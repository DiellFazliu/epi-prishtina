# src/core/monitoring.py
from prometheus_fastapi_instrumentator import Instrumentator

def setup_monitoring(app):
    Instrumentator().instrument(app).expose(app)
    
    # Custom metrics
    from prometheus_client import Counter, Histogram
    pipeline_runs = Counter("pipeline_runs_total", "Total pipeline runs")
    ml_predictions = Counter("ml_predictions_total", "Total ML predictions")
    dispatch_time = Histogram("dispatch_duration_seconds", "Dispatch time")