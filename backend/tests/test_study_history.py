import os
import tempfile
import unittest

from app.models import StudyAnkiExportRequest, StudyPreferencesUpdateRequest
from app.services.study_history import (
    get_video_history,
    get_study_plan,
    get_study_preferences,
    get_study_quota,
    get_word_stats,
    list_word_activity,
    record_anki_export,
    record_video_open,
    record_word_click,
    update_study_preferences,
)
from app.services.user_accounts import get_app_user_account, purge_app_user_data, sync_app_user_account


class StudyHistoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "study.sqlite3")
        self.original_db_path = os.environ.get("THAI_STUDY_DB_PATH")
        os.environ["THAI_STUDY_DB_PATH"] = self.db_path
        self.user_id = "user-one"
        self.other_user_id = "user-two"

    def tearDown(self) -> None:
        if self.original_db_path is None:
            os.environ.pop("THAI_STUDY_DB_PATH", None)
        else:
            os.environ["THAI_STUDY_DB_PATH"] = self.original_db_path
        self.temp_dir.cleanup()

    def test_tracks_video_open_history(self) -> None:
        first = record_video_open(self.user_id, "abc123video", "Thai Lesson 1")
        second = record_video_open(self.user_id, "abc123video", "Thai Lesson 1")

        self.assertEqual(first.videoId, "abc123video")
        self.assertEqual(first.videoTitle, "Thai Lesson 1")
        self.assertEqual(second.openedCount, 2)

        history = get_video_history(self.user_id, limit=5)
        self.assertEqual(len(history.videos), 1)
        self.assertEqual(history.videos[0].videoId, "abc123video")
        self.assertEqual(history.videos[0].videoTitle, "Thai Lesson 1")
        self.assertEqual(history.videos[0].openedCount, 2)

    def test_tracks_word_clicks_and_flashcards(self) -> None:
        record_video_open(self.user_id, "abc123video")
        clicked = record_word_click(
            self.user_id,
            "abc123video",
            "วันนี้",
            "วันนี้ฉันไปตลาด",
        )
        clicked_again = record_word_click(
            self.user_id,
            "abc123video",
            "วันนี้",
            "วันนี้ฉันไปตลาด",
        )
        flashed = record_anki_export(
            self.user_id,
            StudyAnkiExportRequest(
                videoId="abc123video",
                word="วันนี้",
                sentence="วันนี้ฉันไปตลาด",
                noteId=42,
                deckName="Thai",
                modelName="ThaiStudyBasic",
            ),
        )

        self.assertEqual(clicked.clickCount, 1)
        self.assertEqual(clicked_again.clickCount, 2)
        self.assertEqual(flashed.flashcardCount, 1)

        stats = get_word_stats(self.user_id, "วันนี้")
        self.assertEqual(stats.clickCount, 2)
        self.assertEqual(stats.flashcardCount, 1)
        self.assertEqual(stats.lastSentence, "วันนี้ฉันไปตลาด")
        self.assertTrue(flashed.exportedToAnki)
        self.assertEqual(flashed.exportedNoteId, 42)

        history = get_video_history(self.user_id, limit=5)
        self.assertEqual(history.videos[0].totalWordClicks, 2)
        self.assertEqual(history.videos[0].flashcardsCreated, 1)
        self.assertEqual(history.videos[0].uniqueWordsClicked, 1)

    def test_lists_recent_word_activity(self) -> None:
        record_word_click(self.user_id, "video-one", "วันนี้", "วันนี้ฉันไปตลาด")
        record_word_click(self.user_id, "video-two", "กิน", "ฉันกินข้าว")
        record_anki_export(
            self.user_id,
            StudyAnkiExportRequest(
                videoId="video-two",
                word="กิน",
                sentence="ฉันกินข้าว",
                noteId=11,
                deckName="Thai",
                modelName="ThaiStudyBasic",
            ),
        )

        words = list_word_activity(self.user_id, limit=10)

        self.assertEqual(len(words.words), 2)
        self.assertEqual(words.words[0].word, "กิน")
        self.assertEqual(words.words[0].flashcardCount, 1)
        self.assertEqual(words.words[1].word, "วันนี้")

    def test_does_not_double_count_duplicate_export_record(self) -> None:
        payload = StudyAnkiExportRequest(
            videoId="video-two",
            word="กิน",
            sentence="ฉันกินข้าว",
            noteId=11,
            deckName="Thai",
            modelName="ThaiStudyBasic",
        )

        first = record_anki_export(self.user_id, payload)
        second = record_anki_export(self.user_id, payload)

        self.assertEqual(first.flashcardCount, 1)
        self.assertEqual(second.flashcardCount, 1)
        self.assertTrue(second.exportedToAnki)

    def test_isolates_study_history_per_user(self) -> None:
        record_video_open(self.user_id, "shared-video", "Shared Video")
        record_word_click(self.user_id, "shared-video", "กิน", "ฉันกินข้าว")
        record_anki_export(
            self.user_id,
            StudyAnkiExportRequest(
                videoId="shared-video",
                word="กิน",
                sentence="ฉันกินข้าว",
                noteId=11,
                deckName="Thai",
                modelName="ThaiStudyBasic",
            ),
        )

        record_video_open(self.other_user_id, "shared-video", "Shared Video")
        record_word_click(
            self.other_user_id,
            "shared-video",
            "วันนี้",
            "วันนี้ฉันไปตลาด",
        )

        first_user_stats = get_word_stats(self.user_id, "กิน")
        other_user_stats = get_word_stats(self.other_user_id, "กิน")
        first_user_history = get_video_history(self.user_id, limit=5)
        other_user_history = get_video_history(self.other_user_id, limit=5)

        self.assertEqual(first_user_stats.flashcardCount, 1)
        self.assertEqual(other_user_stats.flashcardCount, 0)
        self.assertEqual(first_user_history.videos[0].totalWordClicks, 1)
        self.assertEqual(first_user_history.videos[0].flashcardsCreated, 1)
        self.assertEqual(other_user_history.videos[0].totalWordClicks, 1)
        self.assertEqual(other_user_history.videos[0].flashcardsCreated, 0)

    def test_reports_monthly_flashcard_quota(self) -> None:
        before = get_study_quota(self.user_id)
        self.assertEqual(before.monthlyFlashcardLimit, 20)
        self.assertEqual(before.monthlyFlashcardExportsUsed, 0)
        self.assertEqual(before.monthlyFlashcardExportsRemaining, 20)
        self.assertFalse(before.hasReachedMonthlyFlashcardLimit)

        record_anki_export(
            self.user_id,
            StudyAnkiExportRequest(
                videoId="video-quota",
                word="กิน",
                sentence="ฉันกินข้าว",
                noteId=999,
                deckName="Thai",
                modelName="ThaiStudyBasic",
            ),
        )

        after = get_study_quota(self.user_id)
        self.assertEqual(after.monthlyFlashcardExportsUsed, 1)
        self.assertEqual(after.monthlyFlashcardExportsRemaining, 19)
        self.assertFalse(after.hasReachedMonthlyFlashcardLimit)

    def test_persists_study_preferences_per_user(self) -> None:
        before = get_study_preferences(self.user_id)
        self.assertFalse(before.hasStoredPreferences)
        self.assertEqual(before.theme, "cozy")

        saved = update_study_preferences(
            self.user_id,
            StudyPreferencesUpdateRequest(
                defaultDeck="Thai",
                autoExportToAnki=True,
                theme="night",
                showToneColors=True,
            ),
        )

        other_user = get_study_preferences(self.other_user_id)
        fetched = get_study_preferences(self.user_id)

        self.assertTrue(saved.hasStoredPreferences)
        self.assertEqual(saved.defaultDeck, "Thai")
        self.assertTrue(saved.autoExportToAnki)
        self.assertEqual(saved.theme, "night")
        self.assertTrue(saved.showToneColors)
        self.assertFalse(other_user.hasStoredPreferences)
        self.assertEqual(fetched.defaultDeck, "Thai")
        self.assertEqual(fetched.theme, "night")

    def test_reports_default_plan_state(self) -> None:
        plan = get_study_plan(self.user_id)

        self.assertEqual(plan.planTier, "free")
        self.assertEqual(plan.planStatus, "active")
        self.assertEqual(plan.monthlyFlashcardLimit, 20)

    def test_syncs_app_user_account(self) -> None:
        first = sync_app_user_account(self.user_id, "USER@example.com")
        second = sync_app_user_account(self.user_id)

        self.assertEqual(first.id, self.user_id)
        self.assertEqual(first.email, "user@example.com")
        self.assertEqual(second.id, self.user_id)
        self.assertEqual(second.email, "user@example.com")

    def test_purges_app_owned_user_data_but_keeps_account_marker(self) -> None:
        sync_app_user_account(self.user_id, "user@example.com")
        record_video_open(self.user_id, "shared-video", "Shared Video")
        record_word_click(self.user_id, "shared-video", "กิน", "ฉันกินข้าว")
        update_study_preferences(
            self.user_id,
            StudyPreferencesUpdateRequest(
                defaultDeck="Thai",
                autoExportToAnki=True,
                theme="night",
                showToneColors=True,
            ),
        )

        purged = purge_app_user_data(self.user_id, "user@example.com")
        account = get_app_user_account(self.user_id)
        history = get_video_history(self.user_id, limit=5)
        words = list_word_activity(self.user_id, limit=10)
        preferences = get_study_preferences(self.user_id)

        self.assertIsNotNone(purged.deletionRequestedAt)
        self.assertIsNotNone(purged.dataPurgedAt)
        self.assertIsNotNone(account)
        self.assertEqual(history.videos, [])
        self.assertEqual(words.words, [])
        self.assertFalse(preferences.hasStoredPreferences)


if __name__ == "__main__":
    unittest.main()
