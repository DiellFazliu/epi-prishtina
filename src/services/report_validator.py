"""
Validator për raportet e qytetarëve.
Parandalon raportet fallco dhe abuzimet.
"""

from datetime import datetime, timedelta
from typing import Dict, Optional
from sqlalchemy.orm import Session

from src.models.report import CitizenReport


class ReportValidator:
    """Validon raportet për të parandaluar abuzimet."""

    # Kufijtë
    MAX_REPORTS_PER_HOUR = 3
    MAX_REPORTS_PER_DAY = 10
    MIN_INTERVAL_SECONDS = 60

    @staticmethod
    def can_submit(
        db: Session,
        user_id: Optional[str] = None,
        ip_hash: Optional[str] = None,
    ) -> Dict:
        """
        Kontrollo nëse useri mund të dërgojë raport.
        
        Returns:
            {"allowed": bool, "reason": str}
        """
        now = datetime.utcnow()

        # 1. Kontrollo intervalin minimal (1 minutë)
        if user_id:
            last_report = db.query(CitizenReport).filter(
                CitizenReport.user_id == user_id
            ).order_by(CitizenReport.reported_at.desc()).first()

            if last_report:
                seconds_since = (now - last_report.reported_at).total_seconds()
                if seconds_since < ReportValidator.MIN_INTERVAL_SECONDS:
                    wait = int(ReportValidator.MIN_INTERVAL_SECONDS - seconds_since)
                    return {
                        "allowed": False,
                        "reason": f"Prit {wait} sekonda para raportit tjetër",
                    }

        # 2. Kontrollo limitin orar
        one_hour_ago = now - timedelta(hours=1)
        query = db.query(CitizenReport).filter(
            CitizenReport.reported_at >= one_hour_ago
        )
        
        if user_id:
            query = query.filter(CitizenReport.user_id == user_id)
        elif ip_hash:
            query = query.filter(CitizenReport.ip_hash == ip_hash)

        if query.count() >= ReportValidator.MAX_REPORTS_PER_HOUR:
            return {
                "allowed": False,
                "reason": f"Ke tejkaluar limitin e {ReportValidator.MAX_REPORTS_PER_HOUR} raporteve/orë",
            }

        # 3. Kontrollo limitin ditor
        one_day_ago = now - timedelta(days=1)
        query = db.query(CitizenReport).filter(
            CitizenReport.reported_at >= one_day_ago
        )
        
        if user_id:
            query = query.filter(CitizenReport.user_id == user_id)
        elif ip_hash:
            query = query.filter(CitizenReport.ip_hash == ip_hash)

        if query.count() >= ReportValidator.MAX_REPORTS_PER_DAY:
            return {
                "allowed": False,
                "reason": f"Ke tejkaluar limitin e {ReportValidator.MAX_REPORTS_PER_DAY} raporteve/ditë",
            }

        return {"allowed": True, "reason": ""}

    @staticmethod
    def calculate_reliability(
        db: Session,
        report_data: Dict,
    ) -> float:
        """Llogarit besueshmërinë bazuar në faktorë kontekstualë."""
        score = 0.5

        # 1. Konfirmim laboratorik
        if report_data.get("report_type") == "confirmed":
            score += 0.35
        elif report_data.get("symptoms"):
            known_symptoms = {
                "fever", "cough", "fatigue", "loss_of_smell",
                "loss_of_taste", "sore_throat", "headache",
                "muscle_pain", "shortness_of_breath", "diarrhea",
            }
            matching = [s for s in report_data["symptoms"] if s in known_symptoms]
            if matching:
                score += 0.15 * min(len(matching) / 3, 1.0)

        # 2. Dendësia hapësinore
        one_day_ago = datetime.utcnow() - timedelta(hours=24)
        nearby = db.query(CitizenReport).filter(
            CitizenReport.district == report_data.get("district"),
            CitizenReport.reported_at >= one_day_ago,
        ).count()

        if nearby > 5:
            score += 0.15
        elif nearby > 2:
            score += 0.08

        # 3. Severity
        if report_data.get("severity", 1) >= 3:
            score += 0.05

        return min(score, 1.0)