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

from ..db import get_db
from ..models import InventoryItem

router = APIRouter(prefix="/api/v1/inventory", tags=["inventory"])


@router.get("")
def list_inventory(
    status: str = "approved",
    asset_class: str | None = None,
    limit: int = 500,
    db: DbSession = Depends(get_db),
) -> list[dict]:
    stmt = (
        select(
            InventoryItem,
            func.ST_X(InventoryItem.geom),
            func.ST_Y(InventoryItem.geom),
        )
        .where(InventoryItem.review_status == status)
        .limit(limit)
    )
    if asset_class:
        stmt = stmt.where(InventoryItem.class_name == asset_class)
    return [
        {
            "item_id": str(inv.id),
            "class": inv.class_name,
            "type": inv.type,
            "severity": inv.severity,
            "lat": lat,
            "lon": lon,
            "review_status": inv.review_status,
        }
        for inv, lon, lat in db.execute(stmt).all()
    ]


@router.get("/export")
def export_geojson(
    status: str = "approved",
    srid: int = 4326,
    db: DbSession = Depends(get_db),
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
