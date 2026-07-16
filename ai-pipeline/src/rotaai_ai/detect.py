"""Core inference — the reusable value engine (docs/02-ai-pipeline.md §4).

This module is deliberately framework-thin and side-effect free so it can be
imported by BOTH:
  - the manual CLI (scripts/predict.py), and
  - the future backend Celery worker (docs/03-backend-api.md §5, process_frame).

It takes an image + a frame_id and returns `Detection[]`. De-duplication of the
same asset across consecutive frames is NOT done here — that is GIS's job
(docs/04-gis-data.md §6). This module treats every frame independently.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any

from .schema import Detection

# Lazy import of ultralytics so importing this module stays cheap (e.g. for tests).
_MODEL_CACHE: dict[str, Any] = {}


def load_model(weights: str = "yolo26s.pt"):
    """Load (and cache) a YOLO model. Ultralytics auto-downloads base weights."""
    from ultralytics import YOLO  # heavy import, done lazily

    if weights not in _MODEL_CACHE:
        _MODEL_CACHE[weights] = YOLO(weights)
    return _MODEL_CACHE[weights]


def _xyxy_to_xywh(x1: float, y1: float, x2: float, y2: float) -> tuple[float, float, float, float]:
    """Ultralytics returns [x1,y1,x2,y2]; the contract wants [x, y, w, h] top-left."""
    return (x1, y1, x2 - x1, y2 - y1)


def detect_image(
    model,
    image: str | Path,
    frame_id: str | None = None,
    conf: float = 0.4,
    model_version: str = "v0.1-bootstrap",
    detection_type: str = "asset",
    class_map: dict[int, str] | None = None,
) -> list[Detection]:
    """Run detection on one image → list[Detection] (docs/00-overview.md §4.2).

    Args:
        model: a loaded Ultralytics model (from load_model).
        image: path to an image file (one "frame").
        frame_id: the frame's id; a uuid is generated if omitted.
        conf: confidence threshold — default 0.4 per docs/02-ai-pipeline.md §4.
        model_version: stamped onto every detection.
        detection_type: "asset" (MVP) or "damage" (optional module, docs/07).
        class_map: optional override id->name; defaults to the model's names.
    """
    frame_id = frame_id or str(uuid.uuid4())
    names = class_map or model.names

    results = model.predict(source=str(image), conf=conf, verbose=False)
    detections: list[Detection] = []
    for result in results:
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            continue
        for box in boxes:
            cls_id = int(box.cls[0])
            x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())
            detections.append(
                Detection(
                    frame_id=frame_id,
                    class_name=str(names.get(cls_id, cls_id)),
                    bbox=_xyxy_to_xywh(x1, y1, x2, y2),
                    confidence=float(box.conf[0]),
                    model_version=model_version,
                    type=detection_type,
                )
            )
    return detections
