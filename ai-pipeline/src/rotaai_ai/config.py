"""Configuration loading and model-name resolution.

YOLO26 is the target model (docs/02-ai-pipeline.md §2). Because the dataset format
is identical across YOLOv8/YOLO11/YOLO26, we keep a fallback so the pipeline still
runs if a given weight file is unavailable in the installed Ultralytics version.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIGS_DIR = REPO_ROOT / "configs"

# Preferred model first, fallbacks after. Ultralytics auto-downloads on first use.
MODEL_FALLBACKS = ["yolo26s.pt", "yolo11s.pt", "yolov8s.pt"]


def load_yaml(path: str | Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def load_data_config(path: str | Path | None = None) -> dict[str, Any]:
    path = Path(path) if path else CONFIGS_DIR / "data.yaml"
    return load_yaml(path)


def load_train_config(path: str | Path | None = None) -> dict[str, Any]:
    path = Path(path) if path else CONFIGS_DIR / "train.yaml"
    return load_yaml(path)


def resolve_model(requested: str | None) -> str:
    """Return a usable weights spec.

    If ``requested`` is a path to existing trained weights, use it as-is.
    Otherwise return the requested base model or the first fallback. Ultralytics
    downloads the base checkpoint automatically the first time it is used.
    """
    if requested:
        if Path(requested).exists():
            return requested
        return requested
    return MODEL_FALLBACKS[0]
