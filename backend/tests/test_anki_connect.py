import unittest

from app.models import AnkiExportRequest
from app.services.anki_connect import (
    ANKI_MODEL_NAME,
    build_anki_fields,
    build_audio_filename,
    build_tone_markup,
    build_tags,
    escape_anki_query,
)


class AnkiConnectFormattingTests(unittest.TestCase):
    def test_builds_custom_model_fields(self) -> None:
        payload = AnkiExportRequest(
            deckName="Thai",
            word="วันนี้",
            translation="today",
            sentence="วันนี้ฉันไปตลาด",
            romanized="wan ni",
            tones=["วัน mid", "นี้ high"],
            sourceUrl="http://example.com/source",
        )

        fields = build_anki_fields(payload, "[sound:thai-study-wanni.mp3]")

        self.assertEqual(fields["Word"], "วันนี้")
        self.assertEqual(fields["Translation"], "today")
        self.assertEqual(fields["Sentence"], "วันนี้ฉันไปตลาด")
        self.assertEqual(fields["Romanization"], "wan ni")
        self.assertEqual(fields["Tone"], "วัน mid, นี้ high")
        self.assertEqual(fields["Audio"], "[sound:thai-study-wanni.mp3]")
        self.assertIn("Source link", fields["Video"])
        self.assertIn("Source link", fields["Source"])

    def test_builds_structured_tone_markup_when_details_are_available(self) -> None:
        payload = AnkiExportRequest(
            deckName="Thai",
            word="โมง",
            translation="hour; o'clock",
            sentence="อยากกินข้าวเที่ยงบ่ายกี่โมง",
            romanized="mong",
            tones=["โมง mid"],
            toneDetails=[
                {
                    "text": "โมง",
                    "label": "mid",
                    "pronunciation": "โมง",
                    "romanized": "mong",
                    "ipa": "moːŋ",
                    "consonantClass": "mid",
                    "syllableType": "live",
                    "toneMark": "none",
                    "explanation": "This syllable has no explicit tone mark, so the tone falls out of consonant class (mid) plus syllable type (live).",
                }
            ],
        )

        fields = build_anki_fields(payload, "")

        self.assertIn("tone-stack", fields["Tone"])
        self.assertIn("tone-card", fields["Tone"])
        self.assertIn("mid tone", fields["Tone"])
        self.assertIn("moːŋ", fields["Tone"])
        self.assertIn("This syllable has no explicit tone mark", fields["Tone"])

    def test_tone_markup_escapes_html_from_details(self) -> None:
        payload = AnkiExportRequest(
            deckName="Thai",
            word="โมง",
            translation="hour",
            sentence="กี่โมง",
            toneDetails=[
                {
                    "text": "<script>",
                    "label": "mid",
                    "explanation": "<b>unsafe</b>",
                }
            ],
        )

        markup = build_tone_markup(payload)

        self.assertNotIn("<script>", markup)
        self.assertNotIn("<b>unsafe</b>", markup)
        self.assertIn("&lt;script&gt;", markup)
        self.assertIn("&lt;b&gt;unsafe&lt;/b&gt;", markup)

    def test_normalizes_tags(self) -> None:
        tags = build_tags(["thai study", " lesson-1 ", "", "thai study"])

        self.assertEqual(tags, ["lesson-1", "thai-study"])

    def test_builds_audio_filename(self) -> None:
        filename = build_audio_filename("วันนี้", "http://thai-language.com/mp3/P196713.mp3")
        self.assertEqual(filename, "thai-study-วันนี้.mp3")

    def test_escapes_anki_query(self) -> None:
        query = escape_anki_query('"quoted" path\\value')
        self.assertEqual(query, '\\"quoted\\" path\\\\value')

    def test_model_name_is_custom(self) -> None:
        self.assertEqual(ANKI_MODEL_NAME, "ThaiStudyBasic")


if __name__ == "__main__":
    unittest.main()
