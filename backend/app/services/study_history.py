from __future__ import annotations

import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

try:
    from psycopg import connect as pg_connect
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - exercised only when postgres deps are missing
    pg_connect = None
    dict_row = None

from app.models import (
    StudyPlanResponse,
    StudyAnkiExportRequest,
    StudyPreferencesResponse,
    StudyPreferencesUpdateRequest,
    StudyQuotaResponse,
    StudyVideoHistoryEntry,
    StudyVideoHistoryResponse,
    StudyWordActivityResponse,
    StudyWordStatsResponse,
)


DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / ".data" / "study.sqlite3"
LEGACY_LOCAL_USER_ID = "legacy-local"
MONTHLY_FLASHCARD_EXPORT_LIMIT = 20
DBBackend = Literal["sqlite", "postgres"]


def record_video_open(
    user_id: str,
    video_id: str,
    video_title: str | None = None,
) -> StudyVideoHistoryEntry:
    timestamp = utc_timestamp()
    normalized_user_id = normalize_user_id(user_id)
    normalized_video_id = video_id.strip()
    normalized_video_title = (video_title or "").strip() or None
    with closing(_connect()) as connection:
        _execute(
            connection,
            """
            INSERT INTO user_video_activity (
              user_id,
              video_id,
              video_title,
              opened_count,
              total_word_clicks,
              flashcards_created,
              last_opened_at,
              created_at
            )
            VALUES (?, ?, ?, 1, 0, 0, ?, ?)
            ON CONFLICT(user_id, video_id) DO UPDATE SET
              video_title = COALESCE(excluded.video_title, user_video_activity.video_title),
              opened_count = user_video_activity.opened_count + 1,
              last_opened_at = excluded.last_opened_at
            """,
            (
                normalized_user_id,
                normalized_video_id,
                normalized_video_title,
                timestamp,
                timestamp,
            ),
        )
        connection.commit()
        return _get_video_entry(connection, normalized_user_id, normalized_video_id)


def record_word_click(
    user_id: str,
    video_id: str,
    word: str,
    sentence: str,
) -> StudyWordStatsResponse:
    normalized_user_id = normalize_user_id(user_id)
    normalized_video_id = video_id.strip()
    normalized_word = word.strip()
    normalized_sentence = sentence.strip()
    timestamp = utc_timestamp()

    with closing(_connect()) as connection:
        _execute(
            connection,
            """
            INSERT INTO user_video_activity (
              user_id,
              video_id,
              opened_count,
              total_word_clicks,
              flashcards_created,
              last_opened_at,
              created_at
            )
            VALUES (?, ?, 0, 1, 0, ?, ?)
            ON CONFLICT(user_id, video_id) DO UPDATE SET
              total_word_clicks = user_video_activity.total_word_clicks + 1
            """,
            (normalized_user_id, normalized_video_id, timestamp, timestamp),
        )
        _execute(
            connection,
            """
            INSERT INTO user_word_activity (
              user_id,
              word,
              click_count,
              flashcard_count,
              last_clicked_at,
              last_flashcard_at,
              last_sentence
            )
            VALUES (?, ?, 1, 0, ?, NULL, ?)
            ON CONFLICT(user_id, word) DO UPDATE SET
              click_count = user_word_activity.click_count + 1,
              last_clicked_at = excluded.last_clicked_at,
              last_sentence = excluded.last_sentence
            """,
            (
                normalized_user_id,
                normalized_word,
                timestamp,
                normalized_sentence,
            ),
        )
        _execute(
            connection,
            """
            INSERT INTO user_video_word_activity (
              user_id,
              video_id,
              word,
              click_count,
              flashcard_count,
              last_clicked_at,
              last_flashcard_at,
              last_sentence
            )
            VALUES (?, ?, ?, 1, 0, ?, NULL, ?)
            ON CONFLICT(user_id, video_id, word) DO UPDATE SET
              click_count = user_video_word_activity.click_count + 1,
              last_clicked_at = excluded.last_clicked_at,
              last_sentence = excluded.last_sentence
            """,
            (
                normalized_user_id,
                normalized_video_id,
                normalized_word,
                timestamp,
                normalized_sentence,
            ),
        )
        connection.commit()
        return _get_word_stats(
            connection,
            normalized_user_id,
            normalized_word,
            normalized_video_id,
            normalized_sentence,
        )


