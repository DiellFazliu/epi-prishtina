"""
Pipeline endpoints — logjika e plotë e vendimmarrjes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict
from uuid import UUID
from dataclasses import asdict

from src.core.pipeline import EpiPipeline
from src.core.security import require_health_worker, require_analyst
from src.services.live_simulation import live_pipeline, live_simulation
from src.websocket.manager import publish_event, publish_simulation_update
from src.db.base import get_db
from src.models import (
    AmbulanceDispatch,
    AuditLog,
    HotspotPredictionRecord,
    PipelineSnapshot,
    ResourceInventory,
)
from src.allocation.dispatch import AmbulanceDispatcher
from src.allocation.pipeline import persist_resource_allocations
from src.ml.persistence import persist_hotspot_predictions
from src.ml.report_data import reports_dataframe
from sqlalchemy.orm import Session


router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


# ═══ Singleton për pipeline ═══
_pipeline: Optional[EpiPipeline] = None


def get_pipeline() -> EpiPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = live_pipeline
        _pipeline.load_state()
    return _pipeline


# ═══ Models ═══

class ApplyRequest(BaseModel):
    selected_ids: Optional[List[str]] = None  # None = të gjitha
    days_ahead: int = 30


class CompareRequest(BaseModel):
    days_ahead: int = 30


def _application_summary(log: AuditLog) -> Dict:
    details = log.details or {}
    result = details.get("result") or {}
    selected_ids = details.get("selected_ids")
    return {
        "status": "applied",
        "audit_id": str(log.id),
        "applied_at": log.created_at.isoformat(),
        "applied_by": (
            getattr(log.user, "username", None)
            or getattr(log.user, "email", None)
            if log.user
            else None
        ),
        "selected_count": (
            len(selected_ids)
            if selected_ids is not None
            else result.get("measures", 0)
        ),
        "resource_allocation_count": result.get("resource_allocation_count", 0),
        "dispatch_count": result.get("dispatch_count", 0),
        "days_ahead": details.get("days_ahead", 30),
    }


# ═══ Endpoints ═══

@router.get("/state", summary="Gjendja aktuale e sistemit")
async def get_state(
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_analyst),
):
    """Kthen gjendjen e plotë të pipeline-it."""
    await live_simulation.snapshot(pipeline)
    return {
        "day": pipeline.state.day,
        "simulation_state": pipeline.state.simulation_state,
        "hotspots": pipeline.state.hotspots,
        "active_measures": pipeline.state.active_measures,
        "last_updated": pipeline.state.last_updated,
    }


@router.post("/refresh", summary="Rifresko hotspots (ML)")
async def refresh_hotspots(
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    """Trajno ML dhe rifresko hotspots."""
    await live_simulation.snapshot(pipeline)
    hotspots = pipeline.refresh_hotspots(
        reports=reports_dataframe(db, pipeline.data_dir / "citizen_reports.csv")
    )
    if not hotspots:
        raise HTTPException(status_code=503, detail="Modeli nuk prodhoi parashikime të vlefshme")
    prediction_day = int(pipeline.state.day if pipeline.state else 0)
    import pandas as pd
    prediction_frame = pd.DataFrame(hotspots)
    snapshot = persist_hotspot_predictions(db, prediction_frame, prediction_day)
    await publish_event("hotspot:updated", {"count": len(hotspots), "hotspots": hotspots}, channel="hotspots")
    await publish_simulation_update(await live_simulation.snapshot(pipeline))
    return {"status": "refreshed", "count": len(hotspots), "hotspots": hotspots, **snapshot}


@router.post("/recommend", summary="Gjenero rekomandimet")
async def generate_recommendations(
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    """Gjenero bundlin e plotë të rekomandimeve."""
    await live_simulation.snapshot(pipeline)
    capacities = {
        item.resource_type: item.total_quantity
        for item in db.query(ResourceInventory).all()
    }
    bundle = pipeline.generate_recommendations(capacities=capacities)
    payload = {
        "day": bundle.day,
        "generated_at": bundle.generated_at,
        "recommendations": [asdict(r) for r in bundle.recommendations],
        "baseline_forecast": bundle.baseline_forecast,
        "optimized_forecast": bundle.optimized_forecast,
        "total_expected_impact": bundle.total_expected_impact,
    }
    db.add(PipelineSnapshot(
        snapshot_type="recommendation",
        pipeline_day=str(bundle.day),
        payload=payload,
    ))
    db.commit()
    return {
        **payload,
    }


@router.post("/apply", summary="Apliko rekomandimet e zgjedhura")
async def apply_recommendations(
    request: ApplyRequest,
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    """Apliko rekomandimet e zgjedhura."""
    await live_simulation.snapshot(pipeline)
    # Lexo bundlin e fundit
    snapshot = db.query(PipelineSnapshot).filter(
        PipelineSnapshot.snapshot_type == "recommendation"
    ).order_by(PipelineSnapshot.created_at.desc()).first()
    if snapshot is None:
        raise HTTPException(404, "Nuk ka bundël. Thirr POST /pipeline/recommend fillimisht.")
    data = snapshot.payload

    from src.core.pipeline import Recommendation, RecommendationBundle
    bundle = RecommendationBundle(
        day=data["day"],
        generated_at=data["generated_at"],
        recommendations=[Recommendation(**r) for r in data["recommendations"]],
        baseline_forecast=data["baseline_forecast"],
        optimized_forecast=data["optimized_forecast"],
        total_expected_impact=data["total_expected_impact"],
    )

    selected_recommendations = (
        bundle.recommendations
        if request.selected_ids is None
        else [item for item in bundle.recommendations if item.id in request.selected_ids]
    )
    selected_routing = [item for item in selected_recommendations if item.category == "routing"]
    if selected_routing:
        required_fields = {"ambulance_id", "district", "lat", "lon", "severity", "distance_km", "time_minutes"}
        if any(
            not required_fields.issubset(dispatch)
            for dispatch in selected_routing[0].parameters.get("dispatches", [])
        ):
            raise HTTPException(
                status_code=409,
                detail="Bundle-i i routing është i vjetër dhe nuk përmban të dhënat e emergjencës. Gjenero rekomandime të reja.",
            )
    result = pipeline.apply_bundle(bundle, request.selected_ids)
    resource_result = None
    if result.get("resource_recommendations"):
        resource_rows = [
            {
                "resource_type": recommendation["resource_type"],
                "district": allocation["district"],
                "quantity": allocation["quantity"],
                "cost": allocation.get("cost", 0),
                "reason": recommendation["reason"],
            }
            for recommendation in result["resource_recommendations"]
            for allocation in recommendation["allocations"]
        ]
        resource_result = persist_resource_allocations(db, {
            "status": "success",
            "allocations": resource_rows,
            "total_cost": 0,
        }, commit=False)

    routing_records = []
    if result.get("routing_dispatches"):
        dispatcher = AmbulanceDispatcher()
        active_ambulances = {
            row.ambulance_id
            for row in db.query(AmbulanceDispatch).filter(
                AmbulanceDispatch.status.in_(["en_route", "at_scene"])
            ).all()
        }
        for dispatch in result["routing_dispatches"]:
            ambulance = next(
                (
                    item for item in dispatcher.ambulances
                    if item.id == dispatch["ambulance_id"]
                    and item.id not in active_ambulances
                ),
                None,
            )
            if ambulance is None:
                continue
            route = dispatcher.router.find_shortest_path(
                from_lat=ambulance.base_lat,
                from_lon=ambulance.base_lon,
                to_lat=dispatch["lat"],
                to_lon=dispatch["lon"],
            )
            record = AmbulanceDispatch(
                ambulance_id=ambulance.id,
                hospital=ambulance.hospital_name,
                district=dispatch["district"],
                emergency_lat=dispatch["lat"],
                emergency_lon=dispatch["lon"],
                severity=dispatch["severity"],
                distance_km=dispatch["distance_km"],
                time_minutes=dispatch["time_minutes"],
                cost=dispatch["time_minutes"] * (dispatch["severity"] / 3),
                route=route["coordinates"],
            )
            db.add(record)
            routing_records.append(record)
            active_ambulances.add(ambulance.id)
        db.flush()
        for record in routing_records:
            db.add(AuditLog(
                user_id=current_user.id,
                action="pipeline_dispatch_created",
                resource_type="ambulance_dispatch",
                resource_id=str(record.id),
                details={
                    "snapshot_id": str(snapshot.id),
                    "ambulance_id": record.ambulance_id,
                    "district": record.district,
                    "severity": record.severity,
                },
            ))

    result["resource_run_id"] = resource_result.get("run_id") if resource_result else None
    result["resource_allocation_count"] = resource_result.get("allocation_count", 0) if resource_result else 0
    result["dispatch_count"] = len(routing_records)
    db.add(AuditLog(
        user_id=current_user.id,
        action="pipeline_recommendations_applied",
        resource_type="pipeline",
        resource_id=str(snapshot.id),
        details={
            "snapshot_id": str(snapshot.id),
            "selected_ids": request.selected_ids,
            "days_ahead": request.days_ahead,
            "result": result,
        },
    ))
    db.commit()
    live_simulation.persist_measures(pipeline)
    await publish_simulation_update(await live_simulation.snapshot(pipeline))
    return result


@router.get("/recommendation", summary="Rekomandimi i fundit i ruajtur")
async def get_latest_recommendation(
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    """Kthen bundle-in e fundit pa gjeneruar një run të ri."""
    snapshot = db.query(PipelineSnapshot).filter(
        PipelineSnapshot.snapshot_type == "recommendation"
    ).order_by(PipelineSnapshot.created_at.desc()).first()
    if snapshot is None:
        raise HTTPException(404, "Nuk ka rekomandim të ruajtur.")
    return {
        **snapshot.payload,
        "snapshot_id": str(snapshot.id),
        "saved_at": snapshot.created_at.isoformat(),
    }


@router.get("/history", summary="Historiku i run-eve të Pipeline-it")
async def get_pipeline_history(
    limit: int = Query(20, ge=1, le=100),
    snapshot_type: Optional[str] = Query(None, pattern="^(recommendation|comparison)$"),
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    """Kthen metadata të run-eve pa ekspozuar payload-et e plota."""
    query = db.query(PipelineSnapshot)
    if snapshot_type:
        query = query.filter(PipelineSnapshot.snapshot_type == snapshot_type)
    snapshots = query.order_by(PipelineSnapshot.created_at.desc()).limit(limit).all()
    snapshot_ids = [str(snapshot.id) for snapshot in snapshots]
    day_ids = [f"day-{snapshot.pipeline_day}" for snapshot in snapshots]
    applied_logs = db.query(AuditLog).filter(
        AuditLog.action == "pipeline_recommendations_applied",
        AuditLog.resource_id.in_(snapshot_ids + day_ids),
    ).order_by(AuditLog.created_at.desc()).all()
    applications = {}
    for log in applied_logs:
        applications.setdefault(log.resource_id, _application_summary(log))

    history = []
    for snapshot in snapshots:
        payload = snapshot.payload or {}
        impact = payload.get("total_expected_impact", {})
        comparison = payload.get("comparison", {})
        application = applications.get(
            str(snapshot.id),
            applications.get(f"day-{snapshot.pipeline_day}"),
        )
        history.append({
            "id": str(snapshot.id),
            "type": snapshot.snapshot_type,
            "pipeline_day": snapshot.pipeline_day,
            "created_at": snapshot.created_at.isoformat(),
            "recommendation_count": len(payload.get("recommendations", [])),
            "cases_avoided": impact.get("cases_avoided", comparison.get("cases_avoided", 0)),
            "deaths_avoided": impact.get("deaths_avoided", comparison.get("deaths_avoided", 0)),
            "dispatch_count": payload.get("dispatch_count", 0),
            "application": application,
        })
    return history


@router.get("/history/{snapshot_id}", summary="Hap një run të Pipeline-it")
async def get_pipeline_history_snapshot(
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    """Kthen payload-in e plotë të një run-i të ruajtur."""
    snapshot = db.query(PipelineSnapshot).filter(
        PipelineSnapshot.id == snapshot_id
    ).first()
    if snapshot is None:
        raise HTTPException(404, "Run-i i Pipeline-it nuk u gjet.")
    application_log = db.query(AuditLog).filter(
        AuditLog.action == "pipeline_recommendations_applied",
        AuditLog.resource_id.in_([str(snapshot.id), f"day-{snapshot.pipeline_day}"]),
    ).order_by(AuditLog.created_at.desc()).first()
    return {
        **(snapshot.payload or {}),
        "snapshot_id": str(snapshot.id),
        "snapshot_type": snapshot.snapshot_type,
        "pipeline_day": snapshot.pipeline_day,
        "saved_at": snapshot.created_at.isoformat(),
        "application": _application_summary(application_log) if application_log else None,
    }


@router.post("/simulate", summary="Simulo përpara me masat aktuale")
async def simulate_forward(
    request: CompareRequest,
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Simulo përpara dhe krahaso me/pa masa."""
    await live_simulation.snapshot(pipeline)
    result = pipeline.simulate_forward(days=request.days_ahead)
    db.add(PipelineSnapshot(
        snapshot_type="comparison",
        pipeline_day=str(pipeline.state.day if pipeline.state else 0),
        payload=result,
    ))
    db.commit()
    return result


@router.get("/comparison", summary="Krahasimi i fundit")
async def get_comparison(
    db: Session = Depends(get_db),
    current_user=Depends(require_analyst),
):
    """Kthe krahasimin e fundit të ruajtur."""
    snapshot = db.query(PipelineSnapshot).filter(
        PipelineSnapshot.snapshot_type == "comparison"
    ).order_by(PipelineSnapshot.created_at.desc()).first()
    if snapshot is None:
        raise HTTPException(404, "Nuk ka krahasim të ruajtur.")
    return snapshot.payload


@router.get("/live", summary="Gjendja e simulimit live")
async def get_live_simulation(
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_analyst),
):
    return await live_simulation.snapshot(pipeline)


@router.post("/live/toggle", summary="Ndalo ose nis simulimin live")
async def toggle_live_simulation(
    running: bool,
    pipeline: EpiPipeline = Depends(get_pipeline),
    current_user=Depends(require_health_worker),
):
    await live_simulation.set_running(running, pipeline)
    return await live_simulation.snapshot(pipeline)