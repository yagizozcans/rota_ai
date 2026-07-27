"""Inventory output endpoints (docs/03-backend-api.md §4.3, docs/04-gis-data.md §5).

Export transforms to the requested SRID at query time via ST_Transform — raw data
stays WGS84 (docs/04 §3). Default srid=4326; pass a TUSAGA-Aktif/ITRF EPSG for the
agency's system.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DbSession

from ..deps import get_tenant_db
from ..models import Detection, Frame, InventoryItem

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.get("")
def list_inventory(
    status: str = "approved",
    asset_class: str | None = None,
    limit: int = 500,
    db: DbSession = Depends(get_tenant_db),
) -> list[dict]:
    """Full item detail for any review_status (approved/rejected/corrected/pending).

    Joins in Detection + Frame so the response is self-contained (confidence, bbox,
    image_ref, model_version) — used both as a data API and by the review console's
    archive panel, which shows this raw JSON without loading images.
    """
    stmt = (
        select(
            InventoryItem,
            Detection.confidence,
            Detection.bbox,
            Detection.model_version,
            Frame.image_ref,
            func.ST_X(InventoryItem.geom),
            func.ST_Y(InventoryItem.geom),
        )
        .join(Detection, InventoryItem.detection_id == Detection.id)
        .join(Frame, Detection.frame_id == Frame.id)
        .where(InventoryItem.review_status == status)
        .order_by(InventoryItem.reviewed_at.desc().nullslast(), InventoryItem.created_at.desc())
        .limit(limit)
    )
    if asset_class:
        stmt = stmt.where(InventoryItem.class_name == asset_class)
    return [
        {
            "item_id": str(inv.id),
            "detection_id": str(inv.detection_id),
            "class": inv.class_name,
            "type": inv.type,
            "severity": inv.severity,
            "confidence": confidence,
            "bbox": bbox,
            "model_version": model_version,
            "image_ref": image_ref,
            "lat": lat,
            "lon": lon,
            "review_status": inv.review_status,
            "reviewer_id": str(inv.reviewer_id) if inv.reviewer_id else None,
            "reviewed_at": inv.reviewed_at.isoformat() if inv.reviewed_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv, confidence, bbox, model_version, image_ref, lon, lat in db.execute(stmt).all()
    ]


@router.get("/export")
def export_geojson(
    status: str = "approved",
    srid: int = 4326,
    db: DbSession = Depends(get_tenant_db),
) -> dict:
    stmt = (
        select(
            InventoryItem.id,
            InventoryItem.class_name,
            InventoryItem.type,
            InventoryItem.severity,
            func.ST_AsGeoJSON(func.ST_Transform(InventoryItem.geom, srid)),
        )
        .where(InventoryItem.review_status == status)
    )
    features = [
        {
            "type": "Feature",
            "geometry": json.loads(geojson),
            "properties": {"item_id": str(id_), "class": cls, "type": typ, "severity": sev},
        }
        for id_, cls, typ, sev, geojson in db.execute(stmt).all()
    ]
    return {
        "type": "FeatureCollection",
        "name": "rotaai_inventory",
        "crs": {"type": "name", "properties": {"name": f"EPSG:{srid}"}},
        "features": features,
    }
