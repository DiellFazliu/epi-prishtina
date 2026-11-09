# tests/test_ml_quality.py
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import precision_recall_curve, auc
import mlflow
import shap

def test_time_based_validation():
    """Kontrollo që modeli bën mirë me time-based split (jo random)."""
    tscv = TimeSeriesSplit(n_splits=5)
    
    scores = []
    for train_idx, test_idx in tscv.split(X):
        model = XGBClassifier(...)
        model.fit(X[train_idx], y[train_idx])
        score = f1_score(y[test_idx], model.predict(X[test_idx]))
        scores.append(score)
    
    assert np.mean(scores) > 0.7, f"F1 too low: {np.mean(scores)}"
    assert np.std(scores) < 0.15, "Model unstable across time splits"

def test_calibration():
    """Kontrollo që probabilitetet janë të kalibruara."""
    from sklearn.calibration import calibration_curve
    prob_true, prob_pred = calibration_curve(y_test, y_proba, n_bins=10)
    
    # Probabilitetet duhet të përputhen me realitetin
    calibration_error = np.mean(np.abs(prob_true - prob_pred))
    assert calibration_error < 0.1, f"Model poorly calibrated: {calibration_error}"

def test_shap_explainability():
    """Kontrollo që modeli është i shpjegueshëm."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    
    # Top features duhet të jenë kuptimplota
    assert shap_values.shape == (len(X_test), X_test.shape[1])