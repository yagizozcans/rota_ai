"""Image storage abstraction (docs/03-backend-api.md §2, docs/06-infra-devops.md §3).

MVP: local filesystem on a shared volume (api writes, worker reads). The interface
is deliberately S3-shaped (save/path/read by key) so a Cloudflare R2 / Backblaze B2
backend drops in later without touching callers.
"""

from __future__ import annotations

from pathlib import Path

from .config import settings


class LocalStorage:
    def __init__(self, base_dir: str) -> None:
        self.base = Path(base_dir)
        # Best-effort at construction; save() guarantees the dir exists per-write.
        # Never raise here — this runs at import time (routers import storage).
        try:
            self.base.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass

    def save(self, key: str, data: bytes) -> str:
        dst = self.base / key
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
        return key

    def path(self, key: str) -> str:
        return str(self.base / key)

    def read(self, key: str) -> bytes:
        return (self.base / key).read_bytes()


storage = LocalStorage(settings.storage_dir)
