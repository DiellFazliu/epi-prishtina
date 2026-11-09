"""
Celery tasks për cleanup dhe mirëmbajtje.
"""

from datetime import datetime, timedelta
from src.workers.celery_app import celery_app
from src.db.base import SessionLocal
from src.models import CitizenReport, ReportStatus


@celery_app.task(name="src.workers.cleanup_tasks.cleanup_old_reports")
def cleanup_old_reports(days: int = 90):
    """
    Fshin raportet e vjetra (> 90 ditë).
    
    Args:
        days: Mosha maksimale në ditë.
    """
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Fshij vetëm raportet e vjetra që janë processed
        deleted = db.query(CitizenReport).filter(
            CitizenReport.reported_at < cutoff,
            CitizenReport.status.in_([
                ReportStatus.VALIDATED,
                ReportStatus.REJECTED,
            ]),
        ).delete(synchronize_session=False)

        db.commit()

        print(f"✓ U fshinë {deleted} raporte të vjetra")
        return {
            "status": "success",
            "deleted": deleted,
            "cutoff": cutoff.isoformat(),
        }

    except Exception as e:
        db.rollback()
        print(f"✗ Gabim: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="src.workers.cleanup_tasks.health_check")
def worker_health_check():
    """Health check i workers."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }