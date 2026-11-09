"""
Parashikuesi i Hotspot-eve me Machine Learning.

Përdor XGBoost për të parashikuar zonat që do të bëhen hotspots
në 7 ditët e ardhshme, bazuar në:
    - Historikun ditor të çdo lagjeje (sliding window)
    - Raportet e qytetarëve
    - Dendësinë e popullsisë
    - Mobilitetin
    - Distancën nga spitali

Qëllimi: Parashikim proaktiv për reagim emergjent.

Dataset: 15 lagje × 90 ditë = 1,350 samples për trajnim.
"""

import os
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, classification_report, confusion_matrix
)
import warnings
warnings.filterwarnings('ignore')


# ==================== KONFIGURIMI ====================

SCALING_FACTOR = 10.0
FORECAST_DAYS = 7

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
    (42.6620, 21.1690, "QKUK"),
    (42.6680, 21.1580, "Spitali i Prishtinës"),
]

POPULATION_DENSITY = {
    "Qendra": 8500,
    "Dardania": 7200,
    "Ulpiana": 6800,
    "Arbëria": 5500,
    "Kalabria": 5200,
    "Bregu i Diellit": 5000,
    "Sunny Hill": 4500,
    "Lakrishte": 3800,
    "Mat": 3500,
    "Tophane": 4200,
    "Vranjevc": 3200,
    "Kodra e Trimave": 3000,
    "Kolovica": 2500,
    "Sofali": 2000,
    "Bardhosh": 1800,
}

# Threshold për "hotspot" (raporte në 7 ditë)
HOTSPOT_THRESHOLD_PERCENTILE = 0.70  # Top 30%


# ==================== PËRGATITJA E TË DHËNAVE ====================

class HotspotFeatureBuilder:
    """
    Ndërton features për modelin ML duke përdorur sliding windows.
    
    Për çdo lagje dhe çdo ditë, krijohet një sample me:
        - Raportet e 7 ditëve të fundit
        - Rritja e raporteve
        - Features statike (popullsia, dendësia)
        - Target: A u bë hotspot në 7 ditët e ardhshme?
    """
    
    def __init__(
        self,
        reports_df: pd.DataFrame,
        population_df: pd.DataFrame,
    ):
        self.reports = reports_df.copy()
        self.population = population_df
        
        # Konverto timestamp
        if 'timestamp' in self.reports.columns:
            self.reports['timestamp'] = pd.to_datetime(self.reports['timestamp'])
            # Krijo day_index (0-89) bazuar në timestamp
            min_date = self.reports['timestamp'].min()
            self.reports['day_index'] = (self.reports['timestamp'] - min_date).dt.days
            self.reports['day_index'] = self.reports['day_index'].clip(0, 89)
        
        # Agrego raportet sipas (area, day_index)
        self.daily_reports = self._aggregate_daily()
    
    def _aggregate_daily(self) -> pd.DataFrame:
        """Agrego raportet sipas lagjes dhe ditës."""
        agg = self.reports.groupby(['area', 'day_index']).agg({
            'report_id': 'count',
            'report_type': lambda x: (x == 'confirmed').sum(),
        }).reset_index()
        agg.columns = ['district', 'day', 'reports', 'confirmed']
        return agg
    
    def build_training_data(self) -> pd.DataFrame:
        """
        Ndërton dataset me sliding windows.
        
        Për çdo lagje dhe ditë, krijohen features nga 7 ditët e fundit.
        Target: A do të jetë hotspot në 7 ditët e ardhshme?
        """
        samples = []
        
        for district in DISTRICTS:
            # Raportet e kësaj lagjeje
            district_data = self.daily_reports[
                self.daily_reports['district'] == district
            ].set_index('day')
            
            # Popullsia e lagjes
            pop_count = len(self.population[
                self.population['home_district'] == district
            ])
            if pop_count == 0:
                pop_count = 1
            
            # Për çdo ditë (duke filluar nga dita 7 deri në 83)
            for day in range(7, 84):
                # Features nga 7 ditët e fundit
                window = district_data.loc[
                    district_data.index.isin(range(day - 7, day))
                ]
                
                if len(window) == 0:
                    reports_7d = 0
                    confirmed_7d = 0
                else:
                    reports_7d = window['reports'].sum()
                    confirmed_7d = window['confirmed'].sum()
                
                # Raportet e 7 ditëve të mëparshme (për trend)
                prev_window = district_data.loc[
                    district_data.index.isin(range(max(0, day - 14), day - 7))
                ]
                if len(prev_window) == 0:
                    reports_prev_7d = 0
                else:
                    reports_prev_7d = prev_window['reports'].sum()
                
                # Rritja
                growth_rate = (reports_7d - reports_prev_7d) / (reports_prev_7d + 1)
                
                # Target: A do të jetë hotspot në 7 ditët e ardhshme?
                future_window = district_data.loc[
                    district_data.index.isin(range(day, day + 7))
                ]
                future_reports = future_window['reports'].sum() if len(future_window) > 0 else 0
                
                # Krijo features
                features = {
                    'district': district,
                    'day': day,
                    'reports_7d': reports_7d,
                    'confirmed_7d': confirmed_7d,
                    'reports_prev_7d': reports_prev_7d,
                    'growth_rate': growth_rate,
                    'reports_per_capita': reports_7d / (pop_count / 1000 + 1),
                    'confirmed_ratio': confirmed_7d / (reports_7d + 1),
                    'population': pop_count,
                    'density': POPULATION_DENSITY.get(district, 3000),
                    'distance_to_hospital': self._distance_to_hospital(district),
                    'future_reports': future_reports,
                }
                
                samples.append(features)
        
        df = pd.DataFrame(samples)
        
        # Target: hotspot bazuar në threshold
        threshold = df['future_reports'].quantile(HOTSPOT_THRESHOLD_PERCENTILE)
        df['is_hotspot'] = (df['future_reports'] >= threshold).astype(int)
        
        print(f"\nDataset i krijuar:")
        print(f"  Samples: {len(df):,}")
        print(f"  Threshold (top {int((1-HOTSPOT_THRESHOLD_PERCENTILE)*100)}%): {threshold:.0f} raporte")
        print(f"  Hotspot (1): {df['is_hotspot'].sum():,} ({df['is_hotspot'].mean():.1%})")
        print(f"  Jo-hotspot (0): {(df['is_hotspot'] == 0).sum():,}")
        
        return df
    
    def _distance_to_hospital(self, district: str) -> float:
        """Distanca minimale nga spitali (km)."""
        if district not in DISTRICT_COORDS:
            return 5.0
        
        lat, lon = DISTRICT_COORDS[district]
        min_dist = float('inf')
        
        for h_lat, h_lon, _ in HOSPITALS:
            dlat = (lat - h_lat) * 111
            dlon = (lon - h_lon) * 111 * np.cos(np.radians(42.66))
            dist = np.sqrt(dlat**2 + dlon**2)
            min_dist = min(min_dist, dist)
        
        return min_dist


