import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from src.core.pipeline import EpiPipeline, Recommendation, RecommendationBundle


class PipelineApplyTests(unittest.TestCase):
    def test_apply_updates_live_state_with_selected_measures(self):
        with TemporaryDirectory() as directory:
            pipeline = EpiPipeline(data_dir=directory)
            pipeline.state = type("State", (), {
                "day": 12,
                "simulation_state": {},
                "hotspots": [],
                "active_measures": [],
            })()
            bundle = RecommendationBundle(
                day=12,
                generated_at="2026-01-01T00:00:00",
                recommendations=[
                    Recommendation(
                        id="measure_testing",
                        category="measure",
                        title="Testing",
                        description="Increase testing",
                        parameters={"type": "testing", "intensity": 1.0},
                        expected_impact={"cases_avoided": 10, "deaths_avoided": 1, "cost": 1},
                        confidence=0.8,
                        reason="model",
                    ),
                ],
                baseline_forecast={},
                optimized_forecast={},
                total_expected_impact={},
            )

            result = pipeline.apply_bundle(bundle)

            self.assertEqual(result["measures"], 1)
            self.assertEqual(
                pipeline.state.active_measures,
                [{"type": "testing", "intensity": 1.0}],
            )
            self.assertTrue(Path(directory, "active_measures.json").exists())


if __name__ == "__main__":
    unittest.main()
