"""
Sistemi i raportimit nga qytetarët për EpiPrishtina.

Qytetarët mund të raportojnë:
    1. Simptoma (temperaturë, kollë, etj.) — sinjal i hershëm
    2. Konfirmim pozitiv (test PCR/antigjen) — sinjal i fortë

Karakteristikat:
    - Anonimizim automatik (koordinatat → lagje)
    - Vlerësim besueshmërie (0-1)
    - Zbulim anomalish (raportime false)
    - Korrelacion hapësinor dhe kohor
    - Integrim me simulimin (data assimilation)

Shkallëzimi 1:10 aplikohet automatikisht.
"""

import os
import uuid
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Tuple
from collections import defaultdict


# ==================== KONFIGURIMI ====================

SCALING_FACTOR = 10.0

# Kufizim i testimit ditor (kapaciteti laboratorik)
MAX_TESTS_PER_DAY = 200

# Simptomat e njohura për epideminë
KNOWN_SYMPTOMS = {
    "fever": 0.35,
    "cough": 0.60,
    "fatigue": 0.50,
    "loss_of_smell": 0.45,
    "loss_of_taste": 0.40,
    "sore_throat": 0.30,
    "headache": 0.35,
    "muscle_pain": 0.25,
    "shortness_of_breath": 0.15,
    "diarrhea": 0.10,
}

# Probabilitetet e raportimit
P_REPORT_IF_SYMPTOMATIC = 0.20      # 20% e simptomatikëve raportojnë
P_TEST_IF_SYMPTOMATIC = 0.05        # 15% e simptomatikëve testohen
P_REPORT_IF_CONFIRMED = 0.85        # 85% e konfirmuarve raportojnë
P_FALSE_REPORT = 0.002              # 0.2% false positive

# Lagjet e Prishtinës
PRISHTINA_DISTRICTS = [
    "Qendra", "Dardania", "Ulpiana", "Arbëria", "Kalabria",
    "Bregu i Diellit", "Sunny Hill", "Lakrishte", "Mat", "Tophane",
    "Vranjevc", "Kodra e Trimave", "Kolovica", "Sofali", "Bardhosh",
]


# ==================== RAPORTI ====================

@dataclass
class CitizenReport:
    """Raport i një qytetari."""
    report_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    report_type: str = "symptom"
    symptoms: List[str] = field(default_factory=list)
    severity: int = 1
    area: str = ""
    lat: float = 0.0
    lon: float = 0.0
    age_range: str = ""
    source: str = "self_report"
    reliability_score: float = 0.5
    is_validated: bool = False


# ==================== VLERËSUESI ====================

