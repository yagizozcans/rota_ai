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
