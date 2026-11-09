"""
Reinforcement Learning Emergency Controller.

AI mëson politikën optimale të reagimit ndaj epidemisë.
Përdoret për të sugjeruar veprimet më të mira çdo ditë.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import numpy as np
import gymnasium as gym
from gymnasium import spaces
from typing import Optional, Dict, Tuple

from src.simulation.intervention_engine import (
    advance_day,
    initial_state,
    MEASURE_EFFECTS,
)


# ═══════════════════════════════════════════════════════════════════
# KONFIGURIMI
# ═══════════════════════════════════════════════════════════════════

# Veprimet e mundshme
ACTIONS = [
    "no_action",
    "deploy_ambulance",
    "deploy_testing",
    "restrict_movement",
    "vaccinate",
]

# Kostot e veprimeve (relative)
ACTION_COSTS = {
    "no_action": 0.0,
    "deploy_ambulance": 0.05,
    "deploy_testing": 0.03,
    "restrict_movement": 0.15,
    "vaccinate": 0.08,
}

# Peshat e reward
REWARD_WEIGHTS = {
    "new_cases": -0.01,
    "deaths": -5.0,
    "hospitalized": -0.5,
    "icu": -2.0,
    "action_cost": -1.0,
}

MAX_DAYS = 90
HOSPITAL_CAPACITY = 650


# ═══════════════════════════════════════════════════════════════════
# ENVIRONMENT
# ═══════════════════════════════════════════════════════════════════

class EpidemicEnv(gym.Env):
    """
    Mjedisi RL për kontrollin e epidemisë.
    
    State (10 dimensione):
        [0] susceptible_ratio
        [1] exposed_ratio
        [2] infectious_mild_ratio
        [3] infectious_severe_ratio
        [4] hospitalized_ratio
        [5] icu_ratio
        [6] recovered_ratio
        [7] dead_ratio
        [8] hospital_load
        [9] days_progress
    """
    
    metadata = {"render_modes": ["human"]}
    
    def __init__(self, seed: int = 42):
        super().__init__()
        
        # Action space — 5 veprime
        self.action_space = spaces.Discrete(len(ACTIONS))
        
        # Observation space — 10 metrika (të normalizuara)
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(10,),
            dtype=np.float32,
        )
        
        # State
        self.state = None
        self.day = 0
        self.applied_actions = []
        self.total_costs = 0.0
        self.cumulative_reward = 0.0
        
        # Seed
        self.seed = seed
        np.random.seed(seed)
    
    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None):
        """Rinis mjedisin."""
        super().reset(seed=seed)
        
        self.state = initial_state()
        self.day = 0
        self.applied_actions = []
        self.total_costs = 0.0
        self.cumulative_reward = 0.0
        
        return self._get_observation(), {}
    
    def step(self, action: int):
        """
        Ekzekuton një hap.
        
        Args:
            action: 0-4 (indeksi i ACTIONS)
        
        Returns:
            (observation, reward, terminated, truncated, info)
        """
        # Apliko veprimin
        action_name = ACTIONS[action]
        measures = self._action_to_measures(action_name)
        
        # Përparo simulimin
        self.state, stats = advance_day(self.state, measures)
        self.day += 1
        
        # Regjistro veprimin
        self.applied_actions.append(action_name)
        self.total_costs += ACTION_COSTS[action_name]
        
        # Llogarit reward
        reward = self._calculate_reward(stats, action_name)
        self.cumulative_reward += reward
        
        # Kontrollo përfundimin
        terminated = (
            self.state["exposed"] + self.state["infectious_mild"] + 
            self.state["infectious_severe"] < 1.0  # Epidemija mbaroi
        )
        truncated = self.day >= MAX_DAYS
        
        info = {
            "day": self.day,
            "action": action_name,
            "new_cases": stats["new_cases"],
            "active": stats["active"],
            "rt": stats["rt"],
            "deaths": round(self.state["dead"]),
            "hospital_load": self._get_hospital_load(),
            "cumulative_reward": self.cumulative_reward,
        }
        
        return self._get_observation(), reward, terminated, truncated, info
    
    def _action_to_measures(self, action_name: str) -> list:
        """Konverto veprimin në measures për simulim."""
        if action_name == "no_action":
            return []
        elif action_name == "deploy_ambulance":
            # Ambulancat ulin vdekshmërinë
            return [{"type": "testing", "intensity": 0.3}]
        elif action_name == "deploy_testing":
            return [{"type": "testing", "intensity": 1.0}]
        elif action_name == "restrict_movement":
            return [{"type": "movement_restriction", "intensity": 1.0}]
        elif action_name == "vaccinate":
            return [{"type": "vaccination", "intensity": 1.0}]
        return []
    
    def _get_observation(self) -> np.ndarray:
        """Kthen observimin aktual (të normalizuar 0-1)."""
        population = self.state["population"]
        
        obs = np.array([
            self.state["susceptible"] / population,
            self.state["exposed"] / population,
            self.state["infectious_mild"] / population,
            self.state["infectious_severe"] / population,
            self.state["hospitalized"] / population,
            self.state["icu"] / population,
            self.state["recovered"] / population,
            self.state["dead"] / population,
            self._get_hospital_load(),
            min(self.day / MAX_DAYS, 1.0),
        ], dtype=np.float32)
        
        return np.clip(obs, 0.0, 1.0)
    
    def _get_hospital_load(self) -> float:
        """Ngarkesa e spitalit (0-1)."""
        return min(
            (self.state["hospitalized"] + self.state["icu"]) / HOSPITAL_CAPACITY,
            1.0,
        )
    
    def _calculate_reward(self, stats: dict, action_name: str) -> float:
        """
        Reward = -infeksione - vdekje - mbingarkesë - kosto.
        Sa më negative, aq më keq.
        """
        reward = 0.0
        
        # Kosto e re për raste të reja
        reward += REWARD_WEIGHTS["new_cases"] * stats["new_cases"]
        
        # Kosto e vdekjeve të reja
        prev_deaths = self.state["dead"] - (
            stats["new_cases"] * 0.01  # Përafrim
        )
        reward += REWARD_WEIGHTS["deaths"] * 0.1
        
        # Kosto e hospitalizuarve
        reward += REWARD_WEIGHTS["hospitalized"] * self.state["hospitalized"]
        reward += REWARD_WEIGHTS["icu"] * self.state["icu"]
        
        # Kosto e veprimit
        reward += REWARD_WEIGHTS["action_cost"] * ACTION_COSTS[action_name]
        
        return float(reward)
    
    def render(self):
        """Shfaq statusin aktual."""
        print(f"Dita {self.day:3d}: "
              f"Active={round(self.state['exposed'] + self.state['infectious_mild'] + self.state['infectious_severe']):5d} "
              f"Deaths={round(self.state['dead']):4d} "
              f"Hospital={round(self.state['hospitalized']):3d} "
              f"Reward={self.cumulative_reward:.2f}")


# ═══════════════════════════════════════════════════════════════════
# TRAINING
# ═══════════════════════════════════════════════════════════════════

def train_controller(
    total_timesteps: int = 100_000,
    save_path: str = "models/emergency_controller",
):
    """
    Trajno modelin RL.
    
    Args:
        total_timesteps: Numri i hapave të trajnimit
        save_path: Ku ruhet modeli
    """
    from stable_baselines3 import PPO
    
    print(f"\n{'='*60}")
    print(f"TRAJNIMI I RL CONTROLLER")
    print(f"{'='*60}")
    print(f"Algorithm: PPO (Proximal Policy Optimization)")
    print(f"Total timesteps: {total_timesteps:,}")
    print(f"{'='*60}\n")
    
    # Krijo environment
    env = EpidemicEnv()
    
    # Krijo modelin
    model = PPO(
        "MlpPolicy",
        env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        verbose=1,
        tensorboard_log="./logs/rl/",
    )
    
    # Trajno
    print("Duke trajnuar...")
    model.learn(total_timesteps=total_timesteps, progress_bar=True)
    
    # Ruaj
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    model.save(save_path)
    print(f"\n✓ Modeli u ruajt: {save_path}.zip")
    
    return model


def evaluate_controller(model_path: str = "models/emergency_controller"):
    """
    Vlerëso modelin e trajnuar.
    """
    from stable_baselines3 import PPO
    
    print(f"\n{'='*60}")
    print(f"VLERËSIMI I RL CONTROLLER")
    print(f"{'='*60}\n")
    
    if not os.path.exists(f"{model_path}.zip"):
        print(f"✗ Modeli nuk u gjet: {model_path}.zip")
        print(f"  Ekzekuto fillimisht: python -m src.rl.emergency_controller --train")
        return
    
    model = PPO.load(model_path)
    env = EpidemicEnv()
    
    # Testo 10 episode
    rewards = []
    final_states = []
    
    for episode in range(10):
        obs, _ = env.reset()
        done = False
        episode_reward = 0
        
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            episode_reward += reward
            done = terminated or truncated
        
        rewards.append(episode_reward)
        final_states.append({
            "deaths": round(env.state["dead"]),
            "recovered": round(env.state["recovered"]),
            "days": env.day,
        })
    
    print(f"Rezultatet e 10 episodeve:")
    print(f"  Reward mesatare: {np.mean(rewards):.2f}")
    print(f"  Reward minimale: {np.min(rewards):.2f}")
    print(f"  Reward maksimale: {np.max(rewards):.2f}")
    print(f"\n  Vdekje mesatare: {np.mean([s['deaths'] for s in final_states]):.0f}")
    print(f"  Të shëruar mesatare: {np.mean([s['recovered'] for s in final_states]):.0f}")
    print(f"  Ditë mesatare: {np.mean([s['days'] for s in final_states]):.0f}")


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="RL Emergency Controller")
    parser.add_argument("--train", action="store_true", help="Trajno modelin")
    parser.add_argument("--eval", action="store_true", help="Vlerëso modelin")
    parser.add_argument("--timesteps", type=int, default=100_000, help="Timesteps për trajnim")
    args = parser.parse_args()
    
    if args.train:
        train_controller(total_timesteps=args.timesteps)
    elif args.eval:
        evaluate_controller()
    else:
        print("Përdorimi:")
        print("  python -m src.rl.emergency_controller --train")
        print("  python -m src.rl.emergency_controller --eval")