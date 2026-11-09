# EpiPrishtina

## Platformë inteligjente për monitorim epidemiologjik dhe reagim operacional urban

**Versioni i dokumentit:** 1.0  
**Statusi:** Dokumentim teknik dhe akademik i implementimit aktual  
**Databaza kryesore:** PostgreSQL  
**Backend:** FastAPI + SQLAlchemy  
**Frontend:** React + Vite + React Router  
**Komunikimi live:** WebSocket  
**Infrastruktura lokale:** Docker Compose  
**Qëllimi:** Dokumentim për zhvillim, mirëmbajtje, demonstrim dhe përdorim si bazë për bachelor thesis

---

## 1. Përmbledhje ekzekutive

EpiPrishtina është një platformë për mbështetje të vendimmarrjes epidemiologjike në një mjedis urban. Sistemi kombinon:

1. raportet e qytetarëve;
2. validimin dhe menaxhimin operacional të raporteve;
3. simulimin epidemiologjik live;
4. parashikimin e hotspot-eve me Machine Learning;
5. rekomandimet për masa parandaluese;
6. alokimin e burimeve;
7. dispatch-in e ambulancave;
8. routing-un në rrjet rrugor;
9. hartën interaktive;
10. auditimin e veprimeve;
11. autentikimin dhe autorizimin sipas roleve;
12. historikun e run-eve të Pipeline-it;
13. portalin e qytetarëve;
14. komunikimin real-time përmes WebSocket.

Ideja qendrore e platformës është që informacioni të mos mbetet i izoluar në faqe të veçanta. Një raport ose sinjal i ri duhet të mund të ndikojë në analizë, në parashikim, në rekomandim, në masat aktive, në simulim, në alokim burimesh dhe në pamjen operative të hartës.

Arkitektura aktuale organizohet rreth pesë zonave kryesore:

- **Command Center** – pamja kryesore e situatës dhe kontrolli i shpejtë operacional;
- **Live Map** – paraqitja gjeografike e raporteve, hotspot-eve, spitaleve dhe dispatch-eve;
- **Simulation & AI** – simulimi SEIR/SEIRD, strategjitë dhe modelet inteligjente;
- **Operations** – raportet, burimet, dispatch-et dhe lifecycle-i operacional;
- **Analytics & ML** – historiku, analizat, parashikimet dhe performanca e modeleve.

---

## 2. Qëllimi dhe problemi që zgjidh sistemi

Në një situatë epidemiologjike, të dhënat dhe veprimet zakonisht janë të shpërndara:

- raportet mblidhen në një kanal;
- statistikat analizohen në një tjetër;
- harta përdor të dhëna të ndryshme;
- resurset menaxhohen manualisht;
- ambulancat caktohen pa histori të centralizuar;
- vendimet nuk lidhen gjithmonë me rezultatet e simulimit;
- operatori nuk ka një pamje të vetme se çfarë po ndodh tani.

EpiPrishtina e trajton këtë problem si një **sistem operacional të lidhur**, jo vetëm si dashboard statistikash.

### 2.1 Objektivat funksionale

Platforma synon të:

- mbledhë sinjale epidemiologjike nga qytetarët;
- ruajë dhe validojë raportet në mënyrë të qëndrueshme;
- agregojë raportet sipas lagjeve;
- identifikojë zona me rrezik të shtuar;
- parashikojë hotspot-e për ditët e ardhshme;
- simulojë përhapjen e sëmundjes me dhe pa masa;
- krahasojë skenarët;
- propozojë masa dhe burime;
- caktojë ambulanca sipas distancës, kohës dhe severity-t;
- ruajë të gjitha veprimet kritike;
- shfaqë ndryshimet në kohë reale;
- ndihmojë operatorin të marrë vendime të gjurmueshme.

### 2.2 Objektivat akademike

Projekti është i përshtatshëm për një bachelor thesis sepse përfshin disa fusha të integruara:

- software engineering;
- arkitekturë të sistemeve të shpërndara;
- epidemiologji kompjuterike;
- simulim agent-based dhe compartmental;
- Machine Learning;
- optimizim;
- Geographic Information Systems;
- siguri dhe role;
- observability dhe auditability;
- UX për sisteme kritike.

---

## 3. Pamja e përgjithshme e arkitekturës

### 3.1 Diagrami konceptual

```text
┌──────────────────────────────────────────────────────────────┐
│                         React Frontend                       │
│                                                              │
│  Command Center │ Live Map │ Simulation │ Operations │ ML    │
└───────────────┬───────────────────────────────┬──────────────┘
                │ REST/JSON                     │ WebSocket
                ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                      │
│                                                              │
│ Auth │ Dashboard │ Reports │ Pipeline │ Simulation │ Map     │
│ Users│ Routing   │ Resources│ RL       │ WebSocket           │
└───────────────┬───────────────┬──────────────────────────────┘
                │               │
                ▼               ▼
        ┌──────────────┐  ┌──────────────┐
        │ PostgreSQL   │  │ Redis        │
        │ durable data │  │ live/events  │
        └──────────────┘  └──────┬───────┘
                                  │
                                  ▼
                         Celery workers
                         ML / cleanup / jobs

Additional computational modules:

  SEIR/SEIRD simulator
  XGBoost hotspot predictor
  Hungarian assignment
  A*/OSM routing
  resource allocation heuristics
```

### 3.2 Komponentët kryesorë

#### Frontend

Frontend-i është aplikacion React i ndërtuar me Vite. Ai përmban:

- routing të faqeve;
- kontroll autentikimi;
- layout-e të ndryshme për admin/staff dhe citizen;
- API clients të centralizuar;
- një WebSocket provider të përbashkët;
- komponentë për harta, grafikë, KPI dhe telemetri;
- kontrolle të bazuara në role.

#### Backend

Backend-i është aplikacion FastAPI. Ai:

- ekspozon REST API;
- menaxhon autentikimin JWT;
- kryen autorizimin;
- lexon dhe shkruan PostgreSQL;
- orkestron simulimin;
- ruan audit log;
- publikon evente WebSocket;
- lidh modelet ML me të dhënat operative.

#### PostgreSQL

PostgreSQL është burimi kryesor për të dhëna operative të qëndrueshme:

