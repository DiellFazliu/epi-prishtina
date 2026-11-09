"""
Report Service — logjika e biznesit për raportet.
Përfshin validim me rate limiting dhe filtrо sipas userit.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from src.models.report import CitizenReport, ReportType, ReportStatus
from src.models.user import User
from src.schemas.report import ReportCreate, ReportUpdate
from src.services.report_validator import ReportValidator
from src.core.config import settings


class ReportService:
    """Shërbimi për raportet e qytetarëve."""

    @staticmethod
    def create_report(
        db: Session,
        report_data: ReportCreate,
        user: Optional[User] = None,
        ip_hash: Optional[str] = None,
    ) -> CitizenReport:
        """Krijo një raport të re me validim."""
        
        # 1. Kontrollo rate limiting
        check = ReportValidator.can_submit(
            db,
            user_id=str(user.id) if user else None,
            ip_hash=ip_hash,
        )
        
        if not check["allowed"]:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=check["reason"],
            )

        # 2. Llogarit besueshmërinë
        reliability = ReportValidator.calculate_reliability(
            db,
            {
                "report_type": report_data.report_type,
                "symptoms": report_data.symptoms,
                "severity": report_data.severity,
                "district": report_data.district,
            },
        )

        # 3. Krijo raportin
        report = CitizenReport(
            user_id=user.id if user else None,
            report_type=ReportType(report_data.report_type),
            symptoms=report_data.symptoms,
            severity=report_data.severity,
            notes=report_data.notes,
            district=report_data.district,
            lat=report_data.lat,
            lon=report_data.lon,
            age_range=report_data.age_range,
            gender=report_data.gender,
            status=ReportStatus.PENDING,
            reliability_score=reliability,
            source="web",
            ip_hash=ip_hash,
        )

        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_report(db: Session, report_id: UUID) -> CitizenReport:
        """Merr një raport."""
        report = db.query(CitizenReport).filter(CitizenReport.id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Raporti nuk u gjet",
            )
        return report

    @staticmethod
    def list_reports(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        district: Optional[str] = None,
        status_filter: Optional[str] = None,
        report_type: Optional[str] = None,
        hours: Optional[int] = None,
        user_id: Optional[UUID] = None,
    ) -> List[CitizenReport]:
        """
        Lista e raporteve me filtra.
        
        Nëse user_id jepet, filtro vetëm raportet e atij useri.
        """
        query = db.query(CitizenReport)

        # Filtrо sipas userit (për citizen)
        if user_id:
            query = query.filter(CitizenReport.user_id == user_id)

        if district:
            query = query.filter(CitizenReport.district == district)
        if status_filter:
            try:
                query = query.filter(CitizenReport.status == ReportStatus(status_filter))
            except ValueError as error:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Status i pavlefshëm: {status_filter}",
                ) from error
        if report_type:
            try:
                query = query.filter(CitizenReport.report_type == ReportType(report_type))
            except ValueError as error:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Lloj raporti i pavlefshëm: {report_type}",
                ) from error
        if hours:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            query = query.filter(CitizenReport.reported_at >= cutoff)

        return query.order_by(CitizenReport.reported_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def update_report(
        db: Session,
        report_id: UUID,
        update_data: ReportUpdate,
        validator: User,
    ) -> CitizenReport:
        """Përditëso statusin e raportit."""
        report = ReportService.get_report(db, report_id)

        if update_data.status:
            report.status = ReportStatus(update_data.status)
        if update_data.validation_notes is not None:
            report.validation_notes = update_data.validation_notes

        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def delete_report(db: Session, report_id: UUID) -> None:
        """Fshi një raport."""
        report = ReportService.get_report(db, report_id)
        db.delete(report)
        db.commit()

    @staticmethod
    def get_statistics(
        db: Session,
        hours: Optional[int] = None,
        user_id: Optional[UUID] = None,
    ) -> Dict:
        """Statistika për raportet."""
        query = db.query(CitizenReport)

        if user_id:
            query = query.filter(CitizenReport.user_id == user_id)

        if hours:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            query = query.filter(CitizenReport.reported_at >= cutoff)

        total = query.count()
        symptom = query.filter(CitizenReport.report_type == ReportType.SYMPTOM).count()
        confirmed = query.filter(CitizenReport.report_type == ReportType.CONFIRMED).count()
        pending = query.filter(CitizenReport.status == ReportStatus.PENDING).count()
        validated = query.filter(CitizenReport.status == ReportStatus.VALIDATED).count()
        rejected = query.filter(CitizenReport.status == ReportStatus.REJECTED).count()

        avg_rel = query.with_entities(
            func.avg(CitizenReport.reliability_score)
        ).scalar() or 0

        by_district_query = (
            query.with_entities(
                CitizenReport.district,
                func.count(CitizenReport.id).label("count"),
            )
            .group_by(CitizenReport.district)
            .order_by(func.count(CitizenReport.id).desc())
            .all()
        )
        by_district = {d: c for d, c in by_district_query}

        return {
            "total": total,
            "symptom": symptom,
            "confirmed": confirmed,
            "pending": pending,
            "validated": validated,
            "rejected": rejected,
            "avg_reliability": float(avg_rel),
            "by_district": by_district,
        }


report_service = ReportService()