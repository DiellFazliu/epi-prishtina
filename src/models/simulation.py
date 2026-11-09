"""
Modelet për Simulim dhe Skenarë.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum, JSON, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from src.db.base import Base


class SimulationStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class ScenarioType(str, enum.Enum):
    NO_INTERVENTION = "no_intervention"
    PARTIAL_MEASURES = "partial_measures"
    AI_OPTIMIZED = "ai_optimized"
    CUSTOM = "custom"


class Simulation(Base):
    """Një simulim i plotë."""
    __tablename__ = "simulations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    scenario_type = Column(Enum(ScenarioType), nullable=False)
    parameters = Column(JSON, nullable=False)
    
    status = Column(Enum(SimulationStatus), default=SimulationStatus.PENDING, index=True)
    current_day = Column(Integer, default=0)
    total_days = Column(Integer, default=90)
    
    peak_cases = Column(Integer, nullable=True)
    peak_day = Column(Integer, nullable=True)
    total_infected = Column(Integer, nullable=True)
    total_deaths = Column(Integer, nullable=True)
    hospital_overload = Column(Float, nullable=True)
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    daily_stats = relationship("SimulationDay", back_populates="simulation", cascade="all, delete-orphan")
    interventions = relationship("Intervention", back_populates="simulation")
    
    def __repr__(self):
        return f"<Simulation {self.name} ({self.status.value})>"


class SimulationDay(Base):
    """Statistika ditore e një simulimi."""
    __tablename__ = "simulation_days"
    __table_args__ = (
        UniqueConstraint("simulation_id", "day", name="uq_simulation_day"),
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_id = Column(UUID(as_uuid=True), ForeignKey("simulations.id"), nullable=False, index=True)
    
    day = Column(Integer, nullable=False, index=True)
    
    susceptible = Column(Integer, default=0)
    exposed = Column(Integer, default=0)
    infectious_mild = Column(Integer, default=0)
    infectious_severe = Column(Integer, default=0)
    hospitalized = Column(Integer, default=0)
    icu = Column(Integer, default=0)
    recovered = Column(Integer, default=0)
    dead = Column(Integer, default=0)
    
    real_active = Column(Integer, default=0)
    real_deaths = Column(Integer, default=0)
    
    rt = Column(Float, nullable=True)
    new_cases = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    simulation = relationship("Simulation", back_populates="daily_stats")


class Intervention(Base):
    """Ndërhyrje e aplikuar në një simulim."""
    __tablename__ = "interventions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    simulation_id = Column(UUID(as_uuid=True), ForeignKey("simulations.id"), nullable=False)
    
    intervention_type = Column(String(100), nullable=False)
    target_district = Column(String(100), nullable=True)
    intensity = Column(Float, default=1.0)
    description = Column(Text, nullable=True)
    
    started_day = Column(Integer, nullable=False)
    ended_day = Column(Integer, nullable=True)
    expected_impact = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    simulation = relationship("Simulation", back_populates="interventions")