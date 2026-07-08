"""Anti-tamper hardening tests (Stage 1b). Server on 8900. Stdlib only."""
import json
import time
import random
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8900"


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def ok(c, m):
    if not c:
        raise SystemExit("FAIL: " + m)
    print("PASS: " + m)


def player(**kw):
    p = {"id": 1, "clsId": "warrior", "level": 1, "xp": 0, "statPoints": 0,
         "gold": 0, "kills": 0, "bossKills": 0,
         "stats": {"str": 8, "agi": 4, "int": 1, "vit": 8, "luk": 3},
         "inventory": [], "storage": [],
         "equip": {"head": None, "chest": None, "hands": None, "legs": None, "boots": None},
         "quickItems": []}
    p.update(kw)
    return p


def save(token, p):
    return call("POST", "/api/character", {"character": {"v": 1, "players": [p]}}, token=token)


suffix = str(random.randint(10000, 99999))
st, r = call("POST", "/api/register", {"username": "Harden" + suffix, "password": "secret123"})
token = r["token"]

# 1. gear rows clamped to a legit tier/ilvl maximum
st, r = save(token, player(inventory=[{
    "uid": "g1", "key": "sword2h", "kind": "weapon", "slot": "hands", "tier": "common", "ilvl": 1,
    "rows": [{"stat": "atk", "val": 999999}, {"stat": "str", "val": 999999}, {"stat": "hp", "val": 999999}]}]))
rows = {x["stat"]: x["val"] for x in r["character"]["players"][0]["inventory"][0]["rows"]}
# common tier ilvl 1: atk max ~9, str ~5, hp ~45 (+3 tolerance)
ok(rows["atk"] <= 12 and rows["str"] <= 8 and rows["hp"] <= 48,
   "gear rows clamped to a legit common/ilvl-1 roll: " + json.dumps(rows))

# a legit mystic high-ilvl item keeps its big (but bounded) rolls
time.sleep(2.2)
st, r = save(token, player(inventory=[{
    "uid": "g2", "key": "staff", "kind": "weapon", "slot": "hands", "tier": "mystic", "ilvl": 40,
    "rows": [{"stat": "atk", "val": 999}]}]))
mystic_atk = r["character"]["players"][0]["inventory"][0]["rows"][0]["val"]
# ilvl clamped to the real drop max (28); a mystic atk roll there is large but bounded (< the posted 999)
ok(100 <= mystic_atk <= 200, "mystic/high-ilvl item keeps a large but bounded roll: atk=" + str(mystic_atk))
ok(r["character"]["players"][0]["inventory"][0]["ilvl"] <= 28, "item level clamped to the real drop max (28)")

# 2. base-stat point invariant: over-allocated stats are neutralised
time.sleep(2.2)
st, r = save(token, player(level=5, stats={"str": 500, "agi": 500, "int": 500, "vit": 500, "luk": 500}))
p = r["character"]["players"][0]
used = (p["stats"]["str"] - 8) + (p["stats"]["agi"] - 4) + (p["stats"]["int"] - 1) + (p["stats"]["vit"] - 8) + (p["stats"]["luk"] - 3)
avail = 5 * (p["level"] - 1)
ok(used + p["statPoints"] == avail and used <= avail,
   "stat-point invariant enforced (used+unspent == 5*(lvl-1)): used=%d sp=%d avail=%d" % (used, p["statPoints"], avail))

# 3. legit allocation is preserved
time.sleep(2.2)
st, r = save(token, player(level=3, stats={"str": 8 + 10, "agi": 4, "int": 1, "vit": 8, "luk": 3}, statPoints=0))
p = r["character"]["players"][0]
ok(p["stats"]["str"] == 18 and p["statPoints"] == 0,
   "a within-budget allocation is preserved (str 18 at lvl 3)")

# 4. per-save GOLD gain is capped vs the previous save
time.sleep(2.2)
st, r = save(token, player(level=3, gold=10**9))   # try to jump straight to a billion
gold_after = r["character"]["players"][0]["gold"]
ok(gold_after <= 200000, "gold jump capped per save (got %d, not a billion)" % gold_after)

# 5. per-save LEVEL gain is capped vs the previous save
time.sleep(2.2)
st, r = save(token, player(level=500, gold=gold_after))
ok(r["character"]["players"][0]["level"] <= 20, "level jump capped per save (got %d)" % r["character"]["players"][0]["level"])

# 6. xp is clamped below the next-level threshold
time.sleep(2.2)
lvl = r["character"]["players"][0]["level"]
st, r = save(token, player(level=lvl, xp=10**12, gold=r["character"]["players"][0]["gold"]))
ok(r["character"]["players"][0]["xp"] < int(45 * (lvl ** 1.45)), "xp clamped below the next-level threshold")

# 7. write rate limit: a rapid second write is refused
st, r1 = save(token, player(level=lvl))
st2, r2 = save(token, player(level=lvl))   # immediately again
ok(st2 == 429 and r2.get("error") == "rate_limited", "rapid character writes are rate-limited (429)")

# 8. login brute-force limit
u2 = "Brute" + suffix
call("POST", "/api/register", {"username": u2, "password": "rightpass1"})
codes = []
for _ in range(12):
    st, _ = call("POST", "/api/login", {"username": u2, "password": "WRONG"})
    codes.append(st)
ok(codes[-1] == 429, "repeated wrong-password logins get rate-limited (429)")

print("\nALL HARDENING TESTS PASSED")