- përdorues;
- raporte;
- simulime;
- ndërhyrje;
- ditë simulimi;
- inventory;
- allocation records;
- hotspot predictions;
- ambulance dispatches;
- audit logs;
- pipeline snapshots.

#### Redis

Redis përdoret nga infrastruktura për:

- Celery broker/backend;
- evente ose koordinim të proceseve live sipas konfigurimit;
- mundësi zgjerimi për queues dhe caching.

#### Celery

Celery është i parashikuar për punë asinkrone:

- trajnime ML;
- rifreskim të parashikimeve;
- pastrim të të dhënave;
- detyra të simulimit;
- jobs periodike.

---

## 4. Struktura e repository-t

Struktura kryesore është:

```text
epi-prishtina/
├── src/
│   ├── api/
│   │   ├── main.py
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── ambulance_routing.py
│   │       ├── dashboard.py
│   │       ├── map.py
│   │       ├── pipeline.py
│   │       ├── reports.py
│   │       ├── rl.py
│   │       ├── simulation.py
│   │       └── users.py
│   ├── allocation/
│   │   ├── dispatch.py
│   │   ├── pipeline.py
│   │   └── resource_allocator.py
│   ├── core/
│   │   ├── config.py
│   │   ├── pipeline.py
│   │   └── security.py
│   ├── db/
│   │   ├── base.py
│   │   └── init_db.py
│   ├── graph/
│   │   └── routing.py
│   ├── ingestion/
│   ├── ml/
│   │   ├── hotspot_predictor.py
│   │   ├── persistence.py
│   │   └── report_data.py
│   ├── models/
│   │   ├── ambulance.py
│   │   ├── audit.py
│   │   ├── pipeline.py
│   │   ├── report.py
│   │   ├── resource.py
│   │   ├── simulation.py
│   │   └── user.py
│   ├── population/
│   ├── rl/
│   ├── schemas/
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── live_simulation.py
│   │   ├── report_service.py
│   │   └── report_validator.py
│   ├── simulation/
│   │   ├── intervention_engine.py
│   │   └── seird_model.py
│   ├── websocket/
│   │   ├── manager.py
│   │   └── routes.py
│   └── workers/
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── contexts/
│       ├── hooks/
│       └── pages/
├── tests/
├── docs/
├── docker-compose.yml
├── requirements.txt
└── .env
```

---

## 5. Nisja e aplikacionit

### 5.1 Kërkesat

Duhet të jenë të instaluara:

- Python 3.11+;
- Node.js/npm;
- Docker Desktop;
- PostgreSQL dhe Redis përmes Docker Compose;
- virtualenv Python.

### 5.2 Shërbimet Docker

Konfigurimi ndodhet në [docker-compose.yml](../docker-compose.yml).

Shërbimet:

| Shërbimi | Image | Porti host | Funksioni |
|---|---|---:|---|
| PostgreSQL | `postgres:16-alpine` | `6000` | databaza |
| Redis | `redis:7-alpine` | `6379` | queues/evente |

Komandat:

```powershell
docker compose up -d
docker compose ps
```

PostgreSQL ekspozohet në host në portin `6000`, megjithëse brenda container-it përdor portin standard `5432`.

### 5.3 Inicializimi i databazës

```powershell
.\venv\Scripts\python.exe -m src.db.init_db
```

Ky proces:

- krijon tabelat;
- importon modelet;
- kontrollon strukturën;
- inicializon inventory sipas konfigurimit të projektit.

### 5.4 Nisja e backend-it

```powershell
.\venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --port 8000
```

Endpoint-et bazë:

- `GET /`
- `GET /api/v1/dashboard/health`
- `GET /docs`
- `GET /redoc`
- `GET /openapi.json`
- WebSocket `/ws`

### 5.5 Nisja e frontend-it

```powershell
cd frontend
npm install
npm run dev
```

Build production:

```powershell
npm run build
```

Lint:

```powershell
npm run lint
```

### 5.6 Testimi

```powershell
.\venv\Scripts\python.exe -m pytest tests -q
```

Në gjendjen e dokumentuar, testet e aplikacionit kalojnë me sukses. Disa deprecation warnings lidhen me `datetime.utcnow()` dhe konfigurime të vjetra Pydantic, jo me dështime funksionale.

---

## 6. Lifecycle-i i aplikacionit

Në `src/api/main.py`, FastAPI përdor lifespan:

1. lexohet konfigurimi;
2. caktohet intervali i simulimit;
3. ngarkohet gjendja e Pipeline-it;
4. niset loop-i i simulimit live;
5. aplikacioni pranon kërkesa;
6. gjatë shutdown-it ndalet loop-i.

Në nisje, `live_simulation.start(live_pipeline)` përpiqet të rikthejë gjendjen e ruajtur në PostgreSQL dhe të vazhdojë nga dita e fundit.

Kjo do të thotë se simulimi nuk duhet të trajtohet si një state i vetëm i browser-it. Browser-i është vetëm konsumues i gjendjes; gjendja kryesore është në backend/databazë.

---

## 7. Modeli i të dhënave

### 7.1 User

Përdoruesi ruan identitetin, rolin, kredencialet e hash-uara dhe statusin aktiv.

Fusha tipike:

- `id`;
- `username`;
- `email`;
- `full_name`;
- `hashed_password`;
- `role`;
- `is_active`;
- `last_login`;
- timestamps.

### 7.2 CitizenReport

Raporti i qytetarit është hyrja kryesore e të dhënave operative.

Informacioni përfshin:

- raportuesin;
- district;
- koordinatat, nëse janë dhënë;
- llojin e raportit;
- severity;
- statusin;
- moshën ose grupmoshën;
- kohën e raportimit;
- validimin;
- pronësinë e raportit.

Statuset përfshijnë:

- `pending`;
- `validated`;
- `rejected`;
- `flagged`.

Raportet e qytetarit filtrohen sipas pronësisë në portalin citizen. Staff mund të ketë qasje operative sipas rolit.

### 7.3 Simulation

Tabela e simulimit ruan ekzekutimin live ose një skenar:

- statusin;
- ditën aktuale;
- parametrat;
- timestamps;
- lidhjen me `SimulationDay`.

### 7.4 SimulationDay

Ruhet një snapshot ditor i compartments:

- `S`;
- `E`;
- `I_mild`;
- `I_severe`;
- `H`;
- `ICU`;
- `R`;
- `D`.

Kjo lejon historik, grafikë dhe rikonstruksion të ecurisë së modelit.

### 7.5 Intervention

Ndërhyrja përfaqëson një masë aktive në simulim:

- tipi;
- intensity;
- district target;
- dita e fillimit;
- dita e përfundimit;
- përshkrimi.

Kur aplikohen masa nga Pipeline, masat aktuale në memory sinkronizohen edhe në modelin durable të simulimit.

### 7.6 PipelineSnapshot

Modeli në `src/models/pipeline.py` ruan payload-et kryesore:

- `snapshot_type`: `recommendation` ose `comparison`;
- `pipeline_day`;
- JSON `payload`;
- `created_at`.

Ky model zëvendëson varësinë operative nga bundle JSON lokal.

### 7.7 ResourceInventory

Mban kapacitetet authoritative:

- resource type;
- total quantity;
- updated timestamp.

Këto kapacitete përdoren nga rekomandimet moderne të Pipeline-it, në vend të vlerave statike të vjetra.

### 7.8 ResourceAllocationRecord

Ruhet çdo allocation:

- `run_id`;
- resource type;
- district;
- quantity;
- cost;
- reason;
- generated timestamp.

`run_id` lidh rreshtat e një allocation run-i.

### 7.9 AmbulanceDispatch

Ruhet caktimi operacional i ambulancës:

- ambulance id;
- spitali;
- district;
- koordinatat e emergjencës;
- severity;
- distanca;
- koha;
- cost;
- statusi;
- algorithm;
- route;
- dispatched/completed timestamps.

Lifecycle-i i dispatch-it është:

```text
en_route → at_scene → completed
en_route → cancelled
at_scene → cancelled
```

Gjendjet terminale nuk mund të rihapen.

### 7.10 AuditLog

Auditimi ruan:

- user id;
- action;
- resource type;
- resource id;
- details JSON;
- IP/user agent, kur disponohen;
- timestamp.

Veprimet e rëndësishme që auditohen:

- aplikimi i rekomandimeve;
- krijimi i dispatch-it;
- ndryshimi i statusit të dispatch-it;
- alokimi i burimeve;
- masat e simulimit;
- operacione administrative.

---

## 8. API dhe endpoint-et kryesore

Prefix-i kryesor është:

```text
/api/v1
```

### 8.1 Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/me
```

Login kthen access token dhe refresh token. Access token dërgohet si:

```text
Authorization: Bearer <token>
```

### 8.2 Dashboard

```text
GET /dashboard/summary
GET /dashboard/command-center
GET /dashboard/health
```

`/dashboard/command-center` është endpoint-i i unifikuar për:

- live simulation snapshot;
- report statistics;
- top districts;
- resources;
- age distribution.

### 8.3 Reports

```text
GET    /reports
POST   /reports
GET    /reports/{id}
PATCH  /reports/{id}
DELETE /reports/{id}
GET    /reports/statistics
```

### 8.4 Map

```text
GET /map/districts
GET /map/hospitals
GET /map/heatmap-points?metric=reports
GET /map/heatmap-points?metric=confirmed
GET /map/heatmap-points?metric=projected
GET /map/summary
```

### 8.5 Pipeline

```text
GET  /pipeline/state
POST /pipeline/refresh
POST /pipeline/recommend
POST /pipeline/apply
POST /pipeline/simulate
GET  /pipeline/recommendation
GET  /pipeline/comparison
GET  /pipeline/history
GET  /pipeline/history/{snapshot_id}
GET  /pipeline/live
POST /pipeline/live/toggle
```

### 8.6 Simulation

```text
GET  /simulation/summary
GET  /simulation/history
GET  /simulation/hotspots
GET  /simulation/hotspots/top
GET  /simulation/hotspots/runs
GET  /simulation/strategy/recommendations
GET  /simulation/strategy/status
POST /simulation/strategy/apply
```

### 8.7 Routing dhe dispatch

```text
POST  /routing/route
POST  /routing/dispatch
GET   /routing/ambulances
GET   /routing/dispatches
GET   /routing/dispatches/summary
PATCH /routing/dispatches/{dispatch_id}
```

### 8.8 Users dhe audit

```text
GET    /users
GET    /users/{user_id}
PATCH  /users/{user_id}
DELETE /users/{user_id}
GET    /users/audit-log
```

---

## 9. Autentikimi dhe permisimet

### 9.1 JWT

Procesi:

1. përdoruesi dërgon kredencialet;
2. backend-i i validon;
3. gjeneron access token;
4. gjeneron refresh token;
5. frontend-i i ruan tokenët në local storage;
6. Axios client i shton access token request-it;
7. në `401`, refresh request-et e njëkohshme bashkohen në një promise të përbashkët;
8. nëse refresh dështon, përdoruesi dërgohet në login.

Mekanizmi i promise-it të përbashkët shmang race conditions kur disa request-e skadojnë në të njëjtën kohë.

### 9.2 Rolet

#### Admin

Ka qasje të plotë:

- menaxhim përdoruesish;
- audit;
- operacione;
- masa;
- burime;
- dispatch;
- analiza.

#### Health worker

Mund të kryejë operacione praktike:

- validejë raporte;
- rifreskojë hotspot-e;
- aplikojë rekomandime;
- kontrollojë simulimin;
- ndryshojë status dispatch-i;
- kryejë operacione resursesh.

Nuk ka domosdoshmërisht të drejta të plota administrative mbi përdoruesit.

#### Analyst

Ka qasje read-only:

- dashboard;
- hartë;
- histori;
- analiza;
- parashikime;
- rekomandime;
- dispatch data.

Nuk duhet të kryejë mutacione operacionale.

#### Citizen

Ka qasje në:

- portalin citizen;
- krijimin e raportit;
- historikun e raporteve të veta;
- profilin;
- ndryshimin e password-it.

Nuk ka qasje në endpoint-et staff.

### 9.3 Defense in depth

Frontend-i fsheh ose çaktivizon kontrollet sipas rolit, por backend-i është autoriteti final. Kjo është e domosdoshme sepse një përdorues mund të thërrasë API-në direkt pa përdorur UI-në.

---

## 10. Rrjedha e plotë e të dhënave

### 10.1 Raporti i qytetarit

```text
Citizen Portal
    ↓
POST /reports
    ↓
Pydantic validation
    ↓
ReportService
    ↓
PostgreSQL CitizenReport
    ↓
Audit/Event
    ↓
WebSocket report:created
    ↓
Command Center / Map / Operations refresh
```

Nëse raporti ka koordinata, ai mund të përdoret për heatmap me koordinata. Nëse nuk ka koordinata, sistemi përdor agregim në qendrën e district-it, jo pika të rastësishme.

### 10.2 Validimi i raportit

Health worker ose admin mund të ndryshojë statusin:

```text
pending → validated
pending → rejected
pending → flagged
```

Ndryshimi ndikon në:

- statistikat;
- map aggregation;
- input-in e ML;
- Command Center;
- audit log.

### 10.3 Hotspot prediction

```text
CitizenReport + historical data
    ↓
reports_dataframe()
    ↓
feature builder
    ↓
XGBoost predictor
    ↓
district probabilities
    ↓
HotspotPredictionRecord
    ↓
Pipeline state + map projected layer
    ↓
hotspot:updated WebSocket event
```

### 10.4 Rekomandimet

```text
live simulation snapshot
        +
hotspot prediction
        +
database resource capacity
        +
report-derived context
        ↓
EpiPipeline.generate_recommendations()
        ↓
PipelineSnapshot(type=recommendation)
        ↓
Pipeline UI / Command Center
```

### 10.5 Aplikimi i rekomandimeve

```text
Operatori zgjedh rekomandime
    ↓
POST /pipeline/apply
    ↓
merret latest recommendation snapshot
    ↓
validohet routing bundle
    ↓
aplikohet masa në memory
    ↓
persistohen interventions
    ↓
persistohen resource allocations
    ↓
persistohen ambulance dispatches
    ↓
ruhet audit log
    ↓
commit atomik
    ↓
live simulation snapshot
    ↓
simulation:update
```

Nëse një pjesë e operacionit dështon para commit-it, transaction-i nuk duhet të prodhojë gjendje gjysmake.

### 10.6 Simulimi përpara

```text
POST /pipeline/simulate
    ↓
gjendja aktuale
    ↓
forecast pa masa
    +
forecast me masa
    ↓
comparison snapshot
    ↓
cases avoided / deaths avoided / peak reduction
```

### 10.7 Dispatch

```text
hotspot/routing recommendation
    ↓
emergency locations
    ↓
route calculation
    ↓
cost matrix
    ↓
Hungarian assignment
    ↓
A*/road route
    ↓
AmbulanceDispatch
    ↓
AuditLog
    ↓
routing:dispatch event
    ↓
Map + Operations refresh
```

---

## 11. Command Center

Command Center është pamja e parë operative. Ai nuk duhet të jetë thjesht koleksion KPI-sh, por duhet të përgjigjet shpejt në pyetjet:

1. Çfarë po ndodh tani?
2. A është simulimi aktiv?
3. Cilat masa janë aktive?
4. Cilat janë hotspot-et?
5. Sa është R(t)?
6. Sa raste aktive dhe vdekje ka modeli?
7. Çfarë rekomandon Pipeline-i?
8. A mund të aplikohet rekomandimi?
9. Sa ambulanca janë aktive?
10. Cilat veprime kritike janë bërë?

### 11.1 Komponentët

- KPI row;
- live simulation panel;
- active measures;
- Command Operations;
- mini map;
- AI recommendations;
- resource capacity;
- age distribution;
- recent reports;
- scenario comparison;
- audit activity për admin.

### 11.2 Kontrolli live

Admin dhe health worker mund:

- të nisin simulimin;
- ta pauzojnë;
- të shohin gjendjen e fundit;
- të shohin masat aktive.

Analyst e sheh kontrollin por nuk mund ta ndryshojë.

### 11.3 Aplikimi nga Command Center

Command Center ngarkon recommendation-in e fundit. Nëse ka rekomandime, operatori mund të aplikojë të gjitha me një konfirmim. Pipeline mbetet vendi ku bëhet përzgjedhja dhe kontrolli i detajuar.

---

## 12. Harta dhe GIS

### 12.1 Layer-et

Harta përmban:

- heatmap të raporteve;
- heatmap të parashikimit ML;
- district markers;
- spitale;
- ambulanca;
- emergjenca;
- rrugë dispatch-i;
- live agents vetëm kur ka të dhëna reale nga API;
- route preview.

### 12.2 Heatmap i raporteve

Prioriteti:

1. përdoren koordinatat reale të raporteve;
2. koordinatat grumbullohen në qeliza të rrumbullakosura;
3. në mungesë të koordinatave përdoret qendra e lagjes;
4. burimi shënohet si `district_aggregate`.

Sistemi nuk gjeneron më pika random për të simuluar të dhëna reale.

### 12.3 Heatmap ML

Heatmap-i i parashikimit përdor snapshot-in më të fundit nga PostgreSQL. Për çdo district ka:

- probability;
- risk level;
- intensity;
- coordinates;
- data source.

`intensity` nuk është më relativisht e normalizuar ndaj maksimumit të batch-it. Ajo lidhet me risk level absolut:

| Risk | Intensity vizuale |
|---|---:|
| MINIMAL | 0.12 |
| LOW | 0.28 |
| MEDIUM | 0.52 |
| HIGH | 0.76 |
| CRITICAL | 0.96 |

Kjo parandalon që probabilitete shumë të ulëta të duken si risk kritik.

### 12.4 Dispatch në hartë

Për dispatch aktiv:

- ambulanca shfaqet në marker;
- rruga shfaqet me vijë;
- emergjenca shfaqet me circle marker;
- popup-i tregon severity, district, status dhe ambulance id.

Nëse route-i i ruajtur ka më pak se dy pika, përdoret fallback:

```text
ambulanca current position → emergency position
```

### 12.5 Rifreskimi live

Harta rifreskohet kur merr event:

- `simulation:update`;
- `hotspot:updated`;
- `routing:dispatch`;
- `report:created`;
- `report:updated`;
- `report:deleted`.

Nuk mbështetet vetëm në polling.

### 12.6 Kufizimet

- koordinatat e district-eve janë qendra administrative/operative, jo kufij polygonalë;
- disa raporte mund të mos kenë koordinata;
- spitalet janë konfigurim i projektit dhe kapacitetet e tyre nuk janë ende të sinkronizuara në të gjitha pamjet;
- map tiles varen nga OpenStreetMap dhe interneti.

---

## 13. Simulimi epidemiologjik

Projekti ka dy nivele të lidhura simulimi:

1. simulator agent-based SEIRD;
2. engine deterministic SEIR për live operational forecasts.

### 13.1 Agent-based SEIRD

Në `src/simulation/seird_model.py`, agjentët kanë:

- moshë;
- gjini;
- lokacion shtëpie;
- lokacion pune;
- aktivitet;
- kontakte ditore;
- mobility level;
- health state.

States:

```text
S       Susceptible
E       Exposed
I_mild  Infectious mild
I_severe Infectious severe
H       Hospitalized
ICU     Intensive care
R       Recovered
D       Dead
```

### 13.2 Spatial index

Për të shmangur `O(n²)`, agjentët futen në grid spatial. Për çdo agjent:

- kërkohen qelizat fqinje;
- kufizohet numri i kontakteve;
- mostrohen kontaktet kur numri është i madh.

Kjo e bën simulimin më të realizueshëm për popullsi të mëdha.

### 13.3 Transmetimi

Probabiliteti ndikohet nga:

- distanca;
- transmission rate;
- mosha;
- mobility level;
- contact efficiency;
- kontakti ditor.

### 13.4 IFR sipas moshës

Modeli përdor IFR të ndryshme:

| Grupi | IFR e modeluar |
|---|---:|
| 0–19 | 0.03% |
| 20–39 | 0.2% |
| 40–59 | 1.0% |
| 60–79 | 5.0% |
| 80+ | 20.0% |

Këto janë parametra modelues dhe nuk duhet të interpretohen si vlerësime klinike të një sëmundjeje specifike pa kalibrim epidemiologjik.

### 13.5 Live intervention engine

Në `src/simulation/intervention_engine.py`, gjendja ruhet si compartments dhe avancon një ditë në çdo tick.

Masat:

| Masë | Efekti bazë mbi transmetimin |
|---|---:|
| movement restriction | 0.28 |
| venue closures | 0.18 |
| testing | 0.10 |
| remote work | 0.16 |
| vaccination | ndryshon susceptible |
| transport restriction | 0.12 |

Efektet kombinohen në mënyrë multiplikative:

```text
multiplier = Π (1 - effect_i × intensity_i)
```

Pastaj:

```text
beta_effective = beta_base × multiplier
```

Kufizohet multiplier-i në një minimum për të shmangur zhdukjen artificiale të transmetimit.

### 13.6 R(t)

Në live payload, R(t) llogaritet në mënyrë të thjeshtuar nga:

```text
R(t) = beta × infectious_days × susceptible / population
```

Kjo është një vlerë operative/modeluese, jo një estimate klinik i verifikuar.

### 13.7 Limitet akademike

Për thesis duhet të theksohet:

- parametrat janë kalibrim i simuluar;
- raportet qytetare kanë bias raportimi;
- rezultatet varen nga cilësia e input-it;
- parashikimi nuk është diagnozë;
- modeli nuk zëvendëson ekspertin epidemiologjik;
- uncertainty intervals janë një përmirësim i ardhshëm.

---

## 14. Machine Learning për hotspot-e

### 14.1 Qëllimi

Modeli parashikon cilat lagje kanë probabilitet të bëhen hotspot në 7 ditët e ardhshme.

### 14.2 Features

Për çdo district dhe window:

- `reports_7d`;
- `confirmed_7d`;
- `reports_prev_7d`;
- `growth_rate`;
- `reports_per_capita`;
- `confirmed_ratio`;
- `population`;
- `density`;
- `distance_to_hospital`;
- historiku ditor.

### 14.3 Sliding window

Për çdo ditë:

1. merren 7 ditët e fundit;
2. merren 7 ditët para tyre;
3. llogaritet trendi;
4. merren raportet e 7 ditëve të ardhshme si target;
5. target-i klasifikohet sipas percentile threshold.

Threshold-i i hotspot-it është top 30% sipas konfigurimit aktual.

### 14.4 Modeli

Implementimi përdor XGBoost për klasifikim. Dataset-i konceptual është:

```text
15 districts × historical daily windows
```

Modeli prodhon probability dhe risk level.

### 14.5 Persistenca

Parashikimi ruhet në:

```text
hotspot_predictions
```

CSV-të lejohen vetëm si fallback/historical/training input, jo si burim kryesor operacional.

### 14.6 Përmirësime të ardhshme të ML

- train/test split sipas kohës, jo random split;
- calibration curves;
- precision/recall sipas district-it;
- PR-AUC për imbalance;
- confidence interval;
- model registry;
- feature drift;
- data drift;
- backtesting rolling window;
- baseline naive;
- explainability me SHAP;
- versionim i modelit;
- monitoring i performancës pas deployment-it.

---

## 15. Pipeline i vendimmarrjes

Pipeline është ura midis analizës dhe veprimit.

### 15.1 Hapi 1 – Gjendja aktuale

Lexohen:

- dita e simulimit;
- compartments;
- active measures;
- hotspots;
- last update.

### 15.2 Hapi 2 – Rifreskimi i hotspot-eve

`POST /pipeline/refresh`:

1. merr snapshot live;
2. adapton raportet nga PostgreSQL;
3. ekzekuton ML;
4. ruan prediction rows;
5. publikon `hotspot:updated`.

### 15.3 Hapi 3 – Gjenerimi i rekomandimeve

Rekomandimet mund të përmbajnë kategori:

- measures;
- resource recommendations;
- routing recommendations.

Çdo recommendation ka:

- id;
- category;
- title;
- description;
- parameters;
- expected impact;
- confidence;
- reason.

### 15.4 Hapi 4 – Aplikimi

Aplikimi:

- verifikon snapshot-in;
- verifikon routing payload;
- aplikon masat e zgjedhura;
- ruan allocation;
- krijon dispatch;
- ruan audit;
- bën commit;
- sinkronizon live simulation.

### 15.5 Hapi 5 – Comparison

Krahason:

- baseline;
- optimized/with measures;
- cases avoided;
- deaths avoided;
- peak reduction;
- R(t).

### 15.6 History

Historiku tregon:

- llojin e run-it;
- pipeline day;
- created time;
- recommendation count;
- impact;
- dispatch count;
- application status;
- allocation count;
- audit reference.

Snapshot-i individual hap payload-in e plotë.

---

## 16. Resource allocation

### 16.1 Parimi

Burimet nuk duhet të shpërndahen vetëm me numra statikë. Pipeline-i modern lexon inventory nga PostgreSQL.

Burime të mundshme:

- ambulance;
- testing unit;
- bed;
- vaccine;
- staff.

### 16.2 Prioriteti

Allocator-i kombinon:

- probability të hotspot-it;
- numrin e raporteve;
- distancën nga spitali;
- popullsinë;
- resource capacity.

Për ambulancat, pesha konceptuale përfshin:

```text
priority × 2
+ log(1 + reports_7d) × 0.5
× distance factor
```

### 16.3 Kujdes akademik

Moduli i vjetër `resource_allocator.py` përmban edhe konstante legacy për planning. Rruga aktive e Pipeline-it përdor capacities nga PostgreSQL, por duhet të dokumentohet qartë në thesis se:

- disa heuristika janë relative;
- cost nuk është domosdoshmërisht kosto financiare reale;
- kapacitetet duhet të mirëmbahen nga operatorët;
- optimizimi aktual nuk është linear programming i plotë.

### 16.4 Atomicity

Në Pipeline apply:

- allocation helper mund të ekzekutohet me `commit=False`;
- dispatch dhe audit shtohen në të njëjtën transaction;
- commit-i bëhet në fund.

Kjo shmang rastin ku resources ruhen, por dispatch-i dështon ose anasjelltas.

---

## 17. Ambulance dispatch dhe routing

### 17.1 Hungarian Algorithm

Për `n` ambulanca dhe `m` emergjenca krijohet cost matrix:

```text
cost[i][j] = response_time(i, j) × severity_weight(j)
```

Pastaj përdoret `linear_sum_assignment` nga SciPy.

Avantazhi:

- assignment global më i mirë se greedy assignment;
- respektohen kufizimet e ambulancave të disponueshme;
- emergjencat prioritare marrin peshë.

### 17.2 A*

Për secilin çift:

1. kërkohet route në graph;
2. merret distance;
3. merret response time;
4. route ruhet në dispatch.

### 17.3 Statuset

Statuset ruhen në PostgreSQL dhe kontrollohen me state machine. Frontend-i Operations ka veprime:

- `Arriti në vendngjarje`;
- `Përfundo`.

### 17.4 Audit dhe WebSocket

Çdo ndryshim:

- audit record;
- event `routing:dispatch`;
- refresh i Operations;
- refresh i Map;
- përditësim i telemetrisë.

---

## 18. WebSocket dhe real-time behavior

### 18.1 Provider i përbashkët

Frontend-i përdor një `WebSocketProvider`, jo shumë connections individuale. Kjo shmang:

- duplicated sockets;
- evente të dyfishuara;
- reconnect storms;
- refresh races.

### 18.2 Eventet

Eventet kryesore:

```text
simulation:update
report:created
report:updated
report:deleted
hotspot:updated
resource:allocated
routing:dispatch
```

### 18.3 Konsumuesit

Eventet përdoren nga:

- Command Center;
- Map;
- Pipeline;
- Operations;
- resource views.

### 18.4 Reconnect

Provider:

- lidhet vetëm për staff role;
- përdor access token;
- dërgon ping periodik;
- rilidhet pas 3 sekondash;
- mban `lastEvent` dhe `eventCount`.

`eventCount` përdoret si trigger për rifreskime të komponentëve që lexojnë REST data pas një event-i.

---

## 19. Frontend dhe UX

### 19.1 Layout-et

Ka layout-e të ndara:

- `AdminLayout`;
- `CitizenLayout`;
- `Layout`;
- protected routes.

### 19.2 Pagesat kryesore

#### Command Center

Pamje unifikuese:

- KPI;
- live simulation;
- active measures;
- map;
- recommendations;
- reports;
- resources;
- audit.

#### Live Map

Pamje e fokusuar GIS:

- layers;
- heatmaps;
- hospitals;
- ambulances;
- routes;
- telemetry.

#### Pipeline

Pamje e plotë e ciklit:

- state;
- ML refresh;
- recommendations;
- apply;
- comparison;
- history;
- live controls.

#### Operations

Pamje e veprimeve:

- reports;
- resources;
- routing;
- dispatch lifecycle.

#### Analytics & ML

Pamje e:

- predictions;
- simulation;
- strategy;
- model outputs;
- histories.

### 19.3 State management

Gjendja është e ndarë në:

- server state lokal në secilën faqe;
- WebSocket last event;
- AuthContext;
- Pipeline state;
- map state.

Kjo funksionon, por një përmirësim i ardhshëm do të ishte një query/cache layer i centralizuar si TanStack Query.

### 19.4 React 19

Projekti përdor `queueMicrotask` për ngarkime të shkaktuara nga `useEffect`, sepse lint rule i React 19 sinjalizon setState të drejtpërdrejtë brenda effect-it.

---

## 20. Citizen portal

Citizen-i mund:

- të regjistrohet;
- të kyçet;
- të dërgojë raport;
- të shohë historikun e vet;
- të shohë statusin e raportit;
- të menaxhojë profilin;
- të ndryshojë password-in.

Parimi kryesor i privatësisë:

```text
citizen sees own reports
staff sees operational dataset according to role
```

Raportet e qytetarëve nuk duhet të ekspozojnë të dhëna personale te përdoruesit e tjerë.

---

## 21. Siguria

### 21.1 Kontrollet aktuale

- JWT authentication;
- role dependencies;
- password hashing;
- refresh tokens;
- ownership filters;
- protected routes;
- backend authorization;
- audit log;
- input validation me Pydantic;
- status transition validation.

### 21.2 Kërcënime që duhen trajtuar në production

- sekretet në `.env`;
- rotacioni i JWT secret;
- rate limiting;
- CORS i kufizuar;
- HTTPS;
- secure cookies nëse ndryshohet storage strategy;
- refresh token revocation;
- password policy;
- account lockout;
- audit log tamper protection;
- backup encryption;
- DB least privilege;
- WebSocket authorization per channel;
- validation e file uploads;
- SSRF control për endpoint-e external routing;
- logging pa token/PII.

### 21.3 Të dhëna personale

Raportet mund të përmbajnë:

- kontakt;
- moshë;
- lokacion;
- tekst raporti.

Për përdorim akademik dhe deployment real duhet:

- data minimization;
- anonymization;
- retention policy;
- consent;
- access logs;
- deletion policy;
- pseudonymization.

---

## 22. Auditability dhe reproducibility

Një vendim profesional duhet të përgjigjet:

1. kush e mori?
2. kur e mori?
3. mbi cilin model?
4. mbi cilat të dhëna?
5. cilat masa u zgjodhën?
6. çfarë burimesh u alokuan?
7. cilat dispatch-e u krijuan?
8. çfarë efekti parashikoi modeli?
9. çfarë ndryshoi pas aplikimit?

PipelineSnapshot dhe AuditLog japin bazën për këtë. Për një version edhe më të fortë akademik rekomandohet të shtohen:

- `model_version`;
- `data_cutoff`;
- `input_hash`;
- `recommendation_run_id`;
- `application_id`;
- `actor_role`;
- `approval_reason`;
- `rollback_reference`.

---

## 23. Qëndrueshmëria e të dhënave

### PostgreSQL është authoritative për

- live simulation state/history;
- recommendations/comparisons;
- reports;
- resources;
- allocations;
- dispatches;
- hotspots;
- audit.

### CSV mbetet për

- input historik;
- training/migration;
- compatibility;
- simulation history legacy;
- fallback të kontrolluar.

CSV nuk duhet të jetë burim kryesor për vendime operative kur ekziston record-i PostgreSQL.

---

## 24. Error handling

Parimet:

- input i pavlefshëm → `422`;
- resource missing → `404`;
- operation e paautorizuar → `403`;
- conflict lifecycle/bundle → `409`;
- service unavailable → `503`;
- gabime të tjera të qarta dhe të loguara.

Frontend-i:

- shfaq error message;
- nuk e kthen gabimin në zero/empty success;
- tregon partial failures në dashboard;
- lejon retry për load operations;
- disabled controls sipas rolit.

---

## 25. Testimi

### 25.1 Testet aktuale

Testet mbulojnë:

- permissions;
- pipeline apply;
- resource capacity;
- report data adapter;
- dispatch lifecycle;
- integrime të caktuara.

Komanda:

```powershell
.\venv\Scripts\python.exe -m pytest tests -q
```

### 25.2 Rezultati i fundit

```text
13 passed
```

### 25.3 Çfarë mungon

- API integration tests me dependency override;
- browser E2E;
- WebSocket automated test i dekoruar me `pytest-asyncio`;
- rollback tests;
- transaction failure tests;
- load tests;
- ML performance tests;
- visual regression;
- permission matrix për çdo endpoint;
- test i historikut me snapshot real.

### 25.4 Testi manual WebSocket

`test_webhook.py` është skript manual async. Ai mund të ekzekutohet si:

```powershell
.\venv\Scripts\python.exe test_webhook.py
```

Nuk është i njëjtë me një pytest async test të dekoruar. Për standardizim të ardhshëm:

```python
import pytest

