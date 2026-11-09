"""
Map data endpoints — shpërndarje e rasteve në harta.
"""

from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.db.base import get_db
from src.models import CitizenReport, HotspotPredictionRecord, ReportStatus, ReportType
from src.core.security import require_analyst


router = APIRouter(prefix="/map", tags=["Map"])


# ═══════════════════════════════════════════════════════════════════
# KONFIGURIMI I LAGJEVE
# ═══════════════════════════════════════════════════════════════════

DISTRICTS_GEO = {
    "Qendra": {"center": [42.6629, 21.1655], "radius": 0.012, "population": 3308},
    "Dardania": {"center": [42.6555, 21.1585], "radius": 0.010, "population": 2646},
    "Ulpiana": {"center": [42.6580, 21.1720], "radius": 0.009, "population": 2228},
    "Arbëria": {"center": [42.6700, 21.1480], "radius": 0.011, "population": 1906},
    "Kalabria": {"center": [42.6480, 21.1610], "radius": 0.010, "population": 1779},
    "Bregu i Diellit": {"center": [42.6520, 21.1780], "radius": 0.009, "population": 1849},
    "Sunny Hill": {"center": [42.6450, 21.1700], "radius": 0.008, "population": 1527},
    "Lakrishte": {"center": [42.6420, 21.1450], "radius": 0.008, "population": 1271},
    "Mat": {"center": [42.6580, 21.1350], "radius": 0.008, "population": 1106},
    "Tophane": {"center": [42.6680, 21.1620], "radius": 0.007, "population": 1148},
    "Vranjevc": {"center": [42.6720, 21.1750], "radius": 0.007, "population": 828},
    "Kodra e Trimave": {"center": [42.6760, 21.1580], "radius": 0.008, "population": 865},
    "Kolovica": {"center": [42.6820, 21.1780], "radius": 0.007, "population": 654},
    "Sofali": {"center": [42.6450, 21.1900], "radius": 0.006, "population": 434},
    "Bardhosh": {"center": [42.6900, 21.1500], "radius": 0.006, "population": 451},
}


# ═══════════════════════════════════════════════════════════════════
# SPITALET E SAKTA — BAZUAR NË OSM
# ═══════════════════════════════════════════════════════════════════

HOSPITALS_DATA = [
    {
        "name": "QKUK (Qendra Klinike Universitare e Kosovës)",
        "coords": [42.6467, 21.1653],
        "beds": 300,
        "icu": 40,
        "ventilators": 25,
        "status": "high_load",
        "type": "public",
        "address": "Rr. e Spitalit, Prishtinë",
    },
    {
        "name": "Klinika Infektive",
        "coords": [42.6447, 21.1611],
        "beds": 80,
        "icu": 15,
        "ventilators": 10,
        "status": "critical",
        "type": "public",
        "address": "Bulevardi i Dëshmorëve, Prishtinë",
    },
    {
        "name": "Klinika Pediatrike",
        "coords": [42.6546, 21.1714],
        "beds": 120,
        "icu": 12,
        "ventilators": 8,
        "status": "high_load",
        "type": "public",
        "address": "Rr. Mother Teresa, Prishtinë",
    },
    {
        "name": "Spitali Amerikan",
        "coords": [42.6490, 21.1690],
        "beds": 100,
        "icu": 10,
        "ventilators": 6,
        "status": "normal",
        "type": "private",
        "address": "Rr. Shkupi, Prishtinë",
    },
    {
        "name": "Spitali Gjerman",
        "coords": [42.6555, 21.1580],
        "beds": 60,
        "icu": 8,
        "ventilators": 5,
        "status": "normal",
        "type": "private",
        "address": "Rr. Luan Haradinaj, Prishtinë",
    },
    {
        "name": "Klinika Medicus",
        "coords": [42.6600, 21.1690],
        "beds": 40,
        "icu": 5,
        "ventilators": 3,
        "status": "normal",
        "type": "private",
        "address": "Rr. UÇK, Prishtinë",
    },
]


# ═══════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════

class DistrictData(BaseModel):
    district: str
    center: List[float]
    radius: float
    population: int
    reports: int
    confirmed: int
    pending_reports: int
    validated_reports: int
    severity: str


class HospitalData(BaseModel):
    name: str
    coords: List[float]
    beds: Optional[int] = None
    icu: Optional[int] = None
    ventilators: Optional[int] = None
    status: str
    type: str
    address: str


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

def _district_key(value: str) -> str:
    return " ".join((value or "").strip().casefold().split())


def load_reports_by_district(db: Session):
    """Aggregate non-rejected citizen reports from the live database (7 days)."""
    reports = db.query(CitizenReport).filter(
        CitizenReport.status.in_([ReportStatus.PENDING, ReportStatus.VALIDATED]),
        CitizenReport.reported_at >= datetime.utcnow() - timedelta(days=7),
    ).all()
    grouped = {}
    for report in reports:
        key = _district_key(report.district)
        row = grouped.setdefault(key, {"reports": 0, "pending": 0, "validated": 0, "confirmed": 0})
        row["reports"] += 1
        if report.status == ReportStatus.VALIDATED:
            row["validated"] += 1
            if report.report_type == ReportType.CONFIRMED:
                row["confirmed"] += 1
        elif report.status == ReportStatus.PENDING:
            row["pending"] += 1
    return reports, grouped


def calculate_severity(validated: int) -> str:
    """A report-volume band, not a clinical risk score."""
    if validated >= 50: return "critical"
    if validated >= 25: return "high"
    if validated >= 10: return "medium"
    if validated >= 3: return "low"
    return "minimal"


