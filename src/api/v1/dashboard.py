"""
Dashboard endpoints — statistika të plota.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta

from src.db.base import get_db
from src.models import User, CitizenReport, ReportStatus, ResourceAllocationRecord, ResourceInventory
from src.services.live_simulation import live_pipeline, live_simulation
from src.core.security import require_analyst


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _dashboard_summary(db: Session) -> dict:
    """Build dashboard statistics without relying on FastAPI dependency injection."""
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()

    total_reports = db.query(CitizenReport).count()
    recent_reports = db.query(CitizenReport).filter(
        CitizenReport.reported_at >= datetime.utcnow() - timedelta(hours=24)
    ).count()

    pending = db.query(CitizenReport).filter(
        CitizenReport.status == ReportStatus.PENDING
    ).count()

    by_district = db.query(
        CitizenReport.district,
        func.count(CitizenReport.id).label("count"),
    ).filter(CitizenReport.status.in_([ReportStatus.PENDING, ReportStatus.VALIDATED])).group_by(CitizenReport.district).order_by(
        func.count(CitizenReport.id).desc()
    ).limit(10).all()

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "users": {
            "total": total_users,
            "active": active_users,
        },
        "reports": {
            "total": total_reports,
            "last_24h": recent_reports,
            "pending": pending,
        },
        "top_districts": [
            {"district": d, "count": c} for d, c in by_district
        ],
    }


@router.get(
    "/summary",
    summary="Përmbledhje e plotë e sistemit",
)
async def get_dashboard_summary(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Përmbledhje e plotë e sistemit për dashboard."""
    return _dashboard_summary(db)


@router.get(
    "/health",
    summary="Health check",
)
async def health_check(db: Session = Depends(get_db)):
    """Health check i sistemit."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = "unhealthy"

    return {
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
    }


@router.get("/command-center", summary="Snapshot i unifikuar operacional")
async def command_center(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Kthen burimin e vetëm të të dhënave për Command Center."""
    snapshot = await live_simulation.snapshot(live_pipeline)
    statistics = _dashboard_summary(db)
    resources = []
    latest_allocation = db.query(ResourceAllocationRecord).order_by(
        ResourceAllocationRecord.generated_at.desc()
    ).first()
    if latest_allocation:
        records = db.query(ResourceAllocationRecord).filter(
            ResourceAllocationRecord.run_id == latest_allocation.run_id
        ).all()
        inventory = {
            item.resource_type: item.total_quantity
            for item in db.query(ResourceInventory).all()
        }
        grouped = {}
        for record in records:
            grouped[record.resource_type] = grouped.get(record.resource_type, 0) + record.quantity
        resources = [
            {
                "key": resource_type,
                "label": resource_type.replace("_", " ").title(),
                "icon": "📦",
                "used": quantity,
                "total": inventory.get(resource_type),
            }
            for resource_type, quantity in grouped.items()
        ]
    age_rows = db.query(
        CitizenReport.age_range,
        func.count(CitizenReport.id).label("value"),
    ).filter(CitizenReport.age_range.isnot(None)).group_by(
        CitizenReport.age_range
    ).all()
    age_colors = ["#3b82f6", "#00d4ff", "#7b2ff7", "#ffa502", "#ff4757"]
    age_distribution = [
        {"range": str(age_range), "value": int(value), "color": age_colors[index % len(age_colors)]}
        for index, (age_range, value) in enumerate(age_rows)
    ]
    return {
        **snapshot,
        "reports": statistics["reports"],
        "top_districts": statistics["top_districts"],
        "resources": resources,
        "age_distribution": age_distribution,
    }
