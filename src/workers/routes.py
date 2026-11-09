"""
Admin routes për menaxhimin e Celery workers.
"""

from fastapi import APIRouter, Depends
from src.workers.celery_app import celery_app
from src.core.security import require_admin


router = APIRouter(prefix="/workers", tags=["Workers"])


@router.get("/status", summary="Statusi i workers")
async def workers_status(current_user=Depends(require_admin)):
    """Statusi i Celery workers."""
    try:
        inspect = celery_app.control.inspect()
        
        # Workers aktivë
        active = inspect.active() or {}
        registered = inspect.registered() or {}
        scheduled = inspect.scheduled() or {}
        
        # Stats
        stats = inspect.stats() or {}
        
        return {
            "active_workers": list(active.keys()),
            "total_active_tasks": sum(len(tasks) for tasks in active.values()),
            "total_registered_tasks": sum(len(tasks) for tasks in registered.values()),
            "total_scheduled": sum(len(tasks) for tasks in scheduled.values()),
            "workers": stats,
        }
    except Exception:
        return {"error": "Worker inspection unavailable"}


@router.get("/tasks", summary="Lista e detyrave")
async def list_tasks(current_user=Depends(require_admin)):
    """Lista e të gjitha detyrave të regjistruara."""
    try:
        inspect = celery_app.control.inspect()
        registered = inspect.registered() or {}
        
        all_tasks = set()
        for tasks in registered.values():
            all_tasks.update(tasks)
        
        # Info për secilën detyrë
        tasks_info = []
        for task_name in sorted(all_tasks):
            tasks_info.append({
                "name": task_name,
                "schedule": _get_schedule(task_name),
            })
        
        return {
            "total": len(tasks_info),
            "tasks": tasks_info,
        }
    except Exception:
        return {"error": "Worker inspection unavailable"}


def _get_schedule(task_name: str) -> str:
    """Kthen orarin e një detyre."""
    schedule = celery_app.conf.beat_schedule
    for name, config in schedule.items():
        if config["task"] == task_name:
            return str(config["schedule"])
    return "manual"


@router.post("/trigger/{task_name}", summary="Nis një detyrë manualisht")
async def trigger_task(
    task_name: str,
    current_user=Depends(require_admin),
):
    """Nis një detyrë Celery manualisht."""
    # Gjej detyrën në beat_schedule
    schedule = celery_app.conf.beat_schedule
    task_full_name = None
    
    for name, config in schedule.items():
        if name == task_name or config["task"].endswith(task_name):
            task_full_name = config["task"]
            break
    
    if not task_full_name:
        return {"error": f"Task '{task_name}' nuk u gjet"}
    
    # Nis detyrën
    result = celery_app.send_task(task_full_name)
    
    return {
        "status": "triggered",
        "task_name": task_full_name,
        "task_id": result.id,
    }