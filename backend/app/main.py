"""RotaAI Backend API entrypoint (docs/03-backend-api.md).

Traffic hub connecting mobile capture (01), AI (02), GIS (04) and the review
console (05). Run: uvicorn app.main:app
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers import auth, frames, inventory, review, sessions
from .taxonomy import ASSET_CLASSES

app = FastAPI(title="RotaAI Backend", version="0.1.0")

# MVP dev CORS: review-console runs on a different origin (Vite dev server).
# Tighten this to a specific origin list before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(frames.router)
app.include_router(review.router)
app.include_router(inventory.router)

# Serves uploaded frame images so the review console can render them, e.g.
# GET /media/<session_id>/<frame_id>.jpg (image_ref is the path after /media/).
# MVP local-filesystem storage only — swap for signed S3/R2 URLs at scale.
app.mount("/media", StaticFiles(directory=settings.storage_dir, check_dir=False), name="media")


@app.get("/health", tags=["ops"])
def health() -> dict:
    return {"status": "ok", "service": "rotaai-backend"}


@app.get("/api/v1/taxonomy", tags=["ops"])
def taxonomy() -> dict:
    """Asset classes for the review console's correction dropdown (docs/00 §4.4)."""
    return {"asset_classes": ASSET_CLASSES}
