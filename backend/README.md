# RotaAI — Backend API + Worker (Layer 03)

Orchestration hub: mobile uploads → storage → AI queue → PostGIS → review → export.
PRD: [`../docs/03-backend-api.md`](../docs/03-backend-api.md).

## Run the whole stack

From the repo root (wires PostGIS + Redis + api + worker):

```bash
docker compose up --build
# API docs:  http://localhost:8000/docs
# Health:    http://localhost:8000/health
```

The DB schema ([`db/init/01_schema.sql`](db/init/01_schema.sql)) is applied automatically on first
DB init. Images are stored on a volume shared between `api` and `worker`.

## The model seam (why the API never changes)

The worker calls the model through exactly one function — [`app/ml.py`](app/ml.py) `run_detection()`:

- **Stub mode (default):** `WEIGHTS_PATH` unset → deterministic fake detections, so
  the full pipeline (upload → detect → geolocate → review queue → export) runs today.
- **Real mode:** set `WEIGHTS_PATH` to the Stage-1 weights and make the
  `rotaai_ai` package importable (`pip install -e ../ai-pipeline` + the `[ml]`
  extra). `run_detection` then calls the *same* `rotaai_ai.detect` code the manual
  CLI uses. **No router or task code changes.**

## Endpoints (docs/03 §4)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/sessions` | start a drive session → `session_id` |
| POST | `/api/v1/sessions/{id}/complete` | close a session |
| POST | `/api/v1/frames` | multipart: image + `CaptureFrame` JSON → queues processing |
| GET  | `/api/v1/review/queue` | pending `InventoryItem`s (+ image_ref, bbox, coords) |
| POST | `/api/v1/review/{item_id}` | decision: approved / rejected / corrected |
| GET  | `/api/v1/inventory` | approved inventory (filter by class/status) |
| GET  | `/api/v1/inventory/export` | GeoJSON, `?srid=` transforms via ST_Transform |

## Data flow (one frame)

```
POST /frames ──▶ store image ──▶ INSERT frame (WGS84 point) ──▶ process_frame.delay()
                                                                      │  (Celery/Redis)
                                                                      ▼
              run_detection() ─▶ INSERT detections ─▶ INSERT inventory_items(pending)
                                                                      │
                                             GET /review/queue ◀──────┘
```

## Tables (docs/04 §4)

`sessions`, `frames`, `detections`, `inventory_items`, `training_feedback`.
All geometry is `geometry(Point, 4326)` (raw WGS84; transform on export). GIST
indexes on `frames.geom` and `inventory_items.geom`.

## Local dev without Docker

Needs a reachable Postgres+PostGIS and Redis. Put the venv on local disk (this repo
lives on a non-APFS external drive):

```bash
uv venv /Users/yagizozcan/.venvs/rotaai-backend --python 3.11
source /Users/yagizozcan/.venvs/rotaai-backend/bin/activate
uv pip install --python /Users/yagizozcan/.venvs/rotaai-backend -e .
cp .env.example .env   # point DATABASE_URL/REDIS_URL at your services
uvicorn app.main:app --reload
# worker (separate shell): celery -A app.celery_app:celery_app worker --loglevel=info
```
