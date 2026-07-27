"""Review console endpoints (docs/03-backend-api.md §4.2, docs/05-review-console.md)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..deps import get_tenant_db
from ..models import Detection, Frame, InventoryItem, TrainingFeedback
from ..schemas import ReviewDecision, ReviewQueueItem

router = APIRouter(prefix="/api/v1/review", tags=["review"])

_ALLOWED = {"approved", "rejected", "corrected"}


@router.get("/queue", response_model=list[ReviewQueueItem])
def review_queue(limit: int = 50, db: DbSession = Depends(get_tenant_db)) -> list[ReviewQueueItem]:
    stmt = (
        select(
            InventoryItem,
            Detection.confidence,
            Detection.bbox,
            Frame.image_ref,
            func.ST_X(InventoryItem.geom),
            func.ST_Y(InventoryItem.geom),
        )
        .join(Detection, InventoryItem.detection_id == Detection.id)
        .join(Frame, Detection.frame_id == Frame.id)
        .where(InventoryItem.review_status == "pending")
        .order_by(Detection.confidence.asc())  # riskiest (lowest conf) first
        .limit(limit)
    )
    out = []
    for inv, confidence, bbox, image_ref, lon, lat in db.execute(stmt).all():
        out.append(
            ReviewQueueItem(
                item_id=inv.id,
                detection_id=inv.detection_id,
                class_name=inv.class_name,
                type=inv.type,
                confidence=confidence,
                bbox=bbox,
                image_ref=image_ref,
                lon=lon,
                lat=lat,
                review_status=inv.review_status,
            )
        )
    return out


@router.post("/{item_id}")
def submit_decision(
    item_id: UUID, body: ReviewDecision, db: DbSession = Depends(get_tenant_db)
) -> dict:
    if body.decision not in _ALLOWED:
        raise HTTPException(status_code=422, detail=f"decision must be one of {_ALLOWED}")
    inv = db.get(InventoryItem, item_id)
    if inv is None:
        raise HTTPException(status_code=404, detail="inventory item not found")

    original_class = inv.class_name
    inv.review_status = body.decision
    inv.reviewer_id = body.reviewer_id
    inv.reviewed_at = datetime.now(timezone.utc)
    if body.severity:
        inv.severity = body.severity
    if body.decision == "corrected" and body.corrected_class:
        inv.class_name = body.corrected_class

    # Feed rejected/corrected back for active learning (docs/05 §3.4, docs/02 §3).
    if body.decision in ("rejected", "corrected"):
        det = db.get(Detection, inv.detection_id)
        image_ref = None
        if det is not None:
            frame = db.get(Frame, det.frame_id)
            image_ref = frame.image_ref if frame else None
        db.add(
            TrainingFeedback(
                org_id=inv.org_id,
                inventory_item_id=inv.id,
                detection_id=inv.detection_id,
                original_class=original_class,
                corrected_class=body.corrected_class,
                decision=body.decision,
                image_ref=image_ref,
                bbox=det.bbox if det else None,
            )
        )

    db.commit()
    return {"item_id": str(item_id), "review_status": inv.review_status}
