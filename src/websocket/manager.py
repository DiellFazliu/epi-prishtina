"""
WebSocket Connection Manager.

Menaxhon lidhjet e klientëve dhe shpërndan mesazhet.
"""

import json
import asyncio
from typing import Dict, List, Set, Optional
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState


class ConnectionManager:
    """
    Menaxhon lidhjet WebSocket.

    Struktura:
        - active_connections: Dict[client_id, WebSocket]
        - subscriptions: Dict[channel, Set[client_id]]
    """

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, Set[str]] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> set(client_ids)

    async def connect(
        self,
        websocket: WebSocket,
        client_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Prano një lidhje të re."""
        if not client_id:
            client_id = str(uuid4())

        self.active_connections[client_id] = websocket

        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(client_id)

        # Dërgo mesazhin e mirëseardhjes
        await self.send_personal_message(
            client_id,
            {
                "type": "connected",
                "client_id": client_id,
                "timestamp": datetime.utcnow().isoformat(),
                "message": "Lidhja u pranua",
            },
        )

        print(f"✓ Client i ri: {client_id} (user: {user_id})")
        return client_id

    def disconnect(self, client_id: str):
        """Shkëput një lidhje."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]

        # Hiq nga subscriptions
        for channel in list(self.subscriptions.keys()):
            self.subscriptions[channel].discard(client_id)
            if not self.subscriptions[channel]:
                del self.subscriptions[channel]

        # Hiq nga user_connections
        for user_id, clients in list(self.user_connections.items()):
            clients.discard(client_id)
            if not clients:
                del self.user_connections[user_id]

        print(f"✗ Client u shkëput: {client_id}")

    async def send_personal_message(self, client_id: str, message: dict):
        """Dërgo një mesazh personal."""
        if client_id not in self.active_connections:
            return

        websocket = self.active_connections[client_id]
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
        except Exception as e:
            print(f"Gabim në dërgim: {e}")
            self.disconnect(client_id)

    async def broadcast(self, message: dict, channel: str = "all"):
        """Dërgo një mesazh të gjithë klientëve të një kanali."""
        # Merr klientët e kanalit
        if channel == "all":
            clients = set(self.active_connections.keys())
        else:
            clients = self.subscriptions.get(channel, set())

        if not clients:
            return

        # Dërgo paralelisht
        disconnected = []
        for client_id in clients:
            try:
                await self.send_personal_message(client_id, message)
            except Exception:
                disconnected.append(client_id)

        # Pastro lidhjet e vdekura
        for client_id in disconnected:
            self.disconnect(client_id)

    async def subscribe(self, client_id: str, channel: str):
        """Regjistro një klient në një kanal."""
        if channel not in self.subscriptions:
            self.subscriptions[channel] = set()
        self.subscriptions[channel].add(client_id)

        await self.send_personal_message(
            client_id,
            {
                "type": "subscribed",
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    async def unsubscribe(self, client_id: str, channel: str):
        """Hiq një klient nga një kanal."""
        if channel in self.subscriptions:
            self.subscriptions[channel].discard(client_id)
            if not self.subscriptions[channel]:
                del self.subscriptions[channel]

        await self.send_personal_message(
            client_id,
            {
                "type": "unsubscribed",
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    def get_stats(self) -> dict:
        """Statistika të lidhjeve."""
        return {
            "active_connections": len(self.active_connections),
            "channels": {
                channel: len(clients)
                for channel, clients in self.subscriptions.items()
            },
            "users_connected": len(self.user_connections),
        }


# Instance globale
manager = ConnectionManager()


# ═══ Event Publishers ═══

async def publish_event(event_type: str, data: dict, channel: str = "all"):
    """Publikо një event për të gjithë klientët."""
    message = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    await manager.broadcast(message, channel)


async def publish_report_created(report_data: dict):
    """Njofto për një raport të re."""
    await publish_event("report:created", report_data, channel="reports")


async def publish_report_updated(report_data: dict):
    """Njofto për një raport të përditësuar."""
    await publish_event("report:updated", report_data, channel="reports")


async def publish_simulation_update(data: dict):
    """Njofto për përditësim simulimi."""
    await publish_event("simulation:update", data, channel="simulation")


async def publish_hotspot_alert(data: dict):
    """Njofto për një hotspot të re."""
    await publish_event("hotspot:alert", data, channel="hotspots")


async def publish_resource_allocation(data: dict):
    """Njofto për shpërndarje burimesh."""
    await publish_event("resource:allocated", data, channel="resources")