def record_anki_export(
    user_id: str,
    payload: StudyAnkiExportRequest,
) -> StudyWordStatsResponse:
    normalized_user_id = normalize_user_id(user_id)
    normalized_video_id = payload.videoId.strip()
    normalized_word = payload.word.strip()
    normalized_sentence = payload.sentence.strip()
    timestamp = utc_timestamp()
    backend = _db_backend()

    with closing(_connect()) as connection:
        if backend == "postgres":
            cursor = _execute(
                connection,
                """
                INSERT INTO user_anki_exports (
                  user_id,
                  video_id,
                  word,
                  sentence,
                  note_id,
                  deck_name,
                  model_name,
                  exported_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, video_id, word, sentence) DO NOTHING
                """,
                (
                    normalized_user_id,
                    normalized_video_id,
                    normalized_word,
                    normalized_sentence,
                    payload.noteId,
                    payload.deckName.strip(),
                    payload.modelName.strip(),
                    timestamp,
                ),
            )
        else:
            cursor = _execute(
                connection,
                """
                INSERT OR IGNORE INTO user_anki_exports (
                  user_id,
                  video_id,
                  word,
                  sentence,
                  note_id,
                  deck_name,
                  model_name,
                  exported_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    normalized_user_id,
                    normalized_video_id,
                    normalized_word,
                    normalized_sentence,
                    payload.noteId,
                    payload.deckName.strip(),
                    payload.modelName.strip(),
                    timestamp,
                ),
            )

        inserted = cursor.rowcount > 0

        if inserted:
            _bump_flashcard_counts(
                connection,
                normalized_user_id,
                normalized_video_id,
                normalized_word,
                normalized_sentence,
                timestamp,
            )

        connection.commit()
        return _get_word_stats(
            connection,
            normalized_user_id,
            normalized_word,
            normalized_video_id,
            normalized_sentence,
        )


def get_word_stats(user_id: str, word: str) -> StudyWordStatsResponse:
    with closing(_connect()) as connection:
        return _get_word_stats(connection, normalize_user_id(user_id), word.strip())


def get_video_history(user_id: str, limit: int = 10) -> StudyVideoHistoryResponse:
    normalized_user_id = normalize_user_id(user_id)
    with closing(_connect()) as connection:
        rows = _execute(
            connection,
            """
            SELECT
              v.video_id,
              v.video_title,
              v.opened_count,
              v.total_word_clicks,
              v.flashcards_created,
              v.last_opened_at,
              (
                SELECT COUNT(*)
                FROM user_video_word_activity vw
                WHERE
                  vw.user_id = v.user_id
                  AND vw.video_id = v.video_id
                  AND vw.click_count > 0
              ) AS unique_words_clicked
            FROM user_video_activity v
            WHERE v.user_id = ?
            ORDER BY v.last_opened_at DESC
            LIMIT ?
            """,
            (normalized_user_id, max(1, limit)),
        ).fetchall()

    return StudyVideoHistoryResponse(
        videos=[
            StudyVideoHistoryEntry(
                videoId=row["video_id"],
                videoTitle=row["video_title"],
                openedCount=row["opened_count"],
                totalWordClicks=row["total_word_clicks"],
                flashcardsCreated=row["flashcards_created"],
                uniqueWordsClicked=row["unique_words_clicked"],
                lastOpenedAt=row["last_opened_at"],
            )
            for row in rows
        ]
    )


def list_word_activity(user_id: str, limit: int = 25) -> StudyWordActivityResponse:
    normalized_user_id = normalize_user_id(user_id)
    with closing(_connect()) as connection:
        rows = _execute(
            connection,
            """
            SELECT
              word,
              click_count,
              flashcard_count,
              last_clicked_at,
              last_flashcard_at,
              last_sentence
            FROM user_word_activity
            WHERE user_id = ?
            ORDER BY
              COALESCE(last_flashcard_at, last_clicked_at) DESC,
              click_count DESC,
              word ASC
            LIMIT ?
            """,
            (normalized_user_id, max(1, limit)),
        ).fetchall()

    return StudyWordActivityResponse(words=[_map_word_row(row) for row in rows])


def get_study_quota(user_id: str) -> StudyQuotaResponse:
    normalized_user_id = normalize_user_id(user_id)
    period_start = month_period_start()
    resets_at = next_month_period_start(period_start)

    with closing(_connect()) as connection:
        monthly_limit = _get_monthly_flashcard_limit(connection, normalized_user_id)
        row = _execute(
            connection,
            """
            SELECT COUNT(*) AS used
            FROM user_anki_exports
            WHERE user_id = ? AND exported_at >= ? AND exported_at < ?
            """,
            (
                normalized_user_id,
                period_start.isoformat().replace("+00:00", "Z"),
                resets_at.isoformat().replace("+00:00", "Z"),
            ),
        ).fetchone()

    used = int(row["used"]) if row is not None else 0
    remaining = max(0, monthly_limit - used)

    return StudyQuotaResponse(
        monthlyFlashcardLimit=monthly_limit,
        monthlyFlashcardExportsUsed=used,
        monthlyFlashcardExportsRemaining=remaining,
        resetsAt=resets_at.isoformat().replace("+00:00", "Z"),
        hasReachedMonthlyFlashcardLimit=remaining <= 0,
    )


def get_study_preferences(user_id: str) -> StudyPreferencesResponse:
    normalized_user_id = normalize_user_id(user_id)
    with closing(_connect()) as connection:
        row = _execute(
            connection,
            """
            SELECT
              default_deck_name,
              auto_export_to_anki,
              theme,
              show_tone_colors
            FROM user_preferences
            WHERE user_id = ?
            """,
            (normalized_user_id,),
        ).fetchone()

    if row is None:
        return StudyPreferencesResponse(
            defaultDeck=None,
            autoExportToAnki=False,
            theme="cozy",
            showToneColors=False,
            hasStoredPreferences=False,
        )

    return StudyPreferencesResponse(
        defaultDeck=row["default_deck_name"],
        autoExportToAnki=_coerce_bool(row["auto_export_to_anki"]),
        theme=row["theme"],
        showToneColors=_coerce_bool(row["show_tone_colors"]),
        hasStoredPreferences=True,
    )


def update_study_preferences(
    user_id: str,
    payload: StudyPreferencesUpdateRequest,
) -> StudyPreferencesResponse:
    normalized_user_id = normalize_user_id(user_id)
    default_deck = (payload.defaultDeck or "").strip() or None
    timestamp = utc_timestamp()

    with closing(_connect()) as connection:
        _execute(
            connection,
            """
            INSERT INTO user_preferences (
              user_id,
              default_deck_name,
              auto_export_to_anki,
              theme,
              show_tone_colors,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              default_deck_name = excluded.default_deck_name,
              auto_export_to_anki = excluded.auto_export_to_anki,
              theme = excluded.theme,
              show_tone_colors = excluded.show_tone_colors,
              updated_at = excluded.updated_at
            """,
            (
                normalized_user_id,
                default_deck,
                payload.autoExportToAnki,
                payload.theme,
                payload.showToneColors,
                timestamp,
            ),
        )
        connection.commit()

    return StudyPreferencesResponse(
        defaultDeck=default_deck,
        autoExportToAnki=payload.autoExportToAnki,
        theme=payload.theme,
        showToneColors=payload.showToneColors,
        hasStoredPreferences=True,
    )


def get_study_plan(user_id: str) -> StudyPlanResponse:
    normalized_user_id = normalize_user_id(user_id)
    with closing(_connect()) as connection:
        row = _execute(
            connection,
            """
            SELECT
              plan_tier,
              plan_status,
              monthly_flashcard_limit,
              current_period_starts_at,
              current_period_ends_at
            FROM user_plan_state
            WHERE user_id = ?
            """,
            (normalized_user_id,),
        ).fetchone()

    if row is None:
        return StudyPlanResponse(
            planTier="free",
            planStatus="active",
            monthlyFlashcardLimit=MONTHLY_FLASHCARD_EXPORT_LIMIT,
            currentPeriodStartsAt=None,
            currentPeriodEndsAt=None,
        )

    return StudyPlanResponse(
        planTier=row["plan_tier"],
        planStatus=row["plan_status"],
        monthlyFlashcardLimit=int(row["monthly_flashcard_limit"]),
        currentPeriodStartsAt=row["current_period_starts_at"],
        currentPeriodEndsAt=row["current_period_ends_at"],
    )


def normalize_user_id(user_id: str) -> str:
    normalized = user_id.strip()
    if not normalized:
        raise ValueError("Missing user identifier.")
    return normalized


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def month_period_start(now: datetime | None = None) -> datetime:
    resolved_now = now or datetime.now(timezone.utc)
    return resolved_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_month_period_start(period_start: datetime) -> datetime:
    if period_start.month == 12:
        return period_start.replace(year=period_start.year + 1, month=1)
    return period_start.replace(month=period_start.month + 1)


def _get_word_stats(
    connection: Any,
    user_id: str,
    word: str,
    video_id: str | None = None,
    sentence: str | None = None,
) -> StudyWordStatsResponse:
    row = _execute(
        connection,
        """
        SELECT
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        FROM user_word_activity
        WHERE user_id = ? AND word = ?
        """,
        (user_id, word),
    ).fetchone()

    if row is None:
        return StudyWordStatsResponse(
            word=word,
            clickCount=0,
            flashcardCount=0,
            lastClickedAt=None,
            lastFlashcardAt=None,
            lastSentence=None,
        )

    export_row = None
    if video_id is not None and sentence is not None:
        export_row = _execute(
            connection,
            """
            SELECT
              note_id,
              deck_name,
              model_name,
              exported_at
            FROM user_anki_exports
            WHERE user_id = ? AND video_id = ? AND word = ? AND sentence = ?
            """,
            (user_id, video_id, word, sentence),
        ).fetchone()

    return _map_word_row(row, export_row)


def _get_video_entry(
    connection: Any,
    user_id: str,
    video_id: str,
) -> StudyVideoHistoryEntry:
    row = _execute(
        connection,
        """
        SELECT
          v.video_id,
          v.video_title,
          v.opened_count,
          v.total_word_clicks,
          v.flashcards_created,
          v.last_opened_at,
          (
            SELECT COUNT(*)
            FROM user_video_word_activity vw
            WHERE
              vw.user_id = v.user_id
              AND vw.video_id = v.video_id
              AND vw.click_count > 0
          ) AS unique_words_clicked
        FROM user_video_activity v
        WHERE v.user_id = ? AND v.video_id = ?
        """,
        (user_id, video_id),
    ).fetchone()

    if row is None:
        raise RuntimeError(f"Missing study history entry for video '{video_id}'.")

    return StudyVideoHistoryEntry(
        videoId=row["video_id"],
        videoTitle=row["video_title"],
        openedCount=row["opened_count"],
        totalWordClicks=row["total_word_clicks"],
        flashcardsCreated=row["flashcards_created"],
        uniqueWordsClicked=row["unique_words_clicked"],
        lastOpenedAt=row["last_opened_at"],
    )


def _map_word_row(
    row: Any,
    export_row: Any | None = None,
) -> StudyWordStatsResponse:
    return StudyWordStatsResponse(
        word=row["word"],
        clickCount=row["click_count"],
        flashcardCount=row["flashcard_count"],
        lastClickedAt=row["last_clicked_at"],
        lastFlashcardAt=row["last_flashcard_at"],
        lastSentence=row["last_sentence"],
        exportedToAnki=export_row is not None,
        exportedNoteId=export_row["note_id"] if export_row is not None else None,
        exportedDeckName=export_row["deck_name"] if export_row is not None else None,
        exportedModelName=export_row["model_name"] if export_row is not None else None,
        exportedAt=export_row["exported_at"] if export_row is not None else None,
    )


def _get_monthly_flashcard_limit(connection: Any, user_id: str) -> int:
    row = _execute(
        connection,
        """
        SELECT monthly_flashcard_limit
        FROM user_plan_state
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()

    if row is None or row["monthly_flashcard_limit"] is None:
        return MONTHLY_FLASHCARD_EXPORT_LIMIT

    return int(row["monthly_flashcard_limit"])


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        return value.lower() in {"1", "true", "t", "yes", "on"}
    return bool(value)


def _connect() -> Any:
    if _db_backend() == "postgres":
        database_url = os.environ.get("DATABASE_URL", "").strip()
        if not database_url:
            raise RuntimeError("Missing DATABASE_URL for postgres study storage.")
        if pg_connect is None or dict_row is None:
            raise RuntimeError("psycopg is required for postgres study storage.")

        connection = pg_connect(database_url, row_factory=dict_row)
        _ensure_schema(connection)
        return connection

    db_path = Path(os.environ.get("THAI_STUDY_DB_PATH", DEFAULT_DB_PATH))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    _ensure_schema(connection)
    return connection


def _db_backend() -> DBBackend:
    return "postgres" if os.environ.get("DATABASE_URL", "").strip() else "sqlite"


def _execute(connection: Any, query: str, params: tuple[Any, ...] = ()) -> Any:
    normalized_query = query
    if _db_backend() == "postgres":
        normalized_query = query.replace("?", "%s")
    return connection.execute(normalized_query, params)


def _ensure_schema(connection: Any) -> None:
    backend = _db_backend()
    if backend == "sqlite":
        connection.executescript(SQLITE_SCHEMA_SQL)
        _migrate_legacy_study_history(connection)
        return
    return


def _migrate_legacy_study_history(connection: sqlite3.Connection) -> None:
    legacy_tables = {
        row["name"]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }

    required_legacy_tables = {
        "video_activity",
        "word_activity",
        "video_word_activity",
        "anki_exports",
    }
    if not required_legacy_tables.issubset(legacy_tables):
        return

    existing_rows = connection.execute(
        "SELECT COUNT(*) AS count FROM user_video_activity WHERE user_id = ?",
        (LEGACY_LOCAL_USER_ID,),
    ).fetchone()
    if existing_rows is not None and existing_rows["count"] > 0:
        return

    connection.execute(
        """
        INSERT OR IGNORE INTO user_video_activity (
          user_id,
          video_id,
          video_title,
          opened_count,
          total_word_clicks,
          flashcards_created,
          last_opened_at,
          created_at
        )
        SELECT
          ?,
          video_id,
          video_title,
          opened_count,
          total_word_clicks,
          flashcards_created,
          last_opened_at,
          created_at
        FROM video_activity
        """,
        (LEGACY_LOCAL_USER_ID,),
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO user_word_activity (
          user_id,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        )
        SELECT
          ?,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        FROM word_activity
        """,
        (LEGACY_LOCAL_USER_ID,),
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO user_video_word_activity (
          user_id,
          video_id,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        )
        SELECT
          ?,
          video_id,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        FROM video_word_activity
        """,
        (LEGACY_LOCAL_USER_ID,),
    )
    connection.execute(
        """
        INSERT OR IGNORE INTO user_anki_exports (
          user_id,
          video_id,
          word,
          sentence,
          note_id,
          deck_name,
          model_name,
          exported_at
        )
        SELECT
          ?,
          video_id,
          word,
          sentence,
          note_id,
          deck_name,
          model_name,
          exported_at
        FROM anki_exports
        """,
        (LEGACY_LOCAL_USER_ID,),
    )
    connection.commit()


def _bump_flashcard_counts(
    connection: Any,
    user_id: str,
    video_id: str,
    word: str,
    sentence: str,
    timestamp: str,
) -> None:
    _execute(
        connection,
        """
        INSERT INTO user_video_activity (
          user_id,
          video_id,
          opened_count,
          total_word_clicks,
          flashcards_created,
          last_opened_at,
          created_at
        )
        VALUES (?, ?, 0, 0, 1, ?, ?)
        ON CONFLICT(user_id, video_id) DO UPDATE SET
          flashcards_created = user_video_activity.flashcards_created + 1
        """,
        (user_id, video_id, timestamp, timestamp),
    )
    _execute(
        connection,
        """
        INSERT INTO user_word_activity (
          user_id,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        )
        VALUES (?, ?, 0, 1, NULL, ?, ?)
        ON CONFLICT(user_id, word) DO UPDATE SET
          flashcard_count = user_word_activity.flashcard_count + 1,
          last_flashcard_at = excluded.last_flashcard_at,
          last_sentence = excluded.last_sentence
        """,
        (user_id, word, timestamp, sentence),
    )
    _execute(
        connection,
        """
        INSERT INTO user_video_word_activity (
          user_id,
          video_id,
          word,
          click_count,
          flashcard_count,
          last_clicked_at,
          last_flashcard_at,
          last_sentence
        )
        VALUES (?, ?, ?, 0, 1, NULL, ?, ?)
        ON CONFLICT(user_id, video_id, word) DO UPDATE SET
          flashcard_count = user_video_word_activity.flashcard_count + 1,
          last_flashcard_at = excluded.last_flashcard_at,
          last_sentence = excluded.last_sentence
        """,
        (user_id, video_id, word, timestamp, sentence),
    )


SQLITE_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS user_video_activity (
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT,
  opened_count INTEGER NOT NULL DEFAULT 0,
  total_word_clicks INTEGER NOT NULL DEFAULT 0,
  flashcards_created INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, video_id)
);

CREATE TABLE IF NOT EXISTS user_word_activity (
  user_id TEXT NOT NULL,
  word TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  flashcard_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TEXT,
  last_flashcard_at TEXT,
  last_sentence TEXT,
  PRIMARY KEY (user_id, word)
);

CREATE TABLE IF NOT EXISTS user_video_word_activity (
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  word TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  flashcard_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TEXT,
  last_flashcard_at TEXT,
  last_sentence TEXT,
  PRIMARY KEY (user_id, video_id, word)
);

CREATE TABLE IF NOT EXISTS user_anki_exports (
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  word TEXT NOT NULL,
  sentence TEXT NOT NULL,
  note_id INTEGER NOT NULL,
  deck_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  exported_at TEXT NOT NULL,
  PRIMARY KEY (user_id, video_id, word, sentence)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  default_deck_name TEXT,
  auto_export_to_anki INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'cozy',
  show_tone_colors INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_plan_state (
  user_id TEXT PRIMARY KEY,
  plan_tier TEXT NOT NULL DEFAULT 'free',
  plan_status TEXT NOT NULL DEFAULT 'active',
  monthly_flashcard_limit INTEGER NOT NULL DEFAULT 20,
  current_period_starts_at TEXT,
  current_period_ends_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  deletion_requested_at TEXT,
  data_purged_at TEXT
);
"""
