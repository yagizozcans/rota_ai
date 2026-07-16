"""Road-asset class taxonomy (docs/00-overview.md §4.4, docs/02-ai-pipeline.md §3).

MVP core = assets. Damage classes (docs/07) are listed for completeness but are
out of MVP scope. The KGM sign sub-types (`sign_*`) are seeded here as a starting
point and will be expanded from the KGM Trafik İşaretleri El Kitabı (the Turkish
sign-manual PDF): each 2D sign in that manual maps to one class name below.

IMPORTANT: the actual training class list lives in configs/data.yaml (single
source of truth for a given model). This module is the human-readable master
vocabulary that data.yaml is derived from.
"""

from __future__ import annotations

# Top-level asset groups. Fine-grained sign sub-types get appended as sign_<code>.
ASSET_CLASSES: list[str] = [
    # Traffic signs — grouped by KGM manual families (expand with sub-types).
    "sign_warning",       # tehlike uyarı işaretleri (T-*)
    "sign_prohibitory",   # trafik tanzim / yasaklama (TT-*)
    "sign_mandatory",     # mecburiyet
    "sign_information",   # bilgi / yönlendirme (B-*)
    # Furniture / structures
    "barrier",            # bariyer
    "guardrail",          # otokorkuluk
    "light_pole",         # aydınlatma direği
    "road_marking",       # yatay işaretleme
    "traffic_signal",     # trafik ışığı
]

# Optional module (docs/07-damage-module.md) — NOT trained in MVP.
DAMAGE_CLASSES: list[str] = [
    "pothole",
    "crack_longitudinal",
    "crack_transverse",
    "crack_alligator",
    "edge_deterioration",
    "rutting",
]


def asset_class_index() -> dict[int, str]:
    return {i: name for i, name in enumerate(ASSET_CLASSES)}
