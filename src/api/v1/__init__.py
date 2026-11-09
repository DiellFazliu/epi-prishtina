"""
API v1 router — bashkon të gjitha endpoints.
"""

from fastapi import APIRouter

from src.api.v1 import auth, pipeline, reports, users, dashboard, simulation
from src.api.v1 import map as map_routes
from src.api.v1 import ambulance_routing
from src.api.v1 import rl
from src.workers import routes as workers_routes


router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(reports.router)
router.include_router(users.router)
router.include_router(dashboard.router)
router.include_router(simulation.router)
router.include_router(map_routes.router)
router.include_router(ambulance_routing.router)
router.include_router(rl.router)
router.include_router(pipeline.router)
router.include_router(workers_routes.router)

__all__ = ["router"]