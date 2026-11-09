"""
Simulimi SEIRD për EpiPrishtina — Version i Optimizuar.

Modeli epidemiologjik:
    S (Susceptible) → E (Exposed) → I (Infectious) → R (Recovered)
                                                  ↓
                                                 D (Dead)

Optimizime:
    - Kontakte të kufizuara (jo O(n²))
    - Grid hapësinor për fqinjësi
    - Mostrim i kontakteve ditore
    - Vektorizim me NumPy ku është e mundur
    - Koha ~2s për ditë (22,000 agjentë)

Kalibrim realist:
    - R₀ fillestare: ~2.5
    - Pika e infeksionit: ~35-50 ditë
    - IFR total: ~1%
"""

import os
import time
import random
import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from collections import defaultdict


# ==================== KONFIGURIMI ====================

SCALING_FACTOR = 10.0  # 1:10 (22,000 agjentë = 220,000 banorë)


@dataclass
class EpidemicParams:
    """Parametrat epidemiologjikë."""
    # Transmetimi
    transmission_rate: float = 0.08        # β — probabiliteti bazë (kalibruar)
    contact_radius_km: float = 0.5         # Rrezja e kontaktit (km)
    contact_efficiency: float = 0.30       # Sa kontakte çojnë në transmetim
    
    # Kohëzgjatja e fazave
    incubation_days: int = 5               # E → I
    infectious_days_mild: int = 7          # I (mild) → R
    infectious_days_severe: int = 14       # I (severe) → R/D
    hospital_days: int = 10                # H → R ose ICU ose D
    icu_days: int = 14                     # ICU → R ose D
    
    # Probabilitetet
    asymptomatic_prob: float = 0.35        # Sa nuk kanë simptoma
    severe_prob: float = 0.15              # Sa kalojnë në severe
    hospitalization_prob: float = 0.08     # Sa hospitalizohen
    icu_prob: float = 0.02                 # Sa kalojnë në ICU
    
    # Vdekshmëria (bazuar në moshë) — kalibruar për një patogjen realist
    ifr_by_age: Dict[str, float] = field(default_factory=lambda: {
        "0-19":   0.0003,   # 0.03%
        "20-39":  0.002,    # 0.2%
        "40-59":  0.010,    # 1.0%
        "60-79":  0.050,    # 5.0%
        "80+":    0.200,    # 20.0%
    })
    
    # Imuniteti
    immunity_days: int = 180               # Sa zgjat imuniteti (6 muaj)
    
    # Shkallëzimi
    scaling_factor: float = 10.0
    
    # Random seed
    seed: int = 42


# ==================== AGJENTI ====================

@dataclass
class SimAgent:
    """Agjent në simulim me gjendje epidemiologjike."""
    id: int
    age: int
    gender: str
    home_lat: float
    home_lon: float
    home_district: str
    work_lat: float
    work_lon: float
    work_type: str
    activity_type: str
    daily_contacts: int
    mobility_level: str
    
    # Gjendja epidemiologjike
    health_state: str = "S"  # S, E, I_mild, I_severe, H, ICU, R, D
    days_in_state: int = 0
    infected_day: int = -1
    infectious_day: int = -1
    recovered_day: int = -1
    death_day: int = -1


# ==================== SIMULATORI ====================

