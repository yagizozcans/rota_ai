# RotaAI — AI Pipeline (Layer 02)

Road-**asset** detection (traffic signs, barriers, poles, markings, signals).
The core value engine of the MVP. PRD: [`../docs/02-ai-pipeline.md`](../docs/02-ai-pipeline.md).

> Damage detection (potholes/cracks) is **out of MVP** — optional module,
> [`../docs/07-damage-module.md`](../docs/07-damage-module.md).

## What this is (and isn't)

This is the **Phase 0** pipeline: train a YOLO26-small baseline, run it on test
images, and produce a precision/recall/mAP accuracy report — all driven manually
from the CLI. It is built so the same inference code (`src/rotaai_ai/detect.py`)
is later imported by the backend Celery worker with zero changes — that is the
"manual → automated product" path ([`../docs/03-backend-api.md`](../docs/03-backend-api.md) §5).

```
scripts/convert_datasets.py  public sets (TT-100K, GTSDB) → unified 1-class YOLO
scripts/prepare_data.py      validate a YOLO dataset
scripts/train.py             train (cloud GPU) → runs/<name>/weights/best.pt
scripts/evaluate.py          best.pt → reports/accuracy-*.md   (the sales artifact)
scripts/predict.py           detection on images → Detection[] JSON  (manual test)

src/rotaai_ai/detect.py      CORE inference (reused by the backend later)
src/rotaai_ai/schema.py      Detection contract — matches docs/00-overview.md §4.2
src/rotaai_ai/taxonomy.py    KGM asset class vocabulary
configs/data_pretrain.yaml   Stage 1: generic sign-ness (1 class)
configs/data_finetune.yaml   Stage 2: real KGM taxonomy (~25 classes)
configs/train.yaml           hyperparameters
```

## Setup (local, for inference + smoke tests)

Training runs on a **cloud GPU** (see below); locally you only need enough to run
`predict.py` and validate plumbing.

> ⚠️ This repo lives on an external drive (T7Shield) that is **not APFS** and
> cannot host a Python venv (hardlink / `._` sidecar errors). Put the venv on the
> **local disk** and install from there:

```bash
cd ai-pipeline
uv venv /Users/yagizozcan/.venvs/rotaai-ai --python 3.11
source /Users/yagizozcan/.venvs/rotaai-ai/bin/activate
uv pip install --python /Users/yagizozcan/.venvs/rotaai-ai -e .
```

Quick smoke test with the stock COCO model (no training needed — proves the
Detection contract end to end):

```bash
python scripts/predict.py --source <any.jpg> --weights yolo26s.pt
```

You'll get `Detection[]` JSON (COCO classes for now — real sign classes come
after training).

## Training — two-stage strategy (cloud GPU: Colab / RunPod)

Model gets specialized to Turkey in three steps (docs/02-ai-pipeline.md §3):

### Stage 1 — Pre-train a generic "sign-ness" detector
Public **real-street** detection data → learn what a sign is and how it sits in a
scene. All classes collapsed to one (`traffic_sign`) so incompatible per-dataset
taxonomies don't matter. Sources: **TT-100K + GTSDB**. (~2–3 days GPU.)

> **First-MVP fast path — GTSDB only.** For the very first proof, skip TT-100K and
> use just GTSDB's ~600 labeled training images (auto-split ~85/15). Small, downloads
> in minutes, trains in ~30–60 min on one GPU. Produces a real `best.pt` + accuracy
> number to plug into the backend. It's a demo model (German signs, single class),
> not production Turkish — that comes at Stage 2 fine-tuning. Commands: run the
> `gtsdb` convert + a single-source `merge` (skip the `tt100k` line) below.

> **GTSRB is intentionally excluded from Stage 1** — it's classification crops
> with no scene boxes, so it can't train a detector. It's reused in Stage 2 as
> source material for synthetic 2D-sign paste augmentation.

```bash
# 1. Convert each source to unified single-class YOLO
python scripts/convert_datasets.py gtsdb  --src <gtsdb_dir>  --out data/converted/gtsdb
python scripts/convert_datasets.py tt100k --src <tt100k_dir> --out data/converted/tt100k
# 2. Merge + train/val split
python scripts/convert_datasets.py merge  --src data/converted/gtsdb data/converted/tt100k \
      --out data/pretrain --val-ratio 0.1
python scripts/prepare_data.py --root data/pretrain --data configs/data_pretrain.yaml
# 3. Pre-train
python scripts/train.py --data configs/data_pretrain.yaml --device 0 --name pretrain_signness
```

### Stage 2 — Fine-tune on the real KGM taxonomy
Turkish field capture + KGM El Kitabı labels (~25 classes, ~150–300 examples each),
plus synthetic paste of 2D manual signs (using GTSRB-style crops) onto road
backgrounds. **Load Stage-1 weights as the base:**

```bash
python scripts/train.py --data configs/data_finetune.yaml \
      --model runs/pretrain_signness/weights/best.pt --name rotaai_kgm_v1
python scripts/evaluate.py --weights runs/rotaai_kgm_v1/weights/best.pt \
      --data configs/data_finetune.yaml
```

### Stage 3 — Active learning from the review console
Rejected/corrected detections (docs/05) → `training_feedback` → periodic retrain.
The model keeps specializing to Turkish conditions.

## The 2D sign PDF's role

The KGM Trafik İşaretleri El Kitabı (Turkish sign PDF) is **flat 2D artwork**, not
street photos — it can't train a detector directly. It feeds Stage 2 two ways:
**(1) taxonomy** (each manual sign = one class in `configs/data_finetune.yaml` /
`src/rotaai_ai/taxonomy.py`), and **(2) synthetic data** (paste signs onto real
road backgrounds with augmentation to bootstrap Turkish classes before large-scale
field capture exists).

## Phase 0 "done"

- [ ] `predict.py` returns valid `Detection[]` JSON (`type: "asset"`).
- [ ] Stage-1 generic detector trained on TT-100K+GTSDB; `evaluate.py` report produced.
- [ ] Stage-2 fine-tune wired via `configs/data_finetune.yaml` (fills in as labeling proceeds).
- [ ] Multiple assets in one image detected separately.
