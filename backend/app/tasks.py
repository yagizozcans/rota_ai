"""Async processing (docs/03-backend-api.md §5).

process_frame(frame_id, image_path):
  1. load the frame (has GPS/heading),
  2. run detection via the ml seam (real model or stub — task doesn't care),
  3. persist Detection rows,
  4. geolocate each to an InventoryItem (status=pending) and persist.

Geolocation is MVP-simple: the asset inherits the frame's GPS point. A
heading/bbox-based forward offset is a later refinement (see TODO). De-duplication
of the same asset across frames is GIS's job (docs/04 §6), not here.
"""

from __future__ import annotations

import logging

from celery import shared_task
from geoalchemy2.elements import WKTElement

from .celery_app import celery_app
from .db import SessionLocal
from .ml import run_detection
from .models import Detection, Frame, InventoryItem
from .rls import set_session_org

log = logging.getLogger("rotaai.tasks")


@celery_app.task(name="process_frame", bind=True, max_retries=3, default_retry_delay=10)
def process_frame(self, frame_id: str, image_path: str, org_id: str) -> dict:
    db = SessionLocal()
    # The worker runs outside any request, so it must set its own RLS tenant
    # context (docs/04 §4). Without this the frame lookup below is filtered out
    # and the detection/inventory INSERTs fail their WITH CHECK policy.
    set_session_org(db, org_id)
    try:
        frame = db.get(Frame, frame_id)
        if frame is None:
            log.error("process_frame: frame %s not found", frame_id)
            return {"frame_id": frame_id, "status": "missing"}

        frame.processing_status = "processing"
        db.commit()

        raw_dets = run_detection(image_path, str(frame_id))
        n_items = 0
        for d in raw_dets:
            det = Detection(
                org_id=frame.org_id,
                frame_id=frame.id,
                type=d.get("type", "asset"),
                class_name=d["class"],
                bbox=d["bbox"],
                confidence=d["confidence"],
                model_version=d["model_version"],
            )
            db.add(det)
            db.flush()  # assign det.id

            # Geolocate: MVP = frame GPS point in WGS84.
            # TODO(stage-2): offset along heading_deg by an estimated range from
            #                bbox size / camera intrinsics for a truer asset point.
            if frame.gps_lat is None or frame.gps_lon is None:
                continue  # can't place without a fix; detection is still recorded
            item = InventoryItem(
                org_id=frame.org_id,
                detection_id=det.id,
                geom=WKTElement(f"POINT({frame.gps_lon} {frame.gps_lat})", srid=4326),
                srid_source=4326,
                type=det.type,
                class_name=det.class_name,
                review_status="pending",
            )
            db.add(item)
            n_items += 1

        frame.processing_status = "done"
        db.commit()
        return {"frame_id": frame_id, "status": "done", "detections": len(raw_dets), "items": n_items}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        frame = db.get(Frame, frame_id)
        if frame is not None:
            frame.processing_status = "error"
            db.commit()
        log.exception("process_frame failed for %s", frame_id)
        raise self.retry(exc=exc)
    finally:
        db.close()
