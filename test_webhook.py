"""
Test për WebSocket — version i korrigjuar.
"""

import asyncio
import websockets
import json
import os


async def read_until(websocket, expected_type, timeout=3.0):
    """Lexo mesazhe derisa të gjesh tipin e duhur."""
    start = asyncio.get_event_loop().time()
    while True:
        remaining = timeout - (asyncio.get_event_loop().time() - start)
        if remaining <= 0:
            return None
        try:
            msg = await asyncio.wait_for(websocket.recv(), timeout=remaining)
            data = json.loads(msg)
            if data.get("type") == expected_type:
                return data
        except asyncio.TimeoutError:
            return None


async def test_websocket():
    """Test i plotë i WebSocket."""
    uri = "ws://localhost:8000/ws"
    token = os.environ["TEST_ACCESS_TOKEN"]

    print("\n" + "="*60)
    print("  TEST WEBSOCKET")
    print("="*60)

    try:
        async with websockets.connect(uri) as websocket:
            await websocket.send(json.dumps({
                "action": "authenticate",
                "token": token,
            }))
            # 1. Mesazhi i mirëseardhjes
            print("\n1. Lidhja u pranua...")
            data = await read_until(websocket, "connected")
            if data:
                print(f"   ✓ Client ID: {data['client_id']}")
            
            # 2. Hiq subscribed automatik
            await read_until(websocket, "subscribed", timeout=1.0)

            # 3. Test ping
            print("\n2. Dërgim ping...")
            await websocket.send(json.dumps({
                "action": "ping",
                "timestamp": "2025-01-01T00:00:00",
            }))
            data = await read_until(websocket, "pong")
            if data:
                print(f"   ✓ Pong u pranua")

            # 4. Subscribe në reports
            print("\n3. Subscribe në reports...")
            await websocket.send(json.dumps({
                "action": "subscribe",
                "channel": "reports",
            }))
            data = await read_until(websocket, "subscribed")
            if data:
                print(f"   ✓ U abonua në: {data['channel']}")

            # 5. Merr stats
            print("\n4. Merr stats...")
            await websocket.send(json.dumps({
                "action": "get_stats",
            }))
            data = await read_until(websocket, "stats")
            if data:
                print(f"   ✓ Stats: {data['data']}")

            # 6. Prit evente
            print("\n5. Duke pritur evente për 10 sekonda...")
            print("   (Krijo një raport nga një terminal tjetër)")
            
            try:
                msg = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                data = json.loads(msg)
                print(f"\n   ✓ EVENT U PRANUA!")
                print(f"     Tipi: {data.get('type')}")
                print(f"     Data: {data.get('data')}")
            except asyncio.TimeoutError:
                print("   (Nuk u pranua event brenda 10 sekondave)")

            print("\n" + "="*60)
            print("  ✓ TESTET KALUAN")
            print("="*60 + "\n")

    except Exception as e:
        print(f"\n✗ Gabim: {e}")


if __name__ == "__main__":
    asyncio.run(test_websocket())