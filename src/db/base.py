"""
Konfigurimi i databazës me SQLAlchemy.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from typing import Generator

from src.core.config import settings


# Krijo engine
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# SessionLocal
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base për modelet
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency për FastAPI — jep një session DB dhe e mbyll automatikisht."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()