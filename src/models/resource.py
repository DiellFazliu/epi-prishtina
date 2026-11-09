"""Persistent resource inventory configuration."""

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint

from src.db.base import Base


class ResourceInventory(Base):
    """Authoritative planning capacity for one resource type."""

    __tablename__ = "resource_inventory"
    __table_args__ = (UniqueConstraint("resource_type", name="uq_resource_inventory_type"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_type = Column(String(50), nullable=False, index=True)
    total_quantity = Column(Integer, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ResourceAllocationRecord(Base):
    """One resource assignment in an optimizer snapshot."""

    __tablename__ = "resource_allocations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), nullable=False, index=True)
    resource_type = Column(String(50), nullable=False, index=True)
    district = Column(String(100), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    cost = Column(Float, nullable=False)
    reason = Column(String(500), nullable=False, default="")
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class HotspotPredictionRecord(Base):
    """One district prediction in an ML snapshot."""

    __tablename__ = "hotspot_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(36), nullable=False, index=True)
    prediction_day = Column(Integer, nullable=False)
    district = Column(String(100), nullable=False, index=True)
    probability = Column(Float, nullable=False)
    risk_level = Column(String(30), nullable=False)
    reports_7d = Column(Integer, nullable=False, default=0)
    confirmed_7d = Column(Integer, nullable=False, default=0)
    population = Column(Integer, nullable=False, default=0)
    generated_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