@pytest.mark.asyncio
async def test_websocket():
    ...
```

---

## 26. Performance dhe shkallëzimi

### 26.1 Pikat aktuale

- spatial grid për simulatorin agent-based;
- kufizim contacts;
- shared WebSocket;
- PostgreSQL indexes në fusha kritike;
- pagination/limit në histori;
- refresh event-driven;
- database connection pool.

### 26.2 Probleme të mundshme

- frontend bundle rreth 1 MB;
- map layer shumë të mëdha;
- polling 10 sekonda si fallback;
- query-t e audit log pa cursor pagination;
- pipeline ML training në request;
- snapshot JSON shumë i madh;
- shumë evente në një kanal global;
- dispatcher krijon konfigurim ambulancash në memory.

### 26.3 Përmirësime

- code splitting me lazy routes;
- TanStack Query;
- Redis pub/sub për multi-worker WebSocket;
- background jobs për ML;
- cursor pagination;
- PostGIS;
- materialized views;
- cache për predictions;
- model serving të ndarë;
- observability me Prometheus/OpenTelemetry.

---

## 27. Deployment

### 27.1 Development

```text
Docker PostgreSQL + Redis
FastAPI --reload
Vite dev server
```

### 27.2 Production e rekomanduar

```text
Reverse proxy HTTPS
    ↓