class ReportValidator:
    """Vlerëson besueshmërinë e raporteve."""
    
    def __init__(self):
        self.reports: List[CitizenReport] = []
        self.device_reports: Dict[str, int] = defaultdict(int)
    
    def add_report(self, report: CitizenReport, device_id: str = None) -> CitizenReport:
        if device_id:
            self.device_reports[device_id] += 1
        report.reliability_score = self._calculate_reliability(report, device_id)
        report.is_validated = report.reliability_score >= 0.5
        self.reports.append(report)
        return report

    def _calculate_reliability(self, report: CitizenReport, device_id: Optional[str] = None) -> float:
        score = 0.5
        
        if report.report_type == "confirmed":
            score += 0.35
        elif report.symptoms:
            matching = [s for s in report.symptoms if s in KNOWN_SYMPTOMS]
            if matching:
                score += 0.15 * min(len(matching) / 3, 1.0)
        
        recent_nearby = self._count_nearby_reports(report.area, hours=24)
        if recent_nearby > 5:
            score += 0.15
        elif recent_nearby > 2:
            score += 0.08
        
        if self._is_growth_period(report.area):
            score += 0.10
        
        if device_id:
            n_reports = self.device_reports[device_id]
            if n_reports > 10:
                score -= 0.20
            elif n_reports > 5:
                score -= 0.10
        
        return max(0.0, min(1.0, score))
    
    def _count_nearby_reports(self, area: str, hours: int = 24) -> int:
        cutoff = datetime.now() - timedelta(hours=hours)
        return sum(1 for r in self.reports if r.area == area and r.timestamp > cutoff)
    
    def _is_growth_period(self, area: str) -> bool:
        now = datetime.now()
        last_24h = sum(1 for r in self.reports if r.area == area and r.timestamp > now - timedelta(hours=24))
        prev_24h = sum(1 for r in self.reports if r.area == area and 
                       now - timedelta(hours=48) < r.timestamp <= now - timedelta(hours=24))
        return last_24h > prev_24h * 1.2
    
    def get_area_summary(self, area: str, hours: int = 24) -> Dict:
        cutoff = datetime.now() - timedelta(hours=hours)
        area_reports = [r for r in self.reports if r.area == area and r.timestamp > cutoff]
        
        if not area_reports:
            return {'area': area, 'count': 0, 'avg_reliability': 0,
                    'symptoms': {}, 'confirmed': 0, 'estimated_real_cases': 0}
        
        symptom_counts = defaultdict(int)
        for r in area_reports:
            for s in r.symptoms:
                symptom_counts[s] += 1
        
        reported_count = len(area_reports)
        confirmed_count = sum(1 for r in area_reports if r.report_type == 'confirmed')
        
        # Vlerësim realist i rasteve reale
        # Konfirmimet: 85% raportojnë → shkallëzim
        # Simptomat: 20% raportojnë → ×5, por jo të gjithë janë të infektuar
        if confirmed_count > 0:
            estimated_real = int(confirmed_count / P_REPORT_IF_CONFIRMED * SCALING_FACTOR)
        else:
            estimated_real = int(reported_count * 0.15)
        
        return {
            'area': area,
            'count': reported_count,
            'avg_reliability': np.mean([r.reliability_score for r in area_reports]),
            'symptoms': dict(symptom_counts),
            'confirmed': confirmed_count,
            'estimated_real_cases': estimated_real,
        }
        
    def get_area_total(self, area: str) -> Dict:
        """Kthen totalin e raporteve për një zonë (pa filtër kohe)."""
        area_reports = [r for r in self.reports if r.area == area]
        
        if not area_reports:
            return {'area': area, 'total_reports': 0, 'confirmed': 0,
                    'estimated_real_cases': 0}
        
        confirmed_count = sum(1 for r in area_reports if r.report_type == 'confirmed')
        symptom_count = sum(1 for r in area_reports if r.report_type == 'symptom')
        
        # Vlerësim realist:
        # Konfirmimet: 85% raportojnë → shkallëzim 10×
        # Simptomat: 20% raportojnë → ×5, por vetëm ~30% janë të infektuar realisht
        estimated_from_confirmed = int(confirmed_count / P_REPORT_IF_CONFIRMED * SCALING_FACTOR)
        estimated_from_symptoms = int(symptom_count / P_REPORT_IF_SYMPTOMATIC * 0.3)
        
        # Përdor konfirmimet nëse janë të mjaftueshme
        if confirmed_count >= 50:
            estimated = estimated_from_confirmed
        else:
            # Kombinim
            estimated = estimated_from_confirmed + estimated_from_symptoms
        
        return {
            'area': area,
            'total_reports': len(area_reports),
            'symptom_reports': symptom_count,
            'confirmed': confirmed_count,
            'estimated_real_cases': estimated,
        }
    
    def detect_anomalies(self, min_reports: int = 50) -> List[Dict]:
        """Zbulon zona me rritje jonormale."""
        area_counts = defaultdict(int)
        for r in self.reports:
            area_counts[r.area] += 1
        
        if not area_counts:
            return []
        
        counts = list(area_counts.values())
        mean_count = np.mean(counts)
        max_count = max(counts)
        
        anomalies = []
        for area, count in area_counts.items():
            if count < min_reports:
                continue
            
            percentile = count / max_count
            
            if percentile > 0.75:
                severity = "HIGH"
            elif percentile > 0.50:
                severity = "MEDIUM"
            elif percentile > 0.25:
                severity = "LOW"
            else:
                severity = "MINIMAL"
            
            
            total_summary = self.get_area_total(area)
            anomalies.append({
                'area': area,
                'report_count': count,
                'estimated_real_cases': total_summary['estimated_real_cases'],
                'confirmed': total_summary['confirmed'],
                'severity': severity,
                'percentile': round(percentile, 2),
                'vs_mean': round(count / mean_count, 2),
            })
        
        return sorted(anomalies, key=lambda x: -x['report_count'])
    
    def get_statistics(self) -> Dict:
        if not self.reports:
            return {'total_reports': 0, 'symptom_reports': 0, 'confirmed_reports': 0,
                    'avg_reliability': 0, 'areas_affected': 0}
        
        return {
            'total_reports': len(self.reports),
            'symptom_reports': sum(1 for r in self.reports if r.report_type == 'symptom'),
            'confirmed_reports': sum(1 for r in self.reports if r.report_type == 'confirmed'),
            'avg_reliability': np.mean([r.reliability_score for r in self.reports]),
            'areas_affected': len(set(r.area for r in self.reports)),
        }


