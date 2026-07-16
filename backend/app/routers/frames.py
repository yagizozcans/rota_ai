"""Frame upload endpoint (docs/03-backend-api.md §4.1, contract docs/00-overview §4.1).

Multipart: image file + CaptureFrame JSON (as the `metadata` form field). Stores
the image, writes the frame row (WGS84 point), and queues process_frame.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session as DbSession

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
    db: DbSession = Depends(get_db),
) -> FrameResponse:
    cf = CaptureFrame.model_validate_json(metadata)

    if db.get(Session, cf.session_id) is None:
        raise HTTPException(status_code=404, detail="unknown session_id")

    frame_id = uuid.uuid4()
    key = f"{cf.session_id}/{frame_id}.jpg"
    storage.save(key, await image.read())

    frame = Frame(
        id=frame_id,
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
    process_frame.delay(str(frame_id), storage.path(key))
    return FrameResponse(frame_id=frame_id, processing_status="pending")
