"""Live, persisted simulation loop shared by the dashboard and pipeline."""

from __future__ import annotations

import asyncio
import csv
from datetime import datetime
from pathlib import Path
from typing import Any
from sqlalchemy.exc import SQLAlchemyError

from src.core.pipeline import EpiPipeline
from src.db.base import SessionLocal
from src.models import Intervention, ScenarioType, Simulation, SimulationDay, SimulationStatus
from src.simulation.intervention_engine import advance_day
from src.simulation.intervention_engine import forecast
from src.websocket.manager import publish_simulation_update


class LiveSimulation:
    """Advances one epidemiological day on every configured wall-clock interval."""

    def __init__(self, interval_seconds: int = 10):
        self.interval_seconds = max(1, interval_seconds)
        self.running = False
        self._task: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def start(self, pipeline: EpiPipeline) -> None:
        if self._task and not self._task.done():
            self.running = True
            self._set_database_status(SimulationStatus.RUNNING)
            return
        status = self._restore_from_database(pipeline)
        self.running = True
        if status == SimulationStatus.PAUSED:
            self._set_database_status(SimulationStatus.RUNNING)
        self._task = asyncio.create_task(self._run(pipeline))

    async def stop(self) -> None:
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    async def set_running(self, running: bool, pipeline: EpiPipeline) -> None:
        if running:
            await self.start(pipeline)
        else:
            self.running = False
            self._set_database_status(SimulationStatus.PAUSED)

    @staticmethod
    def persist_measures(pipeline: EpiPipeline) -> None:
        """Synchronize measures selected by the legacy pipeline with the durable model."""
        db = SessionLocal()
        try:
            simulation = db.query(Simulation).filter(
                Simulation.status.in_([SimulationStatus.RUNNING, SimulationStatus.PAUSED])
            ).order_by(Simulation.created_at.desc()).with_for_update().first()
            if simulation is None:
                return
            db.query(Intervention).filter(
                Intervention.simulation_id == simulation.id,
                Intervention.ended_day.is_(None),
            ).update({Intervention.ended_day: pipeline.state.day}, synchronize_session=False)
            for measure in pipeline.state.active_measures:
                db.add(Intervention(
                    simulation_id=simulation.id,
                    intervention_type=measure["type"],
                    target_district=measure.get("target_district"),
                    intensity=measure.get("intensity", 1.0),
                    description="Aplikuar nga pipeline-i operacional",
                    started_day=pipeline.state.day,
                ))
            db.commit()
        except SQLAlchemyError as error:
            db.rollback()
            print(f"Live simulation measure persistence failed: {error}")
        finally:
            db.close()

    @staticmethod
    def _set_database_status(status: SimulationStatus) -> None:
        db = SessionLocal()
        try:
            simulation = db.query(Simulation).filter(
                Simulation.status.in_([SimulationStatus.RUNNING, SimulationStatus.PAUSED])
            ).order_by(Simulation.created_at.desc()).with_for_update().first()
            if simulation:
                simulation.status = status
                db.commit()
        except SQLAlchemyError as error:
            db.rollback()
            print(f"Live simulation status persistence failed: {error}")
        finally:
            db.close()

    async def snapshot(self, pipeline: EpiPipeline) -> dict[str, Any]:
        async with self._lock:
            if pipeline.state is None:
                pipeline.load_state()
            self._restore_from_database(pipeline)
            return self._payload(pipeline)

    async def _run(self, pipeline: EpiPipeline) -> None:
        while self.running:
            await asyncio.sleep(self.interval_seconds)
            if self.running:
                await self.tick(pipeline)

    async def tick(self, pipeline: EpiPipeline) -> dict[str, Any]:
        async with self._lock:
            if pipeline.state is None:
                pipeline.load_state()
            state, stats = advance_day(
                pipeline.state.simulation_state,
                pipeline.state.active_measures,
            )
            pipeline.state.day += 1
            pipeline.state.simulation_state = state
            pipeline.state.last_updated = datetime.utcnow().isoformat()
            self._append_history(pipeline, stats)
            self._persist_tick(pipeline, stats)
            payload = self._payload(pipeline)

        await publish_simulation_update(payload)
        return payload

    @staticmethod
    def _payload(pipeline: EpiPipeline) -> dict[str, Any]:
        state = pipeline.state.simulation_state
        infectious = state.get("infectious_mild", 0) + state.get("infectious_severe", 0)
        rt = round(
            0.32 * 7 * state.get("susceptible", 0) / state["population"],
            3,
        ) if state.get("population") else 0
        baseline = forecast(state, [], days=30)
        active_forecast = forecast(state, pipeline.state.active_measures, days=30)
        return {
            "day": pipeline.state.day,
            "simulation_state": state,
            "active_measures": pipeline.state.active_measures,
            "hotspots": pipeline.state.hotspots,
            "scenarios": [
                LiveSimulation._scenario("no-intervention", "Pa ndërhyrje", baseline, "#ff4757"),
                LiveSimulation._scenario("active-measures", "Masat aktive", active_forecast, "#2ed573"),
            ],
            "stats": {
                "active": round(
                    state.get("exposed", 0)
                    + infectious
                    + state.get("hospitalized", 0)
                    + state.get("icu", 0)
                ),
                "rt": rt,
                "deaths": round(state.get("dead", 0)),
            },
            "running": live_simulation.running,
            "last_updated": pipeline.state.last_updated,
        }

    @staticmethod
    def _scenario(key: str, label: str, result: dict, color: str) -> dict:
        return {
            "key": key,
            "label": label,
            "subtitle": "Projeksion SEIR 30-ditor nga gjendja aktuale",
            "peak": result["peak_active"],
            "peakDate": f"Dita +{result['days']}",
            "deaths": result["deaths_at_end"],
            "newCases": result["new_cases"],
            "rt": result["rt_at_end"],
            "overload": round(
                100 * result["peak_active"] / result["state"]["population"], 1
            ),
            "color": color,
        }

    @staticmethod
    def _append_history(pipeline: EpiPipeline, stats: dict[str, Any]) -> None:
        path = pipeline.data_dir / "simulation_history.csv"
        state = pipeline.state.simulation_state
        row = {
            "day": pipeline.state.day,
            "S": state["susceptible"],
            "E": state["exposed"],
            "I_mild": state["infectious_mild"],
            "I_severe": state["infectious_severe"],
            "H": state["hospitalized"],
            "ICU": state["icu"],
            "R": state["recovered"],
            "D": state["dead"],
            "active": state["exposed"] + state["infectious_mild"]
            + state["infectious_severe"] + state["hospitalized"] + state["icu"],
            "real_active": state["exposed"] + state["infectious_mild"]
            + state["infectious_severe"] + state["hospitalized"] + state["icu"],
            "real_deaths": state["dead"],
            "new_cases": stats["new_cases"],
            "rt": stats["rt"],
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        exists = path.exists()
        fieldnames = row.keys()
        if exists:
            with path.open(newline="") as existing_file:
                fieldnames = next(csv.reader(existing_file), list(row.keys()))
        with path.open("a", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames, extrasaction="ignore")
            if not exists:
                writer.writeheader()
            writer.writerow({key: row.get(key, "") for key in fieldnames})

    @staticmethod
    def _restore_from_database(pipeline: EpiPipeline) -> SimulationStatus | None:
        """Use the latest database simulation as the durable source of truth."""
        db = SessionLocal()
        try:
            simulation = db.query(Simulation).filter(
                Simulation.status.in_([SimulationStatus.RUNNING, SimulationStatus.PAUSED])
            ).order_by(Simulation.created_at.desc()).with_for_update().first()
            if simulation is None:
                return None
            state = (simulation.parameters or {}).get("state")
            if not state:
                return simulation.status
            measures = db.query(Intervention).filter(
                Intervention.simulation_id == simulation.id,
                Intervention.ended_day.is_(None),
            ).all()
            pipeline.state.day = simulation.current_day
            pipeline.state.simulation_state = state
            pipeline.state.active_measures = [
                {"type": item.intervention_type, "target_district": item.target_district, "intensity": item.intensity}
                for item in measures
            ]
            return simulation.status
        except SQLAlchemyError as error:
            print(f"Live simulation database restore failed: {error}")
            return None
        finally:
            db.close()

    @staticmethod
    def _persist_tick(pipeline: EpiPipeline, stats: dict[str, Any]) -> None:
        db = SessionLocal()
        try:
            simulation = db.query(Simulation).filter(
                Simulation.status.in_([SimulationStatus.RUNNING, SimulationStatus.PAUSED])
            ).order_by(Simulation.created_at.desc()).with_for_update().first()
            if simulation is None:
                simulation = Simulation(
                    name="Simulimi live EpiPrishtina",
                    description="State epidemiologjik live i lidhur me Command Center.",
                    scenario_type=ScenarioType.CUSTOM,
                    parameters={"state": pipeline.state.simulation_state, "model": "deterministic-seir-v1"},
                    status=SimulationStatus.RUNNING,
                    current_day=pipeline.state.day,
                    total_days=365,
                )
                db.add(simulation)
                db.flush()
            else:
                simulation.current_day = pipeline.state.day
                simulation.parameters = {
                    **(simulation.parameters or {}),
                    "state": pipeline.state.simulation_state,
                    "model": "deterministic-seir-v1",
                }
                simulation.status = SimulationStatus.RUNNING
            day = db.query(SimulationDay).filter(
                SimulationDay.simulation_id == simulation.id,
                SimulationDay.day == pipeline.state.day,
            ).first()
            if day is None:
                day = SimulationDay(simulation_id=simulation.id, day=pipeline.state.day)
                db.add(day)
            day.susceptible = round(pipeline.state.simulation_state["susceptible"])
            day.exposed = round(pipeline.state.simulation_state["exposed"])
            day.infectious_mild = round(pipeline.state.simulation_state["infectious_mild"])
            day.infectious_severe = round(pipeline.state.simulation_state["infectious_severe"])
            day.hospitalized = round(pipeline.state.simulation_state["hospitalized"])
            day.icu = round(pipeline.state.simulation_state["icu"])
            day.recovered = round(pipeline.state.simulation_state["recovered"])
            day.dead = round(pipeline.state.simulation_state["dead"])
            day.real_active = stats["active"]
            day.real_deaths = round(pipeline.state.simulation_state["dead"])
            day.rt = stats["rt"]
            day.new_cases = stats["new_cases"]
            db.commit()
        except SQLAlchemyError as error:
            db.rollback()
            print(f"Live simulation database persistence failed: {error}")
        finally:
            db.close()


live_simulation = LiveSimulation()
live_pipeline = EpiPipeline()
