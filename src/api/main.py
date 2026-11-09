"""
EpiPrishtina — FastAPI Application.

Version i plotë që përfshin:
    - Authentication + JWT
    - User management (CRUD)
    - Citizen reports (CRUD)
    - Simulations
    - ML Hotspot predictions
    - Resource allocations
    - Dashboard
    - WebSocket (Live Updates)
    - Backward compatibility për endpoint-et e vjetra
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from src.core.config import settings
from src.api.v1 import router as api_v1_router
from src.websocket.routes import router as ws_router
from src.core.pipeline import EpiPipeline
from src.services.live_simulation import live_pipeline, live_simulation


@asynccontextmanager
async def lifespan(_app: FastAPI):
    live_simulation.interval_seconds = settings.SIMULATION_INTERVAL_SECONDS
    live_pipeline.load_state()
    await live_simulation.start(live_pipeline)
    try:
        yield
    finally:
        await live_simulation.stop()


# ═══════════════════════════════════════════════════════════════════
# APP
# ═══════════════════════════════════════════════════════════════════

app = FastAPI(
    title=settings.APP_NAME,
    description="Intelligent Urban Epidemic Response Simulator",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ═══════════════════════════════════════════════════════════════════
# MIDDLEWARE
# ═══════════════════════════════════════════════════════════════════

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══ Middleware për logging 404 ═══
@app.middleware("http")
async def log_404_requests(request: Request, call_next):
    """Logon kërkesat 404 për debugging."""
    response = await call_next(request)
    if response.status_code == 404:
        print(f"⚠ 404: {request.method} {request.url.path}")
        print(f"   Client: {request.client.host if request.client else 'unknown'}")
        print(f"   User-Agent: {request.headers.get('user-agent', 'unknown')[:80]}")
    return response


# ═══════════════════════════════════════════════════════════════════
# ROOT
# ═══════════════════════════════════════════════════════════════════

@app.get("/", tags=["Root"])
async def root():
    """Health check i sistemit."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "docs": "/docs",
        "api_v1": settings.API_V1_PREFIX,
        "websocket": "/ws",
    }


# ═══════════════════════════════════════════════════════════════════
# INCLUDE ROUTERS
# ═══════════════════════════════════════════════════════════════════

app.include_router(api_v1_router)
app.include_router(ws_router)


# ═══════════════════════════════════════════════════════════════════
# BACKWARD COMPATIBILITY — Redirect endpoints e vjetra
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/dashboard", include_in_schema=False)
async def old_dashboard():
    """Redirect i vjetër për dashboard."""
    return RedirectResponse(url="/api/v1/dashboard/summary", status_code=307)


@app.get("/api/hotspots", include_in_schema=False)
async def old_hotspots():
    """Redirect i vjetër për hotspots."""
    return RedirectResponse(url="/api/v1/hotspots", status_code=307)


@app.get("/api/hotspots/top", include_in_schema=False)
async def old_hotspots_top():
    """Redirect i vjetër për top hotspots."""
    return RedirectResponse(url="/api/v1/hotspots/top", status_code=307)


@app.get("/api/simulation/summary", include_in_schema=False)
async def old_simulation_summary():
    """Redirect i vjetër për simulation summary."""
    return RedirectResponse(url="/api/v1/simulation/summary", status_code=307)


@app.get("/api/simulation/history", include_in_schema=False)
async def old_simulation_history():
    """Redirect i vjetër për simulation history."""
    return RedirectResponse(url="/api/v1/simulation/history", status_code=307)


@app.get("/api/resources", include_in_schema=False)
async def old_resources():
    """Redirect i vjetër për resources."""
    return RedirectResponse(url="/api/v1/resources", status_code=307)


@app.get("/api/resources/summary", include_in_schema=False)
async def old_resources_summary():
    """Redirect i vjetër për resources summary."""
    return RedirectResponse(url="/api/v1/resources/summary", status_code=307)


@app.get("/api/reports/summary", include_in_schema=False)
async def old_reports_summary():
    """Redirect i vjetër për reports summary."""
    return RedirectResponse(url="/api/v1/reports/statistics", status_code=307)


@app.get("/api/reports/by-district", include_in_schema=False)
async def old_reports_by_district():
    """Redirect i vjetër për reports by district."""
    return RedirectResponse(url="/api/v1/reports/statistics", status_code=307)


# ═══════════════════════════════════════════════════════════════════
# STATIC UI
# ═══════════════════════════════════════════════════════════════════

UI_DIR = os.path.join(os.path.dirname(__file__), "..", "ui")
if os.path.exists(UI_DIR):
    app.mount("/ui", StaticFiles(directory=UI_DIR, html=True), name="ui")

    @app.get("/ui", include_in_schema=False)
    async def serve_ui():
        """Shërbej faqen e UI."""
        index_path = os.path.join(UI_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(404, "UI not found")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn

    print("\n" + "=" * 60)
    print(f"  {settings.APP_NAME} API")
    print("=" * 60)
    print(f"  Version:    {settings.APP_VERSION}")
    print(f"  Docs:       http://localhost:8000/docs")
    print(f"  ReDoc:      http://localhost:8000/redoc")
    print(f"  WebSocket:  ws://localhost:8000/ws")
    print("=" * 60 + "\n")

    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )