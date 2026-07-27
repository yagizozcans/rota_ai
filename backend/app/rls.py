"""Row-Level Security tenant context (docs/04 §4, docs/06 §3).

Postgres RLS filters every tenant table by a per-transaction setting,
`app.current_org` (see db/init/01_schema.sql). This module carries the caller's
org on the SQLAlchemy Session itself — `session.info["org_id"]` — and re-applies
it to the DB via `set_config(..., is_local=true)` on every transaction begin.

Why `session.info` and not a ContextVar: FastAPI runs sync endpoints and their
dependencies in a threadpool, and contextvar writes made in a dependency do not
reliably propagate to the endpoint's DB calls. `session.info` travels with the
Session object regardless of thread, so the org set when the session is created
is exactly the org RLS sees. `is_local=true` scopes the setting to the current
transaction, so it is re-applied after each commit and never leaks across pooled
connections.

Set the org with `set_session_org(db, org_id)` (or `SessionLocal` + info dict);
a session with no org sets nothing, so RLS sees NULL and returns zero rows.
"""

from __future__ import annotations

import uuid

from sqlalchemy import event, text
from sqlalchemy.orm import Session as OrmSession

from .db import SessionLocal


def set_session_org(db: OrmSession, org_id: uuid.UUID | str) -> None:
    """Bind a session to a tenant so its every transaction is org-scoped."""
    db.info["org_id"] = str(org_id)


@event.listens_for(SessionLocal, "after_begin")
def _apply_tenant(session: OrmSession, transaction, connection) -> None:
    """Re-apply the session's tenant to Postgres at each transaction begin."""
    org = session.info.get("org_id")
    if org is not None:
        connection.execute(
            text("SELECT set_config('app.current_org', :org, true)"),
            {"org": org},
        )
