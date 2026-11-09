"""
Celery Application — konfigurimi i background workers.
"""

from celery import Celery
from celery.schedules import crontab

from src.core.config import settings


# ═══ Krijo aplikacionin Celery ═══

celery_app = Celery(
    "epiprishtina",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "src.workers.simulation_tasks",
        "src.workers.ml_tasks",
        "src.workers.cleanup_tasks",
    ],
)


# ═══ Konfigurimi ═══

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Belgrade",
    enable_utc=True,

    # Performance
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,

    # Results
    result_expires=3600,  # 1 orë
    task_track_started=True,
    task_time_limit=600,  # 10 min max
    task_soft_time_limit=540,  # 9 min soft limit

    # Retry
    task_default_retry_delay=60,  # 1 min
    task_max_retries=3,

    # Beat scheduler
    beat_schedule={
        # ML: rifresko hotspot-et çdo 6 orë
        "update-hotspots": {
            "task": "src.workers.ml_tasks.update_hotspots",
            "schedule": crontab(minute=0, hour="*/6"),
        },
        # Resource: rishpërnda çdo ditë
        "reallocate-resources": {
            "task": "src.workers.simulation_tasks.reallocate_resources",
            "schedule": crontab(minute=0, hour=2),  # 2 AM
        },
        # Cleanup: fshij raportet e vjetra
        "cleanup-old-reports": {
            "task": "src.workers.cleanup_tasks.cleanup_old_reports",
            "schedule": crontab(minute=30, hour=3),  # 3:30 AM
        },
        # Stats: agrego çdo orë
        "aggregate-statistics": {
            "task": "src.workers.simulation_tasks.aggregate_statistics",
            "schedule": crontab(minute=15),  # Çdo orë në :15
        },
    },
)


if __name__ == "__main__":
    celery_app.start()