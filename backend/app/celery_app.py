"""Celery application (docs/03-backend-api.md §2, §5).

Redis is broker + result backend. Tasks are imported for registration at the end.
"""

from __future__ import annotations

from celery import Celery

from .config import settings

celery_app = Celery("rotaai", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,          # redeliver if a worker dies mid-task
    worker_prefetch_multiplier=1,  # heavy AI task → fair dispatch
)

# Register tasks (import for side effects). Kept last to avoid circular imports.
from . import tasks  # noqa: E402,F401
