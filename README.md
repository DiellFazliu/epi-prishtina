# EpiPrishtina

## Epidemic Intelligence & Urban Response Platform

EpiPrishtina is an end-to-end epidemic intelligence platform for district-level outbreak-risk forecasting and operational response planning in Prishtina. It combines machine learning, epidemiological simulation, geospatial data, resource optimization, and a real-time web interface into one decision-support workflow.

**Stack:** Python, FastAPI, PostgreSQL, Redis, Celery, XGBoost, scikit-learn, SciPy, pandas, NumPy, React, WebSocket, Docker

## Machine learning and decision intelligence

- Built an **XGBoost hotspot classifier** to estimate district-level outbreak risk over a seven-day forecast horizon.
- Engineered temporal **sliding-window features** from citizen reports, including seven-day report volume, confirmed-report counts, report growth, population, population density, mobility, and distance to hospitals.
- Constructed district/day training samples from historical report data and used temporal holdout validation with accuracy, precision, recall, F1, ROC-AUC, and confusion-matrix metrics.
- Produced probability-based district risk scores and categorical risk levels, then persisted prediction snapshots with run IDs, forecast day, feature aggregates, and timestamps in PostgreSQL.
- Added validation guards that prevent publishing predictions when the temporal holdout cannot support meaningful evaluation, such as a single-class target.
- Fused ML hotspot probabilities with live SEIR/SEIRD simulation state, active interventions, citizen reports, and database-backed resource inventory.
- Generated intervention recommendations with baseline-versus-optimized forecasts and expected impact estimates.
- Used constrained resource allocation to prioritize supplies and operational capacity for high-risk districts, then persisted allocation runs and their rationale for auditability.

## System architecture

```text
Citizen reports + population / geospatial data
                    |
                    v
      Sliding-window feature engineering
                    |
                    v
       XGBoost hotspot risk prediction
                    |
                    v
 PostgreSQL prediction and inventory snapshots
                    |
                    +--> SEIR/SEIRD simulation
                    +--> Intervention recommendations
                    +--> Resource allocation and routing
                    |
                    v
       FastAPI + WebSocket operations dashboard
```

## Key capabilities

- FastAPI REST API with PostgreSQL persistence through SQLAlchemy.
- Redis and Celery integration for asynchronous simulation and ML-related work.
- Real-time WebSocket updates for dashboards and operational events.
- Epidemiological forecasting with intervention comparisons.
- Geospatial routing and points-of-interest data for urban response planning.
- Role-aware authentication for administrators, health workers, analysts, and citizens.
- React/Vite dashboard for hotspots, simulations, reports, recommendations, maps, and resources.
- Docker Compose configuration for local PostgreSQL and Redis services.

## Repository structure

| Path | Purpose |
| --- | --- |
| `src/ml/` | Feature construction, XGBoost training, prediction, and persistence |
| `src/simulation/` | SEIR/SEIRD models and intervention effects |
| `src/allocation/` | Resource optimization and allocation persistence |
| `src/core/pipeline.py` | End-to-end forecast and recommendation pipeline |
| `src/api/` | FastAPI application and REST endpoints |
| `src/websocket/` | Authenticated real-time event delivery |
| `frontend/` | React/Vite operations dashboard |
| `tests/` | Authentication, permissions, pipeline, ML-quality, and allocation tests |
| `docs/` | Technical and academic project documentation |

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker Desktop
- PostgreSQL and Redis through Docker Compose

### Setup

```powershell
git clone https://github.com/DiellFazliu/epi-prishtina.git
cd epi-prishtina

Copy-Item .env.example .env
# Replace every REPLACE_WITH... value in .env with local development values.

docker compose up -d
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the backend:

```powershell
uvicorn src.api.main:app --reload
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

The API is available at `http://localhost:8000`, and the frontend is available at the URL printed by Vite.

## Data and privacy

Generated processed datasets, local authentication artifacts, environment files, and runtime outputs are intentionally excluded from Git. Use synthetic or properly anonymized data when reproducing experiments or demonstrations.

## Project documentation

Additional implementation and academic documentation is available in [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md).