# ==================== MODELI ====================

# ==================== MODELI ====================

class HotspotPredictor:
    """Modeli XGBoost për parashikimin e hotspot-eve."""
    
    FEATURE_COLS = [
        'reports_7d',
        'confirmed_7d',
        'reports_prev_7d',
        'growth_rate',
        'reports_per_capita',
        'confirmed_ratio',
        'population',
        'density',
        'distance_to_hospital',
    ]
    
    def __init__(self):
        self.model = None
        self.feature_names = None
        self.is_trained = False
        self.metrics = {}
    
    def train(self, df: pd.DataFrame) -> dict:
        """Trajno modelin me 5-Fold Temporal Cross-Validation."""
        print(f"\n{'='*60}")
        print(f"TRAJNIMI I MODELIT XGBOOST")
        print(f"{'='*60}")
        
        self.feature_names = self.FEATURE_COLS
        ordered = df.sort_values(['day', 'district']).reset_index(drop=True)
        X = ordered[self.feature_names].values
        y = ordered['is_hotspot'].values
        days = np.sort(ordered['day'].unique())
        
        print(f"\nFeatures: {len(self.feature_names)}")
        print(f"Samples: {len(X):,}")
        print(f"Class balance: {y.mean():.2%} hotspot")
        print(f"Days: {days.min()}-{days.max()}")
        
        # ═══ 5-Fold Temporal Cross-Validation ═══
        n_folds = 5
        fold_size = max(1, len(days) // n_folds)
        
        fold_metrics = []
        
        print(f"\n5-Fold Temporal Cross-Validation:")
        
        for fold in range(n_folds):
            test_start_idx = fold * fold_size
            test_end_idx = (fold + 1) * fold_size if fold < n_folds - 1 else len(days)
            
            test_days = days[test_start_idx:test_end_idx]
            train_days = np.setdiff1d(days, test_days)
            
            if len(train_days) == 0 or len(test_days) == 0:
                continue
            
            train_mask = ordered['day'].isin(train_days).to_numpy()
            test_mask = ordered['day'].isin(test_days).to_numpy()
            
            X_train, X_test = X[train_mask], X[test_mask]
            y_train, y_test = y[train_mask], y[test_mask]
            
            # Skip nëse njëra klasë mungon
            if np.unique(y_train).size < 2 or np.unique(y_test).size < 2:
                print(f"  Fold {fold+1}: SKIP (një klasë në train ose test)")
                continue
            
            # Trajno modelin për këtë fold
            model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                objective='binary:logistic',
                eval_metric='logloss',
                random_state=42 + fold,
                use_label_encoder=False,
            )
            model.fit(X_train, y_train, verbose=False)
            
            y_pred = model.predict(X_test)
            y_proba = model.predict_proba(X_test)[:, 1]
            
            fold_m = {
                'accuracy': float(accuracy_score(y_test, y_pred)),
                'precision': float(precision_score(y_test, y_pred, zero_division=0)),
                'recall': float(recall_score(y_test, y_pred, zero_division=0)),
                'f1': float(f1_score(y_test, y_pred, zero_division=0)),
                'auc': float(roc_auc_score(y_test, y_proba)) if np.unique(y_test).size == 2 else 0.5,
            }
            fold_metrics.append(fold_m)
            
            print(f"  Fold {fold+1}: F1={fold_m['f1']:.3f}  "
                  f"AUC={fold_m['auc']:.3f}  "
                  f"(train={len(X_train)}, test={len(X_test)})")
        
        # ═══ Trajno modelin final në të gjithë dataset-in ═══
        print(f"\nTrajnimi final në të gjithë dataset-in...")
        self.model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            objective='binary:logistic',
            eval_metric='logloss',
            random_state=42,
            use_label_encoder=False,
        )
        self.model.fit(X, y, verbose=False)
        self.is_trained = True
        
        # ═══ Metrikat mesatare ═══
        if fold_metrics:
            self.metrics = {
                key: float(np.mean([m[key] for m in fold_metrics]))
                for key in ['accuracy', 'precision', 'recall', 'f1', 'auc']
            }
        else:
            # Fallback: përdor të gjithë dataset-in
            y_pred_full = self.model.predict(X)
            y_proba_full = self.model.predict_proba(X)[:, 1]
            self.metrics = {
                'accuracy': float(accuracy_score(y, y_pred_full)),
                'precision': float(precision_score(y, y_pred_full, zero_division=0)),
                'recall': float(recall_score(y, y_pred_full, zero_division=0)),
                'f1': float(f1_score(y, y_pred_full, zero_division=0)),
                'auc': float(roc_auc_score(y, y_proba_full)),
            }
        
        # ═══ Printo rezultatet ═══
        print(f"\n{'='*60}")
        print(f"REZULTATET E TRAJNIMIT (5-Fold CV)")
        print(f"{'='*60}")
        for label, key in (("Accuracy", "accuracy"), ("Precision", "precision"),
                           ("Recall", "recall"), ("F1 Score", "f1"), ("AUC-ROC", "auc")):
            value = self.metrics[key]
            print(f"{label:10s} {value:.4f}")
        
        # Feature importance
        print(f"\nFeature Importance:")
        importance = sorted(
            zip(self.feature_names, self.model.feature_importances_),
            key=lambda x: -x[1]
        )
        for name, imp in importance:
            bar = "#" * int(imp * 50)
            print(f"  {name:25s}: {imp:.4f} {bar}")
        
        return self.metrics
    
    def _evaluate(self, X_test, y_test) -> dict:
        """Vlerëson modelin."""
        if np.unique(y_test).size < 2:
            return {key: None for key in ('accuracy', 'precision', 'recall', 'f1', 'auc')}
        y_pred = self.model.predict(X_test)
        y_proba = self.model.predict_proba(X_test)[:, 1]
        
        return {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1': float(f1_score(y_test, y_pred, zero_division=0)),
            'auc': float(roc_auc_score(y_test, y_proba)) if np.unique(y_test).size == 2 else None,
        }
    
    def predict_for_day(self, df: pd.DataFrame, day: int = None) -> pd.DataFrame:
        """
        Parashikon për një ditë specifike.
        
        Args:
            df: Dataset me features
            day: Dita për parashikim (default: dita e fundit)
        
        Returns:
            DataFrame me parashikime
        """
        if not self.is_trained:
            raise ValueError("Modeli nuk është trajnuar")
        
        if day is None:
            day = int(df['day'].max())
        
        # Merr samples për ditën e specifikuar
        day_data = df[df['day'] == day].copy()
        
        if day_data.empty:
            # Nëse dita nuk ekziston, merr ditën më të afërt
            closest_day = df['day'].iloc[(df['day'] - day).abs().argsort()[:1]].values[0]
            day_data = df[df['day'] == closest_day].copy()
            print(f"  ⚠ Dita {day} nuk ekziston, përdoret dita {closest_day}")
        
        X = day_data[self.feature_names].values
        proba = self.model.predict_proba(X)[:, 1]
        
        result = day_data[['district', 'day', 'reports_7d', 'confirmed_7d', 'population']].copy()
        result['hotspot_probability'] = proba
        result['risk_level'] = pd.cut(
            proba,
            bins=[-0.01, 0.3, 0.5, 0.7, 1.0],
            labels=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        )
        
        return result.sort_values('hotspot_probability', ascending=False)
