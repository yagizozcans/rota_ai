"""Shared FastAPI dependencies.

`get_tenant_db` is the tenant-scoped DB session used by every router that touches
tenant tables: it requires a valid token and binds the session to the token's
org so Row-Level Security (app/rls.py) filters all queries to that tenant. Use
this instead of `get_db` for any endpoint that reads or writes tenant data.
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session as DbSession

from .auth import Identity, require_identity
from .db import SessionLocal
from .rls import set_session_org


def get_tenant_db(identity: Identity = Depends(require_identity)) -> DbSession:
    """Yield a DB session bound to the caller's org (from the JWT — §4.5)."""
    db = SessionLocal()
    set_session_org(db, identity.org_id)
    try:
        yield db
    finally:
        db.close()
