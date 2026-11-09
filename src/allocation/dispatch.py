"""
Dispatch i ambulancave për emergjenca.

Përdor Hungarian Algorithm për të caktuar ambulancat
në mënyrë optimale për emergjencat aktive.
"""

import random
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from datetime import datetime
from scipy.optimize import linear_sum_assignment
import numpy as np

from src.graph.routing import AmbulanceRouter


# ═══════════════════════════════════════════════════════════════════
# STRUKTURA
# ═══════════════════════════════════════════════════════════════════

@dataclass
class Ambulance:
    """Një ambulancë virtuale."""
    id: int
    base_lat: float
    base_lon: float
    hospital_name: str
    status: str = "available"  # available, en_route, busy
    current_lat: float = None
    current_lon: float = None
    
    def __post_init__(self):
        if self.current_lat is None:
            self.current_lat = self.base_lat
        if self.current_lon is None:
            self.current_lon = self.base_lon


@dataclass
class Emergency:
    """Një emergjencë mjekësore."""
    id: int
    district: str
    lat: float
    lon: float
    severity: int = 1  # 1-5
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Dispatch:
    """Caktimi ambulancë → emergjencë."""
    ambulance_id: int
    emergency_id: int
    distance_km: float
    time_minutes: float
    cost: float


# ═══════════════════════════════════════════════════════════════════
# HOSPITALS DHE AMBULANCAT
# ═══════════════════════════════════════════════════════════════════

HOSPITALS = [
    {"name": "QKUK", "lat": 42.6467, "lon": 21.1653, "ambulances": 8},
    {"name": "Spitali i Prishtinës", "lat": 42.6680, "lon": 21.1580, "ambulances": 5},
    {"name": "Klinika Infektive", "lat": 42.6447, "lon": 21.1611, "ambulances": 4},
    {"name": "Klinika Pediatrike", "lat": 42.6546, "lon": 21.1714, "ambulances": 6},
    {"name": "Spitali Amerikan", "lat": 42.6490, "lon": 21.1690, "ambulances": 4},
    {"name": "Spitali Gjerman", "lat": 42.6555, "lon": 21.1580, "ambulances": 3},
]


def generate_ambulances() -> List[Ambulance]:
    """Krijo ambulancat për të gjitha spitalet."""
    ambulances = []
    amb_id = 0
    
    for hospital in HOSPITALS:
        for _ in range(hospital["ambulances"]):
            ambulances.append(Ambulance(
                id=amb_id,
                base_lat=hospital["lat"],
                base_lon=hospital["lon"],
                hospital_name=hospital["name"],
            ))
            amb_id += 1
    
    print(f"[OK] U gjeneruan {len(ambulances)} ambulanca")
    return ambulances


# ═══════════════════════════════════════════════════════════════════
# DISPATCHER
# ═══════════════════════════════════════════════════════════════════

