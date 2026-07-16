"""The model seam (docs/02-ai-pipeline.md ↔ docs/03-backend-api.md §5).

`run_detection` is the ONLY place the backend touches the model. It returns a list
of Detection dicts in the docs/00-overview.md §4.2 shape. Two modes:

  * REAL  — WEIGHTS_PATH set and `rotaai_ai` importable → runs YOLO26 via the exact
            same code the manual CLI uses (ai-pipeline/src/rotaai_ai/detect.py).
  * STUB  — otherwise → deterministic fake detections so the whole pipeline runs
            before Stage-1 weights exist.

Slotting the trained model in = set WEIGHTS_PATH + make rotaai_ai importable.
Nothing in routers/ or tasks.py changes.
"""

from __future__ import annotations

import logging
import random
import uuid

from .config import settings

log = logging.getLogger("rotaai.ml")

_STUB_CLASSES = ["sign_warning", "sign_prohibitory", "barrier", "light_pole", "road_marking"]


def _stub_detections(frame_id: str) -> list[dict]:
    dets = []
    for _ in range(random.randint(1, 3)):
        dets.append(
            {
                "detection_id": str(uuid.uuid4()),
                "frame_id": frame_id,
                "type": "asset",
                "class": random.choice(_STUB_CLASSES),
                "bbox": [
                    float(random.randint(0, 600)),
                    float(random.randint(0, 400)),
                    float(random.randint(20, 120)),
                    float(random.randint(20, 120)),
                ],
                "confidence": round(random.uniform(0.5, 0.95), 3),
                "model_version": settings.detector_version,
            }
        )
    return dets


def run_detection(image_path: str, frame_id: str) -> list[dict]:
    """Return Detection dicts (docs/00-overview §4.2) for one frame image."""
    if settings.weights_path:
        try:
            from rotaai_ai.detect import detect_image, load_model  # heavy, optional

            model = load_model(settings.weights_path)
            dets = detect_image(
                model,
                image_path,
                frame_id=frame_id,
                conf=settings.detect_conf,
                model_version=settings.detector_version,
            )
            return [d.to_dict() for d in dets]
        except Exception:  # noqa: BLE001 — never let a model issue break ingestion
            log.exception("real model failed, falling back to stub for frame %s", frame_id)
    return _stub_detections(frame_id)