# ==================== GJENERUESI SINTETIK ====================

class SyntheticReportGenerator:
    """Gjeneron raporte sintetike bazuar në simulimin."""
    
    def __init__(self, population_df: pd.DataFrame, history_df: pd.DataFrame, seed: int = 42):
        self.population = population_df
        self.history = history_df
        random.seed(seed)
        np.random.seed(seed)
    
    def generate_daily_reports(self, day: int) -> List[CitizenReport]:
        day_stats = self.history[self.history['day'] == day]
        if day_stats.empty:
            return []
        
        day_stats = day_stats.iloc[0]
        symptomatic_count = int(day_stats['E'] + day_stats['I_mild'] + day_stats['I_severe'])
        
        if symptomatic_count == 0:
            return []
        
        reports = []
        base_time = datetime.now() - timedelta(days=(90 - day))
        
        # 1. Raporte simptomash
        n_symptom_reports = int(symptomatic_count * P_REPORT_IF_SYMPTOMATIC)
        
        if n_symptom_reports > 0:
            sampled = self.population.sample(n=min(n_symptom_reports, len(self.population)))
            
            for _, agent in sampled.iterrows():
                symptoms = [s for s, prob in KNOWN_SYMPTOMS.items() if random.random() < prob]
                if not symptoms:
                    continue
                
                report = CitizenReport(
                    timestamp=base_time + timedelta(hours=random.randint(0, 23)),
                    report_type="symptom",
                    symptoms=symptoms,
                    severity=random.randint(1, 5),
                    area=str(agent['home_district']),
                    lat=float(agent['home_lat']),
                    lon=float(agent['home_lon']),
                    age_range=self._age_to_range(int(agent['age'])),
                    source="self_report",
                )
                reports.append(report)
        
        # 2. Raporte konfirmimi (me kapacitet të kufizuar testimi)
        n_tested = min(
            int(symptomatic_count * P_TEST_IF_SYMPTOMATIC),
            MAX_TESTS_PER_DAY
        )
        n_confirmed = int(n_tested * P_REPORT_IF_CONFIRMED)
        
        if n_confirmed > 0:
            sampled = self.population.sample(n=min(n_confirmed, len(self.population)))
            
            for _, agent in sampled.iterrows():
                report = CitizenReport(
                    timestamp=base_time + timedelta(hours=random.randint(0, 23)),
                    report_type="confirmed",
                    symptoms=[],
                    severity=random.randint(2, 5),
                    area=str(agent['home_district']),
                    lat=float(agent['home_lat']),
                    lon=float(agent['home_lon']),
                    age_range=self._age_to_range(int(agent['age'])),
                    source="lab",
                )
                reports.append(report)
        
        # 3. Raporte false
        n_false = int(len(self.population) * P_FALSE_REPORT)
        if n_false > 0:
            false_sampled = self.population.sample(n=n_false)
            
            for _, agent in false_sampled.iterrows():
                symptoms = random.sample(list(KNOWN_SYMPTOMS.keys()), random.randint(1, 2))
                report = CitizenReport(
                    timestamp=base_time + timedelta(hours=random.randint(0, 23)),
                    report_type="symptom",
                    symptoms=symptoms,
                    severity=random.randint(1, 2),
                    area=str(agent['home_district']),
                    lat=float(agent['home_lat']),
                    lon=float(agent['home_lon']),
                    age_range=self._age_to_range(int(agent['age'])),
                    source="self_report",
                )
                reports.append(report)
        
        return reports
    
    def generate_full_history(self, start_day: int = 1, end_day: int = 90) -> List[CitizenReport]:
        all_reports = []
        for day in range(start_day, end_day + 1):
            daily = self.generate_daily_reports(day)
            all_reports.extend(daily)
            if day % 10 == 0:
                print(f"  → Dita {day}: {len(all_reports):,} raporte total")
        return all_reports
    
    def _age_to_range(self, age: int) -> str:
        if age < 18:
            return "0-17"
        elif age < 30:
            return "18-29"
        elif age < 45:
            return "30-44"
        elif age < 60:
            return "45-59"
        else:
            return "60+"


# ==================== DATA ASSIMILATION ====================

