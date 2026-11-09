"""
Konfigurimi i aplikacionit EpiPrishtina.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ═══ App ═══
    APP_NAME: str = "EpiPrishtina"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # ═══ Database ═══
    DATABASE_URL: str
    DATABASE_ECHO: bool = False
    
    # ═══ Redis ═══
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_PUBSUB_CHANNEL: str = "epiprishtina:updates"
    
    # ═══ JWT ═══
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 orë
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # ═══ CORS ═══
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://localhost:8080",
    ]
    
    # ═══ Simulation ═══
    SIMULATION_INTERVAL_SECONDS: int = 10
    DEFAULT_SCALING_FACTOR: float = 10.0
    DEFAULT_SIMULATION_DAYS: int = 90
    
    # ═══ Celery ═══
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


# Instance globale
settings = Settings()