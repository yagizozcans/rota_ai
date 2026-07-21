"""Auth endpoints (docs/03-backend-api.md §4).

Pilot-grade token issuer (plan Q7): there is no user store yet, so this issues a
long-lived JWT for a provisioned org/device. Real credential login + rotation is
a Faz-3 follow-up.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..auth import create_token
from ..schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest) -> TokenResponse:
    token = create_token(body.org_id, body.device_id, body.role or "saha_kullanici")
    return TokenResponse(token=token)
