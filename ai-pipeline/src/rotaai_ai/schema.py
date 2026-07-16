"""Shared data contracts.

`Detection` mirrors the cross-layer contract in docs/00-overview.md §4.2 exactly.
Keeping this identical to the PRD means the backend, GIS and review console do not
change when this module is wired in later — they already speak `Detection`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any


# MVP produces only "asset" detections. The optional damage module
# (docs/07-damage-module.md) reuses this same contract with type="damage".
DetectionType = str  # "asset" | "damage"


@dataclass
class Detection:
    """A single object found on a single frame — docs/00-overview.md §4.2.

    Note: the JSON key is ``class`` (a Python keyword), so the field is named
    ``class_name`` in Python and serialized to ``class`` in :meth:`to_dict`.
    """

    frame_id: str
    class_name: str
    bbox: tuple[float, float, float, float]  # [x, y, w, h] in image pixels (top-left origin)
    confidence: float
    model_version: str
    type: DetectionType = "asset"
    detection_id: str = field(default_factory=lambda: str(uuid.uuid4()))

    def to_dict(self) -> dict[str, Any]:
        return {
            "detection_id": self.detection_id,
            "frame_id": self.frame_id,
            "type": self.type,
            "class": self.class_name,
            "bbox": [round(float(v), 2) for v in self.bbox],
            "confidence": round(float(self.confidence), 4),
            "model_version": self.model_version,
        }
