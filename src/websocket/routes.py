"""
WebSocket endpoints.
"""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.websocket.manager import manager
from src.core.security import decode_token
from src.db.base import SessionLocal
from src.models import User


router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
):
    """
    WebSocket endpoint kryesor.

    Lidhja:
        ws://localhost:8000/ws, followed by an authentication message

    Kanale:
        - all: të gjitha eventet
        - reports: raportet e qytetarëve
        - simulation: simulimet
        - hotspots: hotspot-et
        - resources: burimet
    """
    client_id = None
    try:
        await websocket.accept()
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if auth_message.get("action") != "authenticate" or not auth_message.get("token"):
            await websocket.close(code=1008, reason="Authentication required")
            return
        token = auth_message["token"]
        payload = decode_token(token)
        if payload.get("type") != "access" or not payload.get("sub"):
            raise ValueError("Invalid access token")
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == payload["sub"]).first()
            if not user or not user.is_active or user.role.value not in {"admin", "health_worker", "analyst"}:
                await websocket.close(code=1008, reason="Access denied")
                return
            user_id = str(user.id)
        finally:
            db.close()
    except Exception:
        await websocket.close(code=1008, reason="Invalid access token")
        return

    try:
        client_id = await manager.connect(websocket, user_id=user_id)

        # Subscribe në "all" si default
        await manager.subscribe(client_id, "all")

        # Loop për mesazhet
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "subscribe":
                channel = data.get("channel", "all")
                await manager.subscribe(client_id, channel)

            elif action == "unsubscribe":
                channel = data.get("channel")
                if channel:
                    await manager.unsubscribe(client_id, channel)

            elif action == "ping":
                await manager.send_personal_message(
                    client_id,
                    {"type": "pong", "timestamp": data.get("timestamp")},
                )

            elif action == "get_stats":
                stats = manager.get_stats()
                await manager.send_personal_message(
                    client_id,
                    {"type": "stats", "data": stats},
                )

            else:
                await manager.send_personal_message(
                    client_id,
                    {
                        "type": "error",
                        "message": f"Veprim i panjohur: {action}",
                    },
                )

    except WebSocketDisconnect:
        if client_id:
            manager.disconnect(client_id)

    except Exception as e:
        print(f"Gabim WebSocket: {e}")
        if client_id:
            manager.disconnect(client_id)


@router.get("/ws/stats", tags=["WebSocket"])
async def get_websocket_stats():
    """Statistika të lidhjeve WebSocket."""
    return manager.get_stats()
