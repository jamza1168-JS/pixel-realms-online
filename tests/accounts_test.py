"""Accounts + server-side character store tests. Server on 8900.
Uses only the Python stdlib (urllib) to hit the HTTP API."""
import json
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


import random
suffix = str(random.randint(1000, 9999))
USER = "Hero_" + suffix

# 1. register
st, r = call("POST", "/api/register", {"username": USER, "password": "secret123"})
ok(st == 200 and r["ok"] and r["token"], "register returns a token")
token = r["token"]

# 2. duplicate username rejected
st, r = call("POST", "/api/register", {"username": USER.upper(), "password": "another1"})
ok(st == 409 and r.get("error") == "taken", "duplicate username (case-insensitive) rejected")

# 3. bad username / short password rejected
st, r = call("POST", "/api/register", {"username": "x", "password": "secret123"})
ok(st == 400 and r.get("error") == "bad_username", "too-short username rejected")
st, r = call("POST", "/api/register", {"username": "Valid_" + suffix, "password": "123"})
ok(st == 400 and r.get("error") == "bad_password", "too-short password rejected")

# 4. login: wrong password fails, right password works
st, r = call("POST", "/api/login", {"username": USER, "password": "wrongpass"})
ok(st == 401 and r.get("error") == "bad_credentials", "wrong password fails login")
st, r = call("POST", "/api/login", {"username": USER, "password": "secret123"})
ok(st == 200 and r["ok"] and r["token"], "correct password logs in")
token = r["token"]

# 5. character requires auth
st, r = call("GET", "/api/character")
ok(st == 401, "character GET without token is unauthorized")

# 6. no character yet
st, r = call("GET", "/api/character", token=token)
ok(st == 200 and r["character"] is None, "new account has no character")

# 7. save a character, then load it back
char = {"v": 1, "players": [{
    "id": 1, "clsId": "archer", "level": 12, "xp": 50, "statPoints": 5,
    "gold": 300, "kills": 40, "bossKills": 1,
    "stats": {"str": 4, "agi": 20, "int": 2, "vit": 4, "luk": 6},
    "inventory": [{"key": "hp", "kind": "potion", "count": 5},
                  {"uid": "w1", "key": "bow", "kind": "weapon", "slot": "hands",
                   "tier": "rare", "ilvl": 8, "rows": [{"stat": "agi", "val": 7}]}],
    "storage": [], "equip": {"head": None, "chest": None, "hands": None, "legs": None, "boots": None},
    "quickItems": ["hp", None, None]}]}
st, r = call("POST", "/api/character", {"character": char}, token=token)
ok(st == 200 and r["ok"], "character saves with a valid token")
st, r = call("GET", "/api/character", token=token)
ok(st == 200 and r["character"]["players"][0]["level"] == 12
   and r["character"]["players"][0]["gold"] == 300, "character loads back with the same data")

# 8. sanitization clamps a blatantly cheated save
cheat = {"v": 1, "players": [{
    "id": 1, "clsId": "wizard_hacker", "level": 999999, "gold": 9 * 10**18,
    "statPoints": 10**9, "stats": {"str": 10**9, "agi": 5, "int": 5, "vit": 5, "luk": 5},
    "inventory": [{"key": "godsword", "kind": "weapon", "slot": "hands", "tier": "over9000",
                   "ilvl": 10**9, "rows": [{"stat": "atk", "val": 10**18},
                                           {"stat": "hp", "val": 1}, {"stat": "hp", "val": 1},
                                           {"stat": "hp", "val": 1}]}],
    "storage": [], "equip": {}, "quickItems": []}]}
st, r = call("POST", "/api/character", {"character": cheat}, token=token)
p = r["character"]["players"][0]
ok(st == 200, "cheated save is accepted but sanitized")
ok(p["clsId"] == "warrior", "invalid class clamped to a real one")
ok(p["level"] <= 999, "absurd level clamped to <= 999")
ok(p["gold"] <= 10**9, "absurd gold clamped")
ok(p["stats"]["str"] <= 99999, "absurd stat clamped")
ok(len(p["inventory"]) == 0, "invalid item (bad key/tier) dropped")

# 9. logout invalidates the token
st, r = call("POST", "/api/logout", token=token)
ok(st == 200, "logout ok")
st, r = call("GET", "/api/character", token=token)
ok(st == 401, "token no longer works after logout")

print("\nALL ACCOUNT TESTS PASSED")
