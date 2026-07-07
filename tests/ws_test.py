"""Smoke test: join two clients to a room, relay a chat, host migration, oversized frame rejection."""
import asyncio, base64, json, os, struct

PORT = 8900

def frame(payload: bytes, opcode=0x1, fin=True) -> bytes:
    header = bytes([(0x80 if fin else 0) | opcode])
    n = len(payload)
    mask = os.urandom(4)
    if n < 126:
        header += bytes([0x80 | n])
    elif n < 65536:
        header += bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        header += bytes([0x80 | 127]) + struct.pack(">Q", n)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    return header + mask + masked

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
    resp = await reader.readuntil(b"\r\n\r\n")
    assert b"101" in resp.split(b"\r\n")[0], resp
    return reader, writer

async def send(writer, obj):
    writer.write(frame(json.dumps(obj).encode()))
    await writer.drain()

async def recv(reader):
    op, payload = await asyncio.wait_for(read_frame(reader), 3)
    return json.loads(payload.decode())

async def main():
    r1, w1 = await connect()
    await send(w1, {"t": "join", "room": "test", "name": "Alice"})
    welcome1 = await recv(r1)
    assert welcome1["t"] == "welcome" and welcome1["host"] is True, welcome1
    print("PASS client1 joined as host")

    r2, w2 = await connect()
    await send(w2, {"t": "join", "room": "test", "name": "Bob"})
    welcome2 = await recv(r2)
    assert welcome2["host"] is False and welcome2["peers"][0]["name"] == "Alice", welcome2
    peer_msg = await recv(r1)
    assert peer_msg["t"] == "peer" and peer_msg["name"] == "Bob", peer_msg
    print("PASS client2 joined, peer broadcast OK")

    await send(w2, {"t": "chat", "text": "hello"})
    chat = await recv(r1)
    assert chat["t"] == "chat" and chat["text"] == "hello" and chat["from"] == welcome2["id"], chat
    print("PASS chat relayed with from-id")

    # oversized frame: header claims 2 MiB -> server must drop the connection
    r3, w3 = await connect()
    header = bytes([0x81, 0x80 | 127]) + struct.pack(">Q", 2 << 20) + os.urandom(4)
    w3.write(header)
    await w3.drain()
    data = await asyncio.wait_for(r3.read(100), 3)
    assert data == b"", "server should close on oversized frame"
    print("PASS oversized frame closes connection")

    # fragmented message: a large 'enemies'-style payload split into 3
    # fragments with a ping interleaved (what proxies like Render's do)
    big = {"t": "enemies", "list": [{"i": i, "x": 1000 + i, "y": 2000 + i, "hp": 50} for i in range(300)]}
    raw = json.dumps(big).encode()
    third = len(raw) // 3
    w2.write(frame(raw[:third], opcode=0x1, fin=False))
    w2.write(frame(b"keepalive", opcode=0x9))                # interleaved ping
    w2.write(frame(raw[third:2 * third], opcode=0x0, fin=False))
    w2.write(frame(raw[2 * third:], opcode=0x0, fin=True))
    await w2.drain()
    pong = await read_frame(r2)
    assert pong[0] == 0xA and pong[1] == b"keepalive", pong
    reassembled = await recv(r1)
    assert reassembled["t"] == "enemies" and len(reassembled["list"]) == 300 \
        and reassembled["list"][299]["x"] == 1299, "fragmented message corrupted"
    print("PASS fragmented message reassembled and relayed intact")

    # host leaves -> Bob promoted
    w1.close()
    msgs = [await recv(r2), await recv(r2)]
    kinds = {m["t"] for m in msgs}
    assert kinds == {"leave", "host"}, msgs
    host_msg = next(m for m in msgs if m["t"] == "host")
    assert host_msg["id"] == welcome2["id"], host_msg
    print("PASS host migration to client2")

asyncio.run(main())
print("ALL WS TESTS PASSED")
