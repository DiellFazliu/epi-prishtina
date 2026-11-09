import unittest
from datetime import datetime
from types import SimpleNamespace
from pathlib import Path

import pandas as pd

from src.ml.report_data import reports_dataframe
from src.models import ReportStatus, ReportType


class ReportDataTests(unittest.TestCase):
    def test_live_reports_are_mapped_to_feature_builder_schema(self):
        reports = [
            SimpleNamespace(
                id="report-1",
                district="Qendra",
                reported_at=datetime(2026, 10, 1),
                report_type=ReportType.CONFIRMED,
                status=ReportStatus.VALIDATED,
            ),
        ]
        query = SimpleNamespace(
            filter=lambda *_args: SimpleNamespace(all=lambda: reports)
        )
        db = SimpleNamespace(query=lambda _model: query)

        frame = reports_dataframe(db)

        self.assertEqual(
            list(frame.columns),
            ["report_id", "area", "timestamp", "report_type"],
        )
        self.assertEqual(frame.iloc[0]["area"], "Qendra")
        self.assertEqual(frame.iloc[0]["report_type"], "confirmed")

    def test_live_reports_are_merged_with_historical_baseline(self):
        reports = [
            SimpleNamespace(
                id="live-1",
                district="Qendra",
                reported_at=datetime(2026, 10, 1),
                report_type=ReportType.SYMPTOM,
                status=ReportStatus.PENDING,
            ),
        ]
        query = SimpleNamespace(filter=lambda *_args: SimpleNamespace(all=lambda: reports))
        db = SimpleNamespace(query=lambda _model: query)
        historical_path = Path("tests") / "historical_reports_test.csv"
        pd.DataFrame([{
            "report_id": "history-1",
            "area": "Dardania",
            "timestamp": "2026-09-01",
            "report_type": "confirmed",
        }]).to_csv(historical_path, index=False)
        try:
            frame = reports_dataframe(db, historical_path)
        finally:
            historical_path.unlink(missing_ok=True)
        self.assertEqual(len(frame), 2)
        self.assertEqual(set(frame["report_id"]), {"history-1", "live-1"})


if __name__ == "__main__":
    unittest.main()
