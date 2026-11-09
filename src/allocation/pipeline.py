"""Run the allocator on the latest available processed prediction inputs."""

from pathlib import Path
from datetime import datetime
from uuid import uuid4

import pandas as pd

from src.allocation.resource_allocator import ResourceAllocator
from src.models.resource import ResourceAllocationRecord


def optimize_processed_resources(
    data_dir: str | Path = "data/processed",
    capacities: dict[str, int] | None = None,
) -> dict:
    directory = Path(data_dir)
    paths = {
        "predictions": directory / "hotspot_predictions.csv",
        "reports": directory / "citizen_reports.csv",
        "population": directory / "prishtina_population_22k.csv",
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing allocator inputs: {', '.join(missing)}")

    allocator = ResourceAllocator()
    allocator.load_requests(
        pd.read_csv(paths["predictions"]),
        pd.read_csv(paths["reports"]),
        pd.read_csv(paths["population"]),
    )
    allocations = allocator.optimize_all(capacities=capacities)
    rows = [
        {
            "resource_type": assignment.resource_type,
            "district": assignment.district,
            "quantity": assignment.quantity,
            "cost": assignment.cost,
            "reason": assignment.reason,
        }
        for group in allocations.values()
        for assignment in group
    ]
    output_path = directory / "resource_allocations.csv"
    pd.DataFrame(rows, columns=["resource_type", "district", "quantity", "cost", "reason"]).to_csv(output_path, index=False)
    return {
        "status": "success",
        "allocations": rows,
        "total_cost": round(sum(row["cost"] for row in rows), 2),
        "output_path": str(output_path),
    }


def persist_resource_allocations(db, result: dict, commit: bool = True) -> dict:
    """Persist a new durable resource allocation run."""
    run_id = str(uuid4())
    generated_at = datetime.utcnow()
    db.add_all([
        ResourceAllocationRecord(
            run_id=run_id,
            resource_type=item["resource_type"],
            district=item["district"],
            quantity=item["quantity"],
            cost=item["cost"],
            reason=item["reason"],
            generated_at=generated_at,
        )
        for item in result["allocations"]
    ])
    if commit:
        db.commit()
    return {
        **result,
        "run_id": run_id,
        "generated_at": generated_at.isoformat(),
        "allocation_count": len(result["allocations"]),
    }
