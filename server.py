#!/usr/bin/env python3
"""
Pixel Realms Online — game + multiplayer relay server.

Pure Python standard library (no pip installs). One process does both:
  - serves the game client over HTTP  (open http://localhost:8765)
  - relays multiplayer JSON messages over WebSocket (RFC 6455)

The first client in a room becomes the HOST and simulates enemies; if
the host leaves, the next client is promoted.

Run:            python server.py
Custom port:    python server.py 9000        (or set the PORT env var)
Cloud deploy:   see README.md — Dockerfile and render.yaml included.
"""

import asyncio
import base64
import functools
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import struct
import sys
import time
import urllib.parse

# unbuffered logging so joins show up immediately, even when piped
print = functools.partial(print, flush=True)

PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
ROOT = os.path.dirname(os.path.abspath(__file__))

STATIC_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".md": "text/plain; charset=utf-8",
}

# room name -> {client_id: Client}, insertion order = host order
rooms: dict = {}

# passwords for private rooms (room name -> password); public channels have none
room_pw: dict = {}

# Each room/shard holds at most this many players; the public world
# auto-shards into channels ("@world-1", "@world-2", ...) as they fill.
ROOM_CAP = 20
PUBLIC_PREFIX = "@world-"


def public_channel() -> str:
    """First public world channel with a free slot (create the next if full)."""
    i = 1
    while True:
        name = f"{PUBLIC_PREFIX}{i}"
        room = rooms.get(name)
        if room is None or len(room) < ROOM_CAP:
            return name
        i += 1


def room_display(name: str) -> dict:
    """How a room is shown to clients: public channel number, or private name."""
    if name.startswith(PUBLIC_PREFIX):
        try:
            ch = int(name[len(PUBLIC_PREFIX):])
        except ValueError:
            ch = 1
        return {"room": "world", "channel": ch, "public": True}
    return {"room": name, "channel": 0, "public": False}

# names currently in use by connected clients (lowercased -> client id),
# so two players can't play under the same name at once
active_names: dict = {}


def name_taken(name: str) -> bool:
    return name.strip().lower() in active_names

# ---------------- Leaderboard ----------------
# Persisted to leaderboard.json. Note: on free cloud tiers the disk
# is ephemeral, so the board resets when the service redeploys.

BOARD_FILE = os.path.join(ROOT, "leaderboard.json")
BOARD_CLASSES = ("warrior", "mage", "archer", "cleric")
board: dict = {}  # player id -> {id, name, cls, level, kills, gold, ts}


def load_board():
    global board
    try:
        with open(BOARD_FILE, encoding="utf-8") as f:
            board = json.load(f)
    except Exception:
        board = {}


def save_board():
    try:
        with open(BOARD_FILE, "w", encoding="utf-8") as f:
            json.dump(board, f, ensure_ascii=False)
    except Exception:
        pass


def update_score(d: dict):
    pid = str(d.get("id", ""))[:24]
    if not pid:
        raise ValueError("missing id")

    def clamp(key, hi):
        try:
            v = int(d.get(key, 0))
        except (TypeError, ValueError):
            v = 0
        return max(0, min(hi, v))

    e = board.get(pid, {"level": 0, "kills": 0, "bosses": 0, "gold": 0})
    e["id"] = pid
    e["name"] = (str(d.get("name", "Hero"))[:16]) or "Hero"
    e["cls"] = d.get("cls") if d.get("cls") in BOARD_CLASSES else "warrior"
    e["ts"] = time.time()
    # keep each player's best marks
    e["level"] = max(e["level"], clamp("level", 999))
    e["kills"] = max(e["kills"], clamp("kills", 10**7))
    e["bosses"] = max(e.get("bosses", 0), clamp("bosses", 10**7))
    e["gold"] = max(e["gold"], clamp("gold", 10**9))
    board[pid] = e
    while len(board) > 500:  # cap: drop the stalest entry
        oldest = min(board, key=lambda k: board[k].get("ts", 0))
        del board[oldest]
    save_board()


def board_tops():
    entries = list(board.values())

    def top(key):
        return sorted(entries, key=lambda e: -e.get(key, 0))[:10]

    return {
        "level": top("level"),
        "kills": top("kills"),
        "bosses": top("bosses"),
        "gold": top("gold"),
    }


