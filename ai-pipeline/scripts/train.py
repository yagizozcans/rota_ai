#!/usr/bin/env python3
"""Train the road-asset detector (docs/02-ai-pipeline.md §3).

Thin wrapper over Ultralytics. Reads configs/train.yaml + configs/data.yaml.
Designed to run on a cloud GPU (Colab/RunPod) but also works locally (MPS/CPU).

Usage:
    python scripts/train.py
    python scripts/train.py --data configs/data.yaml --device 0 --epochs 50
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rotaai_ai import config  # noqa: E402


def main() -> None:
    train_cfg = config.load_train_config()

    parser = argparse.ArgumentParser(description="Train RotaAI asset detector")
    parser.add_argument("--data", default=str(config.CONFIGS_DIR / "data.yaml"))
    parser.add_argument("--model", default=train_cfg.get("model", "yolo26s.pt"))
    parser.add_argument("--epochs", type=int, default=train_cfg.get("epochs", 100))
    parser.add_argument("--imgsz", type=int, default=train_cfg.get("imgsz", 640))
    parser.add_argument("--batch", type=int, default=train_cfg.get("batch", 16))
    parser.add_argument("--device", default=train_cfg.get("device"))  # None -> auto
    parser.add_argument("--name", default=train_cfg.get("name", "rotaai_signs_v0"))
    args = parser.parse_args()

    from ultralytics import YOLO

    weights = config.resolve_model(args.model)
    print(f"[train] model={weights} data={args.data} device={args.device or 'auto'}")
    model = YOLO(weights)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=train_cfg.get("patience", 20),
        mosaic=train_cfg.get("mosaic", 1.0),
        close_mosaic=train_cfg.get("close_mosaic", 10),
        lr0=train_cfg.get("lr0", 0.01),
        project=train_cfg.get("project", "runs"),
        name=args.name,
    )
    print("[train] done. Best weights: runs/%s/weights/best.pt" % args.name)


if __name__ == "__main__":
    main()
