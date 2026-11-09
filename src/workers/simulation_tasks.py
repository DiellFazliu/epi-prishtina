"""
Celery tasks për simulim dhe statistika.
"""

import asyncio
from datetime import datetime
from celery import shared_task

from src.workers.celery_app import celery_app
from src.db.base import SessionLocal
from src.models import Simulation, SimulationDay, CitizenReport, Intervention, ReportStatus, SimulationStatus
from src.simulation.intervention_engine import advance_day
from src.simulation.intervention_engine import initial_state


@celery_app.task(name="src.workers.simulation_tasks.step_simulation")
def step_simulation():
    """
    Ekzekuton një hap të simulimit SEIRD.
    
    Kjo detyrë thirret çdo minutë nga Celery Beat.
    """
    db = SessionLocal()
    try:
        # Gjej simulimin aktiv
        simulation = db.query(Simulation).filter(
            Simulation.status == SimulationStatus.RUNNING
        ).order_by(Simulation.created_at.desc()).with_for_update().first()

        if not simulation:
            print("Nuk ka simulim aktiv")
            return {"status": "no_active_simulation"}

        current_day = simulation.current_day + 1
        state = simulation.parameters.get("state")
        if not state:
            raise ValueError("Active simulation has no saved compartment state")

        active_measures = db.query(Intervention).filter(
            Intervention.simulation_id == simulation.id,
            Intervention.started_day <= current_day,
            (Intervention.ended_day.is_(None) | (Intervention.ended_day >= current_day)),
        ).all()
        state, metrics = advance_day(state, [
            {"type": measure.intervention_type, "intensity": measure.intensity}
            for measure in active_measures
        ])
        simulation.parameters = {**simulation.parameters, "state": state}
        simulation.current_day = current_day
        simulation.total_infected = round(simulation.parameters["state"]["population"] - state["susceptible"])
        if simulation.peak_cases is None or metrics["active"] > simulation.peak_cases:
            simulation.peak_cases = metrics["active"]
            simulation.peak_day = current_day
        day = db.query(SimulationDay).filter(
            SimulationDay.simulation_id == simulation.id,
            SimulationDay.day == current_day,
        ).first()
        if day is None:
            day = SimulationDay(simulation_id=simulation.id, day=current_day)
            db.add(day)
        day.susceptible = round(state["susceptible"])
        day.exposed = round(state["exposed"])
        day.infectious_mild = round(state["infectious_mild"])
        day.infectious_severe = round(state["infectious_severe"])
        day.hospitalized = round(state["hospitalized"])
        day.icu = round(state["icu"])
        day.recovered = round(state["recovered"])
        day.dead = round(state["dead"])
        day.real_active = metrics["active"]
        day.real_deaths = round(state["dead"])
        day.rt = metrics["rt"]
        day.new_cases = metrics["new_cases"]

        if current_day >= simulation.total_days:
            simulation.status = SimulationStatus.COMPLETED
            simulation.completed_at = datetime.utcnow()

        db.commit()

        print(f"✓ SEIR advanced to day {current_day}; active={metrics['active']}, Rt={metrics['rt']}")
        return {
            "status": "success",
            "simulation_id": str(simulation.id),
            "current_day": current_day,
            "active": metrics["active"],
            "new_cases": metrics["new_cases"],
            "rt": metrics["rt"],
            "measures_applied": [measure.intervention_type for measure in active_measures],
        }

    except Exception as e:
        db.rollback()
        print(f"✗ Gabim në simulim: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="src.workers.simulation_tasks.reallocate_resources")
def reallocate_resources():
    """
    Rishpërndan burimet emergjente.
    
    Thirret çdo ditë në orën 2 AM.
    """
    import sys
    from src.allocation.pipeline import optimize_processed_resources, persist_resource_allocations
    from src.db.base import SessionLocal
    from src.models import ResourceInventory

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")

    try:
        db = SessionLocal()
        try:
            capacities = {
                item.resource_type: item.total_quantity
                for item in db.query(ResourceInventory).all()
            }
            result = optimize_processed_resources(capacities=capacities)
            persisted = persist_resource_allocations(db, result)
            return {**persisted, "timestamp": datetime.utcnow().isoformat()}
        finally:
            db.close()
    except Exception as error:
        return {"status": "error", "error": str(error)}


@celery_app.task(name="src.workers.simulation_tasks.aggregate_statistics")
def aggregate_statistics():
    """
    Agrego statistika nga raportet e qytetarëve.
    
    Thirret çdo orë.
    """
    db = SessionLocal()
    try:
        # Total raporte
        total = db.query(CitizenReport).count()
        
        # Raporte të reja në 1 orë
        from datetime import timedelta
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent = db.query(CitizenReport).filter(
            CitizenReport.reported_at >= one_hour_ago
        ).count()

        # Në pritje
        pending = db.query(CitizenReport).filter(
            CitizenReport.status == ReportStatus.PENDING
        ).count()

        stats = {
            "total_reports": total,
            "last_hour": recent,
            "pending": pending,
            "timestamp": datetime.utcnow().isoformat(),
        }

        print(f"✓ Statistika u agreguan: {stats}")
        return stats

    except Exception as e:
        print(f"✗ Gabim: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="src.workers.simulation_tasks.run_full_simulation")
def run_full_simulation(simulation_id: str):
    """
    Ekzekuton një simulim të plotë.
    
    Args:
        simulation_id: UUID i simulimit.
    """
    db = SessionLocal()
    try:
        simulation = db.query(Simulation).filter(
            Simulation.id == simulation_id
        ).first()

        if not simulation:
            return {"status": "error", "error": "Simulation not found"}

        state = simulation.parameters.get("state") if simulation.parameters else None
        if not state:
            import pandas as pd
            from src.api.v1.simulation import DATA_DIR
            from pathlib import Path
            history_path = Path(DATA_DIR) / "simulation_history.csv"
            history = pd.read_csv(history_path) if history_path.exists() else None
            seed = history.iloc[-1].to_dict() if history is not None and not history.empty else None
            state = initial_state(seed)
            simulation.parameters = {**(simulation.parameters or {}), "state": state, "model": "deterministic-seir-v1"}
            if not simulation.daily_stats:
                db.add(SimulationDay(
                    simulation_id=simulation.id,
                    day=simulation.current_day,
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
                    rt=1.0,
                    new_cases=0,
                ))
        simulation.status = SimulationStatus.RUNNING
        simulation.started_at = datetime.utcnow()
        db.commit()

        print(f"✓ Simulimi {simulation_id} filloi")
        return {"status": "success", "simulation_id": simulation_id}

    except Exception as e:
        db.rollback()
        print(f"✗ Gabim: {e}")
        return {"status": "error", "error": str(e)}
    finally:
        db.close()