# ---------------- Accounts & characters (SQLite) ----------------
# Stage 1a of docs/SCALING.md: player progress moves off the browser's
# localStorage onto server-side accounts, so a character follows a login
# instead of a device. Saved characters are sanitized/clamped on write to
# block the most blatant edits (full server-authoritative economy is a
# later stage). Pure stdlib sqlite3 — swappable for Postgres at Stage 2.

DB_FILE = os.path.join(ROOT, "accounts.db")
PW_ITERS = 200_000
USER_RE = re.compile(r"^[A-Za-z0-9_]{3,16}$")
sessions: dict = {}   # token -> account_id (in-memory; cleared on restart)

ALLOWED_CLS = {"warrior", "mage", "archer", "cleric"}
ALLOWED_TIERS = {"common", "rare", "unique", "legend", "mystic"}
ALLOWED_POTIONS = {"hp", "mp", "spd", "atk", "aspd", "regen", "tele"}
ALLOWED_MATERIALS = {"ore", "key", "stone"}
ALLOWED_ARMOR = {"head", "chest", "gloves", "legs", "boots"}
ALLOWED_WEAPONS = {"sword1h", "sword2h", "staff", "bow", "mace1h", "wand1h", "crossbow"}
ALLOWED_OFFHANDS = {"shield", "book", "quiver"}
ALLOWED_ACCESSORIES = {"ring", "amulet"}
# item.slot values (accessories share the generic 'acc')
ALLOWED_SLOTS = {"head", "chest", "hands", "offhand", "gloves", "legs", "boots", "acc"}
# equip-dict positions (accessories occupy acc1/acc2)
EQUIP_KEYS = ["head", "chest", "hands", "offhand", "gloves", "legs", "boots", "acc1", "acc2"]


def slot_accepts(slot, ci):
    if not ci or ci.get("kind") == "potion":
        return False
    if slot in ("acc1", "acc2"):
        return ci.get("kind") == "accessory"
    return ci.get("slot") == slot
ALLOWED_BASESTATS = {"str", "agi", "int", "vit", "luk"}
ALLOWED_ROWSTATS = {"str", "agi", "int", "vit", "luk", "hp", "mp", "atk", "matk", "crit", "spd"}

# --- anti-tamper reference values (mirror the client's data.js/items.js) ---
POINTS_PER_LEVEL = 5
CLASS_BASE = {
    "warrior": {"str": 8, "agi": 4, "int": 1, "vit": 8, "luk": 3},
    "mage":    {"str": 1, "agi": 3, "int": 10, "vit": 4, "luk": 4},
    "archer":  {"str": 4, "agi": 10, "int": 2, "vit": 4, "luk": 6},
    "cleric":  {"str": 3, "agi": 3, "int": 8, "vit": 7, "luk": 3},
}
TIER_MULT = {"common": 1.0, "rare": 1.5, "unique": 2.1, "legend": 3.0, "mystic": 4.3}
AFFIX_MAX = {"str": 5, "agi": 5, "int": 5, "vit": 5, "luk": 5, "hp": 45, "mp": 22,
             "atk": 9, "matk": 9, "crit": 6, "spd": 9}
MAX_ILVL = 28   # highest item level a real drop reaches (tier-4 boss: 4*4 + 12)
MAX_REFINE = 9  # highest gear refine level (Phase 2b)
# per-save injection caps (legit play never approaches these between ~8-15s saves)
GOLD_GAIN_PER_SAVE = 100_000
LEVEL_GAIN_PER_SAVE = 10
CHAR_WRITE_MIN_GAP = 2.0   # seconds between character writes per account

char_write_at: dict = {}   # account_id -> last write ts (rate limit)
login_attempts: dict = {}  # uname_lc -> [count, window_start] (brute-force limit)


def xp_to_next(level):
    return int(45 * (level ** 1.45))


def row_cap(stat, tier, ilvl):
    """Largest legit rolled value for a stat on this tier/item-level (+ tolerance)."""
    scale = 1 + (max(1, ilvl) - 1) * 0.12
    return int(AFFIX_MAX[stat] * TIER_MULT.get(tier, 1.0) * scale) + 3


