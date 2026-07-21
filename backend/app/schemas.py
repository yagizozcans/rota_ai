"""API request/response models — mirror the shared contracts in docs/00-overview.md §4."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---- 4.1 CaptureFrame (Mobile → Backend) ----
class GPS(BaseModel):
    lat: float
    lon: float
    accuracy_m: float | None = None
    speed_kmh: float | None = None


class CaptureFrame(BaseModel):
    """docs/00-overview.md §4.1. frame_id + session_id are client-minted (plan Q1);
    org_id and image_ref are advisory — the server trusts the token for tenancy
    (§4.5) and recomputes image_ref (plan Q4)."""

    frame_id: UUID
    org_id: UUID | None = None
    session_id: UUID
    device_id: str | None = None
    timestamp: datetime | None = None
    gps: GPS
    heading_deg: float | None = None
    image_ref: str | None = None


# ---- Sessions ----
class SessionCreate(BaseModel):
    session_id: UUID          # client-minted (plan Q1) — idempotent upsert
    device_id: str | None = None
    user_id: UUID | None = None


# ---- Auth (docs/03-backend-api.md §4, plan Q7) ----
class LoginRequest(BaseModel):
    org_id: UUID
    device_id: str
    role: str | None = None


class TokenResponse(BaseModel):
    token: str


class SessionResponse(BaseModel):
    session_id: UUID
    status: str


class FrameResponse(BaseModel):
    frame_id: UUID
    processing_status: str


# ---- 4.2 Detection (AI → Backend) — response shape ----
class Detection(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    detection_id: UUID
    frame_id: UUID
    type: str = "asset"
    class_name: str = Field(alias="class")
    bbox: list[float]
    confidence: float
    model_version: str


# ---- 4.3 InventoryItem — review queue + inventory output ----
class ReviewQueueItem(BaseModel):
    item_id: UUID
    detection_id: UUID
    class_name: str = Field(alias="class")
    type: str
    confidence: float | None = None
    bbox: list[float] | None = None
    image_ref: str | None = None
    lat: float | None = None
    lon: float | None = None
    review_status: str

    model_config = ConfigDict(populate_by_name=True)


class ReviewDecision(BaseModel):
    """docs/03-backend-api.md §4.2 — approve / reject / correct."""

    decision: str  # approved | rejected | corrected
    corrected_class: str | None = None
    severity: str | None = None  # low | medium | high
    reviewer_id: UUID | None = None
