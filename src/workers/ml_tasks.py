"""Celery jobs for data-backed hotspot training and refresh."""

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from src.workers.celery_app import celery_app
from src.ml.hotspot_predictor import HotspotFeatureBuilder, HotspotPredictor
from src.db.base import SessionLocal
from src.ml.persistence import persist_hotspot_predictions
from src.ml.report_data import reports_dataframe

DATA_DIR = Path("data/processed")
REPORTS_PATH = DATA_DIR / "citizen_reports.csv"
POPULATION_PATH = DATA_DIR / "prishtina_population_22k.csv"
PREDICTIONS_PATH = DATA_DIR / "hotspot_predictions.csv"


def train_and_refresh_hotspots() -> dict:
    if not POPULATION_PATH.exists():
        raise FileNotFoundError("Hotspot training needs prishtina_population_22k.csv")

    db = SessionLocal()
    try:
        reports = reports_dataframe(db, REPORTS_PATH)
    finally:
        db.close()
    if reports.empty:
        raise ValueError("Hotspot training requires persisted citizen reports")
    population = pd.read_csv(POPULATION_PATH)
    features = HotspotFeatureBuilder(reports, population).build_training_data()
    if features.empty or features["is_hotspot"].nunique() < 2:
        raise ValueError("Hotspot training requires examples from both classes")

    predictor = HotspotPredictor()
    metrics = predictor.train(features)
    if metrics.get("f1") is None:
        raise ValueError(
            "Hotspot refresh skipped: the latest temporal holdout has only one class, "
            "so this dataset cannot validate a useful forecast yet."
        )
    day = int(features["day"].max())
    predictions = predictor.predict_for_day(features, day=day)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    predictions.to_csv(PREDICTIONS_PATH, index=False)
    db = SessionLocal()
    try:
        snapshot = persist_hotspot_predictions(db, predictions, day)
    finally:
        db.close()

    return {
        "status": "success",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "training_samples": int(len(features)),
        "prediction_day": day,
        "hotspots_updated": int((predictions["hotspot_probability"] >= 0.7).sum()),
        "metrics": {key: float(value) for key, value in metrics.items() if value is not None},
        "predictions_path": str(PREDICTIONS_PATH),
        **snapshot,
    }


@celery_app.task(name="src.workers.ml_tasks.update_hotspots")
def update_hotspots():
    """Train from the project report/population data and replace the hotspot CSV."""
    return train_and_refresh_hotspots()


@celery_app.task(name="src.workers.ml_tasks.train_model")
def train_model():
    """Run the same measured training pipeline on demand."""
    return train_and_refresh_hotspots()
