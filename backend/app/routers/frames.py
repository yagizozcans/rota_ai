"""Frame upload endpoint (docs/03-backend-api.md §4.1, contract docs/00-overview §4.1).

Multipart: image file + CaptureFrame JSON (as the `metadata` form field). Stores
the image, writes the frame row (WGS84 point), and queues process_frame.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session as DbSession

from ..auth import Identity, require_identity
from ..db import get_db
from ..models import Frame, Session
from ..schemas import CaptureFrame, FrameResponse
from ..storage import storage
from ..tasks import process_frame

router = APIRouter(prefix="/api/v1/frames", tags=["frames"])


@router.post("", response_model=FrameResponse, status_code=202)
async def upload_frame(
    metadata: str = Form(..., description="CaptureFrame JSON (docs/00-overview §4.1)"),
    image: UploadFile = File(...),
    identity: Identity = Depends(require_identity),
    db: DbSession = Depends(get_db),
) -> FrameResponse:
    cf = CaptureFrame.model_validate_json(metadata)
    org_id = identity.org_id  # tenant authority is the token, never the client (§4.5)

    # Idempotent: a retried upload of the same client-minted frame is a no-op, so a
    # lost 2xx ack never creates a duplicate (mobile keeps retrying — 01 §3.4).
    if db.get(Frame, cf.frame_id) is not None:
        return FrameResponse(frame_id=cf.frame_id, processing_status="pending")

    # Lazily auto-register an unknown session (offline-first: the drive may have
    # started with no signal and never called POST /sessions — plan Q1).
    session = db.get(Session, cf.session_id)
    if session is None:
        db.add(Session(id=cf.session_id, org_id=org_id, device_id=cf.device_id))
    elif session.org_id != org_id:
        raise HTTPException(status_code=403, detail="session belongs to another org")

    # image_ref is recomputed server-side, org-prefixed (§4.5, plan Q4); the
    # client's advisory cf.image_ref is ignored.
    key = f"{org_id}/{cf.session_id}/{cf.frame_id}.jpg"
    storage.save(key, await image.read())

    frame = Frame(
        id=cf.frame_id,
        org_id=org_id,
        session_id=cf.session_id,
        device_id=cf.device_id,
        captured_at=cf.timestamp,
        gps_lat=cf.gps.lat,
        gps_lon=cf.gps.lon,
        geom=WKTElement(f"POINT({cf.gps.lon} {cf.gps.lat})", srid=4326),
        heading_deg=cf.heading_deg,
        gps_accuracy_m=cf.gps.accuracy_m,
        speed_kmh=cf.gps.speed_kmh,
        image_ref=key,
    )
    db.add(frame)
    db.commit()

    # Queue async processing; worker reads the image from shared storage.
    process_frame.delay(str(cf.frame_id), storage.path(key))
    return FrameResponse(frame_id=cf.frame_id, processing_status="pending")
