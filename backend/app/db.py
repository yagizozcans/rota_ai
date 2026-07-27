"""Database engine / session factory (PostgreSQL + PostGIS — docs/04-gis-data.md)."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    """FastAPI dependency — yields a session, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Registers the RLS after_begin listener on SessionLocal (tenant isolation).
# Imported here so any process that uses the DB (API + Celery worker) wires it up
# by importing app.db, without each caller having to remember. Must come after
# SessionLocal is defined. See app/rls.py.
from . import rls  # noqa: E402,F401