# ==================== RAPORTI ====================

def print_predictions(predictions: pd.DataFrame):
    """Printo parashikimet."""
    print(f"\n{'='*60}")
    print(f"PARASHIKIMET — HOTSPOTS NË 7 DITËT E ARDHSHME")
    print(f"{'='*60}")
    
    for _, row in predictions.iterrows():
        prob = row['hotspot_probability']
        bar = "█" * int(prob * 30)
        
        print(f"\n{row['district']:20s} [{str(row['risk_level']):8s}]")
        print(f"  Probabiliteti:   {prob:.2%} {bar}")
        print(f"  Raporte 7d:      {int(row['reports_7d']):>6,}")
        print(f"  Konfirmuar 7d:   {int(row['confirmed_7d']):>6,}")
        print(f"  Popullsia:       {int(row['population']):>6,}")


# ==================== MAIN ====================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  EpiPrishtina — Parashikuesi i Hotspot-eve")
    print("="*60)
    
    # Lexo të dhënat
    print(f"\nDuke lexuar të dhënat...")
    
    reports_path = "data/processed/citizen_reports.csv"
    pop_path = "data/processed/prishtina_population_22k.csv"
    
    if not all(os.path.exists(p) for p in [reports_path, pop_path]):
        print("✗ Disa skedarë mungojnë!")
        exit(1)
    
    reports = pd.read_csv(reports_path)
    population = pd.read_csv(pop_path)
    
    print(f"  ✓ Raportet: {len(reports):,}")
    print(f"  ✓ Popullsia: {len(population):,}")
    
    # Ndërto features
    print(f"\nDuke ndërtuar features (sliding windows)...")
    builder = HotspotFeatureBuilder(reports, population)
    training_data = builder.build_training_data()
    
    # Trajno modelin
    predictor = HotspotPredictor()
    metrics = predictor.train(training_data)
    if metrics.get('f1') is None:
        raise SystemExit("Temporal holdout has one class; refusing to publish unvalidated hotspot predictions.")
    
    # Parashiko
        # Parashiko për ditën 25 (fillimi i shpërthimit)
    print(f"\n{'='*60}")
    print(f"PARASHIKIM PËR DITËN 25 (fillimi i shpërthimit)")
    print(f"{'='*60}")
    predictions_25 = predictor.predict_for_day(training_data, day=25)
    print_predictions(predictions_25)
    
    # Parashiko për ditën 40 (kulmi)
    print(f"\n{'='*60}")
    print(f"PARASHIKIM PËR DITËN 40 (kulmi)")
    print(f"{'='*60}")
    predictions_40 = predictor.predict_for_day(training_data, day=40)
    print_predictions(predictions_40)
    
    # Parashiko për ditën 60 (rënie)
    print(f"\n{'='*60}")
    print(f"PARASHIKIM PËR DITËN 60 (rënie)")
    print(f"{'='*60}")
    predictions_60 = predictor.predict_for_day(training_data, day=60)
    print_predictions(predictions_60)
    
    # Ruaj
    predictions_25.to_csv("data/processed/hotspot_predictions_day25.csv", index=False)
    predictions_40.to_csv("data/processed/hotspot_predictions_day40.csv", index=False)
    predictions_60.to_csv("data/processed/hotspot_predictions_day60.csv", index=False)
    
    predictions = predictions_25  # Për përmbledhje
    
    # Printo
    print_predictions(predictions)
    
    # Ruaj
    os.makedirs("data/processed", exist_ok=True)
    pred_path = "data/processed/hotspot_predictions.csv"
    predictions.to_csv(pred_path, index=False)
    print(f"\n✓ U ruajt: {pred_path}")
    
    # Përmbledhje
    print(f"\n{'='*60}")
    print(f"PËRMBLEDHJE")
    print(f"{'='*60}")
    print(f"Modele: XGBoost")
    print(f"Features: {len(predictor.feature_names)}")
    print(f"Samples: {len(training_data):,}")
    print(f"Accuracy: {metrics['accuracy']:.4f}" if metrics['accuracy'] is not None else "Accuracy: unavailable")
    print(f"F1 Score: {metrics['f1']:.4f}" if metrics['f1'] is not None else "F1 Score: unavailable")
    print(f"AUC-ROC:  {metrics['auc']:.4f}" if metrics['auc'] is not None else "AUC-ROC: unavailable")
    print(f"Hotspots: {(predictions['hotspot_probability'] > 0.5).sum()}")
    print(f"{'='*60}\n")
