"""
Report endpoints — CRUD me filtra sipas rolit.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Request
from sqlalchemy.orm import Session

from src.db.base import get_db
from src.schemas.report import (
    ReportCreate,
    ReportResponse,
    ReportUpdate,
    ReportStatistics,
)
from src.services.report_service import report_service
from src.core.security import (
    get_current_user,
    get_current_active_user,
    require_health_worker,
    require_admin,
    require_analyst,
)
from src.websocket import (
    publish_report_created,
    publish_report_updated,
    publish_event,
)


router = APIRouter(prefix="/reports", tags=["Reports"])


# ═══ CREATE ═══

@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Krijo raport (publik)",
)
async def create_report(
    report_data: ReportCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Krijo një raport të re (publik, pa authentication)."""
    # Merr IP për rate limiting
    client_ip = request.client.host if request.client else None
    import hashlib
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest() if client_ip else None

    report = report_service.create_report(
        db, report_data, user=None, ip_hash=ip_hash
    )

    background_tasks.add_task(
        publish_report_created,
        {
            "id": str(report.id),
            "district": report.district,
            "report_type": report.report_type.value,
            "severity": report.severity,
            "reliability_score": report.reliability_score,
            "status": report.status.value,
            "reported_at": report.reported_at.isoformat(),
        },
    )

    return report


@router.post(
    "/authenticated",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Krijo raport si user i autentikuar",
)
async def create_report_authenticated(
    report_data: ReportCreate,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Krijo një raport si user i autentikuar (rate limited)."""
    report = report_service.create_report(db, report_data, user=current_user)

    background_tasks.add_task(
        publish_report_created,
        {
            "id": str(report.id),
            "user_id": str(report.user_id) if report.user_id else None,
            "user_name": current_user.username,
            "district": report.district,
            "report_type": report.report_type.value,
            "severity": report.severity,
            "reliability_score": report.reliability_score,
            "status": report.status.value,
            "reported_at": report.reported_at.isoformat(),
        },
    )

    return report


# ═══ READ ═══

@router.get(
    "",
    response_model=List[ReportResponse],
    summary="Lista e raporteve (të filtruara sipas rolit)",
)
async def list_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    district: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    report_type: Optional[str] = None,
    hours: Optional[int] = Query(None, ge=1, le=720),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista e raporteve për përdoruesit e stafit."""
    return report_service.list_reports(
        db, skip=skip, limit=limit,
        district=district, status_filter=status_filter,
        report_type=report_type, hours=hours,
        user_id=current_user.id if current_user.role.value == "citizen" else None,
    )


@router.get(
    "/statistics",
    response_model=ReportStatistics,
    summary="Statistika për raportet",
)
async def get_statistics(
    hours: Optional[int] = Query(None, ge=1, le=720),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Statistika të plota për raportet."""
    return report_service.get_statistics(
        db,
        hours=hours,
        user_id=current_user.id if current_user.role.value == "citizen" else None,
    )


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Merr një raport",
)
async def get_report(
    report_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Merr detajet e një raporti."""
    report = report_service.get_report(db, report_id)
    
    if current_user.role.value == "citizen" and str(report.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nuk keni akses në këtë raport",
        )
    return report


# ═══ UPDATE ═══

@router.patch(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Përditëso statusin (health_worker/admin)",
)
async def update_report(
    report_id: UUID,
    update_data: ReportUpdate,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    """Përditëso statusin e raportit (vetëm health_worker ose admin)."""
    report = report_service.update_report(db, report_id, update_data, current_user)

    background_tasks.add_task(
        publish_report_updated,
        {
            "id": str(report.id),
            "district": report.district,
            "status": report.status.value,
            "validation_notes": report.validation_notes,
            "validated_by": current_user.username,
            "updated_at": report.updated_at.isoformat(),
        },
    )

    return report


# ═══ DELETE ═══

@router.delete(
    "/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Fshi raport (admin)",
)
async def delete_report(
    report_id: UUID,
    background_tasks: BackgroundTasks,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Fshi një raport (vetëm admin)."""
    report = report_service.get_report(db, report_id)
    report_info = {
        "id": str(report.id),
        "district": report.district,
        "deleted_by": current_user.username,
    }

    report_service.delete_report(db, report_id)

    background_tasks.add_task(
        publish_event,
        "report:deleted",
        report_info,
        "reports",
    )