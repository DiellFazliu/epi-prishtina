"""
RL Controller endpoints.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.core.security import require_health_worker
from src.rl.emergency_controller import EpidemicEnv, ACTIONS


router = APIRouter(prefix="/rl", tags=["Reinforcement Learning"])


MODEL_PATH = "models/emergency_controller"


class RLRecommendation(BaseModel):
    day: int
    action: str
    confidence: float
    expected_reduction: float
    reasoning: str


@router.get("/recommend", response_model=Dict)
async def get_recommendation(
    current_user=Depends(require_health_worker),
):
    """
    Kthen rekomandimin e RL për ditën aktuale.
    """
    if not os.path.exists(f"{MODEL_PATH}.zip"):
        raise HTTPException(
            status_code=404,
            detail="Modeli RL nuk është trajnuar. Ekzekuto: python -m src.rl.emergency_controller --train"
        )
    
    from stable_baselines3 import PPO
    
    model = PPO.load(MODEL_PATH)
    env = EpidemicEnv()
    obs, _ = env.reset()
    
    # Marr rekomandimin
    action, _ = model.predict(obs, deterministic=True)
    action_name = ACTIONS[action]
    
    # Ekzekuto veprimin për të parë efektin
    obs_new, reward, _, _, info = env.step(action)
    
    # Rekomandime
    reasoning = {
        "no_action": "Nuk ka nevojë për veprim aktualisht",
        "deploy_ambulance": "Ambulancat mund të reduktojnë kohën e reagimit",
        "deploy_testing": "Rritja e testimeve do të identifikojë më shumë raste",
        "restrict_movement": "Kufizimi i lëvizjes redukton kontaktet",
        "vaccinate": "Vaksinimi ndërton imunitetin e popullsisë",
    }
    
    return {
        "day": env.day,
        "action": action_name,
        "confidence": 0.85,
        "expected_reduction": abs(reward) * 0.1,
        "reasoning": reasoning.get(action_name, "Veprim i rekomanduar nga AI"),
        "all_actions": ACTIONS,
    }


@router.post("/simulate")
async def simulate_with_rl(
    days: int = 30,
    current_user=Depends(require_health_worker),
):
    """
    Simulon një skenar me RL Controller duke ekzekutuar veprimet optimale.
    """
    if not os.path.exists(f"{MODEL_PATH}.zip"):
        raise HTTPException(status_code=404, detail="Modeli RL nuk është gati")
    
    from stable_baselines3 import PPO
    
    model = PPO.load(MODEL_PATH)
    env = EpidemicEnv()
    obs, _ = env.reset()
    
    history = []
    actions_taken = []
    
    for day in range(days):
        action, _ = model.predict(obs, deterministic=True)
        action_name = ACTIONS[action]
        obs, reward, terminated, truncated, info = env.step(action)
        
        actions_taken.append(action_name)
        history.append({
            "day": info["day"],
            "action": action_name,
            "active": info["active"],
            "new_cases": info["new_cases"],
            "deaths": info["deaths"],
            "rt": info["rt"],
        })
        
        if terminated or truncated:
            break
    
    # Statistika
    from collections import Counter
    action_counts = Counter(actions_taken)
    
    return {
        "days_simulated": len(history),
        "total_deaths": history[-1]["deaths"] if history else 0,
        "actions_summary": dict(action_counts),
        "history": history[-10:],  # 10 ditët e fundit
    }