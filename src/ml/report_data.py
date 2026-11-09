"""Adapters from persisted citizen reports to ML training frames."""

from pathlib import Path

import pandas as pd

from src.models import CitizenReport, ReportStatus


def reports_dataframe(db, historical_path: str | Path | None = None) -> pd.DataFrame:
    """Build a training frame from live reports and an optional historical baseline."""
    reports = db.query(CitizenReport).filter(
        CitizenReport.status.in_([ReportStatus.PENDING, ReportStatus.VALIDATED])
    ).all()
    live_frame = pd.DataFrame([
        {
            "report_id": str(report.id),
            "area": report.district,
            "timestamp": report.reported_at,
            "report_type": report.report_type.value,
        }
        for report in reports
    ], columns=["report_id", "area", "timestamp", "report_type"])
    if historical_path is None or not Path(historical_path).exists():
        return live_frame
    historical = pd.read_csv(historical_path)
    required = ["report_id", "area", "timestamp", "report_type"]
    if not set(required).issubset(historical.columns):
        raise ValueError("Historical report baseline has an incompatible schema")
    historical = historical[required]
    historical["report_id"] = historical["report_id"].astype(str)
    combined = pd.concat([historical, live_frame], ignore_index=True)
    return combined.drop_duplicates(subset=["report_id"], keep="last")
