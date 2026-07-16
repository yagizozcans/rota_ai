#!/usr/bin/env python3
"""Run detection on image(s) → Detection[] JSON (docs/00-overview.md §4.2).

This is the MANUAL TEST entry point and, crucially, it exercises the exact same
`rotaai_ai.detect` code the backend will call later — so a green run here means
the product path is validated too.

Usage:
    python scripts/predict.py --source path/to/image.jpg
    python scripts/predict.py --source path/to/folder --weights runs/.../best.pt
    python scripts/predict.py --source img.jpg --save-viz   # also draw boxes
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rotaai_ai import config  # noqa: E402
from rotaai_ai.detect import detect_image, load_model  # noqa: E402

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def gather_images(source: Path) -> list[Path]:
    if source.is_file():
        return [source]
    return sorted(p for p in source.rglob("*") if p.suffix.lower() in IMAGE_EXTS)


def main() -> None:
    train_cfg = config.load_train_config()
    parser = argparse.ArgumentParser(description="Detect road assets → Detection[] JSON")
    parser.add_argument("--source", required=True, help="image file or folder")
    parser.add_argument("--weights", default=train_cfg.get("model", "yolo26s.pt"))
    parser.add_argument("--conf", type=float, default=0.4)  # docs/02 §4 default
    parser.add_argument("--model-version", default=train_cfg.get("model_version", "v0.1-bootstrap"))
    parser.add_argument("--out", default=None, help="write JSON here (default: stdout)")
    parser.add_argument("--save-viz", action="store_true", help="save annotated images")
    args = parser.parse_args()

    weights = config.resolve_model(args.weights)
    model = load_model(weights)

    images = gather_images(Path(args.source))
    if not images:
        sys.exit(f"No images found under {args.source}")

    frames_out = []
    for img in images:
        frame_id = str(uuid.uuid4())
        dets = detect_image(
            model, img, frame_id=frame_id, conf=args.conf, model_version=args.model_version
        )
        frames_out.append(
            {"image": str(img), "frame_id": frame_id, "detections": [d.to_dict() for d in dets]}
        )
        if args.save_viz:
            model.predict(source=str(img), conf=args.conf, save=True, verbose=False)

    payload = json.dumps(frames_out, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(payload, encoding="utf-8")
        n = sum(len(f["detections"]) for f in frames_out)
        print(f"[predict] {len(images)} image(s), {n} detection(s) -> {args.out}")
    else:
        print(payload)


if __name__ == "__main__":
    main()
