"""
Modelet për Raportet e Qytetarëve.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from src.db.base import Base


class ReportType(str, enum.Enum):
    SYMPTOM = "symptom"
    CONFIRMED = "confirmed"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    REJECTED = "rejected"
    FLAGGED = "flagged"


class CitizenReport(Base):
    """Raport i një qytetari."""
    __tablename__ = "citizen_reports"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Përmbajtja
    report_type = Column(Enum(ReportType), nullable=False)
    symptoms = Column(JSON, default=list)
    severity = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    
    # Lokacioni
    district = Column(String(100), nullable=False, index=True)
    lat = Column(Float, nullable=True)
    lon = Column(Float, nullable=True)
    
    # Demografia
    age_range = Column(String(20), nullable=True)
    gender = Column(String(10), nullable=True)
    
    # Vlerësim
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING, index=True)
    reliability_score = Column(Float, default=0.5)
    validation_notes = Column(Text, nullable=True)
    
    # Metadata
    source = Column(String(50), default="web")
    ip_hash = Column(String(64), nullable=True)
    device_hash = Column(String(64), nullable=True)
    
    # Timestamps
    reported_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="reports")
    
    def __repr__(self):
        return f"<Report {self.id} in {self.district}>"