"""
Pipeline-i i plotë i EpiPrishtina.

Rrjedha:
    1. Lexo raportet live + gjendjen e simulimit
    2. Trajno ML për hotspot prediction
    3. Zbato algoritmet e optimizimit (Hungarian, Graph)
    4. Gjenero rekomandime (masa + burime + rrugë)
    5. Prit vendimin e userit
    6. Apliko masat + re-run simulimin
    7. Krahaso para/pas + vizualizo
"""

import sys
from pathlib import Path

# Shto root në path për ekzekutim direkt
_root = Path(__file__).resolve().parent.parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

import os
import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np

from src.simulation.intervention_engine import (
    initial_state, advance_day, forecast, MEASURE_EFFECTS, normalize_measures
)
from src.allocation.resource_allocator import ResourceAllocator
from src.ml.hotspot_predictor import HotspotPredictor, HotspotFeatureBuilder
from src.graph.routing import AmbulanceRouter
from src.allocation.dispatch import AmbulanceDispatcher, Emergency


# ═══════════════════════════════════════════════════════════════════
# STRUKTURAT E PIPELINE
# ═══════════════════════════════════════════════════════════════════

@dataclass
class PipelineState:
    """Gjendja e plotë e sistemit në një moment."""
    day: int = 0
    simulation_state: Dict = field(default_factory=dict)
    hotspots: List[Dict] = field(default_factory=list)
    active_measures: List[Dict] = field(default_factory=list)
    resource_allocations: List[Dict] = field(default_factory=list)
    last_updated: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Recommendation:
    """Një rekomandim i vetëm me efekt të matshëm."""
    id: str
    category: str
    title: str
    description: str
    parameters: Dict
    expected_impact: Dict
    confidence: float
    reason: str


@dataclass
class RecommendationBundle:
    """Seti i plotë i rekomandimeve për një ditë."""
    day: int
    generated_at: str
    recommendations: List[Recommendation]
    baseline_forecast: Dict
    optimized_forecast: Dict
    total_expected_impact: Dict


# ═══════════════════════════════════════════════════════════════════
# PIPELINE
# ═══════════════════════════════════════════════════════════════════

