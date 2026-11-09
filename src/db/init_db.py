"""
Inicializimi i databazës — krijon të gjitha tabelat.
"""

import sys
import os

# Shto root në path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.db.base import Base, engine
from src.models import *  # Importo të gjitha modelet
from sqlalchemy import text
from src.models.resource import ResourceInventory


RESOURCE_DEFAULTS = {
    "ambulance": 30,
    "testing_unit": 20,
    "bed": 500,
    "vaccine": 50000,
    "staff": 200,
}


def init_db():
    """Krijo të gjitha tabelat në databazë."""
    print("=" * 60)
    print("  EpiPrishtina — Inicializimi i Databazës")
    print("=" * 60)
    print(f"\nDuke u lidhur me: {engine.url}")
    print("\nDuke krijuar tabelat...")
    
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        constraint_exists = connection.execute(text("""
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_simulation_day'
        """)).scalar()
        if not constraint_exists:
            connection.execute(text("""
                ALTER TABLE simulation_days
                ADD CONSTRAINT uq_simulation_day UNIQUE (simulation_id, day)
            """))
        for resource_type, total_quantity in RESOURCE_DEFAULTS.items():
            connection.execute(text("""
                INSERT INTO resource_inventory (resource_type, total_quantity, updated_at)
                VALUES (:resource_type, :total_quantity, CURRENT_TIMESTAMP)
                ON CONFLICT (resource_type) DO NOTHING
            """), {
                "resource_type": resource_type,
                "total_quantity": total_quantity,
            })
    
    # Verifiko tabelat e krijuara
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\nU krijuan/verifikuan {len(tables)} tabela:")
    for table in sorted(tables):
        print(f"  - {table}")
    
    print("\n" + "=" * 60)
    print("  Inicializimi perfundoi me sukses!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    init_db()