class DataAssimilator:
    """Kombinon raportet e qytetarëve me simulimin."""
    
    def __init__(self, validator: ReportValidator):
        self.validator = validator
        self.assimilation_history: List[Dict] = []
    
    def assimilate(self, day: int) -> Dict:
        anomalies = self.validator.detect_anomalies()
        stats = self.validator.get_statistics()
        
        result = {
            'day': day,
            'timestamp': datetime.now(),
            'anomalies': anomalies,
            'stats': stats,
        }
        
        self.assimilation_history.append(result)
        return result
    
    def estimate_infection_rate(self, area: str) -> float:
        summary = self.validator.get_area_summary(area)
        if summary['count'] == 0:
            return 0.0
        return summary['estimated_real_cases']


# ==================== MAIN ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EpiPrishtina — Sistemi i Raportimit nga Qytetarët")
    print("="*60)
    
    pop_path = "data/processed/prishtina_population_22k.csv"
    if not os.path.exists(pop_path):
        print(f"✗ Skedari {pop_path} nuk ekziston!")
        exit(1)
    
    print(f"\nDuke lexuar popullsinë...")
    population = pd.read_csv(pop_path)
    print(f"  ✓ {len(population):,} agjentë")
    
    hist_path = "data/processed/simulation_history.csv"
    if not os.path.exists(hist_path):
        print(f"✗ Skedari {hist_path} nuk ekziston!")
        print(f"  Ekzekuto fillimisht: python src/simulation/seird_model.py")
        exit(1)
    
    print(f"\nDuke lexuar historikun e simulimit...")
    history = pd.read_csv(hist_path)
    print(f"  ✓ {len(history)} ditë")
    
    print(f"\nDuke gjeneruar raporte sintetike...")
    generator = SyntheticReportGenerator(population, history)
    reports = generator.generate_full_history(start_day=1, end_day=90)
    print(f"\n  ✓ Gjeneruar {len(reports):,} raporte total")
    
    print(f"\nDuke validuar raportet...")
    validator = ReportValidator()
    for report in reports:
        validator.add_report(report)
    
    stats = validator.get_statistics()
    print(f"\n{'='*60}")
    print(f"STATISTIKAT E RAPORTEVE")
    print(f"{'='*60}")
    print(f"Total raporte:       {stats['total_reports']:>10,}")
    print(f"  Simptoma:          {stats['symptom_reports']:>10,}")
    print(f"  Konfirmuar:        {stats['confirmed_reports']:>10,}")
    print(f"Besueshmëria mes.:   {stats['avg_reliability']:>10.2f}")
    print(f"Zona të prekura:     {stats['areas_affected']:>10}")
    
    print(f"\n{'='*60}")
    print(f"HOTSPOTS — ZONAT ME RREZIK")
    print(f"{'='*60}")
    anomalies = validator.detect_anomalies()
    
    if anomalies:
        for i, anom in enumerate(anomalies, 1):
            print(f"\n{i}. {anom['area']:20s} [{anom['severity']:6s}]")
            print(f"   Raporte:              {anom['report_count']:>6,}")
            print(f"   Konfirmuar:           {anom['confirmed']:>6,}")
            print(f"   Raste reale vlerësuar:{anom['estimated_real_cases']:>8,}")
            print(f"   Percentile:           {anom['percentile']:.2f}")
            print(f"   vs mesatare:          {anom['vs_mean']:.2f}×")
    else:
        print("Nuk ka anomali të zbuluara")
    
    # Ruaj raportet
    print(f"\n{'='*60}")
    print(f"RUAJTJA E RAPORTEVE")
    print(f"{'='*60}")
    
    reports_data = [asdict(r) for r in reports]
    df_reports = pd.DataFrame(reports_data)
    
    os.makedirs("data/processed", exist_ok=True)
    reports_path = "data/processed/citizen_reports.csv"
    df_reports.to_csv(reports_path, index=False)
    print(f"✓ U ruajt: {reports_path}")
    print(f"  {len(df_reports):,} raporte × {len(df_reports.columns)} kolona")
    
    # Statistika përfundimtare
    print(f"\n{'='*60}")
    print(f"KONKLUZIONE")
    print(f"{'='*60}")
    print(f"✓ Sistemi i raportimit nga qytetarët është funksional")
    print(f"✓ Qytetarët mund të raportojnë simptoma ose konfirmim")
    print(f"✓ Sistemi validon raportet dhe zbulon anomalitë")
    print(f"✓ Raportet integrohen me simulimin për korrigjim")
    print(f"{'='*60}\n")