def enforce_player_invariants(pl):
    """Force self-consistency a legit client always satisfies, so tampering is
    neutralised: base stats >= class base and within the level's point budget,
    statPoints derived from level, xp below the next-level threshold."""
    cls = pl["clsId"]
    base = CLASS_BASE[cls]
    for k in ALLOWED_BASESTATS:
        pl["stats"][k] = max(base[k], clampi(pl["stats"].get(k, base[k]), 0, 99999))
    used = sum(pl["stats"][k] - base[k] for k in ALLOWED_BASESTATS)
    available = POINTS_PER_LEVEL * (pl["level"] - 1)
    if used > available:            # more points spent than the level grants → cheat
        pl["stats"] = dict(base)
        used = 0
    pl["statPoints"] = max(0, available - used)
    pl["xp"] = clampi(pl.get("xp", 0), 0, max(0, xp_to_next(pl["level"]) - 1))
    return pl


def db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS accounts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            uname_lc TEXT UNIQUE NOT NULL,
            pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL,
            created REAL NOT NULL,
            hero_name TEXT, hero_name_lc TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS characters(
            account_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL, updated REAL NOT NULL)""")
        # hero_name = the public, globally-unique player name (username stays
        # private). Columns added for legacy DBs; unique index enforces it.
        for col in ("hero_name TEXT", "hero_name_lc TEXT"):
            try:
                c.execute("ALTER TABLE accounts ADD COLUMN " + col)
            except sqlite3.OperationalError:
                pass
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_lc "
                  "ON accounts(hero_name_lc) WHERE hero_name_lc IS NOT NULL")


# Public display name: 2–14 chars, no control chars (letters/digits/space/
# Thai/etc. allowed); uniqueness is case-insensitive.
def valid_hero_name(name: str) -> bool:
    name = (name or "").strip()
    return 2 <= len(name) <= 14 and all(ord(ch) >= 0x20 for ch in name)


def hash_pw(pw: str, salt: str = None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), PW_ITERS).hex()
    return h, salt


def clampi(v, lo, hi):
    try:
        v = int(v)
    except (TypeError, ValueError):
        v = lo
    return max(lo, min(hi, v))


def clean_item(o):
    if not isinstance(o, dict):
        return None
    kind = o.get("kind")
    if kind == "potion":
        if o.get("key") not in ALLOWED_POTIONS:
            return None
        return {"key": o["key"], "kind": "potion", "count": clampi(o.get("count", 1), 1, 9999)}
    if kind == "material":
        if o.get("key") not in ALLOWED_MATERIALS:
            return None
        return {"key": o["key"], "kind": "material", "count": clampi(o.get("count", 1), 1, 9999)}
    if kind in ("weapon", "armor", "offhand", "accessory"):
        table = (ALLOWED_WEAPONS if kind == "weapon"
                 else ALLOWED_OFFHANDS if kind == "offhand"
                 else ALLOWED_ACCESSORIES if kind == "accessory" else ALLOWED_ARMOR)
        if o.get("key") not in table or o.get("slot") not in ALLOWED_SLOTS:
            return None
        tier = o.get("tier") if o.get("tier") in ALLOWED_TIERS else "common"
        ilvl = clampi(o.get("ilvl", 1), 1, MAX_ILVL)
        # awakened gear (P5a) may carry a 4th affix row; each row is still
        # clamped to row_cap, so the extra row is a bounded (one-affix) gain.
        awakened = bool(o.get("awakened"))
        max_rows = 4 if awakened else 3
        rows = []
        for r in (o.get("rows") or [])[:max_rows]:
            if isinstance(r, dict) and r.get("stat") in ALLOWED_ROWSTATS:
                # clamp to the strongest a legit drop of this tier/ilvl could roll
                rows.append({"stat": r["stat"], "val": clampi(r.get("val", 0), 0, row_cap(r["stat"], tier, ilvl))})
        # rr = per-item reforge counter (Phase 2a). Rows above are already
        # clamped to row_cap, so a reforge can't inflate stats; rr only needs
        # to persist (it escalates the gold cost) and stay in a sane range.
        # refine = gear upgrade level (Phase 2b); the client applies its stat
        # bonus at equip time, so clamping the stored level 0..MAX_REFINE
        # bounds it (rows themselves are already capped above).
        return {"uid": str(o.get("uid", ""))[:32], "key": o["key"], "kind": kind,
                "slot": o["slot"], "tier": tier, "ilvl": ilvl, "rows": rows,
                "rr": clampi(o.get("rr", 0), 0, 99),
                "refine": clampi(o.get("refine", 0), 0, MAX_REFINE),
                "awakened": 1 if awakened else 0}
    return None


def clean_player(p):
    if not isinstance(p, dict):
        return None
    stats = p.get("stats") or {}
    equip_in = p.get("equip") or {}
    equip = {}
    for slot in EQUIP_KEYS:
        ci = clean_item(equip_in.get(slot))
        equip[slot] = ci if slot_accepts(slot, ci) else None
    quick = [(k if k in ALLOWED_POTIONS else None) for k in (p.get("quickItems") or [])[:3]]
    while len(quick) < 3:
        quick.append(None)
    pl = {
        "id": clampi(p.get("id", 1), 1, 2),
        "clsId": p.get("clsId") if p.get("clsId") in ALLOWED_CLS else "warrior",
        "level": clampi(p.get("level", 1), 1, 999),
        "xp": clampi(p.get("xp", 0), 0, 10**12),
        "statPoints": clampi(p.get("statPoints", 0), 0, 99999),
        "gold": clampi(p.get("gold", 0), 0, 10**9),
        "kills": clampi(p.get("kills", 0), 0, 10**8),
        "bossKills": clampi(p.get("bossKills", 0), 0, 10**8),
        "stats": {k: clampi(stats.get(k, 1), 0, 99999) for k in ALLOWED_BASESTATS},
        "inventory": [ci for ci in (clean_item(x) for x in (p.get("inventory") or [])[:200]) if ci],
        "storage": [ci for ci in (clean_item(x) for x in (p.get("storage") or [])[:200]) if ci],
        "equip": equip,
        "quickItems": quick,
    }
    return enforce_player_invariants(pl)


def apply_save_caps(clean, prev):
    """Cap per-save gold/level increases vs the previously stored character,
    so progress can't be injected in a single write. Skips a fresh character
    (different class = a new game the player legitimately restarted)."""
    if not prev or not isinstance(prev.get("players"), list):
        return clean
    for i, pl in enumerate(clean["players"]):
        pv = prev["players"][i] if i < len(prev["players"]) else None
        if not pv or pv.get("clsId") != pl["clsId"]:
            continue
        pl["gold"] = min(pl["gold"], clampi(pv.get("gold", 0), 0, 10**9) + GOLD_GAIN_PER_SAVE)
        max_lvl = clampi(pv.get("level", 1), 1, 999) + LEVEL_GAIN_PER_SAVE
        if pl["level"] > max_lvl:
            pl["level"] = max_lvl
            enforce_player_invariants(pl)   # keep statPoints/xp consistent
    return clean


def sanitize_character(obj):
    """Clamp a client-sent save to sane bounds; return cleaned dict or None."""
    if not isinstance(obj, dict):
        return None
    players = [cp for cp in (clean_player(x) for x in (obj.get("players") or [])[:2]) if cp]
    if not players:
        return None
    return {"v": 1, "players": players}


def account_of(headers: dict, query: str):
    """Resolve the account id from a Bearer token (header or ?token=)."""
    tok = None
    auth = headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        tok = auth[7:].strip()
    if not tok:
        tok = urllib.parse.parse_qs(query).get("token", [None])[0]
    return sessions.get(tok) if tok else None


class Client:
    def __init__(self, reader, writer):
        self.reader = reader
        self.writer = writer
        self.id = secrets.token_hex(4)
        self.room = None
        self.name = "?"

    def send(self, obj):
        try:
            self.writer.write(encode_frame(json.dumps(obj).encode()))
        except Exception:
            pass


# ---------------- HTTP: game client + leaderboard API ----------------

CORS_HEADERS = (
    "Access-Control-Allow-Origin: *\r\n"
    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
    "Access-Control-Allow-Headers: Content-Type\r\n"
)


def http_json(writer, status: str, obj):
    body = json.dumps(obj, ensure_ascii=False).encode()
    writer.write(
        (
            f"HTTP/1.1 {status}\r\nContent-Type: application/json; charset=utf-8\r\n"
            f"{CORS_HEADERS}Content-Length: {len(body)}\r\n\r\n"
        ).encode()
        + body
    )


# Server-published announcements (patch notes / dev updates). Read from a
# committed JSON file at request time so they can be edited without a code
# change; newest first. Each item: {date, en:{title,body}, th:{title,body}}.
def load_announcements():
    try:
        with open(os.path.join(ROOT, "announcements.json"), encoding="utf-8") as f:
            data = json.load(f)
        items = data.get("items", []) if isinstance(data, dict) else []
        return items if isinstance(items, list) else []
    except Exception:
        return []


# Server-published support info (M0 tip jar + transparent server-cost meter).
# Read from support.json at request time so the owner can update the link and
# the monthly cost/raised numbers without a code change. Fields:
#   link, linkLabel (str), month (str), billUsd, raisedUsd (numbers).
def load_support():
    default = {"link": "", "linkLabel": "", "qr": "", "month": "", "billUsd": 0, "raisedUsd": 0}
    try:
        with open(os.path.join(ROOT, "support.json"), encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return default
        return {
            "link": str(data.get("link", ""))[:300],
            "linkLabel": str(data.get("linkLabel", ""))[:60],
            "qr": str(data.get("qr", ""))[:300],   # QR image URL (e.g. PromptPay)
            "month": str(data.get("month", ""))[:40],
            "billUsd": max(0, float(data.get("billUsd", 0) or 0)),
            "raisedUsd": max(0, float(data.get("raisedUsd", 0) or 0)),
        }
    except Exception:
        return default


def handle_api(writer, method: str, raw_path: str, body: bytes, headers: dict):
    path, _, query = raw_path.partition("?")
    if method == "OPTIONS":
        writer.write(("HTTP/1.1 204 No Content\r\n" + CORS_HEADERS + "\r\n").encode())
        return
    if method == "GET" and path == "/api/leaderboard":
        http_json(writer, "200 OK", board_tops())
        return
    if method == "GET" and path == "/api/announcements":
        http_json(writer, "200 OK", {"items": load_announcements()})
        return
    if method == "GET" and path == "/api/support":
        http_json(writer, "200 OK", load_support())
        return
    if method == "GET" and path == "/api/name-available":
        params = urllib.parse.parse_qs(query)
        name = (params.get("name", [""])[0] or "").strip()[:14]
        http_json(writer, "200 OK", {"available": bool(name) and not name_taken(name)})
        return
    # account-username availability: valid format AND not already registered
    if method == "GET" and path == "/api/username-available":
        params = urllib.parse.parse_qs(query)
        uname = (params.get("username", [""])[0] or "").strip()
        valid = bool(USER_RE.match(uname))
        taken = False
        if valid:
            with db() as c:
                taken = c.execute(
                    "SELECT 1 FROM accounts WHERE uname_lc=?", (uname.lower(),)
                ).fetchone() is not None
        http_json(writer, "200 OK", {"valid": valid, "available": valid and not taken})
        return
    # public player-name availability (globally unique, separate from username)
    if method == "GET" and path == "/api/hero-name-available":
        params = urllib.parse.parse_qs(query)
        name = (params.get("name", [""])[0] or "").strip()
        valid = valid_hero_name(name)
        taken = False
        if valid:
            with db() as c:
                taken = c.execute(
                    "SELECT 1 FROM accounts WHERE hero_name_lc=?", (name.lower(),)
                ).fetchone() is not None
        http_json(writer, "200 OK", {"valid": valid, "available": valid and not taken})
        return
    if method == "POST" and path == "/api/score":
        try:
            update_score(json.loads(body.decode("utf-8")))
            http_json(writer, "200 OK", {"ok": True})
        except Exception:
            http_json(writer, "400 Bad Request", {"ok": False})
        return

    # -------- accounts --------
    if method == "POST" and path in ("/api/register", "/api/login"):
        try:
            d = json.loads(body.decode("utf-8"))
        except Exception:
            http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_json"})
            return
        username = str(d.get("username", "")).strip()
        password = str(d.get("password", ""))
        if path == "/api/register":
            if not USER_RE.match(username):
                http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_username"})
                return
            if not (6 <= len(password) <= 64):
                http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_password"})
                return
            h, salt = hash_pw(password)
            try:
                with db() as c:
                    cur = c.execute(
                        "INSERT INTO accounts(username, uname_lc, pw_hash, pw_salt, created) "
                        "VALUES(?,?,?,?,?)",
                        (username, username.lower(), h, salt, time.time()),
                    )
                    acc_id = cur.lastrowid
            except sqlite3.IntegrityError:
                http_json(writer, "409 Conflict", {"ok": False, "error": "taken"})
                return
            tok = secrets.token_hex(24)
            sessions[tok] = acc_id
            http_json(writer, "200 OK", {"ok": True, "token": tok, "username": username, "hero_name": None})
            print(f"[acct] registered '{username}' (#{acc_id})")
            return
        # login — throttle password guessing per username
        lc = username.lower()
        rec = login_attempts.get(lc)
        tnow = time.time()
        if not rec or tnow - rec[1] > 60:
            login_attempts[lc] = [0, tnow]
            rec = login_attempts[lc]
        if rec[0] >= 10:
            http_json(writer, "429 Too Many Requests", {"ok": False, "error": "too_many"})
            return
        with db() as c:
            row = c.execute("SELECT * FROM accounts WHERE uname_lc=?", (lc,)).fetchone()
        if not row or not hmac.compare_digest(hash_pw(password, row["pw_salt"])[0], row["pw_hash"]):
            rec[0] += 1   # count only failures toward the limit
            http_json(writer, "401 Unauthorized", {"ok": False, "error": "bad_credentials"})
            return
        login_attempts.pop(lc, None)   # success clears the counter
        tok = secrets.token_hex(24)
        sessions[tok] = row["id"]
        http_json(writer, "200 OK", {"ok": True, "token": tok, "username": row["username"],
                                     "hero_name": row["hero_name"]})
        return

    if method == "POST" and path == "/api/logout":
        auth = headers.get("authorization", "")
        tok = auth[7:].strip() if auth.lower().startswith("bearer ") else None
        if tok:
            sessions.pop(tok, None)
        http_json(writer, "200 OK", {"ok": True})
        return

    # claim the account's public player name (set once at character creation)
    if method == "POST" and path == "/api/hero-name":
        acc_id = account_of(headers, query)
        if not acc_id:
            http_json(writer, "401 Unauthorized", {"ok": False, "error": "unauthorized"})
            return
        try:
            name = str(json.loads(body.decode("utf-8")).get("name", "")).strip()
        except Exception:
            name = ""
        if not valid_hero_name(name):
            http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_name"})
            return
        with db() as c:
            row = c.execute("SELECT hero_name FROM accounts WHERE id=?", (acc_id,)).fetchone()
            if row and row["hero_name"]:
                # already named — the name is fixed; just echo it back
                http_json(writer, "200 OK", {"ok": True, "name": row["hero_name"], "already": True})
                return
            try:
                c.execute("UPDATE accounts SET hero_name=?, hero_name_lc=? WHERE id=?",
                          (name, name.lower(), acc_id))
            except sqlite3.IntegrityError:
                http_json(writer, "409 Conflict", {"ok": False, "error": "taken"})
                return
        http_json(writer, "200 OK", {"ok": True, "name": name})
        return

    # -------- character (auth required) --------
    if path == "/api/character":
        acc_id = account_of(headers, query)
        if not acc_id:
            http_json(writer, "401 Unauthorized", {"ok": False, "error": "unauthorized"})
            return
        if method == "GET":
            with db() as c:
                row = c.execute("SELECT data FROM characters WHERE account_id=?", (acc_id,)).fetchone()
                acc = c.execute("SELECT hero_name FROM accounts WHERE id=?", (acc_id,)).fetchone()
            char = json.loads(row["data"]) if row else None
            http_json(writer, "200 OK", {"ok": True, "character": char,
                                         "hero_name": acc["hero_name"] if acc else None})
            return
        if method == "POST":
            now = time.time()
            if now - char_write_at.get(acc_id, 0) < CHAR_WRITE_MIN_GAP:
                http_json(writer, "429 Too Many Requests", {"ok": False, "error": "rate_limited"})
                return
            try:
                d = json.loads(body.decode("utf-8"))
            except Exception:
                http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_json"})
                return
            clean = sanitize_character(d.get("character") if isinstance(d, dict) and "character" in d else d)
            if clean is None:
                http_json(writer, "400 Bad Request", {"ok": False, "error": "bad_character"})
                return
            with db() as c:
                row = c.execute("SELECT data FROM characters WHERE account_id=?", (acc_id,)).fetchone()
                prev = json.loads(row["data"]) if row else None
                clean = apply_save_caps(clean, prev)   # cap per-save gold/level injection
                c.execute(
                    "INSERT INTO characters(account_id, data, updated) VALUES(?,?,?) "
                    "ON CONFLICT(account_id) DO UPDATE SET data=excluded.data, updated=excluded.updated",
                    (acc_id, json.dumps(clean, ensure_ascii=False), now),
                )
            char_write_at[acc_id] = now
            http_json(writer, "200 OK", {"ok": True, "character": clean})
            return

    http_json(writer, "404 Not Found", {"ok": False})


def serve_static(writer, path: str):
    if path in ("/", ""):
        path = "/index.html"
    path = path.split("?", 1)[0]
    safe = os.path.normpath(path.lstrip("/")).replace("\\", "/")
    ext = os.path.splitext(safe)[1].lower()
    full = os.path.join(ROOT, safe)
    if (
        safe.startswith("..")
        or os.path.isabs(safe)
        or ext not in STATIC_TYPES
        or not os.path.isfile(full)
    ):
        body = b"404 Not Found"
        writer.write(
            b"HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n"
            b"Content-Length: %d\r\n\r\n%s" % (len(body), body)
        )
        return
    with open(full, "rb") as f:
        body = f.read()
    writer.write(
        (
            "HTTP/1.1 200 OK\r\n"
            f"Content-Type: {STATIC_TYPES[ext]}\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Cache-Control: no-cache\r\n\r\n"
        ).encode()
        + body
    )


# ---------------- WebSocket plumbing ----------------

async def handshake(reader, writer) -> bool:
    """Upgrade to WebSocket, or answer as a static file server."""
    try:
        raw = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=10)
    except Exception:
        return False
    lines = raw.decode("latin1").split("\r\n")
    request_line = lines[0].split(" ")
    method = request_line[0].upper() if request_line else "GET"
    path = request_line[1] if len(request_line) > 1 else "/"
    headers = {}
    for line in lines[1:]:
        if ": " in line:
            k, v = line.split(": ", 1)
            headers[k.lower()] = v.strip()

    key = headers.get("sec-websocket-key")
    if not key:
        if path.split("?", 1)[0].startswith("/api/"):
            body = b""
            try:
                n = int(headers.get("content-length", 0) or 0)
            except ValueError:
                n = 0
            if 0 < n <= 262144:   # room for a full inventory/storage character blob
                body = await reader.readexactly(n)
            handle_api(writer, method, path, body, headers)
        else:
            serve_static(writer, path)
        await writer.drain()
        return False

    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    writer.write(
        (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
        ).encode()
    )
    await writer.drain()
    return True


MAX_FRAME = 1 << 20  # 1 MiB — game messages are tiny; refuse anything huge


async def read_message(reader, writer):
    """Return (opcode, payload) for the next complete message.

    Reassembles fragmented messages (proxies like Render's split large
    frames — dropping fragments silently loses enemy snapshots) and
    answers pings inline. Returns opcode 0x8 on close.
    """
    opcode = None
    buf = b""
    while True:
        b1, b2 = await reader.readexactly(2)
        fin = b1 & 0x80
        op = b1 & 0x0F
        masked = b2 & 0x80
        length = b2 & 0x7F
        if length == 126:
            (length,) = struct.unpack(">H", await reader.readexactly(2))
        elif length == 127:
            (length,) = struct.unpack(">Q", await reader.readexactly(8))
        if len(buf) + length > MAX_FRAME:
            raise ConnectionError("frame too large")
        mask = await reader.readexactly(4) if masked else None
        payload = await reader.readexactly(length) if length else b""
        if mask:
            payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        if op == 0x8:  # close
            return op, payload
        if op == 0x9:  # ping -> pong (may interleave with fragments)
            writer.write(encode_frame(payload, opcode=0xA))
            continue
        if op == 0xA:  # pong: ignore
            continue
        if op != 0x0:            # first (or only) fragment of a message
            opcode, buf = op, payload
        elif opcode is None:
            continue             # stray continuation: drop
        else:                    # continuation fragment
            buf += payload
        if fin:
            return opcode, buf


def encode_frame(payload: bytes, opcode=0x1) -> bytes:
    header = bytes([0x80 | opcode])
    n = len(payload)
    if n < 126:
        header += bytes([n])
    elif n < 65536:
        header += bytes([126]) + struct.pack(">H", n)
    else:
        header += bytes([127]) + struct.pack(">Q", n)
    return header + payload


# ---------------- Room logic ----------------

def broadcast(room: dict, obj, skip_id=None):
    for cid, c in room.items():
        if cid != skip_id:
            c.send(obj)


def host_id(room: dict):
    return next(iter(room), None)


def join_room(client: Client, req_room: str, name: str, password: str, public: bool):
    name = (name or "Hero")[:14]
    # reject duplicate names so no two players share one at once
    if name_taken(name):
        client.send({"t": "name_taken", "name": name})
        print(f"[!] name '{name}' rejected for {client.id} (already in use)")
        return

    if public:
        # shared world: drop into the first channel with a free slot
        room_name = public_channel()
    else:
        # private room by name; '@' prefix is reserved for public channels
        room_name = (req_room or "realm-1").lstrip("@")[:24] or "realm-1"
        existing = rooms.get(room_name)
        if existing is None:
            # first person in — they set the room's password
            room_pw[room_name] = password
        else:
            if len(existing) >= ROOM_CAP:
                client.send({"t": "room_full", "room": room_name})
                print(f"[!] room '{room_name}' full — rejected {client.id}")
                return
            if room_pw.get(room_name, "") != password:
                client.send({"t": "wrong_password", "room": room_name})
                print(f"[!] wrong password for '{room_name}' — rejected {client.id}")
                return

    room = rooms.setdefault(room_name, {})
    if len(room) >= ROOM_CAP:                     # safety net (races/edges)
        client.send({"t": "room_full", "room": room_name})
        return

    client.room = room_name
    client.name = name
    active_names[name.lower()] = client.id
    is_host = len(room) == 0
    client.send(
        {
            "t": "welcome",
            "id": client.id,
            "host": is_host,
            "peers": [{"id": c.id, "name": c.name} for c in room.values()],
            **room_display(room_name),
        }
    )
    broadcast(room, {"t": "peer", "id": client.id, "name": client.name})
    room[client.id] = client
    print(f"[+] {client.name} ({client.id}) joined '{room_name}' "
          f"({len(room)}/{ROOM_CAP})" + (" as HOST" if is_host else ""))


def leave_room(client: Client):
    # release the client's reserved name
    key = (client.name or "").lower()
    if active_names.get(key) == client.id:
        del active_names[key]
    room = rooms.get(client.room)
    if not room or client.id not in room:
        return
    was_host = host_id(room) == client.id
    del room[client.id]
    print(f"[-] {client.name} ({client.id}) left room '{client.room}'")
    if not room:
        del rooms[client.room]
        room_pw.pop(client.room, None)   # forget an emptied private room's password
        return
    broadcast(room, {"t": "leave", "id": client.id, "name": client.name})
    if was_host:
        new_host = host_id(room)
        broadcast(room, {"t": "host", "id": new_host})
        print(f"[*] room '{client.room}': host migrated to {new_host}")


async def handle_client(reader, writer):
    if not await handshake(reader, writer):
        writer.close()
        return
    client = Client(reader, writer)
    try:
        while True:
            opcode, payload = await read_message(reader, writer)
            if opcode == 0x8:  # close
                break
            if opcode != 0x1:  # only text messages carry game data
                continue
            try:
                msg = json.loads(payload.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                continue

            if msg.get("t") == "join":
                if client.room is None:
                    join_room(
                        client,
                        str(msg.get("room", "") or "")[:24],
                        str(msg.get("name", "")),
                        str(msg.get("password", "") or "")[:32],
                        bool(msg.get("public")),
                    )
                continue

            # relay everything else to the rest of the room
            room = rooms.get(client.room)
            if room:
                msg["from"] = client.id
                broadcast(room, msg, skip_id=client.id)
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        leave_room(client)
        try:
            writer.close()
        except Exception:
            pass


async def main():
    load_board()
    init_db()
    server = await asyncio.start_server(handle_client, "0.0.0.0", PORT)
    print("=" * 52)
    print("  Pixel Realms Online - game & relay server")
    print(f"  Play at      http://localhost:{PORT}")
    print(f"  Multiplayer  ws://<this-machine's-ip>:{PORT}")
    print("=" * 52)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
