from __future__ import annotations

from contextlib import closing

from app.models import AppUserAccountResponse
from app.services.study_history import _connect, _db_backend, _execute, normalize_user_id, utc_timestamp


def sync_app_user_account(user_id: str, email: str | None = None) -> AppUserAccountResponse:
    normalized_user_id = normalize_user_id(user_id)
    normalized_email = (email or "").strip().lower() or None
    timestamp = utc_timestamp()

    with closing(_connect()) as connection:
        backend = _db_backend()
        if backend == "postgres":
            _execute(
                connection,
                """
                INSERT INTO app_users (
                  id,
                  email,
                  created_at,
                  updated_at,
                  last_seen_at,
                  deletion_requested_at,
                  data_purged_at
                )
                VALUES (?, ?, ?, ?, ?, NULL, NULL)
                ON CONFLICT(id) DO UPDATE SET
                  email = COALESCE(excluded.email, app_users.email),
                  updated_at = excluded.updated_at,
                  last_seen_at = excluded.last_seen_at
                """,
                (
                    normalized_user_id,
                    normalized_email,
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )
        else:
            _execute(
                connection,
                """
                INSERT INTO app_users (
                  id,
                  email,
                  created_at,
                  updated_at,
                  last_seen_at,
                  deletion_requested_at,
                  data_purged_at
                )
                VALUES (?, ?, ?, ?, ?, NULL, NULL)
                ON CONFLICT(id) DO UPDATE SET
                  email = COALESCE(excluded.email, app_users.email),
                  updated_at = excluded.updated_at,
                  last_seen_at = excluded.last_seen_at
                """,
                (
                    normalized_user_id,
                    normalized_email,
                    timestamp,
                    timestamp,
                    timestamp,
                ),
            )
        connection.commit()

        row = _execute(
            connection,
            """
            SELECT
              id,
              email,
              created_at,
              updated_at,
              last_seen_at,
              deletion_requested_at,
              data_purged_at
            FROM app_users
            WHERE id = ?
            """,
            (normalized_user_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError(f"Missing app user account for '{normalized_user_id}'.")

    return _map_app_user_row(row)


def get_app_user_account(user_id: str) -> AppUserAccountResponse | None:
    normalized_user_id = normalize_user_id(user_id)

    with closing(_connect()) as connection:
        row = _execute(
            connection,
            """
            SELECT
              id,
              email,
              created_at,
              updated_at,
              last_seen_at,
              deletion_requested_at,
              data_purged_at
            FROM app_users
            WHERE id = ?
            """,
            (normalized_user_id,),
        ).fetchone()

    if row is None:
        return None

    return _map_app_user_row(row)


def purge_app_user_data(user_id: str, email: str | None = None) -> AppUserAccountResponse:
    normalized_user_id = normalize_user_id(user_id)
    sync_app_user_account(normalized_user_id, email)
    timestamp = utc_timestamp()

    with closing(_connect()) as connection:
        _execute(connection, "DELETE FROM user_anki_exports WHERE user_id = ?", (normalized_user_id,))
        _execute(connection, "DELETE FROM user_video_word_activity WHERE user_id = ?", (normalized_user_id,))
        _execute(connection, "DELETE FROM user_word_activity WHERE user_id = ?", (normalized_user_id,))
        _execute(connection, "DELETE FROM user_video_activity WHERE user_id = ?", (normalized_user_id,))
        _execute(connection, "DELETE FROM user_preferences WHERE user_id = ?", (normalized_user_id,))
        _execute(connection, "DELETE FROM user_plan_state WHERE user_id = ?", (normalized_user_id,))
        _execute(
            connection,
            """
            UPDATE app_users
            SET
              deletion_requested_at = COALESCE(deletion_requested_at, ?),
              data_purged_at = ?,
              updated_at = ?
            WHERE id = ?
            """,
            (timestamp, timestamp, timestamp, normalized_user_id),
        )
        connection.commit()

        row = _execute(
            connection,
            """
            SELECT
              id,
              email,
              created_at,
              updated_at,
              last_seen_at,
              deletion_requested_at,
              data_purged_at
            FROM app_users
            WHERE id = ?
            """,
            (normalized_user_id,),
        ).fetchone()

    if row is None:
        raise RuntimeError(f"Missing app user account for '{normalized_user_id}'.")

    return _map_app_user_row(row)


def _map_app_user_row(row: object) -> AppUserAccountResponse:
    return AppUserAccountResponse(
        id=str(row["id"]),
        email=row["email"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
        lastSeenAt=row["last_seen_at"],
        deletionRequestedAt=row["deletion_requested_at"],
        dataPurgedAt=row["data_purged_at"],
    )