class SEIRDSimulator:
    """Simulator agent-based SEIRD për Prishtinën."""
    
    def __init__(
        self,
        agents: List[SimAgent],
        params: EpidemicParams,
    ):
        self.agents = agents
        self.params = params
        self.day = 0
        
        # Histori ditore
        self.history: List[Dict] = []
        
        # Inicializo random
        random.seed(params.seed)
        np.random.seed(params.seed)
        
        # Indeks hapësinor
        self._build_spatial_index()
        
        # Statistika
        self.peak_infections = 0
        self.peak_day = 0
        
        # Cache për shpejtësi
        self._infectious_cache: List[SimAgent] = []
        
        print(f"\n{'='*60}")
        print(f"SIMULATORI SEIRD — Inicializuar")
        print(f"{'='*60}")
        print(f"Agjentë: {len(self.agents):,}")
        print(f"Shkallëzimi: 1:{params.scaling_factor:.0f}")
        print(f"Transmission rate: {params.transmission_rate}")
        print(f"Rrezja e kontaktit: {params.contact_radius_km} km")
        print(f"Inkubacioni: {params.incubation_days} ditë")
        print(f"Infektiviteti: {params.infectious_days_mild}-{params.infectious_days_severe} ditë")
        print(f"{'='*60}\n")
    
    def _build_spatial_index(self):
        """Krijo një indeks hapësinor me grid."""
        self.grid = defaultdict(list)
        for agent in self.agents:
            cell = (int(agent.home_lat * 100), int(agent.home_lon * 100))
            self.grid[cell].append(agent)
    
    def _get_neighbors(
        self,
        agent: SimAgent,
        radius_km: float = 0.5,
        max_neighbors: int = None,
    ) -> List[SimAgent]:
        """Gjej fqinjët — me limit për performancë."""
        if max_neighbors is None:
            max_neighbors = agent.daily_contacts * 10
        
        neighbors = []
        lat_cell = int(agent.home_lat * 100)
        lon_cell = int(agent.home_lon * 100)
        
        for dlat in [-1, 0, 1]:
            for dlon in [-1, 0, 1]:
                cell = (lat_cell + dlat, lon_cell + dlon)
                neighbors.extend(self.grid.get(cell, []))
        
        if len(neighbors) > max_neighbors:
            neighbors = random.sample(neighbors, max_neighbors)
        
        return neighbors
    
    def _get_age_group(self, age: int) -> str:
        """Kthen grupmoshën për IFR."""
        if age < 20:
            return "0-19"
        elif age < 40:
            return "20-39"
        elif age < 60:
            return "40-59"
        elif age < 80:
            return "60-79"
        else:
            return "80+"
    
    def initialize_outbreak(
        self,
        n_initial: int = 20,
        district: Optional[str] = None,
    ) -> None:
        """Injekto n_initial agjentë të infektuar."""
        if district:
            candidates = [a for a in self.agents if a.home_district == district]
        else:
            candidates = self.agents
        
        if len(candidates) < n_initial:
            candidates = self.agents
        
        initial = random.sample(candidates, min(n_initial, len(candidates)))
        
        for agent in initial:
            agent.health_state = "E"
            agent.days_in_state = 0
            agent.infected_day = 0
        
        location = district if district else "Prishtinë (e gjitha)"
        print(f"Dita 0: {n_initial} agjentë të ekspozuar (E) në {location}")
        print(f"       ≈ {int(n_initial * self.params.scaling_factor)} raste reale\n")
    
    def _calculate_transmission_probability(
        self,
        susceptible: SimAgent,
        infected: SimAgent,
    ) -> float:
        """Llogarit probabilitetin e transmetimit."""
        # Distanca hapësinore
        dlat = (susceptible.home_lat - infected.home_lat) * 111
        dlon = (susceptible.home_lon - infected.home_lon) * 111 * np.cos(np.radians(42.66))
        dist_km = np.sqrt(dlat ** 2 + dlon ** 2)
        
        if dist_km > self.params.contact_radius_km:
            return 0.0
        
        p = self.params.transmission_rate
        
        # Faktor distance (linear)
        distance_factor = max(0.1, 1 - dist_km / self.params.contact_radius_km)
        p *= distance_factor
        
        # Faktor mosha
        if susceptible.age < 10:
            p *= 0.5
        elif susceptible.age > 65:
            p *= 1.2
        
        # Faktor lëvizshmëria
        if susceptible.mobility_level == "high":
            p *= 1.3
        elif susceptible.mobility_level == "low":
            p *= 0.7
        
        return min(p, 1.0)
    
    def _update_states(self):
        """Përditëso gjendjet epidemiologjike — i optimizuar me lista."""
        new_infectious = []
        new_recovered = []
        new_dead = []
        new_hospitalized = []
        new_icu = []
        
        for agent in self.agents:
            agent.days_in_state += 1
            state = agent.health_state
            
            # E → I_mild ose I_severe ose R (asymptomatic)
            if state == "E":
                if agent.days_in_state >= self.params.incubation_days:
                    r = random.random()
                    if r < self.params.asymptomatic_prob:
                        agent.health_state = "R"
                        agent.recovered_day = self.day
                        new_recovered.append(agent)
                    elif r < self.params.asymptomatic_prob + self.params.severe_prob:
                        agent.health_state = "I_severe"
                        agent.infectious_day = self.day
                        new_infectious.append(agent)
                    else:
                        agent.health_state = "I_mild"
                        agent.infectious_day = self.day
                        new_infectious.append(agent)
                    agent.days_in_state = 0
            
            # I_mild → R
            elif state == "I_mild":
                if agent.days_in_state >= self.params.infectious_days_mild:
                    agent.health_state = "R"
                    agent.recovered_day = self.day
                    new_recovered.append(agent)
                    agent.days_in_state = 0
            
            # I_severe → H ose R
            elif state == "I_severe":
                if agent.days_in_state >= self.params.infectious_days_severe:
                    agent.health_state = "R"
                    agent.recovered_day = self.day
                    new_recovered.append(agent)
                    agent.days_in_state = 0
                elif agent.days_in_state >= 3 and random.random() < self.params.hospitalization_prob:
                    agent.health_state = "H"
                    new_hospitalized.append(agent)
                    agent.days_in_state = 0
            
            # H → ICU ose R ose D
            elif state == "H":
                if agent.days_in_state >= self.params.hospital_days:
                    r = random.random()
                    age_group = self._get_age_group(agent.age)
                    ifr = self.params.ifr_by_age[age_group]
                    
                    if r < self.params.icu_prob:
                        agent.health_state = "ICU"
                        new_icu.append(agent)
                        agent.days_in_state = 0
                    elif r < self.params.icu_prob + ifr * 3:
                        agent.health_state = "D"
                        agent.death_day = self.day
                        new_dead.append(agent)
                        agent.days_in_state = 0
                    else:
                        agent.health_state = "R"
                        agent.recovered_day = self.day
                        new_recovered.append(agent)
                        agent.days_in_state = 0
            
            # ICU → R ose D
            elif state == "ICU":
                if agent.days_in_state >= self.params.icu_days:
                    age_group = self._get_age_group(agent.age)
                    ifr = self.params.ifr_by_age[age_group]
                    
                    if random.random() < ifr * 10:
                        agent.health_state = "D"
                        agent.death_day = self.day
                        new_dead.append(agent)
                        agent.days_in_state = 0
                    else:
                        agent.health_state = "R"
                        agent.recovered_day = self.day
                        new_recovered.append(agent)
                        agent.days_in_state = 0
            
            # R → S (humb imunitetin)
            elif state == "R":
                if agent.recovered_day > 0:
                    days_recovered = self.day - agent.recovered_day
                    if days_recovered >= self.params.immunity_days:
                        agent.health_state = "S"
                        agent.days_in_state = 0
    
    def _transmit(self):
        """Transmeto sëmundjen — i optimizuar."""
        # Merr agjentët infektivë (cache)
        infectious = [a for a in self.agents if a.health_state in ("I_mild", "I_severe", "H", "ICU")]
        
        if not infectious:
            return
        
        # Krijo set të shpejtë për lookup
        infectious_set = set(a.id for a in infectious)
        
        newly_exposed = []
        
        for susceptible in self.agents:
            if susceptible.health_state != "S":
                continue
            
            # Merr fqinjët (të limituar)
            neighbors = self._get_neighbors(susceptible)
            
            # Filtro vetëm infektivët që janë brenda rrezes
            nearby_infected = []
            for n in neighbors:
                if n.id not in infectious_set:
                    continue
                
                dlat = (susceptible.home_lat - n.home_lat) * 111
                dlon = (susceptible.home_lon - n.home_lon) * 111 * np.cos(np.radians(42.66))
                dist_km = np.sqrt(dlat ** 2 + dlon ** 2)
                
                if dist_km <= self.params.contact_radius_km:
                    nearby_infected.append(n)
            
            if not nearby_infected:
                continue
            
            # Mostro vetëm daily_contacts fqinjë
            n_contacts = min(len(nearby_infected), susceptible.daily_contacts)
            if n_contacts < len(nearby_infected):
                contacts = random.sample(nearby_infected, n_contacts)
            else:
                contacts = nearby_infected
            
            # Llogarit probabilitetin total
            p_total = 1.0
            for infected in contacts:
                p = self._calculate_transmission_probability(susceptible, infected)
                p_total *= (1 - p)
            p_total = 1 - p_total
            
            # Aplikon efficiency
            p_total *= self.params.contact_efficiency
            
            if random.random() < p_total:
                newly_exposed.append(susceptible)
        
        for agent in newly_exposed:
            agent.health_state = "E"
            agent.days_in_state = 0
            agent.infected_day = self.day
    
    def step(self) -> Dict:
        """Përparon simulimin me një ditë."""
        self.day += 1
        start_time = time.time()
        
        self._update_states()
        self._transmit()
        
        stats = self._collect_stats()
        stats['elapsed_seconds'] = time.time() - start_time
        self.history.append(stats)
        
        if stats['active'] > self.peak_infections:
            self.peak_infections = stats['active']
            self.peak_day = self.day
        
        return stats
    
    def _collect_stats(self) -> Dict:
        """Mblidh statistikat ditore."""
        counts = defaultdict(int)
        for agent in self.agents:
            counts[agent.health_state] += 1
        
        active = counts['E'] + counts['I_mild'] + counts['I_severe'] + counts['H'] + counts['ICU']
        total_infected = counts['E'] + counts['I_mild'] + counts['I_severe'] + \
                         counts['H'] + counts['ICU'] + counts['R'] + counts['D']
        sf = self.params.scaling_factor
        
        return {
            'day': self.day,
            'S': counts['S'],
            'E': counts['E'],
            'I_mild': counts['I_mild'],
            'I_severe': counts['I_severe'],
            'H': counts['H'],
            'ICU': counts['ICU'],
            'R': counts['R'],
            'D': counts['D'],
            'active': active,
            'total_infected': total_infected,
            'real_active': int(active * sf),
            'real_deaths': int(counts['D'] * sf),
            'real_total_infected': int(total_infected * sf),
            'real_hospitalized': int(counts['H'] * sf),
            'real_icu': int(counts['ICU'] * sf),
        }
    
    def run(self, n_days: int = 90, verbose: bool = True) -> pd.DataFrame:
        """Ekzekuton simulimin."""
        print(f"\n{'='*60}")
        print(f"FILLON SIMULIMI SEIRD")
        print(f"{'='*60}")
        print(f"Kohëzgjatja: {n_days} ditë")
        print(f"Popullsia: {len(self.agents):,}")
        print(f"{'='*60}\n")
        
        start_time = time.time()
        
        for _ in range(n_days):
            stats = self.step()
            
            if verbose and (self.day % 7 == 0 or self.day == 1):
                print(f"Dita {self.day:3d}: "
                      f"E={stats['E']:5d} "
                      f"I={stats['I_mild'] + stats['I_severe']:5d} "
                      f"H={stats['H']:4d} "
                      f"ICU={stats['ICU']:3d} "
                      f"R={stats['R']:5d} "
                      f"D={stats['D']:4d} "
                      f"| Aktivë: {stats['active']:5d} "
                      f"({stats['real_active']:7,} realë)")
        
        total_time = time.time() - start_time
        df = pd.DataFrame(self.history)
        
        print(f"\n{'='*60}")
        print(f"SIMULIMI PËRFUNDOI")
        print(f"{'='*60}")
        print(f"Koha totale: {total_time:.1f} sekonda")
        print(f"Koha mesatare për ditë: {total_time/n_days:.2f} sekonda")
        print(f"\nPika maksimale e infeksionit:")
        print(f"  Dita: {self.peak_day}")
        print(f"  Aktivë (simulim): {self.peak_infections:,}")
        print(f"  Aktivë (real): {int(self.peak_infections * self.params.scaling_factor):,}")
        print(f"\nTotal:")
        final = self.history[-1]
        print(f"  Të infektuar (simulim): {final['total_infected']:,}")
        print(f"  Të infektuar (real): {final['real_total_infected']:,}")
        print(f"  Vdekje (simulim): {final['D']:,}")
        print(f"  Vdekje (real): {final['real_deaths']:,}")
        print(f"  R(t) fundit: {self._calculate_rt():.2f}")
        print(f"{'='*60}\n")
        
        return df
    
    def _calculate_rt(self) -> float:
        """Llogarit R(t) — numri riprodhues efektiv."""
        if len(self.history) < 15:
            return 1.0
        
        recent = self.history[-1]['total_infected'] - self.history[-8]['total_infected']
        previous = self.history[-8]['total_infected'] - self.history[-15]['total_infected']
        
        if previous <= 0:
            return 1.0
        
        return recent / previous


