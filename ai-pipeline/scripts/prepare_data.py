#!/usr/bin/env python3
"""Prepare / validate a YOLO-format dataset (docs/02-ai-pipeline.md §3, §5).

Phase 0 bootstraps with a PUBLIC real-street traffic-sign detection dataset.
Two common sources (pick one, download into data/bootstrap):

  1) Roboflow Universe (already YOLO format, easiest):
       pip install roboflow
       from roboflow import Roboflow
       Rf = Roboflow(api_key="...").workspace("...").project("...")
       Rf.version(1).download("yolov8", location="data/bootstrap")
     Then set configs/data.yaml `names` to match the downloaded data.yaml.

  2) GTSDB (German Traffic Sign Detection Benchmark) — real street, classic;
     needs conversion to YOLO txt (script left as a TODO for the chosen source).

This script does NOT download (sources vary / may need auth). It VALIDATES that
whatever is in data/bootstrap is a well-formed YOLO dataset before you burn GPU
time, and prints a class/instance summary.

Usage:
    python scripts/prepare_data.py --root data/bootstrap
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rotaai_ai import config  # noqa: E402

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def validate_split(root: Path, split: str) -> tuple[int, int, Counter]:
    img_dir = root / "images" / split
    lbl_dir = root / "labels" / split
    if not img_dir.exists():
        return 0, 0, Counter()
    images = [p for p in img_dir.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    class_counts: Counter = Counter()
    missing = 0
    for img in images:
        label = lbl_dir / f"{img.stem}.txt"
        if not label.exists():
            missing += 1
            continue
        for line in label.read_text().splitlines():
            line = line.strip()
            if line:
                class_counts[int(line.split()[0])] += 1
    return len(images), missing, class_counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate a YOLO dataset")
    parser.add_argument("--root", default="data/bootstrap")
    parser.add_argument("--data", default=str(config.CONFIGS_DIR / "data.yaml"))
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        sys.exit(
            f"Dataset root {root} not found. Download a YOLO dataset there first "
            f"(see this file's docstring)."
        )

    names = config.load_data_config(args.data).get("names", {})
    print(f"[prepare] root={root}  classes in data.yaml={len(names)}")
    total = 0
    for split in ("train", "val", "test"):
        n_imgs, missing, counts = validate_split(root, split)
        if n_imgs == 0:
            continue
        total += n_imgs
        named = {names.get(k, k): v for k, v in sorted(counts.items())}
        print(f"  {split:5s}: {n_imgs:5d} images, {missing} missing labels, instances={named}")
    if total == 0:
        sys.exit("No images found. Expected layout: <root>/images/<split> + <root>/labels/<split>")
    print(f"[prepare] OK — {total} images total. Ready for scripts/train.py")


if __name__ == "__main__":
    main()
