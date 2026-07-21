"""JWT auth (docs/03-backend-api.md §4/§6, plan Q7).

The token is the authority for org_id (§4.5): routers derive the tenant from the
decoded token here, never from client-supplied request fields.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Header, HTTPException

from .config import settings


@dataclass
class Identity:
    org_id: uuid.UUID
    device_id: str
    role: str


def create_token(org_id: uuid.UUID, device_id: str, role: str = "saha_kullanici") -> str:
    """Issue a JWT carrying the tenant/device identity (docs/00-overview §4.1)."""
    payload = {"org_id": str(org_id), "device_id": device_id, "role": role}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def require_identity(authorization: str | None = Header(default=None)) -> Identity:
    """FastAPI dependency: verify the Bearer token and return the caller's identity."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return Identity(
            org_id=uuid.UUID(claims["org_id"]),
            device_id=claims.get("device_id", ""),
            role=claims.get("role", "saha_kullanici"),
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc
