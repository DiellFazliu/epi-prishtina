"""
Simulation, Hotspots, Resources endpoints — nga CSV.
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, Depends
import pandas as pd
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.db.base import get_db
from src.models import AuditLog, CitizenReport, HotspotPredictionRecord, Intervention, ReportStatus, ResourceAllocationRecord, ResourceInventory, ScenarioType, Simulation, SimulationDay, SimulationStatus
from src.core.security import require_admin, require_analyst, require_health_worker
from src.simulation.intervention_engine import MEASURE_EFFECTS, forecast, initial_state, normalize_measures
from src.allocation.pipeline import optimize_processed_resources, persist_resource_allocations
from src.services.live_simulation import live_pipeline, live_simulation
from src.websocket.manager import publish_event, publish_simulation_update


router = APIRouter(tags=["Simulation & Analytics"])

DATA_DIR = "data/processed"
_cache: Dict[str, tuple[float, pd.DataFrame]] = {}


def load_csv(filename: str) -> Optional[pd.DataFrame]:
    """Lexon CSV me cache."""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return None
    modified_at = os.path.getmtime(path)
    cached = _cache.get(filename)
    if cached and cached[0] == modified_at:
        return cached[1]
    df = pd.read_csv(path)
    _cache[filename] = (modified_at, df)
    return df


# ═══ Models ═══

class HotspotPrediction(BaseModel):
    district: str
    probability: float
    risk_level: str
    reports_7d: int
    confirmed_7d: int
    population: int
    observed_reports_7d: int = 0
    observed_validated_7d: int = 0


class ResourceAllocation(BaseModel):
    resource_type: str
    district: str
    quantity: int
    cost: float
    reason: str


class MeasureSelection(BaseModel):
    type: str
    target_district: str | None = None
    intensity: float = Field(default=1.0, ge=0.0, le=1.0)


class StrategyRequest(BaseModel):
    measures: list[MeasureSelection]
    days: int = Field(default=30, ge=7, le=90)


class ResourceInventoryUpdate(BaseModel):
    total_quantity: int = Field(ge=0, le=10_000_000)


def _current_simulation(db: Session) -> Simulation | None:
    return db.query(Simulation).filter(
        Simulation.status.in_([SimulationStatus.RUNNING, SimulationStatus.PAUSED])
    ).order_by(Simulation.created_at.desc()).first()


def _seed_state() -> dict:
    history = load_csv("simulation_history.csv")
    source = history.iloc[-1].to_dict() if history is not None and not history.empty else None
    return initial_state(source)


def _serialize_day(simulation_id, day: int, state: dict, rt: float, new_cases: int) -> SimulationDay:
    return SimulationDay(
        simulation_id=simulation_id,
        day=day,
        susceptible=round(state["susceptible"]),
        exposed=round(state["exposed"]),
        infectious_mild=round(state["infectious_mild"]),
        infectious_severe=round(state["infectious_severe"]),
        hospitalized=round(state["hospitalized"]),
        icu=round(state["icu"]),
        recovered=round(state["recovered"]),
        dead=round(state["dead"]),
        real_active=round(state["exposed"] + state["infectious_mild"] + state["infectious_severe"] + state["hospitalized"] + state["icu"]),
        real_deaths=round(state["dead"]),
        rt=rt,
        new_cases=new_cases,
    )


def _observed_reports_last_week(db: Session) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=7)
    recent_reports = db.query(CitizenReport).filter(
        CitizenReport.reported_at >= cutoff,
        CitizenReport.status.in_([ReportStatus.PENDING, ReportStatus.VALIDATED]),
    ).all()
    observed = {}
    for report in recent_reports:
        key = " ".join((report.district or "").strip().casefold().split())
        counts = observed.setdefault(key, {"reports": 0, "validated": 0})
        counts["reports"] += 1
        if report.status == ReportStatus.VALIDATED:
            counts["validated"] += 1
    return observed


def _district_key(value: str) -> str:
    return " ".join((value or "").strip().casefold().split())


@router.post("/simulation/strategy/preview", summary="Krahaso skenarin me masat")
async def preview_strategy(
    request: StrategyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    try:
        measures = normalize_measures([measure.model_dump() for measure in request.measures])
    except (ValueError, KeyError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    simulation = _current_simulation(db)
    state = (simulation.parameters or {}).get("state") if simulation else None
    state = state or _seed_state()
    baseline = forecast(state, [], request.days)
    with_measures = forecast(state, measures, request.days)
    avoided = max(0, baseline["new_cases"] - with_measures["new_cases"])
    return {
        "model": "deterministic-seir-v1",
        "disclaimer": "Projeksion SEIR agregat për gjithë qytetin; etiketat e zonës nuk modelojnë përhapje lagje më lagje. Nuk është parashikim klinik i kalibruar.",
        "baseline": {key: baseline[key] for key in ("days", "active_at_end", "peak_active", "new_cases", "deaths_at_end", "rt_at_end")},
        "with_measures": {key: with_measures[key] for key in ("days", "active_at_end", "peak_active", "new_cases", "deaths_at_end", "rt_at_end")},
        "estimated_cases_avoided": avoided,
        "relative_reduction_percent": round(100 * avoided / baseline["new_cases"], 1) if baseline["new_cases"] else 0,
    }


@router.get("/simulation/strategy/recommendations", summary="Rendit masat sipas ndikimit të modeluar")
async def recommend_strategy(
    days: int = Query(30, ge=7, le=90),
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    simulation = _current_simulation(db)
    state = (simulation.parameters or {}).get("state") if simulation else None
    state = state or _seed_state()
    active_measures = []
    if simulation:
        active_measures = db.query(Intervention).filter(
            Intervention.simulation_id == simulation.id,
            Intervention.ended_day.is_(None),
        ).all()
    current = normalize_measures([
        {"type": item.intervention_type, "intensity": item.intensity}
        for item in active_measures
    ])
    active_types = {item["type"] for item in current}
    current_forecast = forecast(state, current, days)
    recommendations = []
    for measure_type in MEASURE_EFFECTS:
        if measure_type in active_types:
            continue
        candidate = current + [{"type": measure_type, "intensity": 1.0}]
        projected = forecast(state, candidate, days)
        avoided = max(0, current_forecast["new_cases"] - projected["new_cases"])
        recommendations.append({
            "type": measure_type,
            "intensity": 1.0,
            "estimated_additional_cases_avoided": avoided,
            "projected_cases_with_measure": projected["new_cases"],
        })
    recommendations.sort(key=lambda item: item["estimated_additional_cases_avoided"], reverse=True)
    recommendations = [
        item for item in recommendations
        if item["estimated_additional_cases_avoided"] > 0
    ]
    return {
        "model": "deterministic-seir-v1",
        "days": days,
        "current_projected_cases": current_forecast["new_cases"],
        "recommendations": recommendations,
        "disclaimer": "Renditja krahason ndikimin shtesë të secilës masë mbi gjendjen dhe masat aktive. Nuk përfshin kosto, kapacitet zbatimi apo përhapje lagje-më-lagje; rishikoje para zbatimit.",
    }


@router.post("/simulation/strategy/apply", summary="Ruaj dhe aktivizo masat")
async def apply_strategy(
    request: StrategyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_health_worker),
):
    try:
        measures = normalize_measures([measure.model_dump() for measure in request.measures])
    except (ValueError, KeyError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    if not measures:
        raise HTTPException(status_code=422, detail="Zgjidh të paktën një masë.")

    simulation = _current_simulation(db)
    if simulation is None:
        state = _seed_state()
        simulation = Simulation(
            name="Simulimi i masave aktive",
            description="Projeksion ditor SEIR me masa të regjistruara.",
            scenario_type=ScenarioType.CUSTOM,
            parameters={"state": state, "model": "deterministic-seir-v1"},
            status=SimulationStatus.RUNNING,
            current_day=0,
            total_days=90,
        )
        db.add(simulation)
        db.flush()
        db.add(_serialize_day(simulation.id, 0, state, 1.0, 0))
    else:
        state = (simulation.parameters or {}).get("state") or _seed_state()
        simulation.parameters = {**(simulation.parameters or {}), "state": state, "model": "deterministic-seir-v1"}

    db.query(Intervention).filter(
        Intervention.simulation_id == simulation.id,
        Intervention.ended_day.is_(None),
    ).update({Intervention.ended_day: simulation.current_day}, synchronize_session=False)
    baseline = forecast(simulation.parameters["state"], [], request.days)
    with_measures = forecast(simulation.parameters["state"], measures, request.days)
    expected_impact = {
        "model": "deterministic-seir-v1",
        "days": request.days,
        "estimated_cases_avoided": max(0, baseline["new_cases"] - with_measures["new_cases"]),
    }
    for measure in measures:
        db.add(Intervention(
            simulation_id=simulation.id,
            intervention_type=measure["type"],
            target_district=measure.get("target_district"),
            intensity=measure["intensity"],
            description=f"Zbatuar nga {current_user.username}",
            started_day=simulation.current_day + 1,
            expected_impact=expected_impact,
        ))
    db.add(AuditLog(
        user_id=current_user.id,
        action="simulation_measures_applied",
        resource_type="simulation",
        resource_id=str(simulation.id),
        details={
            "current_day": simulation.current_day,
            "effective_from_day": simulation.current_day + 1,
            "measures": measures,
            "expected_impact": expected_impact,
        },
    ))
    db.commit()
    if live_pipeline.state is None:
        live_pipeline.load_state()
    live_pipeline.state.active_measures = measures
    live_pipeline._save_active_measures(measures)
    await publish_simulation_update(await live_simulation.snapshot(live_pipeline))
    return {
        "status": "applied",
        "simulation_id": str(simulation.id),
        "current_day": simulation.current_day,
        "effective_from_day": simulation.current_day + 1,
        "measures": measures,
        "expected_impact": expected_impact,
    }


@router.get("/simulation/strategy/status", summary="Masat aktive dhe gjendja e simulimit")
async def strategy_status(
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    simulation = _current_simulation(db)
    if simulation is None:
        return {"status": "not_started", "current_day": 0, "measures": []}
    measures = db.query(Intervention).filter(
        Intervention.simulation_id == simulation.id,
        Intervention.ended_day.is_(None),
    ).all()
    return {
        "status": simulation.status.value,
        "simulation_id": str(simulation.id),
        "current_day": simulation.current_day,
        "total_days": simulation.total_days,
        "state": simulation.parameters.get("state", {}),
        "measures": [{"type": item.intervention_type, "target_district": item.target_district, "intensity": item.intensity} for item in measures],
    }


# ═══ Simulation ═══

def _latest_persisted_history(db: Session) -> tuple[Simulation | None, list[SimulationDay]]:
    simulation = db.query(Simulation).order_by(Simulation.created_at.desc()).first()
    if simulation is None:
        return None, []
    rows = db.query(SimulationDay).filter(
        SimulationDay.simulation_id == simulation.id
    ).order_by(SimulationDay.day.asc()).all()
    return simulation, rows


def _day_dict(row: SimulationDay) -> dict:
    return {
        "day": row.day, "S": row.susceptible, "E": row.exposed,
        "I_mild": row.infectious_mild, "I_severe": row.infectious_severe,
        "H": row.hospitalized, "ICU": row.icu, "R": row.recovered,
        "D": row.dead, "active": row.real_active, "real_active": row.real_active,
        "real_deaths": row.real_deaths, "new_cases": row.new_cases, "rt": row.rt,
    }


@router.get("/simulation/summary", summary="Përmbledhje e simulimit")
async def get_simulation_summary(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    simulation, rows = _latest_persisted_history(db)
    if simulation and rows:
        final = rows[-1]
        peak_row = max(rows, key=lambda row: row.real_active or 0)
        return {
            "simulation_id": str(simulation.id), "status": simulation.status.value,
            "total_days": len(rows),
            "final": {"day": final.day, "active": final.real_active, "real_active": final.real_active, "dead": final.dead, "real_deaths": final.real_deaths},
            "peak": {"day": peak_row.day, "active": peak_row.real_active, "real_active": peak_row.real_active},
        }
    df = load_csv("simulation_history.csv")
    if df is None:
        raise HTTPException(404, "Simulation history not found")
    
    final = df.iloc[-1]
    peak_row = df.loc[df['active'].idxmax()]
    
    return {
        "total_days": len(df),
        "final": {
            "day": int(final['day']),
            "active": int(final['active']),
            "real_active": int(final['real_active']),
            "dead": int(final['D']),
            "real_deaths": int(final['real_deaths']),
        },
        "peak": {
            "day": int(peak_row['day']),
            "active": int(peak_row['active']),
            "real_active": int(peak_row['real_active']),
        },
    }


@router.get("/simulation/history", summary="Historiku i plotë")
async def get_simulation_history(
    limit: int = Query(90, ge=1, le=200),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    simulation, rows = _latest_persisted_history(db)
    if simulation and rows:
        return [_day_dict(row) for row in rows[-limit:]]
    df = load_csv("simulation_history.csv")
    if df is None:
        raise HTTPException(404, "Simulation history not found")
    return df.tail(limit).to_dict(orient="records")


@router.get("/simulation/day/{day}", summary="Një ditë specifike")
async def get_simulation_day(
    day: int,
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    simulation, _ = _latest_persisted_history(db)
    if simulation:
        row = db.query(SimulationDay).filter(
            SimulationDay.simulation_id == simulation.id,
            SimulationDay.day == day,
        ).first()
        if row:
            return _day_dict(row)
    df = load_csv("simulation_history.csv")
    if df is None:
        raise HTTPException(404, "Simulation history not found")
    
    row = df[df['day'] == day]
    if row.empty:
        raise HTTPException(404, f"Day {day} not found")
    
    return row.iloc[0].to_dict()


# ═══ Hotspots ═══

@router.get("/hotspots", response_model=List[HotspotPrediction], summary="Të gjitha hotspots")
async def get_hotspots(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    latest = db.query(HotspotPredictionRecord).order_by(
        HotspotPredictionRecord.generated_at.desc()
    ).first()
    if latest:
        rows = db.query(HotspotPredictionRecord).filter(
            HotspotPredictionRecord.run_id == latest.run_id
        ).all()
        observed = _observed_reports_last_week(db)
        return [
            HotspotPrediction(
                district=row.district,
                probability=row.probability,
                risk_level=row.risk_level,
                reports_7d=row.reports_7d,
                confirmed_7d=row.confirmed_7d,
                population=row.population,
                observed_reports_7d=observed.get(_district_key(row.district), {}).get("reports", 0),
                observed_validated_7d=observed.get(_district_key(row.district), {}).get("validated", 0),
            )
            for row in rows
        ]
    df = load_csv("hotspot_predictions.csv")
    if df is None:
        raise HTTPException(404, "Hotspot predictions not found")

    observed = _observed_reports_last_week(db)
    
    results = []
    for _, row in df.iterrows():
        counts = observed.get(" ".join(str(row['district']).strip().casefold().split()), {})
        results.append(HotspotPrediction(
            district=str(row['district']),
            probability=float(row['hotspot_probability']),
            risk_level=str(row.get('risk_level', 'UNKNOWN')),
            reports_7d=int(row.get('reports_7d', 0)),
            confirmed_7d=int(row.get('confirmed_7d', 0)),
            population=int(row.get('population', 0)),
            observed_reports_7d=counts.get("reports", 0),
            observed_validated_7d=counts.get("validated", 0),
        ))
    return results


@router.get("/hotspots/top", summary="Top N hotspots")
async def get_top_hotspots(
    n: int = Query(5, ge=1, le=15),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    latest = db.query(HotspotPredictionRecord).order_by(
        HotspotPredictionRecord.generated_at.desc()
    ).first()
    if latest:
        rows = db.query(HotspotPredictionRecord).filter(
            HotspotPredictionRecord.run_id == latest.run_id
        ).order_by(HotspotPredictionRecord.probability.desc()).limit(n).all()
        observed = _observed_reports_last_week(db)
        return [
            {
                "district": row.district,
                "probability": row.probability,
                "risk_level": row.risk_level,
                "reports_7d": row.reports_7d,
                "confirmed_7d": row.confirmed_7d,
                "population": row.population,
                "observed_reports_7d": observed.get(_district_key(row.district), {}).get("reports", 0),
                "observed_validated_7d": observed.get(_district_key(row.district), {}).get("validated", 0),
            }
            for row in rows
        ]
    df = load_csv("hotspot_predictions.csv")
    if df is None:
        raise HTTPException(404, "Hotspot predictions not found")
    
    top = df.nlargest(n, 'hotspot_probability').copy()
    
    # Normalizo emrat e fushave për konsistencë
    top = top.rename(columns={
        'hotspot_probability': 'probability',
        'reports_7d': 'reports_7d',
        'confirmed_7d': 'confirmed_7d',
    })
    
    observed = _observed_reports_last_week(db)
    results = top.to_dict(orient="records")
    for row in results:
        counts = observed.get(" ".join(str(row.get("district", "")).strip().casefold().split()), {})
        row["observed_reports_7d"] = counts.get("reports", 0)
        row["observed_validated_7d"] = counts.get("validated", 0)
    return results


@router.get("/hotspots/runs", summary="Historiku i run-eve ML")
async def get_hotspot_runs(
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    rows = db.query(HotspotPredictionRecord).order_by(
        HotspotPredictionRecord.generated_at.desc()
    ).all()
    runs = []
    seen = set()
    for row in rows:
        if row.run_id in seen:
            continue
        seen.add(row.run_id)
        runs.append({
            "run_id": row.run_id,
            "prediction_day": row.prediction_day,
            "generated_at": row.generated_at.isoformat(),
            "count": sum(item.run_id == row.run_id for item in rows),
        })
        if len(runs) >= limit:
            break
    return runs


# ═══ Resources ═══

@router.get("/resources", response_model=List[ResourceAllocation], summary="Të gjitha burimet")
async def get_resources(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    latest = db.query(ResourceAllocationRecord).order_by(
        ResourceAllocationRecord.generated_at.desc()
    ).first()
    if latest:
        records = db.query(ResourceAllocationRecord).filter(
            ResourceAllocationRecord.run_id == latest.run_id
        ).order_by(ResourceAllocationRecord.resource_type, ResourceAllocationRecord.district).all()
        return [
            ResourceAllocation(
                resource_type=record.resource_type,
                district=record.district,
                quantity=record.quantity,
                cost=record.cost,
                reason=record.reason,
            )
            for record in records
        ]
    df = load_csv("resource_allocations.csv")
    if df is None:
        raise HTTPException(404, "Resource allocations not found")
    
    results = []
    for _, row in df.iterrows():
        results.append(ResourceAllocation(
            resource_type=str(row['resource_type']),
            district=str(row['district']),
            quantity=int(row['quantity']),
            cost=float(row['cost']),
            reason=str(row.get('reason', '')),
        ))
    return results


@router.get("/resources/summary", summary="Përmbledhje e burimeve")
async def get_resources_summary(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    latest = db.query(ResourceAllocationRecord).order_by(
        ResourceAllocationRecord.generated_at.desc()
    ).first()
    if latest:
        records = db.query(ResourceAllocationRecord).filter(
            ResourceAllocationRecord.run_id == latest.run_id
        ).all()
        grouped = {}
        for record in records:
            item = grouped.setdefault(record.resource_type, {
                "resource_type": record.resource_type,
                "total_quantity": 0,
                "districts": 0,
                "total_cost": 0.0,
            })
            item["total_quantity"] += record.quantity
            item["districts"] += 1
            item["total_cost"] += record.cost
        summary = list(grouped.values())
        total_cost = sum(item["total_cost"] for item in summary)
        allocation_run_id = latest.run_id
        allocation_generated_at = latest.generated_at.isoformat()
    else:
        df = load_csv("resource_allocations.csv")
        if df is None:
            raise HTTPException(404, "Resource allocations not found")
        frame = df.groupby('resource_type').agg({
            'quantity': 'sum',
            'district': 'count',
            'cost': 'sum',
        }).reset_index()
        frame.columns = ['resource_type', 'total_quantity', 'districts', 'total_cost']
        summary = frame.to_dict(orient="records")
        total_cost = float(df['cost'].sum())
        allocation_run_id = None
        allocation_generated_at = None
    
    inventory = {
        item.resource_type: item.total_quantity
        for item in db.query(ResourceInventory).all()
    }
    return {
        "by_type": summary,
        "total_cost": total_cost,
        "allocation_run_id": allocation_run_id,
        "allocation_generated_at": allocation_generated_at,
        "inventory": inventory,
        "inventory_updated_at": max(
            (item.updated_at for item in db.query(ResourceInventory).all()),
            default=None,
        ).isoformat() if inventory else None,
    }


@router.get("/resources/runs", summary="Historiku i alokimeve")
async def get_resource_runs(
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    rows = db.query(ResourceAllocationRecord).order_by(
        ResourceAllocationRecord.generated_at.desc()
    ).all()
    runs = []
    seen = set()
    for row in rows:
        if row.run_id in seen:
            continue
        seen.add(row.run_id)
        runs.append({
            "run_id": row.run_id,
            "generated_at": row.generated_at.isoformat(),
            "count": sum(item.run_id == row.run_id for item in rows),
            "total_cost": round(sum(item.cost for item in rows if item.run_id == row.run_id), 2),
        })
        if len(runs) >= limit:
            break
    return runs


@router.patch("/resources/inventory/{resource_type}", summary="Përditëso kapacitetin e burimit")
async def update_resource_inventory(
    resource_type: str,
    request: ResourceInventoryUpdate,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    resource = db.query(ResourceInventory).filter(
        ResourceInventory.resource_type == resource_type
    ).first()
    if resource is None:
        raise HTTPException(status_code=404, detail="Lloji i burimit nuk ekziston")
    previous_quantity = resource.total_quantity
    resource.total_quantity = request.total_quantity
    db.add(AuditLog(
        user_id=current_user.id,
        action="resource_inventory_updated",
        resource_type="resource_inventory",
        resource_id=resource_type,
        details={
            "resource_type": resource_type,
            "previous_quantity": previous_quantity,
            "new_quantity": request.total_quantity,
        },
    ))
    db.commit()
    db.refresh(resource)
    await publish_event(
        "resource:inventory_updated",
        {
            "resource_type": resource.resource_type,
            "total_quantity": resource.total_quantity,
            "updated_at": resource.updated_at.isoformat(),
        },
        channel="resources",
    )
    return {
        "resource_type": resource.resource_type,
        "total_quantity": resource.total_quantity,
        "updated_at": resource.updated_at.isoformat(),
    }


@router.post("/resources/optimize", summary="Rillogarit dhe ruaj alokimin e burimeve")
async def optimize_resources(
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    try:
        capacities = {
            item.resource_type: item.total_quantity
            for item in db.query(ResourceInventory).all()
        }
        result = optimize_processed_resources(DATA_DIR, capacities=capacities)
        persisted_result = persist_resource_allocations(db, result)
        db.add(AuditLog(
            user_id=current_user.id,
            action="resource_allocation_optimized",
            resource_type="resource_allocation",
            resource_id=str(persisted_result.get("run_id")) if persisted_result.get("run_id") else None,
            details={
                "run_id": persisted_result.get("run_id"),
                "resource_types": sorted(capacities),
            },
        ))
        db.commit()
        await publish_event("resource:allocated", persisted_result, channel="resources")
        return persisted_result
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.get("/resources/{district}", summary="Burimet për një lagje")
async def get_resources_by_district(
    district: str,
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    latest = db.query(ResourceAllocationRecord).order_by(
        ResourceAllocationRecord.generated_at.desc()
    ).first()
    if latest:
        records = db.query(ResourceAllocationRecord).filter(
            ResourceAllocationRecord.run_id == latest.run_id,
            ResourceAllocationRecord.district == district,
        ).all()
        if not records:
            raise HTTPException(404, f"District {district} not found")
        return {
            "district": district,
            "resources": [
                {
                    "resource_type": record.resource_type,
                    "district": record.district,
                    "quantity": record.quantity,
                    "cost": record.cost,
                    "reason": record.reason,
                }
                for record in records
            ],
            "total_cost": sum(record.cost for record in records),
            "allocation_run_id": latest.run_id,
            "allocation_generated_at": latest.generated_at.isoformat(),
        }
    df = load_csv("resource_allocations.csv")
    if df is None:
        raise HTTPException(404, "Resource allocations not found")
    
    district_df = df[df['district'] == district]
    if district_df.empty:
        raise HTTPException(404, f"District {district} not found")
    
    return {
        "district": district,
        "resources": district_df.to_dict(orient="records"),
        "total_cost": float(district_df['cost'].sum()),
    }
