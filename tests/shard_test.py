"""Sharding (cap 20) + private-room password tests. Server on 8900."""
import asyncio, base64, json, os, struct

PORT = 8900

def frame(payload: bytes) -> bytes:
    header = bytes([0x81])
    n = len(payload)
    mask = os.urandom(4)
    if n < 126:
        header += bytes([0x80 | n])
    elif n < 65536:
        header += bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        header += bytes([0x80 | 127]) + struct.pack(">Q", n)
    return header + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

async def read_frame(reader):
    b1, b2 = await reader.readexactly(2)
    length = b2 & 0x7F
    if length == 126:
        (length,) = struct.unpack(">H", await reader.readexactly(2))
    elif length == 127:
        (length,) = struct.unpack(">Q", await reader.readexactly(8))
    payload = await reader.readexactly(length) if length else b""
    return b1 & 0x0F, payload

async def connect():
    reader, writer = await asyncio.open_connection("127.0.0.1", PORT)
    key = base64.b64encode(os.urandom(16)).decode()
    writer.write((f"GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                  f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
    await writer.drain()
    assert b"101" in (await reader.readuntil(b"\r\n\r\n")).split(b"\r\n")[0]
    return reader, writer

async def join(name, room="", password="", public=False):
    r, w = await connect()
    w.write(frame(json.dumps({"t": "join", "name": name, "room": room,
                              "password": password, "public": public}).encode()))
    await w.drain()
    _, payload = await asyncio.wait_for(read_frame(r), 4)
    return r, w, json.loads(payload.decode())

def close(*conns):
    for r, w in conns:
        try: w.close()
        except Exception: pass

async def main():
    # ---- 1. Public world shards at 20 players/channel ----
    conns, welcomes = [], []
    for i in range(21):
        r, w, m = await join(f"pub{i}", public=True)
        conns.append((r, w)); welcomes.append(m)
    assert all(m["public"] and m["room"] == "world" for m in welcomes), "public welcomes"
    ch1 = [m for m in welcomes[:20] if m["channel"] == 1]
    assert len(ch1) == 20, f"first 20 in channel 1, got {[m['channel'] for m in welcomes[:20]]}"
    assert welcomes[20]["channel"] == 2, f"21st player rolls to channel 2, got {welcomes[20]['channel']}"
    print("PASS public world: 20 players fill channel 1, 21st opens channel 2")
    assert welcomes[0]["host"] and not welcomes[1]["host"], "first player in a channel is host"
    print("PASS first player in a channel is the host")
    close(*conns)
    await asyncio.sleep(0.4)   # let the server free names/rooms

    # ---- 2. Private room password ----
    ra, wa, ma = await join("owner", room="secret", password="abc")
    assert (not ma["public"]) and ma["room"] == "secret" and ma["host"], "owner creates private room"
    print("PASS private room created (owner is host)")
    rb, wb, mb = await join("friend", room="secret", password="abc")
    assert mb.get("t") != "wrong_password" and mb.get("room") == "secret", "correct password joins"
    print("PASS correct password joins the private room")
    rc, wc, mc = await join("intruder", room="secret", password="nope")
    assert mc.get("t") == "wrong_password", f"wrong password rejected, got {mc}"
    print("PASS wrong password is rejected")
    close((ra, wa), (rb, wb), (rc, wc))
    await asyncio.sleep(0.4)

    # ---- 3. Password is forgotten once the room empties ----
    r1, w1, m1 = await join("owner2", room="secret", password="different-now")
    assert m1.get("room") == "secret" and m1.get("host"), "emptied room can be recreated with a new password"
    print("PASS emptied private room forgets its old password")
    close((r1, w1))
    await asyncio.sleep(0.4)

    # ---- 4. A named room is full at 20 ----
    conns = []
    for i in range(20):
        r, w, m = await join(f"full{i}", room="party", password="p")
        conns.append((r, w))
    rx, wx, mx = await join("straggler", room="party", password="p")
    assert mx.get("t") == "room_full", f"21st into a full room is rejected, got {mx}"
    print("PASS a private room is capped at 20 (21st gets room_full)")
    close(*conns, (rx, wx))

    print("\nALL SHARD/PASSWORD TESTS PASSED")

asyncio.run(main())
