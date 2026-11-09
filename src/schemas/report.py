"""
Pydantic schemas për Raportet e Qytetarëve.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class ReportBase(BaseModel):
    report_type: str = Field(..., pattern="^(symptom|confirmed)$")
    symptoms: List[str] = Field(default_factory=list)
    severity: int = Field(1, ge=1, le=5)
    notes: Optional[str] = None
    district: str = Field(..., min_length=2, max_length=100)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    age_range: Optional[str] = Field(None, pattern="^(0-17|18-29|30-44|45-59|60\\+)$")
    gender: Optional[str] = Field(None, pattern="^(M|F|O)$")

    @field_validator("symptoms")
    @classmethod
    def validate_symptoms(cls, v: List[str]) -> List[str]:
        valid = {"fever", "cough", "fatigue", "loss_of_smell", "loss_of_taste",
                 "sore_throat", "headache", "muscle_pain", "shortness_of_breath", "diarrhea"}
        for s in v:
            if s not in valid:
                raise ValueError(f"Simptomë e pavlefshme: {s}")
        return v


class ReportCreate(ReportBase):
    """Schema për krijim raporti."""
    pass


class ReportUpdate(BaseModel):
    """Schema për përditësim raporti (vetëm admin/health_worker)."""
    status: Optional[str] = Field(None, pattern="^(pending|validated|rejected|flagged)$")
    validation_notes: Optional[str] = None


class ReportResponse(ReportBase):
    """Schema për përgjigje."""
    id: UUID
    user_id: Optional[UUID]
    status: str
    reliability_score: float
    source: str
    reported_at: datetime
    created_at: datetime
    validation_notes: Optional[str]

    class Config:
        from_attributes = True


class ReportStatistics(BaseModel):
    """Statistika për raportet."""
    total: int
    symptom: int
    confirmed: int
    pending: int
    validated: int
    rejected: int
    avg_reliability: float
    by_district: dict