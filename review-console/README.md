# RotaAI — Onay Konsolu (Review Console, Layer 05)

Human-in-the-loop review UI: approve, reject, or correct the AI's detections.
PRD: [`../docs/05-review-console.md`](../docs/05-review-console.md).

React + Vite + Tailwind + MapLibre GL. Talks directly to the backend API
(CORS is open for MVP dev — see `backend/app/main.py`).

## Run

Needs the backend stack running first (`docker compose up` from the repo root).

```bash
cd review-console
npm install
npm run dev
# http://localhost:5173
```

Point at a different backend with `VITE_API_URL` (copy `.env.example` to `.env`).

## What it does (docs/05 §3)

- Fetches the pending review queue (`GET /api/v1/review/queue`), sorted riskiest
  (lowest confidence) first by the backend.
- Shows the frame image with the AI's bounding box drawn on top, plus a small
  map pinning the detection's location (OpenStreetMap raster tiles — free, no
  API key; MapLibre demo tiles were tried first but have almost no real street
  data outside sample regions, so they don't work for arbitrary real coordinates).
- Keyboard shortcuts: **A** approve, **R** reject, **C** correct, **←/→** navigate.
- Correcting lets you pick a real class from the taxonomy (`GET /api/v1/taxonomy`)
  and a severity. If the AI's suggested class isn't in the taxonomy (e.g. the
  Stage-1 model's generic `traffic_sign` label), the dropdown defaults to the
  first real option rather than silently mismatching what gets submitted.
- Rejected/corrected decisions feed `training_feedback` server-side for active
  learning (docs/05 §3.4) — nothing to do here, the backend handles it.

## Known limitation

MapLibre GL JS requires WebGL2. It renders fine in real browsers (Chrome,
Safari, Firefox), but won't render inside embedded/sandboxed preview tools that
lack WebGL2 support — the map area will just show blank/attribution-only there.
Not a bug in this app; verify in an actual browser if you ever see this.
