"""Persistent ambulance dispatch records."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from src.db.base import Base


class AmbulanceDispatch(Base):
    """One algorithmic assignment of an ambulance to an emergency location."""

    __tablename__ = "ambulance_dispatches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ambulance_id = Column(Integer, nullable=False, index=True)
    hospital = Column(String(255), nullable=False)
    district = Column(String(100), nullable=False, index=True)
    emergency_lat = Column(Float, nullable=False)
    emergency_lon = Column(Float, nullable=False)
    severity = Column(Integer, nullable=False)
    distance_km = Column(Float, nullable=False)
    time_minutes = Column(Float, nullable=False)
    cost = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="en_route", index=True)
    algorithm = Column(String(50), nullable=False, default="hungarian+astar")
    route = Column(JSON, nullable=True)
    dispatched_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