# ═══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/districts", response_model=List[DistrictData])
async def get_districts(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Return district geography and current report counts from the database."""
    _, reports_data = load_reports_by_district(db)
    result = []
    for district_name, geo in DISTRICTS_GEO.items():
        stats = reports_data.get(
            _district_key(district_name),
            {"reports": 0, "confirmed": 0, "pending": 0, "validated": 0},
        )
        result.append(DistrictData(
            district=district_name,
            center=geo["center"],
            radius=geo["radius"],
            population=geo["population"],
            reports=stats["reports"],
            confirmed=stats["confirmed"],
            pending_reports=stats["pending"],
            validated_reports=stats["validated"],
            severity=calculate_severity(stats["validated"]),
        ))
    return result


@router.get("/hospitals", response_model=List[HospitalData])
async def get_hospitals(current_user=Depends(require_analyst)):
    """Return configured facility locations; live capacity is not integrated."""
    return [HospitalData(**hospital) for hospital in HOSPITALS_DATA]


@router.get("/heatmap-points")
async def get_heatmap_points(
    metric: str = "reports",
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Return privacy-preserving heat cells based on live reports or districts."""
    if metric not in {"reports", "confirmed", "projected"}:
        return {"points": [], "metric": metric, "total": 0, "window_days": 7}

    reports, reports_data = load_reports_by_district(db)
    points = []

    if metric == "projected":
        latest = db.query(HotspotPredictionRecord).order_by(
            HotspotPredictionRecord.generated_at.desc()
        ).first()
        if latest:
            prediction_rows = [
                {
                    "district": row.district,
                    "hotspot_probability": row.probability,
                    "risk_level": row.risk_level,
                }
                for row in db.query(HotspotPredictionRecord).filter(
                    HotspotPredictionRecord.run_id == latest.run_id
                ).all()
            ]
            data_source = "postgresql_ml_prediction"
        else:
            prediction_path = Path("data/processed/hotspot_predictions.csv")
            if not prediction_path.exists():
                return {
                    "points": [],
                    "metric": metric,
                    "total": 0,
                    "window_days": 7,
                    "data_source": "ml_prediction_unavailable",
                }
            import pandas as pd
            predictions = pd.read_csv(prediction_path)
            prediction_rows = predictions.to_dict(orient="records")
            data_source = "validated_ml_prediction"
        risk_intensity = {
            "MINIMAL": 0.12,
            "LOW": 0.28,
            "MEDIUM": 0.52,
            "HIGH": 0.76,
            "CRITICAL": 0.96,
        }
        for row in prediction_rows:
            geo = DISTRICTS_GEO.get(str(row.get("district", "")))
            if not geo:
                continue
            probability = max(0.0, min(1.0, float(row.get("hotspot_probability", 0))))
            if probability <= 0:
                continue
            risk_level = str(row.get("risk_level", "LOW")).upper()
            points.append({
                "lat": geo["center"][0],
                "lon": geo["center"][1],
                "intensity": risk_intensity.get(risk_level, 0.28),
                "value": probability,
                "district": row.get("district"),
                "probability": probability,
                "risk_level": risk_level,
                "data_source": data_source,
            })
        return {
            "points": points,
            "metric": metric,
            "total": len(points),
            "window_days": 7,
            "data_source": data_source,
        }
    
    # 1. Pikat nga raportet reale (me lat/lon)
    cells = Counter()
    for report in reports:
        if metric == "confirmed" and not (
            report.status == ReportStatus.VALIDATED and report.report_type == ReportType.CONFIRMED
        ):
            continue
        if report.lat is not None and report.lon is not None:
            # 100m cells
            cell = (round(report.lat, 3), round(report.lon, 3))
            cells[cell] += 1
    
    max_count = max(cells.values(), default=1)
    for (lat, lon), count in cells.items():
        points.append({
            "lat": lat,
            "lon": lon,
            "intensity": count / max_count,
            "value": count,
            "data_source": "database_coordinates",
        })

    # Keep the map informative without inventing household-level locations.
    # District centers are the most precise honest fallback when reports lack coordinates.
    if not points:
        district_counts = {}
        for district, values in reports_data.items():
            count = values["reports"] if metric == "reports" else values["confirmed"]
            if count > 0:
                district_counts[district] = count
        max_district_count = max(district_counts.values(), default=1)
        for district_name, count in district_counts.items():
            geo = next(
                (
                    item for name, item in DISTRICTS_GEO.items()
                    if _district_key(name) == district
                ),
                None,
            )
            if not geo:
                continue
            points.append({
                "lat": geo["center"][0],
                "lon": geo["center"][1],
                "intensity": count / max_district_count,
                "value": count,
                "district": next(
                    name for name in DISTRICTS_GEO
                    if _district_key(name) == district
                ),
                "data_source": "district_aggregate",
            })

    return {
        "points": points,
        "metric": metric,
        "total": len(points),
        "window_days": 7,
        "data_source": (
            "database_coordinates"
            if cells
            else "district_aggregate"
        ),
    }


@router.get("/summary")
async def get_map_summary(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Map summary sourced from live, non-rejected reports."""
    reports, reports_data = load_reports_by_district(db)
    return {
        "total_reports": len(reports),
        "total_confirmed": sum(row["confirmed"] for row in reports_data.values()),
        "total_validated": sum(row["validated"] for row in reports_data.values()),
        "total_pending": sum(row["pending"] for row in reports_data.values()),
        "districts_count": len(DISTRICTS_GEO),
        "hospitals_count": len(HOSPITALS_DATA),
        "window_days": 7,
        "data_source": "database",
    }