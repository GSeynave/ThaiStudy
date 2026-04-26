from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class AuthenticatedSupabaseUser:
    id: str
    email: str | None = None


class SupabaseAuthError(Exception):
    def __init__(self, detail: str, status_code: int = 401) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def verify_bearer_token(authorization_header: str | None) -> AuthenticatedSupabaseUser:
    token = _extract_bearer_token(authorization_header)
    if not token:
        raise SupabaseAuthError("Authentication required.")

    supabase_url = _get_supabase_url()
    publishable_key = _get_supabase_publishable_key()

    if not supabase_url or not publishable_key:
        raise SupabaseAuthError(
            "Supabase auth validation is not configured on the backend.",
            status_code=503,
        )

    user_payload = _fetch_supabase_user(supabase_url, publishable_key, token)
    user_id = str(user_payload.get("id") or "").strip()
    if not user_id:
        raise SupabaseAuthError("Authenticated user payload is missing an id.", status_code=502)

    email = user_payload.get("email")
    normalized_email = str(email).strip().lower() if isinstance(email, str) and email.strip() else None

    return AuthenticatedSupabaseUser(id=user_id, email=normalized_email)


def _extract_bearer_token(authorization_header: str | None) -> str | None:
    raw_value = (authorization_header or "").strip()
    if not raw_value:
        return None

    scheme, _, token = raw_value.partition(" ")
    if scheme.lower() != "bearer":
        return None

    normalized_token = token.strip()
    return normalized_token or None


def _get_supabase_url() -> str | None:
    return _first_config_value("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")


def _get_supabase_publishable_key() -> str | None:
    return _first_config_value(
        "SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    )


def _first_config_value(*names: str) -> str | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def _fetch_supabase_user(
    supabase_url: str,
    publishable_key: str,
    access_token: str,
) -> dict[str, Any]:
    endpoint = f"{supabase_url.rstrip('/')}/auth/v1/user"
    request = Request(
        endpoint,
        headers={
            "apikey": publishable_key,
            "Authorization": f"Bearer {access_token}",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        if error.code in {401, 403}:
            raise SupabaseAuthError("Authentication required.") from error
        raise SupabaseAuthError(
            "Could not validate the Supabase access token.",
            status_code=502,
        ) from error
    except (URLError, TimeoutError, json.JSONDecodeError) as error:
        raise SupabaseAuthError(
            "Could not reach Supabase auth to validate the access token.",
            status_code=502,
        ) from error

    if not isinstance(payload, dict):
        raise SupabaseAuthError(
            "Supabase auth returned an unexpected user payload.",
            status_code=502,
        )

    return payload