class AmbulanceDispatcher:
    """
    Cakton ambulancat për emergjencat në mënyrë optimale.
    
    Përdor:
        - Hungarian Algorithm për assignment
        - A* për kohën e reagimit
    """
    
    def __init__(self):
        self.router = AmbulanceRouter()
        self.ambulances = generate_ambulances()
        self.dispatches: List[Dispatch] = []
    
    def dispatch_emergencies(
        self,
        emergencies: List[Emergency],
    ) -> List[Dispatch]:
        """
        Cakto ambulancat për emergjencat.
        
        Args:
            emergencies: Lista e emergjencave aktive
        
        Returns:
            Lista e caktimeve optimale
        """
        if not emergencies:
            return []
        
        # Merr ambulancat e disponueshme
        available = [a for a in self.ambulances if a.status == "available"]
        
        if not available:
            print("[WARN] Nuk ka ambulanca të disponueshme")
            return []
        
        # Krijo matricën e kostove: [ambulance_idx × emergency_idx]
        n_amb = len(available)
        n_emg = len(emergencies)
        
        costs = np.zeros((n_amb, n_emg))
        time_matrix = np.zeros((n_amb, n_emg))
        distance_matrix = np.zeros((n_amb, n_emg))
        
        print(f"\nDuke llogaritur kostot për {n_amb} ambulanca × {n_emg} emergjenca...")
        
        for i, amb in enumerate(available):
            for j, emg in enumerate(emergencies):
                # Gjej rrugën
                route = self.router.find_shortest_path(
                    from_lat=amb.current_lat,
                    from_lon=amb.current_lon,
                    to_lat=emg.lat,
                    to_lon=emg.lon,
                )
                
                time_min = route["time_seconds"] / 60
                dist_km = route["distance_m"] / 1000
                
                # Kosto = koha e reagimit + peshë për severitetin
                # Sa më i rëndë, aq më prioritare
                cost = time_min * (emg.severity / 3.0)
                
                costs[i][j] = cost
                time_matrix[i][j] = time_min
                distance_matrix[i][j] = dist_km
        
        # Apliko Hungarian Algorithm
        row_ind, col_ind = linear_sum_assignment(costs)
        
        # Krijo caktimet
        dispatches = []
        for amb_idx, emg_idx in zip(row_ind, col_ind):
            amb = available[amb_idx]
            emg = emergencies[emg_idx]
            
            dispatch = Dispatch(
                ambulance_id=amb.id,
                emergency_id=emg.id,
                distance_km=round(distance_matrix[amb_idx][emg_idx], 2),
                time_minutes=round(time_matrix[amb_idx][emg_idx], 2),
                cost=round(costs[amb_idx][emg_idx], 2),
            )
            dispatches.append(dispatch)
            
            # Përditëso statusin
            amb.status = "en_route"
            amb.current_lat = emg.lat
            amb.current_lon = emg.lon
        
        self.dispatches.extend(dispatches)
        
        print(f"[OK] U caktuan {len(dispatches)} emergjenca")
        return dispatches
    
    def get_stats(self) -> dict:
        """Statistika të ambulancave."""
        by_status = {}
        for amb in self.ambulances:
            by_status[amb.status] = by_status.get(amb.status, 0) + 1
        
        return {
            "total_ambulances": len(self.ambulances),
            "by_status": by_status,
            "total_dispatches": len(self.dispatches),
            "avg_response_time": (
                sum(d.time_minutes for d in self.dispatches) / len(self.dispatches)
                if self.dispatches else 0
            ),
        }


# ═══════════════════════════════════════════════════════════════════
# TEST
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    dispatcher = AmbulanceDispatcher()
    
    # Krijo 10 emergjenca të rastësishme
    emergencies = []
    districts = [
        ("Qendra", 42.6629, 21.1655),
        ("Dardania", 42.6555, 21.1585),
        ("Ulpiana", 42.6580, 21.1720),
        ("Arbëria", 42.6700, 21.1480),
        ("Kalabria", 42.6480, 21.1610),
    ]
    
    for i in range(10):
        district, lat, lon = random.choice(districts)
        emergencies.append(Emergency(
            id=i,
            district=district,
            lat=lat + random.uniform(-0.005, 0.005),
            lon=lon + random.uniform(-0.005, 0.005),
            severity=random.randint(1, 5),
        ))
    
    # Dispatch
    dispatches = dispatcher.dispatch_emergencies(emergencies)
    
    # Printo
    print(f"\n=== Caktimet ===")
    for d in dispatches[:5]:
        amb = dispatcher.ambulances[d.ambulance_id]
        emg = next(e for e in emergencies if e.id == d.emergency_id)
        print(f"Ambulanca #{d.ambulance_id} ({amb.hospital_name}) -> Emergjenca #{d.emergency_id} ({emg.district})")
        print(f"  Distanca: {d.distance_km} km")
        print(f"  Koha: {d.time_minutes} min")
    
    print(f"\n=== Statistikat ===")
    stats = dispatcher.get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")