Frontend static assets
    ↓
FastAPI workers
    ↓
PostgreSQL managed/replicated
Redis managed
Celery workers
Celery beat
Monitoring/logging
```

### 27.3 Backup

Duhet të bëhen backup:

- PostgreSQL;
- model artifacts;
- configuration;
- migration history;
- audit logs;
- selected historical inputs.

CSV temporary dhe generated build files nuk duhet të konsiderohen backup authoritative.

---

## 28. Flow i plotë i një skenari real

### Skenari

Një qytetar dërgon raport për simptoma në Dardania.

### Hapat

1. Citizen login.
2. Hap formularin.
3. Dërgon district, severity dhe koordinata.
4. API validon payload-in.
5. Ruhet `CitizenReport`.
6. Publikohet `report:created`.
7. Command Center rifreskohet.
8. Harta rifreskohet.
9. Nëse raporti validohet, futet në agregimin ML.
10. Operatorja bën `POST /pipeline/refresh`.
11. XGBoost llogarit probabilitetet.
12. Parashikimi ruhet në PostgreSQL.
13. Harta shfaq projected hotspot layer.
14. Pipeline gjeneron masa.
15. Resource allocator llogarit alokimet.
16. Dispatcher llogarit ambulancat.
17. Operatorja zgjedh rekomandimet.
18. `POST /pipeline/apply`.
19. Masat futen në simulation.
20. Resource allocations ruhen.
21. Dispatch records ruhen.
22. Audit log ruan aktorin dhe rezultatet.
23. WebSocket publikon ndryshimin.
24. Simulimi vazhdon me beta të reduktuar.
25. Command Center tregon R(t), active cases dhe measures.
26. Ambulanca kalon `en_route`.
27. Arrin në vendngjarje: `at_scene`.
28. Përfundon rastin: `completed`.
29. Harta dhe Operations pasqyrojnë çdo hap.

---

## 29. Përshkrim i përshtatshëm për bachelor thesis

### 29.1 Titull i mundshëm

**“Projektimi dhe implementimi i një platforme inteligjente për simulim epidemiologjik, parashikim hotspot-esh dhe koordinim operacional në mjedis urban”**

### 29.2 Pyetja kërkimore

Si mund të integrohen simulimi epidemiologjik, Machine Learning, GIS dhe optimizimi i burimeve në një platformë të vetme për të përmirësuar mbështetjen e vendimmarrjes gjatë një ngjarjeje epidemiologjike?

### 29.3 Hipoteza

Një platformë e integruar që lidh raportet, parashikimin, simulimin dhe veprimet operative mund të:

- ulë fragmentimin e informacionit;
- shkurtojë kohën nga sinjali te vendimi;
- rrisë gjurmueshmërinë;
- ndihmojë në shpërndarjen më të arsyeshme të burimeve;
- paraqesë më qartë ndikimin e masave.

### 29.4 Metodologjia

1. analiza e kërkesave;
2. projektimi arkitekturor;
3. modelimi i databazës;
4. implementimi backend;
5. implementimi frontend;
6. ndërtimi i simulimit;
7. integrimi i ML;
8. integrimi i optimizimit;
9. validimi me test data;
10. testimi funksional;
11. analiza e kufizimeve;
12. vlerësimi dhe puna e ardhshme.

### 29.5 Kapituj të rekomanduar

1. Hyrje
2. Problemi dhe motivimi
3. Punime të ngjashme
4. Kërkesat e sistemit
5. Arkitektura
6. Modeli i të dhënave
7. Simulimi epidemiologjik
8. Machine Learning
9. GIS dhe routing
10. Resource allocation
11. Implementimi
12. Siguria dhe permisimet
13. Testimi
14. Rezultatet
15. Kufizimet
16. Përfundimi dhe puna e ardhshme

### 29.6 Si të raportohen rezultatet

Rezultatet duhet të ndahen në:

- rezultate teknike;
- rezultate të simulimit;
- rezultate të ML;
- rezultate operacionale;
- usability;
- limitations.

Mos deklaro se modeli “parashikon saktë epideminë” pa metrika dhe dataset të validuar. Formulimi më korrekt është:

> Sistemi ofron parashikime eksperimentale dhe simulime të kalibruara për mbështetje të vendimmarrjes në një mjedis të kontrolluar.

---

## 30. Kufizimet aktuale

1. Modeli nuk është validuar me dataset klinik real të identifikuar.
2. Raportet qytetare kanë bias të mundshëm raportimi.
3. Disa parametra epidemiologjikë janë të konfiguruar për demonstrim.
4. R(t) është operational estimate, jo estimim formal Bayesian.
5. Prediction probability duhet të kalibrohet me backtesting.
6. Inventory mund të ketë nevojë për feed real nga institucionet.
7. Harta përdor qendra district-esh kur mungojnë koordinatat.
8. Ambulancat janë konfigurim i sistemit dhe jo GPS real.
9. Rrugët varen nga graph/OSM data.
10. RL module kërkon trajnim dhe validim të veçantë.
11. Frontend bundle është i madh.
12. Disa warnings deprecation mbeten në backend.
13. CSV legacy ekziston për compatibility.
14. WebSocket horizontal scaling kërkon pub/sub të centralizuar.
15. Nuk ka ende rollback të plotë të aplikimit të Pipeline-it.

---

## 31. Roadmap i rekomanduar

### Faza 1 – Stabilizim

- migrimi nga `datetime.utcnow()` në timezone-aware UTC;
- API testet për Pipeline;
- testet e WebSocket-it;
- E2E login/report/Pipeline/dispatch;
- standardizim i error codes;
- dokumentim OpenAPI i plotë.

### Faza 2 – Model quality

- dataset real i anonymized;
- time-based validation;
- model calibration;
- confidence intervals;
- explainability;
- model versioning;
- monitoring drift.

### Faza 3 – Operational realism

- GPS/ambulance integration;
- live hospital occupancy;
- actual inventory feeds;
- polygon district boundaries;
- PostGIS spatial queries;
- dispatch ETA updates.

### Faza 4 – Resilience

- multi-worker WebSocket;
- Redis pub/sub;
- retry policy;
- idempotency keys;
- transaction outbox;
- disaster recovery;
- backups and restore tests.

### Faza 5 – Academic evaluation

- baseline comparison;
- scenario experiments;
- sensitivity analysis;
- ablation studies;
- user study me health workers;
- latency measurements;
- fairness analysis;
- reproducible experiment scripts.

---

## 32. Konkluzion

EpiPrishtina është ndërtuar si platformë e integruar për të kaluar nga sinjali epidemiologjik te vendimi operacional:

```text
Raport
  → Validim
  → Agregim
  → ML hotspot
  → Simulim
  → Rekomandim
  → Alokim burimesh
  → Dispatch
  → Audit
  → Feedback live
```

Pika më e rëndësishme e arkitekturës është që këto nuk trajtohen si sisteme të izoluara. PostgreSQL ruan gjendjen durable, FastAPI orkestron domain logic, WebSocket përhap ndryshimet, React i paraqet në Command Center/Map/Operations, ndërsa simulation, ML, routing dhe allocation prodhojnë sinjale për vendimmarrje.

Për përdorim si bachelor thesis, projekti ka vlerë të veçantë sepse demonstron integrimin e disa disiplinave në një sistem të vetëm. Megjithatë, duhet të bëhet dallim i qartë midis:

- një platforme demonstrative/eksperimentale për mbështetje të vendimmarrjes;
- dhe një sistemi klinik të certifikuar për përdorim real.

Dokumentimi i ardhshëm duhet të plotësohet me:

- screenshot-e të flow-eve;
- diagram ER;
- sequence diagrams;
- metrics të testimit;
- eksperimente ML;
- sensitivity analysis;
- user evaluation;
- deployment runbook;
- risk register.

