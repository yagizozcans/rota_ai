"""ORM models — mirror db/init/01_schema.sql (docs/04-gis-data.md §4).

Geometry columns are geometry(Point, 4326): raw data is always stored in WGS84;
coordinate transforms happen at export time (docs/04 §3). Keep this in sync with
the SQL init file — the SQL file is the source of truth that creates the tables
(with the PostGIS extension + GIST indexes); these classes read/write them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)  # tenant (00-overview §4.5)
    device_id: Mapped[str | None] = mapped_column(String)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, default="active")  # active | completed


class Frame(Base):
    __tablename__ = "frames"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)  # tenant (00-overview §4.5)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"))
    device_id: Mapped[str | None] = mapped_column(String)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    geom: Mapped[str | None] = mapped_column(Geometry("POINT", srid=4326))
    gps_lat: Mapped[float | None] = mapped_column(Float)
    gps_lon: Mapped[float | None] = mapped_column(Float)
    heading_deg: Mapped[float | None] = mapped_column(Float)
    gps_accuracy_m: Mapped[float | None] = mapped_column(Float)
    speed_kmh: Mapped[float | None] = mapped_column(Float)
    image_ref: Mapped[str] = mapped_column(String, nullable=False)
    processing_status: Mapped[str] = mapped_column(String, default="pending")  # pending|processing|done|error
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    frame_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("frames.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String, default="asset")  # asset | damage
    # 'class' is the contract key (docs/00-overview §4.2); Python attr is class_name.
    class_name: Mapped[str] = mapped_column("class", String, nullable=False)
    bbox: Mapped[dict] = mapped_column(JSONB, nullable=False)  # [x, y, w, h] pixels
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_version: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    detection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("detections.id", ondelete="CASCADE"))
    geom: Mapped[str] = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    srid_source: Mapped[int] = mapped_column(Integer, default=4326)
    type: Mapped[str] = mapped_column(String, default="asset")
    class_name: Mapped[str] = mapped_column("class", String, nullable=False)
    severity: Mapped[str | None] = mapped_column(String)  # low | medium | high | null
    review_status: Mapped[str] = mapped_column(String, default="pending")  # pending|approved|rejected|corrected
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TrainingFeedback(Base):
    """Rejected/corrected items feeding 02 active learning (docs/04 §7, docs/05 §3.4)."""

    __tablename__ = "training_feedback"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL")
    )
    detection_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    original_class: Mapped[str | None] = mapped_column(String)
    corrected_class: Mapped[str | None] = mapped_column(String)
    decision: Mapped[str] = mapped_column(String, nullable=False)  # rejected | corrected
    image_ref: Mapped[str | None] = mapped_column(String)
    bbox: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