class EpiPipeline:
    """
    Pipeline-i kryesor që lidh të gjitha modulet.

    Përdorimi:
        pipeline = EpiPipeline()
        pipeline.load_state()
        bundle = pipeline.generate_recommendations()
        pipeline.apply_bundle(bundle, selected_ids=[1, 2, 3])
        comparison = pipeline.simulate_forward(days=30)
    """

    def __init__(self, data_dir: str = "data/processed"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.state: Optional[PipelineState] = None
        self.router: Optional[AmbulanceRouter] = None

    # ───────────────────────────────────────────────────────────
    # 1. LOAD STATE
    # ───────────────────────────────────────────────────────────

    def load_state(self) -> PipelineState:
        """Lexo gjendjen aktuale nga të gjitha burimet."""
        print(f"\n{'='*60}")
        print(f"PIPELINE: Duke lexuar gjendjen...")
        print(f"{'='*60}")

        sim_state = self._load_simulation_state()
        print(f"  [OK] Simulimi: dita {sim_state.get('day', 0)}")

        reports = self._load_reports()
        print(f"  [OK] Raportet: {len(reports):,}")

        hotspots = self._load_hotspots()
        print(f"  [OK] Hotspots: {len(hotspots)}")

        measures = self._load_active_measures()
        print(f"  [OK] Masat aktive: {len(measures)}")

        self.state = PipelineState(
            day=sim_state.get("day", 0),
            simulation_state=sim_state.get("state", {}),
            hotspots=hotspots,
            active_measures=measures,
        )
        return self.state

    def _load_simulation_state(self) -> Dict:
        """Lexo ditën e fundit të simulimit."""
        path = self.data_dir / "simulation_history.csv"
        if not path.exists():
            return {"day": 0, "state": initial_state()}
        df = pd.read_csv(path)
        if df.empty:
            return {"day": 0, "state": initial_state()}
        last = df.iloc[-1].to_dict()
        state = initial_state(last)
        return {"day": int(last.get("day", 0)), "state": state}

    def _load_reports(self) -> pd.DataFrame:
        path = self.data_dir / "citizen_reports.csv"
        if not path.exists():
            return pd.DataFrame()
        return pd.read_csv(path)

    def _load_hotspots(self) -> List[Dict]:
        path = self.data_dir / "hotspot_predictions.csv"
        if not path.exists():
            return []
        df = pd.read_csv(path)
        return df.to_dict(orient="records")

    def _load_active_measures(self) -> List[Dict]:
        path = self.data_dir / "active_measures.json"
        if not path.exists():
            return []
        with open(path) as f:
            return json.load(f)

    # ───────────────────────────────────────────────────────────
    # 2. TRAIN & PREDICT
    # ───────────────────────────────────────────────────────────

    def refresh_hotspots(self, reports: Optional[pd.DataFrame] = None) -> List[Dict]:
        """Trajno ML dhe parashiko hotspots për ditën aktuale."""
        print(f"\n{'='*60}")
        print(f"PIPELINE: Rifreskim i hotspots...")
        print(f"{'='*60}")

        reports = reports if reports is not None else self._load_reports()
        population_path = self.data_dir / "prishtina_population_22k.csv"

        if not population_path.exists():
            print("  [ERROR] Popullsia nuk u gjet")
            return []

        population = pd.read_csv(population_path)

        if reports.empty:
            print("  [ERROR] Nuk ka raporte për trajnim")
            return []

        builder = HotspotFeatureBuilder(reports, population)
        features = builder.build_training_data()

        predictor = HotspotPredictor()
        metrics = predictor.train(features)

        if metrics.get("f1") is None:
            print("  ⚠ Nuk mund të validizohet (një klasë)")
            return []

        current_day = self.state.day if self.state else int(features["day"].max())
        predictions = predictor.predict_for_day(features, day=current_day)

        predictions.to_csv(self.data_dir / "hotspot_predictions.csv", index=False)

        hotspots = predictions.to_dict(orient="records")
        print(f"  [OK] {len(hotspots)} lagje analizuar")
        print(f"  [OK] F1 score: {metrics['f1']:.3f}")

        if self.state:
            self.state.hotspots = hotspots

        return hotspots

    # ───────────────────────────────────────────────────────────
    # 3. GENERATE RECOMMENDATIONS
    # ───────────────────────────────────────────────────────────

    def generate_recommendations(self, capacities: Optional[Dict[str, int]] = None) -> RecommendationBundle:
        """Gjenero rekomandime të plota."""
        print(f"\n{'='*60}")
        print(f"PIPELINE: Duke gjeneruar rekomandime...")
        print(f"{'='*60}")

        if self.state is None:
            self.load_state()

        recommendations = []

        measures = self._recommend_measures()
        recommendations.extend(measures)
        print(f"  [OK] {len(measures)} masa të rekomanduara")

        resources = self._recommend_resources(capacities=capacities)
        recommendations.extend(resources)
        print(f"  [OK] {len(resources)} burime të rekomanduara")

        routing = self._recommend_routing()
        recommendations.extend(routing)
        print(f"  [OK] {len(routing)} rrugë të rekomanduara")

        state = self.state.simulation_state or initial_state()
        baseline = forecast(state, [], days=30)
        optimized = forecast(
            state,
            [r.parameters for r in recommendations if r.category == "measure"],
            days=30,
        )

        bundle = RecommendationBundle(
            day=self.state.day,
            generated_at=datetime.utcnow().isoformat(),
            recommendations=recommendations,
            baseline_forecast=baseline,
            optimized_forecast=optimized,
            total_expected_impact={
                "cases_avoided": max(0, baseline["new_cases"] - optimized["new_cases"]),
                "deaths_avoided": max(0, baseline["deaths_at_end"] - optimized["deaths_at_end"]),
                "total_cost": sum(r.expected_impact.get("cost", 0) for r in recommendations),
            },
        )

        print(f"\n  📊 Efekti total i pritur:")
        print(f"     Raste të shmangura: {bundle.total_expected_impact['cases_avoided']:,}")
        print(f"     Vdekje të shmangura: {bundle.total_expected_impact['deaths_avoided']:,}")
        print(f"     Kosto: {bundle.total_expected_impact['total_cost']:.2f}")

        return bundle

    def _recommend_measures(self) -> List[Recommendation]:
        """Rekomando masa sipas analizës së hotspots."""
        state = self.state.simulation_state
        active = {m["type"] for m in self.state.active_measures}

        recommendations = []
        rec_id = 0

        for measure_type, effect in MEASURE_EFFECTS.items():
            if measure_type in active:
                continue

            trial = [{"type": measure_type, "intensity": 1.0}]
            with_measure = forecast(state, trial, days=30)
            baseline = forecast(state, [], days=30)

            cases_avoided = max(0, baseline["new_cases"] - with_measure["new_cases"])
            deaths_avoided = max(0, baseline["deaths_at_end"] - with_measure["deaths_at_end"])

            if cases_avoided < 10:
                continue

            confidence = min(0.95, 0.5 + effect)

            recommendations.append(Recommendation(
                id=f"measure_{rec_id}",
                category="measure",
                title=self._measure_title(measure_type),
                description=self._measure_description(measure_type, cases_avoided),
                parameters={"type": measure_type, "intensity": 1.0},
                expected_impact={
                    "cases_avoided": cases_avoided,
                    "deaths_avoided": deaths_avoided,
                    "cost": self._measure_cost(measure_type),
                },
                confidence=confidence,
                reason=f"Redukton transmetimin me {effect*100:.0f}%. Raste të shmangura: {cases_avoided:,}",
            ))
            rec_id += 1

        recommendations.sort(key=lambda r: -r.expected_impact["cases_avoided"])
        return recommendations[:5]

    def _recommend_resources(self, capacities: Optional[Dict[str, int]] = None) -> List[Recommendation]:
        """Rekomando shpërndarjen e burimeve."""
        if not self.state.hotspots:
            return []

        try:
            allocator = ResourceAllocator()
            predictions = pd.DataFrame(self.state.hotspots)
            reports = self._load_reports()
            population = pd.read_csv(self.data_dir / "prishtina_population_22k.csv")
            allocator.load_requests(predictions, reports, population)
            allocations = allocator.optimize_all(capacities=capacities)
        except Exception as e:
            print(f"  ⚠ Allocator dështoi: {e}")
            return []

        RESOURCE_DEATH_SAVINGS = {
            "ambulances": 0.1,
            "testing_units": 0.05,
            "beds": 0.1,
            "vaccines": 0.001,
            "staff": 0.1,
        }

        recommendations = []
        rec_id = 100

        for resource_type, assignments in allocations.items():
            if not assignments:
                continue

            total_qty = sum(a.quantity for a in assignments)
            total_cost = sum(a.cost for a in assignments)
            top_districts = sorted(assignments, key=lambda a: -a.quantity)[:3]

            deaths_avoided = int(total_qty * RESOURCE_DEATH_SAVINGS.get(resource_type, 0.05))

            recommendations.append(Recommendation(
                id=f"resource_{rec_id}",
                category="resource",
                title=f"Shpërndaj {total_qty} {resource_type}",
                description=f"Në {len(assignments)} lagje, fokus në: {', '.join(a.district for a in top_districts)}",
                parameters={
                    "resource_type": resource_type,
                    "allocations": [
                        {"district": a.district, "quantity": a.quantity, "cost": a.cost}
                        for a in assignments
                    ],
                },
                expected_impact={
                    "cases_avoided": 0,
                    "deaths_avoided": deaths_avoided,
                    "cost": total_cost,
                },
                confidence=0.75,
                reason=f"Bazuar në prioritetin e hotspot-eve",
            ))
            rec_id += 1

        return recommendations

    def _recommend_routing(self) -> List[Recommendation]:
        """Rekomando rrugë për ambulancat në hotspot-e kritike."""
        critical = [h for h in self.state.hotspots if h.get("hotspot_probability", 0) > 0.7]
        if not critical:
            return []

        emergencies = []
        for i, h in enumerate(critical[:5]):
            emergencies.append(Emergency(
                id=i,
                district=h["district"],
                lat=h.get("lat", 42.6629),
                lon=h.get("lon", 21.1655),
                severity=int(h.get("hotspot_probability", 0.5) * 5),
            ))

        try:
            dispatcher = AmbulanceDispatcher()
            dispatches = dispatcher.dispatch_emergencies(emergencies)
        except Exception as e:
            print(f"  ⚠ Dispatcher dështoi: {e}")
            return []

        if not dispatches:
            return []

        avg_time = sum(d.time_minutes for d in dispatches) / len(dispatches)
        emergency_by_id = {emergency.id: emergency for emergency in emergencies}

        return [Recommendation(
            id="routing_200",
            category="routing",
            title=f"Dërgo {len(dispatches)} ambulanca në hotspot-e kritike",
            description=f"Koha mesatare e reagimit: {avg_time:.1f} minuta",
            parameters={
                "dispatches": [
                    {
                        "ambulance_id": d.ambulance_id,
                        "emergency_id": d.emergency_id,
                        "district": emergency_by_id[d.emergency_id].district,
                        "lat": emergency_by_id[d.emergency_id].lat,
                        "lon": emergency_by_id[d.emergency_id].lon,
                        "severity": emergency_by_id[d.emergency_id].severity,
                        "time_minutes": d.time_minutes,
                        "distance_km": d.distance_km,
                    }
                    for d in dispatches
                ],
            },
            expected_impact={
                "cases_avoided": 0,
                "deaths_avoided": len(dispatches) * 2,
                "cost": len(dispatches) * 1.0,
            },
            confidence=0.85,
            reason=f"Ambulancat e optimizuara reduktojnë vdekshmërinë",
        )]

    # ───────────────────────────────────────────────────────────
    # 4. APPLY
    # ───────────────────────────────────────────────────────────

    def apply_bundle(
        self,
        bundle: RecommendationBundle,
        selected_ids: Optional[List[str]] = None,
    ) -> Dict:
        """Apliko rekomandimet e zgjedhura."""
        print(f"\n{'='*60}")
        print(f"PIPELINE: Duke aplikuar rekomandimet...")
        print(f"{'='*60}")

        if selected_ids is None:
            selected = bundle.recommendations
        else:
            selected = [r for r in bundle.recommendations if r.id in selected_ids]

        print(f"  Zgjedhur: {len(selected)}/{len(bundle.recommendations)}")

        measures = [r for r in selected if r.category == "measure"]
        resources = [r for r in selected if r.category == "resource"]
        routing = [r for r in selected if r.category == "routing"]

        new_measures = self.state.active_measures + [r.parameters for r in measures]
        self.state.active_measures = new_measures
        self._save_active_measures(new_measures)
        print(f"  [OK] {len(measures)} masa u aktivizuan")

        self._save_decision_log(bundle, selected)

        return {
            "status": "applied",
            "day": bundle.day,
            "applied_count": len(selected),
            "measures": len(measures),
            "resources": len(resources),
            "routing": len(routing),
            "resource_recommendations": [
                {
                    "resource_type": recommendation.parameters["resource_type"],
                    "allocations": recommendation.parameters["allocations"],
                    "reason": recommendation.reason,
                }
                for recommendation in resources
            ],
            "routing_dispatches": routing[0].parameters["dispatches"] if routing else [],
        }

    def _save_active_measures(self, measures: List[Dict]):
        with open(self.data_dir / "active_measures.json", "w") as f:
            json.dump(measures, f, indent=2)

    def _save_decision_log(self, bundle: RecommendationBundle, selected: List[Recommendation]):
        path = self.data_dir / "decision_log.jsonl"
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "day": bundle.day,
            "applied_ids": [r.id for r in selected],
            "expected_impact": bundle.total_expected_impact,
        }
        with open(path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    # ───────────────────────────────────────────────────────────
    # 5. SIMULATE FORWARD
    # ───────────────────────────────────────────────────────────

    def simulate_forward(self, days: int = 30, from_day: Optional[int] = None) -> Dict:
        """Ekzekuto simulimin me masat e reja."""
        print(f"\n{'='*60}")
        print(f"PIPELINE: Duke simuluar {days} ditë përpara...")
        print(f"{'='*60}")

        history_path = self.data_dir / "simulation_history.csv"
        start_row = None

        if history_path.exists():
            history_df = pd.read_csv(history_path)

            if from_day is not None:
                idx = (history_df['day'] - from_day).abs().idxmin()
                start_row = history_df.iloc[idx].to_dict()
            else:
                if self.state and self.state.day > 50:
                    idx = (history_df['day'] - 25).abs().idxmin()
                    start_row = history_df.iloc[idx].to_dict()
                    print(f"  ⚠ Dita aktuale {self.state.day} është në fund të epidemisë.")
                    print(f"  -> Simulohet nga dita {start_row['day']} (fillimi i shpërthimit)")
                else:
                    start_row = history_df.iloc[-1].to_dict()

            state = initial_state(start_row)
        else:
            state = self.state.simulation_state or initial_state()

        measures = self.state.active_measures if self.state else []

        baseline = forecast(state, [], days=days)
        with_measures = forecast(state, measures, days=days)

        daily = []
        s = dict(state)
        base_day = int(start_row.get("day", self.state.day)) if start_row else (self.state.day if self.state else 0)
        for day in range(days):
            s, stats = advance_day(s, measures)
            daily.append({
                "day": base_day + day + 1,
                "active": stats["active"],
                "new_cases": stats["new_cases"],
                "rt": stats["rt"],
                "deaths": round(s["dead"]),
            })

        comparison = {
            "cases_avoided": max(0, baseline["new_cases"] - with_measures["new_cases"]),
            "deaths_avoided": max(0, baseline["deaths_at_end"] - with_measures["deaths_at_end"]),
            "peak_reduction": max(0, baseline["peak_active"] - with_measures["peak_active"]),
            "rt_reduction": baseline["rt_at_end"] - with_measures["rt_at_end"],
        }

        print(f"  [OK] Raste të shmangura: {comparison['cases_avoided']:,}")
        print(f"  [OK] Vdekje të shmangura: {comparison['deaths_avoided']:,}")
        print(f"  [OK] Reduktim piku: {comparison['peak_reduction']:,}")

        result = {
            "baseline": baseline,
            "with_measures": with_measures,
            "comparison": comparison,
            "daily": daily,
            "measures_count": len(measures),
        }

        return result

    # ───────────────────────────────────────────────────────────
    # 6. HELPERS
    # ───────────────────────────────────────────────────────────

    def _calculate_rt(self, state: Dict) -> float:
        pop = state.get("population", 22000)
        sus = state.get("susceptible", pop)
        inf = state.get("infectious_mild", 0) + state.get("infectious_severe", 0)
        if inf < 1:
            return 0.0
        return round(0.32 * 7 * sus / pop, 3)

    def _measure_title(self, mtype: str) -> str:
        return {
            "movement_restriction": "Kufizim i lëvizjes",
            "venue_closures": "Mbyllje e lokaleve",
            "testing": "Rritje e testimit",
            "remote_work": "Punë nga shtëpia",
            "vaccination": "Vaksinim masiv",
            "transport_restriction": "Kufizim transporti",
        }.get(mtype, mtype)

    def _measure_description(self, mtype: str, cases: int) -> str:
        effect = MEASURE_EFFECTS.get(mtype, 0) * 100
        return f"Redukton transmetimin me {effect:.0f}%. Pritet {cases:,} raste të shmangura."

    def _measure_cost(self, mtype: str) -> float:
        return {
            "movement_restriction": 0.15,
            "venue_closures": 0.10,
            "testing": 0.03,
            "remote_work": 0.08,
            "vaccination": 0.05,
            "transport_restriction": 0.06,
        }.get(mtype, 0.05)

# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pipeline = EpiPipeline()
    pipeline.load_state()
    pipeline.refresh_hotspots()
    bundle = pipeline.generate_recommendations()

    print(f"\n{'='*60}")
    print(f"REKOMANDIMET:")
    print(f"{'='*60}")
    for r in bundle.recommendations:
        print(f"\n[{r.category.upper()}] {r.title}")
        print(f"  {r.description}")
        print(f"  Efekti: {r.expected_impact}")
        print(f"  Besueshmëria: {r.confidence:.0%}")

    result = pipeline.apply_bundle(bundle)
    print(f"\n[OK] U aplikuan: {result['applied_count']} rekomandime")

    comparison = pipeline.simulate_forward(days=30)
    print(f"\n📊 Krahasimi: {comparison['comparison']}")