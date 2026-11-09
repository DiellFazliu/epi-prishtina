"""
Gjeneruesi i popullsisë sintetike për Prishtinën.

Krijon 22,000 agjentë virtualë që përfaqësojnë 220,000 banorë realë
(faktor shkallëzimi 1:10).

Të dhënat bazë:
    - Census 2024 (ASK): shpërndarja e moshës, gjinisë
    - WorldPop: dendësia hapësinore e popullsisë
    - OSM: ndërtesat rezidenciale, POI-të

Çdo agjent ka:
    - Moshë, gjini
    - Vendbanim (home)
    - Vend pune/shkolle (work/school)
    - Model lëvizjeje ditore
    - Gjendje shëndetësore (S/E/I/R/D)
    - Numri i kontakteve ditore
"""

import os
import random
import numpy as np
import pandas as pd
import geopandas as gpd
from dataclasses import dataclass, field, asdict
from typing import List, Tuple, Optional


# ==================== KONFIGURIMI ====================

# Popullsia reale e Prishtinës
REAL_POPULATION = 220_000

# Numri i agjentëve sintetikë
N_AGENTS = 22_000

# Faktori i shkallëzimit
SCALING_FACTOR = REAL_POPULATION / N_AGENTS  # = 10.0

# Qendra e Prishtinës
CENTER_LAT = 42.6629
CENTER_LON = 21.1655

# Shpërndarja e moshës nga Census 2024 (përqindje e përafërt)
AGE_DISTRIBUTION = {
    "0-4":   (0,  5,  0.055),
    "5-9":   (5,  10, 0.060),
    "10-14": (10, 15, 0.065),
    "15-19": (15, 20, 0.070),
    "20-24": (20, 25, 0.075),
    "25-29": (25, 30, 0.080),
    "30-34": (30, 35, 0.075),
    "35-39": (35, 40, 0.070),
    "40-44": (40, 45, 0.065),
    "45-49": (45, 50, 0.060),
    "50-54": (50, 55, 0.055),
    "55-59": (55, 60, 0.050),
    "60-64": (60, 65, 0.045),
    "65-69": (65, 70, 0.035),
    "70-74": (70, 75, 0.025),
    "75-79": (75, 80, 0.015),
    "80+":   (80, 95, 0.010),
}

# Probabiliteti i gjinisë
P_MALE = 0.49
P_FEMALE = 0.51


# ==================== AGJENTI ====================

@dataclass
class Agent:
    """Agjent virtual me karakteristika demografike dhe epidemiologjike."""
    id: int
    age: int
    gender: str  # 'M' ose 'F'
    
    # Vendbanimi
    home_lat: float
    home_lon: float
    home_district: str
    
    # Vendi i punës/shkollës
    work_lat: float
    work_lon: float
    work_type: str  # 'school', 'university', 'work', 'home'
    work_name: str = ""
    
    # Lëvizja ditore
    activity_type: str = "worker"  # 'child', 'student', 'worker', 'retired'
    daily_contacts: int = 10
    mobility_level: str = "medium"  # 'low', 'medium', 'high'
    
    # Gjendja shëndetësore
    health_state: str = "S"  # S, E, I, R, D
    days_in_state: int = 0
    
    # Familja
    household_id: int = 0
    household_size: int = 1


# ==================== NDARJA E LAGJEVE ====================

# Lagjet e Prishtinës me koordinata të përafërta
PRISHTINA_DISTRICTS = [
    # (emri, lat, lon, pesha relative)
    ("Qendra", 42.6629, 21.1655, 0.15),
    ("Dardania", 42.6555, 21.1585, 0.12),
    ("Ulpiana", 42.6580, 21.1720, 0.10),
    ("Arbëria", 42.6700, 21.1480, 0.09),
    ("Kalabria", 42.6480, 21.1610, 0.08),
    ("Bregu i Diellit", 42.6520, 21.1780, 0.08),
    ("Sunny Hill", 42.6450, 21.1700, 0.07),
    ("Lakrishte", 42.6420, 21.1450, 0.06),
    ("Mat", 42.6580, 21.1350, 0.05),
    ("Tophane", 42.6680, 21.1620, 0.05),
    ("Vranjevc", 42.6720, 21.1750, 0.04),
    ("Kodra e Trimave", 42.6760, 21.1580, 0.04),
    ("Kolovica", 42.6820, 21.1780, 0.03),
    ("Sofali", 42.6450, 21.1900, 0.02),
    ("Bardhosh", 42.6900, 21.1500, 0.02),
]


