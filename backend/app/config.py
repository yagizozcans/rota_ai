"""Runtime settings (docs/03-backend-api.md, docs/06-infra-devops.md).

Everything is env-driven so the same image runs the API and the worker, and so
the real model "slots in" by setting WEIGHTS_PATH — nothing else changes.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # protected_namespaces=() so we could use model_* names; we avoid them anyway.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=())

    # Infra
    database_url: str = "postgresql+psycopg2://rotaai:rotaai@db:5432/rotaai"
    redis_url: str = "redis://redis:6379/0"
    storage_dir: str = "/data/images"          # shared volume between api + worker

    # Model seam (docs/02-ai-pipeline.md). When weights_path is set AND the
    # rotaai_ai package is importable, the real YOLO26 model runs; otherwise the
    # worker uses a deterministic stub so the vertical slice stays alive.
    weights_path: str | None = None            # e.g. /models/best.pt
    detect_conf: float = 0.4                   # docs/02 §4 default threshold
    detector_version: str = "stub-0"           # stamped onto detections when stubbing

    # Auth (docs/03-backend-api.md §4/§6, plan Q7). Pilot uses long-lived JWTs
    # signed with this secret; set a strong value via env in production.
    jwt_secret: str = "dev-insecure-secret-change-me-in-production-0123456789"
    jwt_algorithm: str = "HS256"


settings = Settings()
