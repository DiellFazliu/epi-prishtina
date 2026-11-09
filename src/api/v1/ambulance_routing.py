"""
Routing endpoints — rrugët e ambulancave.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from src.graph.routing import AmbulanceRouter
from src.allocation.dispatch import AmbulanceDispatcher, Emergency
from src.core.security import require_health_worker, require_analyst
from src.db.base import get_db
from src.models import AmbulanceDispatch, AuditLog
from src.websocket.manager import publish_event
from sqlalchemy.orm import Session


router = APIRouter(prefix="/routing", tags=["Routing"])


# ═══════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════

class RouteRequest(BaseModel):
    from_lat: float = Field(..., ge=-90, le=90)
    from_lon: float = Field(..., ge=-180, le=180)
    to_lat: float = Field(..., ge=-90, le=90)
    to_lon: float = Field(..., ge=-180, le=180)
    algorithm: str = "astar"


class RouteResponse(BaseModel):
    distance_m: float
    time_seconds: float
    coordinates: List[List[float]]
    algorithm: str


class EmergencyRequest(BaseModel):
    district: str
    lat: float
    lon: float
    severity: int = Field(1, ge=1, le=5)


class DispatchRequest(BaseModel):
    emergencies: List[EmergencyRequest]


class DispatchStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(en_route|at_scene|completed|cancelled)$")


def dispatch_transition_allowed(previous_status: str, next_status: str) -> bool:
    """Allow only forward operational transitions and cancellation while active."""
    transitions = {
        "en_route": {"at_scene", "cancelled"},
        "at_scene": {"completed", "cancelled"},
    }
    return next_status == previous_status or next_status in transitions.get(previous_status, set())


# ═══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@router.post("/route", response_model=RouteResponse)
async def calculate_route(
    request: RouteRequest,
    current_user=Depends(require_health_worker),
):
    """Kalkulon rrugën më të shkurtër midis dy pikave."""
    try:
        router_instance = AmbulanceRouter()
        result = router_instance.find_shortest_path(
            from_lat=request.from_lat,
            from_lon=request.from_lon,
            to_lat=request.to_lat,
            to_lon=request.to_lon,
            algorithm=request.algorithm,
        )
        
        # Konverto koordinatat në [lat, lon]
        coordinates = [list(c) for c in result["coordinates"]]
        
        return RouteResponse(
            distance_m=result["distance_m"],
            time_seconds=result["time_seconds"],
            coordinates=coordinates,
            algorithm=result["algorithm"],
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Routing operation failed.")


@router.post("/dispatch", summary="Cakto ambulancat për emergjenca")
async def dispatch_ambulances(
    request: DispatchRequest,
    current_user=Depends(require_health_worker),
    db: Session = Depends(get_db),
):
    """
    Cakton ambulancat në mënyrë optimale për emergjencat.
    Përdor Hungarian Algorithm.
    """
    try:
        dispatcher = AmbulanceDispatcher()
        active = db.query(AmbulanceDispatch).filter(
            AmbulanceDispatch.status.in_(["en_route", "at_scene"])
        ).all()
        active_by_ambulance = {record.ambulance_id: record for record in active}
        for ambulance in dispatcher.ambulances:
            record = active_by_ambulance.get(ambulance.id)
            if record:
                ambulance.status = "en_route"
                ambulance.current_lat = record.emergency_lat
                ambulance.current_lon = record.emergency_lon
        
        emergencies = [
            Emergency(
                id=i,
                district=e.district,
                lat=e.lat,
                lon=e.lon,
                severity=e.severity,
            )
            for i, e in enumerate(request.emergencies)
        ]
        
        dispatches = dispatcher.dispatch_emergencies(emergencies)
        emergency_by_id = {emergency.id: emergency for emergency in emergencies}
        persisted = []
        for dispatch in dispatches:
            emergency = emergency_by_id[dispatch.emergency_id]
            ambulance = dispatcher.ambulances[dispatch.ambulance_id]
            route = dispatcher.router.find_shortest_path(
                from_lat=ambulance.base_lat,
                from_lon=ambulance.base_lon,
                to_lat=emergency.lat,
                to_lon=emergency.lon,
            )
            record = AmbulanceDispatch(
                ambulance_id=dispatch.ambulance_id,
                hospital=ambulance.hospital_name,
                district=emergency.district,
                emergency_lat=emergency.lat,
                emergency_lon=emergency.lon,
                severity=emergency.severity,
                distance_km=dispatch.distance_km,
                time_minutes=dispatch.time_minutes,
                cost=dispatch.cost,
                route=route["coordinates"],
            )
            db.add(record)
            persisted.append((dispatch, emergency, record))
        db.flush()
        for dispatch, emergency, record in persisted:
            db.add(AuditLog(
                user_id=current_user.id,
                action="ambulance_dispatch_created",
                resource_type="ambulance_dispatch",
                resource_id=str(record.id),
                details={
                    "ambulance_id": dispatch.ambulance_id,
                    "district": emergency.district,
                    "severity": emergency.severity,
                    "distance_km": dispatch.distance_km,
                    "time_minutes": dispatch.time_minutes,
                },
            ))
        db.commit()
        result = {
            "dispatches": [
                {
                    "id": str(record.id),
                    "ambulance_id": d.ambulance_id,
                    "emergency_id": d.emergency_id,
                    "district": emergency.district,
                    "lat": emergency.lat,
                    "lon": emergency.lon,
                    "distance_km": d.distance_km,
                    "time_minutes": d.time_minutes,
                    "cost": d.cost,
                    "status": record.status,
                    "route": record.route,
                }
                for d, emergency, record in persisted
            ],
            "stats": dispatcher.get_stats(),
        }
        await publish_event("routing:dispatch", result, channel="resources")
        return result
    except Exception:
        raise HTTPException(status_code=500, detail="Routing operation failed.")


@router.get("/ambulances", summary="Lista e ambulancave")
async def list_ambulances(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    """Lista e të gjitha ambulancave me statusin."""
    try:
        dispatcher = AmbulanceDispatcher()
        active = db.query(AmbulanceDispatch).filter(
            AmbulanceDispatch.status.in_(["en_route", "at_scene"])
        ).order_by(AmbulanceDispatch.dispatched_at.desc()).all()
        active_by_ambulance = {record.ambulance_id: record for record in active}
        return {
            "ambulances": [
                {
                    "id": a.id,
                    "hospital": a.hospital_name,
                    "status": active_by_ambulance[a.id].status if a.id in active_by_ambulance else a.status,
                    "current_lat": active_by_ambulance[a.id].emergency_lat if a.id in active_by_ambulance else a.current_lat,
                    "current_lon": active_by_ambulance[a.id].emergency_lon if a.id in active_by_ambulance else a.current_lon,
                    "dispatch_id": str(active_by_ambulance[a.id].id) if a.id in active_by_ambulance else None,
                }
                for a in dispatcher.ambulances
            ],
            "stats": dispatcher.get_stats(),
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Routing operation failed.")


@router.get("/dispatches", summary="Dispatch-et e ruajtura")
async def list_dispatches(
    status: Optional[str] = Query(None, pattern="^(en_route|at_scene|completed|cancelled)$"),
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    query = db.query(AmbulanceDispatch).order_by(AmbulanceDispatch.dispatched_at.desc())
    if status:
        query = query.filter(AmbulanceDispatch.status == status)
    records = query.limit(200).all()
    return {
        "dispatches": [
            {
                "id": str(record.id),
                "ambulance_id": record.ambulance_id,
                "hospital": record.hospital,
                "district": record.district,
                "lat": record.emergency_lat,
                "lon": record.emergency_lon,
                "severity": record.severity,
                "distance_km": record.distance_km,
                "time_minutes": record.time_minutes,
                "cost": record.cost,
                "status": record.status,
                "algorithm": record.algorithm,
                "route": record.route or [],
                "dispatched_at": record.dispatched_at.isoformat(),
                "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            }
            for record in records
        ]
    }


@router.get("/dispatches/summary", summary="Përmbledhje e flotës dhe dispatch-eve")
async def dispatch_summary(
    current_user=Depends(require_analyst),
    db: Session = Depends(get_db),
):
    dispatcher = AmbulanceDispatcher()
    records = db.query(AmbulanceDispatch).all()
    active_count = sum(record.status in {"en_route", "at_scene"} for record in records)
    completed = [record for record in records if record.status == "completed"]
    response_times = [record.time_minutes for record in records]
    return {
        "fleet": {
            "total": len(dispatcher.ambulances),
            "available": len(dispatcher.ambulances) - active_count,
            "active": active_count,
        },
        "dispatches": {
            "total": len(records),
            "active": active_count,
            "completed": len(completed),
            "cancelled": sum(record.status == "cancelled" for record in records),
        },
        "average_response_minutes": round(
            sum(response_times) / len(response_times), 2
        ) if response_times else 0,
        "last_dispatch_at": max(
            (record.dispatched_at for record in records), default=None
        ).isoformat() if records else None,
    }


@router.patch("/dispatches/{dispatch_id}", summary="Përditëso statusin e dispatch-it")
async def update_dispatch_status(
            dispatch_id: str,
            request: DispatchStatusRequest,
            current_user=Depends(require_health_worker),
            db: Session = Depends(get_db),
):
            record = db.query(AmbulanceDispatch).filter(
                AmbulanceDispatch.id == dispatch_id
            ).first()
            if record is None:
                raise HTTPException(status_code=404, detail="Dispatch-i nuk u gjet")
            if request.status == record.status:
                return {"id": str(record.id), "status": record.status}
            if not dispatch_transition_allowed(record.status, request.status):
                raise HTTPException(
                    status_code=409,
                    detail=f"Tranzicioni {record.status} → {request.status} nuk lejohet.",
                )
            previous_status = record.status
            record.status = request.status
            if request.status in {"completed", "cancelled"}:
                from datetime import datetime
                record.completed_at = datetime.utcnow()
            db.add(AuditLog(
                user_id=current_user.id,
                action="ambulance_dispatch_status_updated",
                resource_type="ambulance_dispatch",
                resource_id=str(record.id),
                details={"previous_status": previous_status, "status": request.status},
            ))
            db.commit()
            await publish_event(
                "routing:dispatch",
                {"dispatch_id": str(record.id), "status": record.status},
                channel="resources",
            )
            return {"id": str(record.id), "status": record.status}