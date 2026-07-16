"""RotaAI Backend API entrypoint (docs/03-backend-api.md).

Traffic hub connecting mobile capture (01), AI (02), GIS (04) and the review
console (05). Run: uvicorn app.main:app
"""

from __future__ import annotations

from fastapi import FastAPI

from .routers import frames, inventory, review, sessions

app = FastAPI(title="RotaAI Backend", version="0.1.0")

app.include_router(sessions.router)
app.include_router(frames.router)
app.include_router(review.router)
app.include_router(inventory.router)


@app.get("/health", tags=["ops"])
def health() -> dict:
    return {"status": "ok", "service": "rotaai-backend"}
