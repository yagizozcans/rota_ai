"""Asset class taxonomy exposed to the review console's correction dropdown.

Mirrors ai-pipeline/src/rotaai_ai/taxonomy.py ASSET_CLASSES. Duplicated (not
imported) on purpose: the api image deliberately stays free of the ai-pipeline/
ultralytics dependency (only the worker installs it, see Dockerfile.worker) so
the API stays lightweight. Keep this list in sync by hand for now — revisit if
it drifts often enough to be worth a shared package.
"""

from __future__ import annotations

ASSET_CLASSES: list[str] = [
    "sign_warning",
    "sign_prohibitory",
    "sign_mandatory",
    "sign_information",
    "barrier",
    "guardrail",
    "light_pole",
    "road_marking",
    "traffic_signal",
]
