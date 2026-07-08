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
import json
import os
import secrets
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


def handle_api(writer, method: str, raw_path: str, body: bytes):
    path, _, query = raw_path.partition("?")
    if method == "OPTIONS":
        writer.write(("HTTP/1.1 204 No Content\r\n" + CORS_HEADERS + "\r\n").encode())
        return
    if method == "GET" and path == "/api/leaderboard":
        http_json(writer, "200 OK", board_tops())
        return
    if method == "GET" and path == "/api/name-available":
        params = urllib.parse.parse_qs(query)
        name = (params.get("name", [""])[0] or "").strip()[:14]
        http_json(writer, "200 OK", {"available": bool(name) and not name_taken(name)})
        return
    if method == "POST" and path == "/api/score":
        try:
            update_score(json.loads(body.decode("utf-8")))
            http_json(writer, "200 OK", {"ok": True})
        except Exception:
            http_json(writer, "400 Bad Request", {"ok": False})
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
            if 0 < n <= 65536:
                body = await reader.readexactly(n)
            handle_api(writer, method, path, body)
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
