#!/usr/bin/env python3
"""Evaluate a trained model → precision/recall/mAP report.

This report is a deliverable, not just a dev check: docs/02-ai-pipeline.md §3/§8
call it the sales/accuracy artifact for Phase 0. Writes JSON + Markdown.

Usage:
    python scripts/evaluate.py --weights runs/rotaai_signs_v0/weights/best.pt
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from rotaai_ai import config  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate RotaAI asset detector")
    parser.add_argument("--weights", required=True, help="path to trained .pt")
    parser.add_argument("--data", default=str(config.CONFIGS_DIR / "data.yaml"))
    parser.add_argument("--device", default=None)
    parser.add_argument("--out", default="reports")
    args = parser.parse_args()

    from ultralytics import YOLO

    model = YOLO(args.weights)
    metrics = model.val(data=args.data, device=args.device, verbose=False)

    box = metrics.box
    data_cfg = config.load_data_config(args.data)
    names = data_cfg.get("names", {})

    # Per-class mAP50 where available.
    per_class = {}
    try:
        for i, ap in enumerate(box.maps):  # box.maps: mAP50-95 per class
            per_class[str(names.get(i, i))] = round(float(ap), 4)
    except Exception:
        pass

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "weights": args.weights,
        "data": args.data,
        "num_classes": len(names),
        "metrics": {
            "precision": round(float(box.mp), 4),      # mean precision
            "recall": round(float(box.mr), 4),         # mean recall
            "mAP50": round(float(box.map50), 4),
            "mAP50_95": round(float(box.map), 4),
        },
        "per_class_mAP50_95": per_class,
    }

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    (out_dir / f"accuracy-{stamp}.json").write_text(json.dumps(report, indent=2))

    md = [
        f"# RotaAI Doğruluk Raporu — {stamp}",
        "",
        f"- Ağırlıklar: `{args.weights}`",
        f"- Veri: `{args.data}` ({report['num_classes']} sınıf)",
        "",
        "| Metrik | Değer |",
        "|--------|-------|",
        f"| Precision | {report['metrics']['precision']} |",
        f"| Recall | {report['metrics']['recall']} |",
        f"| mAP@50 | {report['metrics']['mAP50']} |",
        f"| mAP@50-95 | {report['metrics']['mAP50_95']} |",
    ]
    if per_class:
        md += ["", "## Sınıf bazında mAP@50-95", "", "| Sınıf | mAP |", "|-------|-----|"]
        md += [f"| {k} | {v} |" for k, v in per_class.items()]
    (out_dir / f"accuracy-{stamp}.md").write_text("\n".join(md))

    print(json.dumps(report["metrics"], indent=2))
    print(f"[evaluate] report written to {out_dir}/accuracy-{stamp}.(json|md)")


if __name__ == "__main__":
    main()
