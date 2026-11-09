"""Persistence helpers for ML prediction snapshots."""

from datetime import datetime
from uuid import uuid4

from src.models import HotspotPredictionRecord


def persist_hotspot_predictions(db, predictions, prediction_day: int) -> dict:
    """Persist a new durable hotspot prediction run."""
    if predictions.empty:
        raise ValueError("Cannot persist an empty hotspot prediction snapshot")
    run_id = str(uuid4())
    generated_at = datetime.utcnow()
    records = []
    for row in predictions.to_dict(orient="records"):
        records.append(HotspotPredictionRecord(
            run_id=run_id,
            prediction_day=prediction_day,
            district=str(row.get("district", "")),
            probability=float(row.get("hotspot_probability", 0)),
            risk_level=str(row.get("risk_level", "UNKNOWN")),
            reports_7d=int(row.get("reports_7d", 0)),
            confirmed_7d=int(row.get("confirmed_7d", 0)),
            population=int(row.get("population", 0)),
            generated_at=generated_at,
        ))
    db.add_all(records)
    db.commit()
    return {
        "run_id": run_id,
        "prediction_day": prediction_day,
        "generated_at": generated_at.isoformat(),
        "count": len(records),
    }
