#!/usr/bin/env python3
"""Convert public sign datasets → unified single-class YOLO for Stage-1 pretraining.

Strategy (docs/02-ai-pipeline.md §3): learn generic "sign-ness" from real street
scenes. All boxes collapse to class 0 = traffic_sign. The real KGM taxonomy is
introduced later at fine-tuning (configs/data_finetune.yaml).

Detection sources supported:
  - gtsdb   : German Traffic Sign Detection Benchmark (.ppm + gt.txt)
  - tt100k  : Tsinghua-Tencent 100K (annotations.json + train/test/other jpgs)
NOT here: GTSRB (classification crops, no scene boxes) → used in Stage-2 synthetic
augmentation instead.

Pipeline:
  python scripts/convert_datasets.py gtsdb  --src <gtsdb_dir>  --out data/converted/gtsdb
  python scripts/convert_datasets.py tt100k --src <tt100k_dir> --out data/converted/tt100k
  python scripts/convert_datasets.py merge  --src data/converted/gtsdb data/converted/tt100k \
        --out data/pretrain --val-ratio 0.1

Each converter writes a FLAT  <out>/images/*.jpg + <out>/labels/*.txt  (no split);
`merge` combines sources and makes the train/val split expected by data_pretrain.yaml.

NOTE: written against the datasets' documented formats but NOT yet run on a real
download — validate counts with scripts/prepare_data.py after merging.
"""

from __future__ import annotations

import argparse
import json
import random
import shutil
from pathlib import Path

from PIL import Image

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".ppm", ".bmp"}


def _write_label(label_path: Path, boxes_xyxy: list[tuple[float, float, float, float]],
                 w: int, h: int) -> None:
    """Write YOLO labels (all class 0), converting pixel xyxy → normalized cxcywh."""
    lines = []
    for x1, y1, x2, y2 in boxes_xyxy:
        cx = ((x1 + x2) / 2) / w
        cy = ((y1 + y2) / 2) / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        if bw <= 0 or bh <= 0:
            continue
        lines.append(f"0 {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
    label_path.write_text("\n".join(lines))


def _save_jpg(src_img: Path, dst_img: Path) -> tuple[int, int]:
    """Copy/convert an image to jpg; return (width, height)."""
    with Image.open(src_img) as im:
        w, h = im.size
        if src_img.suffix.lower() in {".jpg", ".jpeg"}:
            shutil.copy2(src_img, dst_img)
        else:
            im.convert("RGB").save(dst_img, "JPEG", quality=92)
    return w, h


def convert_gtsdb(src: Path, out: Path) -> int:
    """GTSDB: gt.txt lines 'file.ppm;x1;y1;x2;y2;classId' (no line = no sign)."""
    gt = src / "gt.txt"
    if not gt.exists():
        raise SystemExit(f"gt.txt not found in {src}")
    boxes_by_img: dict[str, list[tuple[float, float, float, float]]] = {}
    for line in gt.read_text().splitlines():
        parts = line.strip().split(";")
        if len(parts) < 6:
            continue
        fname, x1, y1, x2, y2 = parts[0], *map(float, parts[1:5])
        boxes_by_img.setdefault(fname, []).append((x1, y1, x2, y2))

    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    n = 0
    # Include ALL images (even sign-free ones = useful negatives) if present.
    for img in sorted(src.glob("*.ppm")):
        stem = img.stem
        dst_img = out / "images" / f"gtsdb_{stem}.jpg"
        w, h = _save_jpg(img, dst_img)
        _write_label(out / "labels" / f"gtsdb_{stem}.txt", boxes_by_img.get(img.name, []), w, h)
        n += 1
    print(f"[gtsdb] converted {n} images → {out}")
    return n


def convert_tt100k(src: Path, out: Path) -> int:
    """TT-100K: annotations.json {imgs:{id:{path, objects:[{bbox:{xmin..ymax}}]}}}."""
    ann_path = src / "annotations.json"
    if not ann_path.exists():
        raise SystemExit(f"annotations.json not found in {src}")
    ann = json.loads(ann_path.read_text())
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    n = 0
    for img_id, meta in ann.get("imgs", {}).items():
        rel = meta.get("path")
        objs = meta.get("objects", [])
        if not rel or not objs:
            continue
        src_img = src / rel
        if not src_img.exists():
            continue
        dst_img = out / "images" / f"tt100k_{img_id}.jpg"
        w, h = _save_jpg(src_img, dst_img)
        boxes = [(o["bbox"]["xmin"], o["bbox"]["ymin"], o["bbox"]["xmax"], o["bbox"]["ymax"])
                 for o in objs if "bbox" in o]
        _write_label(out / "labels" / f"tt100k_{img_id}.txt", boxes, w, h)
        n += 1
    print(f"[tt100k] converted {n} images → {out}")
    return n


def merge(srcs: list[Path], out: Path, val_ratio: float, seed: int = 42) -> None:
    random.seed(seed)
    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)
    total = {"train": 0, "val": 0}
    for src in srcs:
        imgs = sorted((src / "images").glob("*.jpg"))
        random.shuffle(imgs)
        n_val = int(len(imgs) * val_ratio)
        for i, img in enumerate(imgs):
            split = "val" if i < n_val else "train"
            label = src / "labels" / f"{img.stem}.txt"
            shutil.copy2(img, out / "images" / split / img.name)
            if label.exists():
                shutil.copy2(label, out / "labels" / split / label.name)
            total[split] += 1
    print(f"[merge] → {out}  train={total['train']} val={total['val']}")
    print("[merge] validate with: python scripts/prepare_data.py --root %s "
          "--data configs/data_pretrain.yaml" % out)


def main() -> None:
    p = argparse.ArgumentParser(description="Convert public sign datasets → YOLO (class 0)")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("gtsdb", "tt100k"):
        sp = sub.add_parser(name)
        sp.add_argument("--src", required=True)
        sp.add_argument("--out", required=True)
    mp = sub.add_parser("merge")
    mp.add_argument("--src", nargs="+", required=True)
    mp.add_argument("--out", default="data/pretrain")
    mp.add_argument("--val-ratio", type=float, default=0.1)
    args = p.parse_args()

    if args.cmd == "gtsdb":
        convert_gtsdb(Path(args.src), Path(args.out))
    elif args.cmd == "tt100k":
        convert_tt100k(Path(args.src), Path(args.out))
    elif args.cmd == "merge":
        merge([Path(s) for s in args.src], Path(args.out), args.val_ratio)


if __name__ == "__main__":
    main()