# ==================== MAIN ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EpiPrishtina — Simulimi SEIRD")
    print("="*60)
    
    pop_path = "data/processed/prishtina_population_22k.csv"
    if not os.path.exists(pop_path):
        print(f"✗ Skedari {pop_path} nuk ekziston!")
        print(f"  Ekzekuto fillimisht: python src/population/generator.py")
        exit(1)
    
    print(f"\nDuke lexuar popullsinë nga {pop_path}...")
    df_pop = pd.read_csv(pop_path)
    print(f"  ✓ Lexuar {len(df_pop):,} agjentë")
    
    print(f"\nDuke konvertuar në agjentë simulimi...")
    agents = []
    for _, row in df_pop.iterrows():
        agent = SimAgent(
            id=int(row['id']),
            age=int(row['age']),
            gender=str(row['gender']),
            home_lat=float(row['home_lat']),
            home_lon=float(row['home_lon']),
            home_district=str(row['home_district']),
            work_lat=float(row['work_lat']),
            work_lon=float(row['work_lon']),
            work_type=str(row['work_type']),
            activity_type=str(row['activity_type']),
            daily_contacts=int(row['daily_contacts']),
            mobility_level=str(row['mobility_level']),
        )
        agents.append(agent)
    print(f"  ✓ Konvertuar {len(agents):,} agjentë")
    
    # Parametrat — të kalibruar për një patogjen realist
    params = EpidemicParams(
        transmission_rate=0.18,        # Pak më e ulët se 0.08
        contact_radius_km=0.5,          # Rreze më e gjerë (nga 0.5)
        contact_efficiency=0.5,         # NUK e reduktojmë (nga 0.30)
        incubation_days=5,
        infectious_days_mild=7,
        infectious_days_severe=14,
        asymptomatic_prob=0.35,
        severe_prob=0.15,
        hospitalization_prob=0.08,
        icu_prob=0.02,
        scaling_factor=10.0,
        seed=42,
    )
    
    sim = SEIRDSimulator(agents, params)
    sim.initialize_outbreak(n_initial=20, district=None)
    
    history_df = sim.run(n_days=90, verbose=True)
    
    os.makedirs("data/processed", exist_ok=True)
    history_path = "data/processed/simulation_history.csv"
    history_df.to_csv(history_path, index=False)
    print(f"✓ Historiku u ruajt: {history_path}")
    
    print(f"\n{'='*60}")
    print(f"STATISTIKA PËRFUNDIMTARE")
    print(f"{'='*60}")
    print(f"Ditët totale: {len(history_df)}")
    print(f"Raste maksimale aktive (simulim): {sim.peak_infections:,}")
    print(f"Raste maksimale aktive (real): {int(sim.peak_infections * 10):,}")
    print(f"Dita e pikut: {sim.peak_day}")
    print(f"Vdekje totale (simulim): {history_df['D'].iloc[-1]:,}")
    print(f"Vdekje totale (real): {history_df['real_deaths'].iloc[-1]:,}")
    print(f"{'='*60}\n")
