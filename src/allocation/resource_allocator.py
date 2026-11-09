"""Priority and proportional heuristics for emergency resource planning.

This module produces scenario allocations from the saved hotspot prediction
snapshot. It does not use live clinical occupancy, deaths, or inventory feeds,
and its fixed totals are planning assumptions rather than measured capacity.
"""

import os
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import List, Dict, Tuple
from datetime import datetime


# ==================== KONFIGURIMI ====================

# Kapaciteti i burimeve (simulim)
TOTAL_AMBULANCES = 30
TOTAL_TESTING_UNITS = 20
TOTAL_BEDS = 500
TOTAL_VACCINES = 50000
TOTAL_STAFF = 200

# Kostot për njësi (relative)
COST_AMBULANCE = 1.0
COST_TESTING_UNIT = 0.5
COST_BED = 0.3
COST_VACCINE = 0.01
COST_STAFF = 0.8


# ==================== KONFIGURIMI I LAGJEVE ====================

DISTRICTS = [
    "Qendra", "Dardania", "Ulpiana", "Arbëria", "Kalabria",
    "Bregu i Diellit", "Sunny Hill", "Lakrishte", "Mat", "Tophane",
    "Vranjevc", "Kodra e Trimave", "Kolovica", "Sofali", "Bardhosh",
]

DISTRICT_COORDS = {
    "Qendra": (42.6629, 21.1655),
    "Dardania": (42.6555, 21.1585),
    "Ulpiana": (42.6580, 21.1720),
    "Arbëria": (42.6700, 21.1480),
    "Kalabria": (42.6480, 21.1610),
    "Bregu i Diellit": (42.6520, 21.1780),
    "Sunny Hill": (42.6450, 21.1700),
    "Lakrishte": (42.6420, 21.1450),
    "Mat": (42.6580, 21.1350),
    "Tophane": (42.6680, 21.1620),
    "Vranjevc": (42.6720, 21.1750),
    "Kodra e Trimave": (42.6760, 21.1580),
    "Kolovica": (42.6820, 21.1780),
    "Sofali": (42.6450, 21.1900),
    "Bardhosh": (42.6900, 21.1500),
}

HOSPITALS = [
    (42.6620, 21.1690, "QKUK", 300),
    (42.6680, 21.1580, "Spitali i Prishtinës", 200),
]


# ==================== FUNKSIONE NDIHMËSE ====================

def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distanca në km midis dy pikave."""
    dlat = (lat1 - lat2) * 111
    dlon = (lon1 - lon2) * 111 * np.cos(np.radians(42.66))
    return np.sqrt(dlat**2 + dlon**2)


def nearest_hospital(district: str) -> Tuple[str, float]:
    """Gjen spitalin më të afërt."""
    if district not in DISTRICT_COORDS:
        return ("QKUK", 5.0)
    
    lat, lon = DISTRICT_COORDS[district]
    min_dist = float('inf')
    nearest = "QKUK"
    
    for h_lat, h_lon, name, _ in HOSPITALS:
        dist = distance_km(lat, lon, h_lat, h_lon)
        if dist < min_dist:
            min_dist = dist
            nearest = name
    
    return (nearest, min_dist)


# ==================== STRUKTURAT ====================

@dataclass
class ResourceRequest:
    """Kërkesë për burime nga një lagje."""
    district: str
    priority: float          # 0-1 (nga risk level)
    reports_7d: int
    distance_to_hospital: float
    population: int
    
    # Kostot për këtë lagje
    cost_score: float = 0.0


@dataclass
class ResourceAssignment:
    """Caktim i një burimi."""
    resource_type: str       # 'ambulance', 'testing_unit', 'bed', 'vaccine', 'staff'
    district: str
    quantity: int
    cost: float
    reason: str


# ==================== OPTIMIZUESI ====================

class ResourceAllocator:
    """
    Shpërndarësi i burimeve me proportional and priority-based heuristics.
    
    Për çdo lloj burimi:
        1. Merr kërkesat (lagjet me prioritet)
        2. Ndërton matricën e kostove
        3. Aplikon proportional and priority-based heuristics
        4. Kthen caktimet optimale
    """
    
    def __init__(self):
        self.requests: List[ResourceRequest] = []
        self.assignments: List[ResourceAssignment] = []
    
    def load_requests(
        self,
        predictions_df: pd.DataFrame,
        reports_df: pd.DataFrame,
        population_df: pd.DataFrame,
    ):
        """Ngarko kërkesat nga parashikimet e hotspot-eve."""
        self.requests = []
        
        for _, row in predictions_df.iterrows():
            district = row['district']
            prob = pd.to_numeric(pd.Series([row.get('hotspot_probability', 0)]), errors='coerce').fillna(0).iloc[0]
            prob = float(np.clip(prob, 0, 1))
            
            # Merr raportet
            reports_7d = int(max(0, pd.to_numeric(row.get('reports_7d', 0), errors='coerce') or 0))
            
            # Merr popullsinë
            pop = len(population_df[population_df['home_district'] == district])
            
            # Merr distancën
            _, dist = nearest_hospital(district)
            
            # Vlerëso vdekjet
            
            # Llogarit prioritetin (0-1)
            priority = prob  # Bazuar në probabilitetin e hotspot
            
            request = ResourceRequest(
                district=district,
                priority=priority,
                reports_7d=reports_7d,
                distance_to_hospital=dist,
                population=pop,
            )
            self.requests.append(request)
    
    def allocate_ambulances(self, total: int = TOTAL_AMBULANCES) -> List[ResourceAssignment]:
        """
        Shpërndan ambulancat me qasje hibride:
            1. Rendit lagjet sipas prioritetit
            2. Shpërndaj proporcionale me prioritetin dhe rastet
        """
        print(f"\n{'='*60}")
        print(f"SHPËRNDARJA E AMBULANCAVE ({total} njësi)")
        print(f"{'='*60}")
        
        # Llogarit peshën për çdo lagje
        # Pesha = prioritet × raste × (1 + ngarkesë spitalore)
        for req in self.requests:
            req.weight = (
                (req.priority * 2.0 + np.log1p(req.reports_7d) * 0.5) * (1 + req.distance_to_hospital / 10.0)
            )
        
        total_weight = sum(r.weight for r in self.requests)
        if total_weight <= 0 or total <= 0:
            return []
        
        # Shpërndaj proporcionale
        district_allocations = {}
        for req in self.requests:
            share = req.weight / total_weight * total
            district_allocations[req.district] = share
        
        # Rrumbullakosje duke ruajtur totalin
        assignments = []
        allocated = 0
        sorted_districts = sorted(
            district_allocations.items(),
            key=lambda x: -x[1]
        )
        
        for i, (district, share) in enumerate(sorted_districts):
            if i == len(sorted_districts) - 1:
                # I fundit merr çdo gjë që mbetet
                count = total - allocated
            else:
                count = int(round(share))
                count = max(1, count)  # Min 1 për lagje prioritare
                count = min(count, total - allocated - (len(sorted_districts) - i - 1))
            
            if count > 0:
                req = next(r for r in self.requests if r.district == district)
                assignments.append(ResourceAssignment(
                    resource_type='ambulance',
                    district=district,
                    quantity=count,
                    cost=count * COST_AMBULANCE,
                    reason=f"Prioritet hotspot {req.priority:.2f}, {req.reports_7d:,} raporte (7 dit?)",
                ))
                allocated += count
        
        print(f"  Caktuar në {len(assignments)} lagje:")
        for a in sorted(assignments, key=lambda x: -x.quantity):
            print(f"    {a.district:20s}: {a.quantity:2d} ambulanca")
        
        return assignments
    
    def allocate_testing_units(self, total: int = TOTAL_TESTING_UNITS) -> List[ResourceAssignment]:
        """
        Shpërndan njësitë e testimit.
        
        Prioritet: lagjet me probabilitet të lartë hotspot.
        """
        print(f"\n{'='*60}")
        print(f"SHPËRNDARJA E NJËSIVE TË TESTIMIT ({total} njësi)")
        print(f"{'='*60}")
        
        # Rendit lagjet sipas prioritetit
        sorted_requests = sorted(
            [request for request in self.requests if request.priority > 0 or request.reports_7d > 0],
            key=lambda r: -r.priority
        )
        
        # Aloko njësi proporcionale me prioritetin
        assignments = []
        remaining = total
        
        for req in sorted_requests:
            if remaining <= 0:
                break
            
            # Sa njësi meriton?
            # Bazuar në prioritet dhe raste aktive
            share = int(np.ceil(req.priority * remaining / 2))
            share = max(1, min(share, 3))  # Max 3 për lagje
            share = min(share, remaining)
            
            if share > 0:
                assignments.append(ResourceAssignment(
                    resource_type='testing_unit',
                    district=req.district,
                    quantity=share,
                    cost=share * COST_TESTING_UNIT,
                reason=f"Hotspot {req.priority:.2f}, {req.reports_7d:,} raporte në 7 ditë",
                ))
                remaining -= share
        
        print(f"  Caktuar në {len(assignments)} lagje:")
        for a in sorted(assignments, key=lambda x: -x.quantity):
            print(f"    {a.district:20s}: {a.quantity:2d} njësi")
        
        return assignments
    
    def allocate_beds(self, total: int = TOTAL_BEDS) -> List[ResourceAssignment]:
        """Shpërndan shtretërit proporcional me rastet aktive."""
        print(f"\n{'='*60}")
        print(f"SHPËRNDARJA E SHTRETËRVE SPITALOR ({total} shtretër)")
        print(f"{'='*60}")
        
        sorted_requests = sorted((r for r in self.requests if r.reports_7d > 0), key=lambda r: -r.reports_7d)
        total_cases = sum(r.reports_7d for r in sorted_requests)
        
        if total_cases == 0:
            return []
        
        assignments = []
        allocated = 0
        
        for i, req in enumerate(sorted_requests):
            if i == len(sorted_requests) - 1:
                share = total - allocated
            else:
                share = int(total * req.reports_7d / total_cases)
                share = max(5, share)
                # Mos tejkalo totalin
                remaining_districts = len(sorted_requests) - i - 1
                share = min(share, total - allocated - remaining_districts * 5)
            
            if share > 0:
                assignments.append(ResourceAssignment(
                    resource_type='bed',
                    district=req.district,
                    quantity=share,
                    cost=share * COST_BED,
                    reason=f"{req.reports_7d:,} raporte n? periudh?n e parashikimit",
                ))
                allocated += share
        
        print(f"  Caktuar në {len(assignments)} lagje:")
        for a in sorted(assignments, key=lambda x: -x.quantity)[:5]:
            print(f"    {a.district:20s}: {a.quantity:3d} shtretër")
        print(f"  Total: {allocated} shtretër")
        
        return assignments
    
    def allocate_vaccines(self, total: int = TOTAL_VACCINES) -> List[ResourceAssignment]:
        """Shpërndan vaksinat proporcional me prioritetin."""
        print(f"\n{'='*60}")
        print(f"SHPËRNDARJA E VAKSINAVE ({total:,} doza)")
        print(f"{'='*60}")
        
        # Fokus në lagjet me prioritet të lartë
        high_priority = [r for r in self.requests if r.priority > 0]
        if not high_priority:
            return []
        
        total_pop = sum(r.population for r in high_priority)
        if total_pop == 0:
            return []
        
        assignments = []
        allocated = 0
        sorted_hp = sorted(high_priority, key=lambda r: -r.population)
        
        for i, req in enumerate(sorted_hp):
            if i == len(sorted_hp) - 1:
                share = total - allocated
            else:
                share = int(total * req.population / total_pop)
                remaining = len(sorted_hp) - i - 1
                share = min(share, total - allocated - remaining * 100)
            
            if share > 0:
                assignments.append(ResourceAssignment(
                    resource_type='vaccine',
                    district=req.district,
                    quantity=share,
                    cost=share * COST_VACCINE,
                    reason=f"Prioritet {req.priority:.2f}",
                ))
                allocated += share
        
        print(f"  Caktuar në {len(assignments)} lagje:")
        for a in sorted(assignments, key=lambda x: -x.quantity):
            print(f"    {a.district:20s}: {a.quantity:>6,} doza")
        print(f"  Total: {allocated:,} doza")
        
        return assignments
    
    def allocate_staff(self, total: int = TOTAL_STAFF) -> List[ResourceAssignment]:
        """Shpërndan personelin mjekësor proporcional."""
        print(f"\n{'='*60}")
        print(f"SHPËRNDARJA E PERSONELIT MJEKËSOR ({total} persona)")
        print(f"{'='*60}")
        
        # Pesha = rastet × ngarkesa spitalore
        weights = []
        for req in self.requests:
            w = req.reports_7d
            weights.append((req, w))
        
        total_weight = sum(w for _, w in weights)
        if total_weight <= 0 or total <= 0:
            return []
        
        assignments = []
        allocated = 0
        sorted_weights = sorted(weights, key=lambda x: -x[1])
        
        for i, (req, w) in enumerate(sorted_weights):
            if i == len(sorted_weights) - 1:
                share = total - allocated
            else:
                share = int(total * w / total_weight)
                remaining_districts = len(sorted_weights) - i - 1
                share = min(share, total - allocated - remaining_districts)
            
            if share > 0:
                assignments.append(ResourceAssignment(
                    resource_type='staff',
                    district=req.district,
                    quantity=share,
                    cost=share * COST_STAFF,
                    reason=f"Report volume: {req.reports_7d:,} over the forecast window",
                ))
                allocated += share
        
        print(f"  Caktuar në {len(assignments)} lagje:")
        for a in sorted(assignments, key=lambda x: -x.quantity):
            print(f"    {a.district:20s}: {a.quantity:2d} persona")
        print(f"  Total: {allocated} persona")
        
        return assignments
    
    def optimize_all(self, capacities: Dict[str, int] | None = None) -> Dict[str, List[ResourceAssignment]]:
        """Optimizon të gjitha burimet."""
        capacities = capacities or {}
        print(f"\n{'='*60}")
        print(f"OPTIMIZIMI I BURIMEVE EMERGJENTE")
        print(f"{'='*60}")
        print(f"Lagje: {len(self.requests)}")
        
        results = {
            'ambulances': self.allocate_ambulances(capacities.get("ambulance", TOTAL_AMBULANCES)),
            'testing_units': self.allocate_testing_units(capacities.get("testing_unit", TOTAL_TESTING_UNITS)),
            'beds': self.allocate_beds(capacities.get("bed", TOTAL_BEDS)),
            'vaccines': self.allocate_vaccines(capacities.get("vaccine", TOTAL_VACCINES)),
            'staff': self.allocate_staff(capacities.get("staff", TOTAL_STAFF)),
        }
        
        # Total kosto
        total_cost = sum(
            a.cost for assignments in results.values() for a in assignments
        )
        
        print(f"\n{'='*60}")
        print(f"PËRMBLEDHJE")
        print(f"{'='*60}")
        for resource, assignments in results.items():
            total_qty = sum(a.quantity for a in assignments)
            print(f"  {resource:20s}: {total_qty:>8,} njësi në {len(assignments)} lagje")
        print(f"\n  Kostoja totale: {total_cost:.2f}")
        print(f"{'='*60}")
        
        return results


# ==================== MAIN ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EpiPrishtina — Shpërndarja e Burimeve Emergjente")
    print("="*60)
    
    # Lexo parashikimet e hotspot-eve
    pred_path = "data/processed/hotspot_predictions.csv"
    if not os.path.exists(pred_path):
        pred_path = "data/processed/hotspot_predictions_day25.csv"
    
    if not os.path.exists(pred_path):
        print(f"✗ Skedari {pred_path} nuk ekziston!")
        print(f"  Ekzekuto fillimisht: python src/ml/hotspot_predictor.py")
        exit(1)
    
    print(f"\nDuke lexuar parashikimet...")
    predictions = pd.read_csv(pred_path)
    print(f"  ✓ {len(predictions)} lagje")
    
    reports = pd.read_csv("data/processed/citizen_reports.csv")
    population = pd.read_csv("data/processed/prishtina_population_22k.csv")
    print(f"  ✓ Raportet: {len(reports):,}")
    print(f"  ✓ Popullsia: {len(population):,}")
    
    # Krijo alokuesin
    allocator = ResourceAllocator()
    allocator.load_requests(predictions, reports, population)
    
    print(f"\nKërkesat e ngarkuara:")
    for req in sorted(allocator.requests, key=lambda r: -r.priority)[:5]:
        print(f"  {req.district:20s}: prioritet={req.priority:.2f}, "
              f"raste={req.reports_7d:,}, distanca={req.distance_to_hospital:.2f}km")
    
    # Optimizo
    results = allocator.optimize_all()
    
    # Ruaj
    all_assignments = []
    for resource, assignments in results.items():
        for a in assignments:
            all_assignments.append({
                'resource_type': a.resource_type,
                'district': a.district,
                'quantity': a.quantity,
                'cost': a.cost,
                'reason': a.reason,
            })
    
    df_assignments = pd.DataFrame(all_assignments)
    os.makedirs("data/processed", exist_ok=True)
    output_path = "data/processed/resource_allocations.csv"
    df_assignments.to_csv(output_path, index=False)
    print(f"\n✓ U ruajt: {output_path}")
    print(f"  {len(df_assignments)} caktime × {len(df_assignments.columns)} kolona")
    print(f"{'='*60}\n")