# ==================== GENERATORI ====================

class SyntheticPopulationGenerator:
    """
    Gjeneruesi i popullsisë sintetike për Prishtinën.
    """
    
    def __init__(
        self,
        n_agents: int = N_AGENTS,
        real_population: int = REAL_POPULATION,
        seed: int = 42,
    ):
        self.n_agents = n_agents
        self.real_population = real_population
        self.scaling_factor = real_population / n_agents
        self.agents: List[Agent] = []
        
        # Vendos seed për riprodhueshmëri
        random.seed(seed)
        np.random.seed(seed)
        
        # Ngarko POI-të
        self.pois = self._load_pois()
        
    def _load_pois(self) -> dict:
        """Ngarko POI-të e shkarkuara."""
        pois = {}
        poi_dir = "data/raw/osm"
        
        for poi_type in ["schools", "universities", "hospitals", 
                         "supermarkets", "restaurants", "cafes"]:
            path = os.path.join(poi_dir, f"{poi_type}.gpkg")
            if os.path.exists(path):
                try:
                    gdf = gpd.read_file(path)
                    # Konverto në lista koordinatash
                    coords = []
                    for _, row in gdf.iterrows():
                        geom = row.geometry
                        if geom is None:
                            continue
                        if geom.geom_type in ("Polygon", "MultiPolygon"):
                            c = geom.centroid
                            coords.append((c.y, c.x, row.get("name", "")))
                        elif geom.geom_type == "Point":
                            coords.append((geom.y, geom.x, row.get("name", "")))
                    pois[poi_type] = coords
                    print(f"  ✓ Ngarkuar {len(coords)} {poi_type}")
                except Exception as e:
                    print(f"  ✗ Gabim në {poi_type}: {e}")
                    pois[poi_type] = []
            else:
                pois[poi_type] = []
        
        return pois
    
    def _generate_age(self) -> int:
        """Gjenero një moshë bazuar në shpërndarjen e Census 2024."""
        # Zgjidh grupmoshën
        groups = list(AGE_DISTRIBUTION.keys())
        probs = [AGE_DISTRIBUTION[g][2] for g in groups]
        
        # Normalizo
        probs = np.array(probs)
        probs = probs / probs.sum()
        
        group = np.random.choice(groups, p=probs)
        min_age, max_age, _ = AGE_DISTRIBUTION[group]
        
        return np.random.randint(min_age, max_age)
    
    def _assign_activity(self, age: int) -> Tuple[str, str, int, str]:
        """
        Cakto llojin e aktivitetit bazuar në moshë.
        
        Returns:
            (activity_type, work_type, daily_contacts, mobility_level)
        """
        if age < 7:
            return ("child", "home", 4, "low")
        elif age < 19:
            return ("student", "school", 15, "medium")
        elif age < 25:
            return ("student", "university", 12, "high")
        elif age < 65:
            return ("worker", "work", 10, "high")
        else:
            return ("retired", "home", 5, "low")
    
    def _pick_district(self) -> Tuple[str, float, float]:
        """Zgjidh një lagje bazuar në peshën relative."""
        names = [d[0] for d in PRISHTINA_DISTRICTS]
        weights = [d[3] for d in PRISHTINA_DISTRICTS]
        weights = np.array(weights) / sum(weights)
        
        idx = np.random.choice(len(names), p=weights)
        name, lat, lon, _ = PRISHTINA_DISTRICTS[idx]
        
        # Shto pak zhurmë për variacion
        lat += np.random.normal(0, 0.003)
        lon += np.random.normal(0, 0.003)
        
        return (name, lat, lon)
    
    def _pick_workplace(self, work_type: str) -> Tuple[float, float, str]:
        """Zgjidh një vend pune/shkolle bazuar në llojin."""
        if work_type == "school" and self.pois.get("schools"):
            options = self.pois["schools"]
        elif work_type == "university" and self.pois.get("universities"):
            options = self.pois["universities"]
        elif work_type == "work":
            # Kombino disa POI për vende pune
            options = (
                self.pois.get("hospitals", []) +
                self.pois.get("supermarkets", []) +
                self.pois.get("restaurants", []) +
                self.pois.get("cafes", [])
            )
        else:
            # Për 'home' ose mungesë POI, përdor lagje të rastësishme
            _, lat, lon = self._pick_district()
            return (lat, lon, "")
        
        if not options:
            _, lat, lon = self._pick_district()
            return (lat, lon, "")
        
        chosen = random.choice(options)
        return (chosen[0], chosen[1], chosen[2])
    
    def generate(self) -> List[Agent]:
        """Gjeneron popullsinë e plotë."""
        print(f"\n{'='*60}")
        print(f"GJENERIMI I POPULLSISË SINTETIKE")
        print(f"{'='*60}")
        print(f"Agjentë: {self.n_agents:,}")
        print(f"Popullsia reale: {self.real_population:,}")
        print(f"Faktori i shkallëzimit: 1:{self.scaling_factor:.0f}")
        print(f"{'='*60}\n")
        
        # Gjenero agjentët
        household_counter = 0
        current_household_size = 0
        target_household_size = 3  # Mesatarisht 3 persona për familje
        
        for i in range(self.n_agents):
            # Progres
            if (i + 1) % 2000 == 0:
                print(f"  → Gjeneruar {i+1:,}/{self.n_agents:,} agjentë...")
            
            # Mosha dhe gjinia
            age = self._generate_age()
            gender = "M" if random.random() < P_MALE else "F"
            
            # Aktiviteti
            activity_type, work_type, contacts, mobility = self._assign_activity(age)
            
            # Vendbanimi
            district_name, home_lat, home_lon = self._pick_district()
            
            # Vendi i punës/shkollës
            work_lat, work_lon, work_name = self._pick_workplace(work_type)
            
            # Familja
            if current_household_size >= target_household_size:
                household_counter += 1
                current_household_size = 0
                target_household_size = np.random.choice([1, 2, 3, 4, 5], p=[0.1, 0.25, 0.3, 0.25, 0.1])
            
            current_household_size += 1
            
            agent = Agent(
                id=i,
                age=int(age),
                gender=gender,
                home_lat=float(home_lat),
                home_lon=float(home_lon),
                home_district=district_name,
                work_lat=float(work_lat),
                work_lon=float(work_lon),
                work_type=work_type,
                work_name=work_name,
                activity_type=activity_type,
                daily_contacts=contacts,
                mobility_level=mobility,
                household_id=household_counter,
                household_size=current_household_size,
            )
            
            self.agents.append(agent)
        
        print(f"\n  ✓ Gjeneruar {len(self.agents):,} agjentë")
        self._print_stats()
        
        return self.agents
    
    def _print_stats(self):
        """Printo statistikat e popullsisë."""
        print(f"\n{'='*60}")
        print(f"STATISTIKAT E POPULLSISË")
        print(f"{'='*60}")
        
        # Shpërndarja e moshës
        ages = [a.age for a in self.agents]
        print(f"Mosha mesatare: {np.mean(ages):.1f} vjeç")
        print(f"Mosha minimale: {min(ages)} vjeç")
        print(f"Mosha maksimale: {max(ages)} vjeç")
        
        # Gjinia
        males = sum(1 for a in self.agents if a.gender == "M")
        females = sum(1 for a in self.agents if a.gender == "F")
        print(f"\nGjinia:")
        print(f"  Meshkuj: {males:,} ({males/len(self.agents)*100:.1f}%)")
        print(f"  Femra:   {females:,} ({females/len(self.agents)*100:.1f}%)")
        
        # Aktiviteti
        print(f"\nAktiviteti:")
        for act in ["child", "student", "worker", "retired"]:
            count = sum(1 for a in self.agents if a.activity_type == act)
            print(f"  {act:10s}: {count:6,} ({count/len(self.agents)*100:5.1f}%)")
        
        # Lagjet
        print(f"\nLagjet (Top 5):")
        from collections import Counter
        districts = Counter(a.home_district for a in self.agents)
        for name, count in districts.most_common(5):
            print(f"  {name:20s}: {count:6,}")
        
        # Familjet
        households = set(a.household_id for a in self.agents)
        print(f"\nFamiljet: {len(households):,}")
        print(f"Mesatarisht: {len(self.agents)/len(households):.1f} persona/familje")
        
        # Kontaktet
        contacts = [a.daily_contacts for a in self.agents]
        print(f"\nKontaktet ditore:")
        print(f"  Mesatare: {np.mean(contacts):.1f}")
        print(f"  Minimale: {min(contacts)}")
        print(f"  Maksimale: {max(contacts)}")
        
        print(f"{'='*60}\n")
    
    def to_dataframe(self) -> pd.DataFrame:
        """Konverto popullsinë në DataFrame."""
        return pd.DataFrame([asdict(a) for a in self.agents])
    
    def save(self, path: str = "data/processed/prishtina_population_22k.csv"):
        """Ruaj popullsinë në CSV."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        df = self.to_dataframe()
        df.to_csv(path, index=False)
        print(f"  ✓ Popullsia u ruajt: {path}")
        print(f"    Madhësia: {len(df):,} rreshta × {len(df.columns)} kolona")
        return path
    
    def scale_to_real(self, value: int) -> int:
        """Shkallëzo një vlerë nga simulimi në realitet."""
        return int(value * self.scaling_factor)
    
    def scale_from_real(self, value: int) -> int:
        """Shkallëzo një vlerë nga realiteti në simulim."""
        return int(value / self.scaling_factor)


# ==================== MAIN ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EpiPrishtina — Gjeneruesi i Popullsisë Sintetike")
    print("="*60)
    
    # Krijo generatorin
    gen = SyntheticPopulationGenerator(
        n_agents=22_000,
        real_population=220_000,
    )
    
    # Gjenero
    agents = gen.generate()
    
    # Ruaj
    gen.save()
    
    # Shembuj
    print("\n=== Shembuj Agjentësh ===")
    for i in [0, 1000, 5000, 10000, 21000]:
        a = agents[i]
        print(f"\nAgjenti #{a.id}")
        print(f"  Mosha: {a.age} vjeç, {a.gender}")
        print(f"  Lagjja: {a.home_district}")
        print(f"  Aktiviteti: {a.activity_type}")
        print(f"  Vendi i punës: {a.work_type} - {a.work_name or 'N/A'}")
        print(f"  Kontaktet ditore: {a.daily_contacts}")
        print(f"  Lëvizshmëria: {a.mobility_level}")
        print(f"  Familja: #{a.household_id} ({a.household_size} persona)")
        print(f"  Gjendja shëndetësore: {a.health_state}")
    
    # Shembull shkallëzimi
    print(f"\n=== Shembull Shkallëzimi ===")
    sim_value = 500
    real_value = gen.scale_to_real(sim_value)
    print(f"  Në simulim: {sim_value:,} agjentë të infektuar")
    print(f"  Në realitet: {real_value:,} raste reale")
    print(f"  Faktori: {gen.scaling_factor:.1f}×")
    
    print(f"\n{'='*60}")
    print(f"  ✓ Popullsia u gjenerua me sukses!")
    print(f"{'='*60}\n")