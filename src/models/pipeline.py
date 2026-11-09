import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, JSON, String
from sqlalchemy.dialects.postgresql import UUID

from src.db.base import Base


class PipelineSnapshot(Base):
    """Durable recommendation and comparison snapshots."""

    __tablename__ = "pipeline_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_type = Column(String(30), nullable=False, index=True)
    pipeline_day = Column(String(30), nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
