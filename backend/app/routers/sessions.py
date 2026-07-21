"""Session endpoints (docs/03-backend-api.md §4.1)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession

from ..auth import Identity, require_identity
from ..db import get_db
from ..models import Session
from ..schemas import SessionCreate, SessionResponse

router = APIRouter(prefix="/api/v1/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
def create_session(
    body: SessionCreate,
    identity: Identity = Depends(require_identity),
    db: DbSession = Depends(get_db),
) -> SessionResponse:
    """Idempotent upsert of a client-minted session (plan Q1). Repeated calls with
    the same id are a no-op; org_id comes from the token (§4.5)."""
    existing = db.get(Session, body.session_id)
    if existing is not None:
        if existing.org_id != identity.org_id:
            raise HTTPException(status_code=403, detail="session belongs to another org")
        return SessionResponse(session_id=existing.id, status=existing.status)

    session = Session(
        id=body.session_id,
        org_id=identity.org_id,
        device_id=body.device_id,
        user_id=body.user_id,
    )
    db.add(session)
    db.commit()
    return SessionResponse(session_id=session.id, status=session.status)


@router.post("/{session_id}/complete", response_model=SessionResponse)
def complete_session(session_id: UUID, db: DbSession = Depends(get_db)) -> SessionResponse:
    session = db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    return SessionResponse(session_id=session.id, status=session.status)
