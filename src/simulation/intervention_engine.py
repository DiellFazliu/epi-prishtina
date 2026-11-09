"""Deterministic city-wide SEIR projection used by strategy previews and workers."""

from __future__ import annotations

from copy import deepcopy
from typing import Iterable


MEASURE_EFFECTS = {
    "movement_restriction": 0.28,
    "venue_closures": 0.18,
    "testing": 0.10,
    "remote_work": 0.16,
    "vaccination": 0.0,
    "transport_restriction": 0.12,
}

DEFAULT_POPULATION = 22_000
BASE_TRANSMISSION_RATE = 0.32
INCUBATION_DAYS = 5
INFECTIOUS_DAYS = 7


def normalize_measures(measures: Iterable[dict]) -> list[dict]:
    normalized = []
    for measure in measures:
        kind = str(measure["type"])
        if kind not in MEASURE_EFFECTS:
            raise ValueError(f"Unknown intervention type: {kind}")
        intensity = max(0.0, min(1.0, float(measure.get("intensity", 1.0))))
        normalized.append({**measure, "type": kind, "intensity": intensity})
    return normalized


def transmission_multiplier(measures: Iterable[dict]) -> float:
    multiplier = 1.0
    for measure in normalize_measures(measures):
        multiplier *= 1.0 - MEASURE_EFFECTS[measure["type"]] * measure["intensity"]
    return max(0.05, multiplier)


def initial_state(source: dict | None = None) -> dict:
    source = source or {}
    state = {
        "population": max(1.0, float(source.get("population", DEFAULT_POPULATION))),
        "susceptible": float(source.get("S", source.get("susceptible", DEFAULT_POPULATION - 20))),
        "exposed": float(source.get("E", source.get("exposed", 20))),
        "infectious_mild": float(source.get("I_mild", source.get("infectious_mild", 0))),
        "infectious_severe": float(source.get("I_severe", source.get("infectious_severe", 0))),
        "hospitalized": float(source.get("H", source.get("hospitalized", 0))),
        "icu": float(source.get("ICU", source.get("icu", 0))),
        "recovered": float(source.get("R", source.get("recovered", 0))),
        "dead": float(source.get("D", source.get("dead", 0))),
    }
    total = sum(state[key] for key in state if key != "population")
    if total <= 0:
        state["susceptible"] = state["population"] - 20
        state["exposed"] = 20
    elif total > state["population"]:
        factor = state["population"] / total
        for key in state:
            if key != "population":
                state[key] *= factor
    return state


def advance_day(state: dict, measures: Iterable[dict] = ()) -> tuple[dict, dict]:
    """Advance one deterministic SEIR day; preserve population across all compartments."""
    next_state = deepcopy(state)
    infectious = state["infectious_mild"] + state["infectious_severe"]
    beta = BASE_TRANSMISSION_RATE * transmission_multiplier(measures)
    new_exposed = min(state["susceptible"], beta * state["susceptible"] * infectious / state["population"])
    new_infectious = min(state["exposed"], state["exposed"] / INCUBATION_DAYS)
    new_severe = new_infectious * 0.12
    new_mild = new_infectious - new_severe
    mild_recovery = min(state["infectious_mild"] + new_mild, (state["infectious_mild"] + new_mild) / INFECTIOUS_DAYS)
    severe_to_hospital = min(state["infectious_severe"] + new_severe, (state["infectious_severe"] + new_severe) * 0.08)
    severe_recovery = min(state["infectious_severe"] + new_severe - severe_to_hospital, (state["infectious_severe"] + new_severe - severe_to_hospital) / 14)
    hospital_to_icu = min(state["hospitalized"], state["hospitalized"] * 0.04)
    hospital_deaths = min(state["hospitalized"] - hospital_to_icu, state["hospitalized"] * 0.002)
    hospital_recovery = max(0.0, state["hospitalized"] - hospital_to_icu - hospital_deaths) / 10
    icu_deaths = min(state["icu"], state["icu"] * 0.01)
    icu_recovery = max(0.0, state["icu"] - icu_deaths) / 14

    vaccination = min(state["susceptible"] - new_exposed, state["susceptible"] * sum(
        0.002 * measure["intensity"] for measure in normalize_measures(measures) if measure["type"] == "vaccination"
    ))
    next_state.update({
        "susceptible": state["susceptible"] - new_exposed - vaccination,
        "exposed": state["exposed"] + new_exposed - new_infectious,
        "infectious_mild": state["infectious_mild"] + new_mild - mild_recovery,
        "infectious_severe": state["infectious_severe"] + new_severe - severe_to_hospital - severe_recovery,
        "hospitalized": state["hospitalized"] + severe_to_hospital - hospital_to_icu - hospital_deaths - hospital_recovery,
        "icu": state["icu"] + hospital_to_icu - icu_deaths - icu_recovery,
        "recovered": state["recovered"] + vaccination + mild_recovery + severe_recovery + hospital_recovery + icu_recovery,
        "dead": state["dead"] + hospital_deaths + icu_deaths,
    })
    active = next_state["exposed"] + next_state["infectious_mild"] + next_state["infectious_severe"] + next_state["hospitalized"] + next_state["icu"]
    stats = {
        "new_cases": int(round(new_exposed)),
        "active": int(round(active)),
        "rt": round(beta * INFECTIOUS_DAYS * next_state["susceptible"] / next_state["population"], 3),
    }
    return next_state, stats


def forecast(source: dict, measures: Iterable[dict], days: int = 30) -> dict:
    state = initial_state(source)
    peak = 0
    total_new = 0
    measure_list = normalize_measures(measures)
    for _ in range(days):
        state, stats = advance_day(state, measure_list)
        peak = max(peak, stats["active"])
        total_new += stats["new_cases"]
    return {
        "days": days,
        "active_at_end": stats["active"] if days else 0,
        "peak_active": peak,
        "new_cases": total_new,
        "deaths_at_end": int(round(state["dead"])),
        "rt_at_end": stats["rt"] if days else 0,
        "state": state,
    }
