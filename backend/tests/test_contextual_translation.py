import unittest

from app.services.contextual_translation import (
    build_pronunciation,
    build_contextual_translation,
    build_translation_suggestions,
    infer_tone_label,
    parse_audio_url,
    parse_entry_definition,
    parse_prefix_search_results,
    split_syllables,
    DictionaryEntry,
)


class ContextualTranslationTests(unittest.TestCase):
    def test_builds_contextual_translation_payload(self) -> None:
        result = build_contextual_translation("ไม่", "ฉันไม่ไปตลาด")

        self.assertEqual(result.word, "ไม่")
        self.assertEqual(result.sentence, "ฉันไม่ไปตลาด")
        self.assertGreaterEqual(len(result.suggestions), 1)
        self.assertGreaterEqual(len(result.exampleSentences), 2)
        self.assertEqual(
            result.flashcardPreview.back.chosenTranslation,
            result.suggestions[0].translation,
        )
        self.assertEqual(
            result.flashcardPreview.back.exampleSentence,
            result.exampleSentences[0].text,
        )
        self.assertTrue(result.pronunciation.syllables)

    def test_infers_explicit_tone_marks(self) -> None:
        self.assertEqual(infer_tone_label("ก๋า"), "rising")
        self.assertEqual(infer_tone_label("ก่า"), "low")

    def test_explains_tone_rule_in_pronunciation_payload(self) -> None:
        pronunciation = build_pronunciation("วันนี้")

        self.assertGreaterEqual(len(pronunciation.syllables), 1)
        self.assertTrue(pronunciation.syllables[0].tone.rule)
        self.assertTrue(pronunciation.syllables[0].tone.explanation)

    def test_parses_prefix_search_results(self) -> None:
        payload = """<?xml version="1.0" encoding="utf-8"?>
<tl-xml-response>
  <results s="วันนี้" exact="1" extra="1">
    <result id="196713">
      <t exact="1">วันนี้</t>
      <x>wanMneeH</x>
      <e>today</e>
    </result>
    <result id="249206">
      <t>วันนี้กินข้าวที่ไหน</t>
      <x>wanMneeHginMkhaaoFtheeFnaiR</x>
      <e>"Where're you gonna eat today?"</e>
    </result>
  </results>
</tl-xml-response>"""

        entry_id, examples = parse_prefix_search_results(payload, "วันนี้")

        self.assertEqual(entry_id, 196713)
        self.assertEqual(examples[0].translation, "today")
        self.assertEqual(examples[1].text, "วันนี้กินข้าวที่ไหน")

    def test_parses_dictionary_entry_html(self) -> None:
        html = """
<table width='100%' cellpadding=4>
  <tr>
    <td><span class=th3>วันนี้</span></td>
    <td style='text-align:right'><a onClick=PlayAudioFile('/mp3/P196713.mp3')></a></td>
  </tr>
</table>
<tr>
  <td style='background-color:#808080;'>definition</td>
  <td colspan=3 class='df'><br /><b>today</b><br /><br /></td>
</tr>
"""

        self.assertEqual(parse_entry_definition(html), "today")
        self.assertEqual(
            parse_audio_url(html),
            "http://thai-language.com/mp3/P196713.mp3",
        )

    def test_ranks_language_reading_for_thai_in_language_context(self) -> None:
        suggestions = build_translation_suggestions(
            "ไทย",
            ["ฉัน", "เรียน", "ภาษา", "ไทย"],
            DictionaryEntry(
                entry_id=1,
                translation="Thai; Thailand; Thai language",
                audio_url=None,
                source_url="http://example.com/thai",
                examples=(),
            ),
        )

        self.assertGreaterEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0].translation, "Thai language")
        self.assertIn("Language reading favored", suggestions[0].rationale)

    def test_ranks_people_for_khon_in_group_context(self) -> None:
        suggestions = build_translation_suggestions(
            "คน",
            ["คน", "ไทย", "หลาย", "คน"],
            None,
        )

        self.assertGreaterEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0].translation, "people")
        self.assertIn("Plural reading favored", suggestions[0].rationale)

    def test_splits_common_multi_syllable_words_more_reliably(self) -> None:
        self.assertEqual(split_syllables("วันนี้"), ["วัน", "นี้"])
        self.assertEqual(split_syllables("ทำไม"), ["ทำ", "ไม"])


if __name__ == "__main__":
    unittest.main()
