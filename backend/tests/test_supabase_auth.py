import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from app.services.supabase_auth import (
    AuthenticatedSupabaseUser,
    SupabaseAuthError,
    verify_bearer_token,
)


class _FakeResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def read(self) -> bytes:
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class SupabaseAuthTests(unittest.TestCase):
    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
        },
        clear=False,
    )
    @patch("app.services.supabase_auth.urlopen")
    def test_verify_bearer_token_returns_authenticated_user(self, mock_urlopen) -> None:
        mock_urlopen.return_value = _FakeResponse(
            {
                "id": "0f4a2e84-43d3-4d4a-b4cf-65ce1f385c94",
                "email": "USER@EXAMPLE.COM",
            }
        )

        user = verify_bearer_token("Bearer test-token")

        self.assertEqual(
            user,
            AuthenticatedSupabaseUser(
                id="0f4a2e84-43d3-4d4a-b4cf-65ce1f385c94",
                email="user@example.com",
            ),
        )
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://example.supabase.co/auth/v1/user")
        self.assertEqual(request.headers["Authorization"], "Bearer test-token")
        self.assertEqual(request.headers["Apikey"], "sb_publishable_test")

    def test_verify_bearer_token_rejects_missing_bearer_token(self) -> None:
        with self.assertRaises(SupabaseAuthError) as error:
            verify_bearer_token(None)

        self.assertEqual(error.exception.status_code, 401)
        self.assertEqual(error.exception.detail, "Authentication required.")

    @patch.dict("os.environ", {}, clear=True)
    def test_verify_bearer_token_requires_backend_supabase_config(self) -> None:
        with self.assertRaises(SupabaseAuthError) as error:
            verify_bearer_token("Bearer test-token")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("not configured", error.exception.detail)

    @patch.dict(
        "os.environ",
        {
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
        },
        clear=False,
    )
    @patch("app.services.supabase_auth.urlopen")
    def test_verify_bearer_token_rejects_invalid_token(self, mock_urlopen) -> None:
        mock_urlopen.side_effect = HTTPError(
            url="https://example.supabase.co/auth/v1/user",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=None,
        )

        with self.assertRaises(SupabaseAuthError) as error:
            verify_bearer_token("Bearer bad-token")

        self.assertEqual(error.exception.status_code, 401)
        self.assertEqual(error.exception.detail, "Authentication required.")
