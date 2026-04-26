from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from html import unescape
import time
import re
from urllib.parse import quote
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

try:
    from pythainlp.tokenize import word_tokenize
    from pythainlp.transliterate import pronunciate, romanize, transliterate
except ImportError:
    def word_tokenize(text: str, keep_whitespace: bool = False) -> list[str]:
        return [text] if text.strip() else []

    def pronunciate(text: str, engine: str = "w2p") -> str:
        return text

    def romanize(text: str, engine: str = "royin") -> str:
        return text

    def transliterate(text: str, engine: str = "ipa") -> str:
        return text

from app.models import (
    ContextualTranslationResponse,
    ExampleSentence,
    FlashcardBack,
    FlashcardFront,
    FlashcardPreview,
    Pronunciation,
    PronunciationSyllable,
    ToneLabel,
    ToneMetadata,
    TranslationSuggestion,
)

THAI_LANGUAGE_BASE_URL = "http://thai-language.com"
THAI_LANGUAGE_TIMEOUT_SECONDS = 12
DICTIONARY_HTTP_CACHE_TTL_SECONDS = 60 * 60 * 24
TRANSLATION_CACHE_TTL_SECONDS = 60 * 30
TAG_STRIP_PATTERN = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class TimedCacheEntry:
    value: object
    expires_at: float


_http_text_cache: dict[str, TimedCacheEntry] = {}
_translation_cache: dict[tuple[str, str], TimedCacheEntry] = {}

HIGH_CLASS_CONSONANTS = frozenset("ขฃฉฐถผฝศษสห")
MID_CLASS_CONSONANTS = frozenset("กจฎฏดตบปอ")
LOW_SONORANTS = frozenset("งญณนมยรลวฬ")
SONORANT_FINALS = frozenset("งนมยวญณรลฬ")
STOP_FINALS = frozenset("กขฃคฅฆจชซฌฎฏฐฑฒดตถทธศษสบปพภฟ")
SHORT_VOWEL_MARKS = ("ะ", "ั", "ิ", "ึ", "ุ", "็", "ฤ", "ฦ")
TONE_MARKS = {"่": "mai_ek", "้": "mai_tho", "๊": "mai_tri", "๋": "mai_chattawa"}
TONE_MARK_LABELS = {
    "none": "no tone mark",
    "mai_ek": "mai ek",
    "mai_tho": "mai tho",
    "mai_tri": "mai tri",
    "mai_chattawa": "mai chattawa",
}
THAI_CONSONANTS = frozenset(
    "กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"
)
THAI_LEADING_VOWELS = frozenset("เแโใไ")
THAI_VOWEL_SIGNS = frozenset("ะัาำิีึืุูฤฦ็ๅ")

TONE_TABLE: dict[str, dict[str, dict[str, ToneLabel]]] = {
    "none": {
        "mid": {"live": "mid", "dead": "low"},
        "high": {"live": "rising", "dead": "low"},
        "low": {"live": "mid", "dead": "falling"},
    },
    "mai_ek": {
        "mid": {"live": "low", "dead": "low"},
        "high": {"live": "low", "dead": "low"},
        "low": {"live": "falling", "dead": "high"},
    },
    "mai_tho": {
        "mid": {"live": "falling", "dead": "falling"},
        "high": {"live": "falling", "dead": "falling"},
        "low": {"live": "high", "dead": "falling"},
    },
    "mai_tri": {
        "mid": {"live": "high", "dead": "high"},
        "high": {"live": "rising", "dead": "rising"},
        "low": {"live": "rising", "dead": "high"},
    },
    "mai_chattawa": {
        "mid": {"live": "rising", "dead": "rising"},
        "high": {"live": "high", "dead": "high"},
        "low": {"live": "rising", "dead": "rising"},
    },
}

SHORT_VOWEL_PATTERNS = (
    re.compile(r"เ.าะ"),
    re.compile(r"เ.อะ"),
    re.compile(r"เ.ะ"),
    re.compile(r"แ.ะ"),
    re.compile(r"โ.ะ"),
    re.compile(r"เ.าะ"),
)


@dataclass(frozen=True)
class MockSuggestionSeed:
    translation: str
    rationale: str


@dataclass(frozen=True)
class ContextTranslationRule:
    translation: str
    rationale: str
    scope: str = "nearby"
    tokens: tuple[str, ...] = ()


@dataclass(frozen=True)
class DictionaryExample:
    text: str
    translation: str


@dataclass(frozen=True)
class DictionaryEntry:
    entry_id: int
    translation: str
    audio_url: str | None
    source_url: str
    examples: tuple[DictionaryExample, ...]


OFFLINE_TRANSLATION_MAP: dict[str, list[MockSuggestionSeed]] = {
    "ครับ": [
        MockSuggestionSeed("yes / understood", "Likely a polite male sentence-ending particle."),
        MockSuggestionSeed("polite particle", "Often softens or confirms the sentence rather than translating literally."),
        MockSuggestionSeed("I agree", "Common contextual gloss when used as a brief reply."),
    ],
    "ค่ะ": [
        MockSuggestionSeed("yes / understood", "Likely a polite female sentence-ending particle."),
        MockSuggestionSeed("polite particle", "Often marks politeness more than dictionary meaning."),
        MockSuggestionSeed("okay", "Common contextual gloss in spoken replies."),
    ],
    "ไม่": [
        MockSuggestionSeed("not", "Strong candidate because the word is commonly used as a negator."),
        MockSuggestionSeed("no", "Fits short reply or sentence-final usage."),
        MockSuggestionSeed("did not", "Useful contextual gloss when modifying a verb phrase."),
    ],
    "ไป": [
        MockSuggestionSeed("go", "Common motion verb gloss."),
        MockSuggestionSeed("to go", "Matches dictionary-style infinitive gloss."),
        MockSuggestionSeed("leave", "Possible contextual gloss when movement away is emphasized."),
    ],
    "มา": [
        MockSuggestionSeed("come", "Common motion verb gloss."),
        MockSuggestionSeed("arrive", "Possible contextual gloss when arrival is emphasized."),
        MockSuggestionSeed("have come", "Useful when the sentence is describing completed movement."),
    ],
    "คน": [
        MockSuggestionSeed("person", "Most common noun gloss."),
        MockSuggestionSeed("people", "Plural or generic reading depends on sentence context."),
        MockSuggestionSeed("someone", "Useful when the word refers to an unspecified person."),
    ],
    "ไทย": [
        MockSuggestionSeed("Thai", "Likely adjective or language label in context."),
        MockSuggestionSeed("Thailand", "Possible country reference depending on surrounding nouns."),
        MockSuggestionSeed("Thai language", "Useful gloss when attached to language-learning context."),
    ],
}

CONTEXTUAL_TRANSLATION_RULES: dict[str, tuple[ContextTranslationRule, ...]] = {
    "ไทย": (
        ContextTranslationRule(
            translation="Thai language",
            rationale="Language reading favored because the sentence is about language use or study.",
            scope="sentence",
            tokens=("ภาษา", "เรียน", "พูด", "อ่าน", "เขียน", "ฟัง"),
        ),
        ContextTranslationRule(
            translation="Thailand",
            rationale="Country reading favored because the sentence mentions a place or country context.",
            scope="sentence",
            tokens=("ประเทศ", "กรุงเทพ", "เชียงใหม่"),
        ),
    ),
    "คน": (
        ContextTranslationRule(
            translation="people",
            rationale="Plural reading favored because the sentence includes a quantity or group cue.",
            scope="sentence",
            tokens=("หลาย", "พวก", "ทุก", "ทั้ง", "สอง", "สาม"),
        ),
        ContextTranslationRule(
            translation="someone",
            rationale="Indefinite-person reading favored because the sentence uses an existence or unspecified-person cue.",
            scope="nearby",
            tokens=("มี", "ไม่มี", "บาง", "สัก"),
        ),
    ),
    "ไป": (
        ContextTranslationRule(
            translation="leave",
            rationale="Departure reading favored because the sentence emphasizes moving away.",
            scope="sentence",
            tokens=("ออก", "จาก"),
        ),
    ),
    "มา": (
        ContextTranslationRule(
            translation="arrive",
            rationale="Arrival reading favored because the sentence emphasizes reaching a destination.",
            scope="sentence",
            tokens=("ถึง", "เพิ่ง"),
        ),
    ),
}


def build_contextual_translation(word: str, sentence: str) -> ContextualTranslationResponse:
    normalized_word = word.strip()
    normalized_sentence = sentence.strip()
    cache_key = (normalized_word, normalized_sentence)
    cached_response = get_timed_cache_value(_translation_cache, cache_key)
    if cached_response is not None:
        return cached_response

    sentence_tokens = [
        token.strip()
        for token in word_tokenize(normalized_sentence, keep_whitespace=False)
        if token.strip()
    ]
    dictionary_entry = lookup_dictionary_entry(normalized_word)
    suggestions = build_translation_suggestions(
        normalized_word,
        sentence_tokens,
        dictionary_entry,
    )
    pronunciation = build_pronunciation(normalized_word)
    example_sentences = build_example_sentences(
        normalized_word,
        normalized_sentence,
        sentence_tokens,
        suggestions,
        dictionary_entry,
    )
    flashcard_preview = FlashcardPreview(
        front=FlashcardFront(word=normalized_word, hints=[normalized_sentence]),
        back=FlashcardBack(
            word=normalized_word,
            chosenTranslation=suggestions[0].translation if suggestions else "",
            exampleSentence=example_sentences[0].text,
            dictionaryAudioUrl=dictionary_entry.audio_url if dictionary_entry else None,
        ),
    )
    response = ContextualTranslationResponse(
        word=normalized_word,
        sentence=normalized_sentence,
        sentenceTokens=sentence_tokens,
        suggestions=suggestions,
        pronunciation=pronunciation,
        dictionaryAudioUrl=dictionary_entry.audio_url if dictionary_entry else None,
        dictionarySourceUrl=dictionary_entry.source_url if dictionary_entry else None,
        exampleSentences=example_sentences,
        flashcardPreview=flashcard_preview,
    )
    set_timed_cache_value(
        _translation_cache,
        cache_key,
        response,
        ttl_seconds=TRANSLATION_CACHE_TTL_SECONDS,
    )
    return response


def build_translation_suggestions(
    word: str,
    sentence_tokens: list[str],
    dictionary_entry: DictionaryEntry | None,
) -> list[TranslationSuggestion]:
    context_window = get_context_window(word, sentence_tokens)
    sentence_context = [token.strip() for token in sentence_tokens if token.strip()]
    dictionary_candidates: list[MockSuggestionSeed] = []

    if dictionary_entry is not None:
        dictionary_candidates.extend(
            expand_translation_candidates(
                dictionary_entry.translation,
                "Dictionary gloss from thai-language.com.",
            )
        )

    dictionary_candidates.extend(OFFLINE_TRANSLATION_MAP.get(word, []))

    seen_translations: set[str] = set()
    ranked_candidates: list[tuple[float, str, str]] = []

    for candidate in dictionary_candidates:
        normalized_translation = normalize_translation_candidate(candidate.translation)
        if not normalized_translation or normalized_translation in seen_translations:
            continue

        seen_translations.add(normalized_translation)
        score, rationale = score_translation_candidate(
            word=word,
            translation=normalized_translation,
            rationale=candidate.rationale,
            sentence_tokens=sentence_context,
            context_window=context_window,
        )
        ranked_candidates.append((score, normalized_translation, rationale))

    ranked_candidates.sort(key=lambda entry: (-entry[0], len(entry[1]), entry[1]))

    suggestions: list[TranslationSuggestion] = []
    for index, (score, translation, rationale) in enumerate(ranked_candidates[:5]):
        suggestions.append(
            TranslationSuggestion(
                translation=translation,
                score=round(max(0.42, min(0.98, score - index * 0.03)), 2),
                rationale=append_context(rationale, context_window),
            )
        )

    return suggestions


def expand_translation_candidates(
    translation: str,
    rationale: str,
) -> list[MockSuggestionSeed]:
    normalized_translation = normalize_translation_candidate(translation)
    split_candidates = split_translation_candidates(normalized_translation)
    candidates = split_candidates + ([normalized_translation] if len(split_candidates) > 1 else [])

    unique_candidates: list[str] = []
    for candidate in candidates:
        if candidate and candidate not in unique_candidates:
            unique_candidates.append(candidate)

    return [
        MockSuggestionSeed(
            candidate,
            rationale
            if candidate == normalized_translation
            else f"{rationale} Extracted as a cleaner candidate sense from the same gloss.",
        )
        for candidate in unique_candidates
    ]


def split_translation_candidates(translation: str) -> list[str]:
    if ";" in translation:
        return [part.strip() for part in translation.split(";") if part.strip()]

    if " / " in translation:
        return [part.strip() for part in translation.split(" / ") if part.strip()]

    return [translation]


def score_translation_candidate(
    word: str,
    translation: str,
    rationale: str,
    sentence_tokens: list[str],
    context_window: list[str],
) -> tuple[float, str]:
    score = 0.72
    enriched_rationale = rationale
    translation_key = normalize_translation_key(translation)

    if ";" not in translation and " / " not in translation:
        score += 0.06
    else:
        score -= 0.05

    if len(translation.split()) <= 3:
        score += 0.03

    for rule in CONTEXTUAL_TRANSLATION_RULES.get(word, ()):
        if normalize_translation_key(rule.translation) != translation_key:
            continue

        haystack = context_window if rule.scope == "nearby" else sentence_tokens
        if not any(token in haystack for token in rule.tokens):
            continue

        score += 0.22
        enriched_rationale = f"{enriched_rationale} {rule.rationale}"

    return score, enriched_rationale


def normalize_translation_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def build_example_sentences(
    word: str,
    sentence: str,
    sentence_tokens: list[str],
    suggestions: list[TranslationSuggestion],
    dictionary_entry: DictionaryEntry | None,
) -> list[ExampleSentence]:
    primary_translation = (
        suggestions[0].translation if suggestions else "No English translation available yet."
    )
    highlighted_sentence = highlight_word_in_sentence(word, sentence)
    context_window = format_context_window(get_context_window(word, sentence_tokens))

    examples = [
        ExampleSentence(
            text=sentence,
            translationHint=f"Primary context for '{word}': {primary_translation}.",
            source="video-transcript",
        ),
        ExampleSentence(
            text=highlighted_sentence,
            translationHint=f"Focus word highlighted in context. Nearby Thai tokens: {context_window}.",
            source="study-focus",
        ),
    ]

    if dictionary_entry is not None:
        for example in dictionary_entry.examples[:3]:
            examples.append(
                ExampleSentence(
                    text=example.text,
                    translationHint=example.translation,
                    source="thai-language.com",
                )
            )

    return examples


@lru_cache(maxsize=512)
def lookup_dictionary_entry(word: str) -> DictionaryEntry | None:
    search_xml = fetch_text(
        f"{THAI_LANGUAGE_BASE_URL}/xml/PrefixSearch?fmt=0&input={quote(word)}"
    )
    if not search_xml:
        return None

    exact_id, examples = parse_prefix_search_results(search_xml, word)
    if exact_id is None:
        return None

    entry_html = fetch_text(f"{THAI_LANGUAGE_BASE_URL}/id/{exact_id}")
    if not entry_html:
        return None

    translation = parse_entry_definition(entry_html)
    if not translation:
        return None

    audio_url = parse_audio_url(entry_html)
    return DictionaryEntry(
        entry_id=exact_id,
        translation=translation,
        audio_url=audio_url,
        source_url=f"{THAI_LANGUAGE_BASE_URL}/id/{exact_id}",
        examples=tuple(examples),
    )


def fetch_text(url: str) -> str | None:
    cached_text = get_timed_cache_value(_http_text_cache, url)
    if cached_text is not None:
        return cached_text

    request = Request(url, headers={"User-Agent": "Mozilla/5.0 ThaiStudy/0.1"})

    try:
        with urlopen(request, timeout=THAI_LANGUAGE_TIMEOUT_SECONDS) as response:
            text = response.read().decode("utf-8", "ignore")
            set_timed_cache_value(
                _http_text_cache,
                url,
                text,
                ttl_seconds=DICTIONARY_HTTP_CACHE_TTL_SECONDS,
            )
            return text
    except Exception:
        return None


def get_timed_cache_value(cache: dict[object, TimedCacheEntry], key: object):
    entry = cache.get(key)
    if entry is None:
        return None

    if entry.expires_at <= time.time():
        cache.pop(key, None)
        return None

    return entry.value


def set_timed_cache_value(
    cache: dict[object, TimedCacheEntry],
    key: object,
    value: object,
    ttl_seconds: int,
) -> None:
    cache[key] = TimedCacheEntry(
        value=value,
        expires_at=time.time() + ttl_seconds,
    )


def parse_prefix_search_results(
    xml_payload: str,
    word: str,
) -> tuple[int | None, list[DictionaryExample]]:
    try:
        root = ET.fromstring(xml_payload)
    except ET.ParseError:
        return None, []

    results_node = root.find("results")
    if results_node is None:
        return None, []

    entry_id: int | None = None
    examples: list[DictionaryExample] = []

    for result in results_node.findall("result"):
        result_id = result.get("id")
        thai_text = (result.findtext("t") or "").strip()
        english_text = clean_dictionary_text(result.findtext("e") or "")

        if result_id and thai_text == word and result.find("t") is not None:
            if result.find("t").get("exact") == "1":
                entry_id = int(result_id)
                if english_text:
                    examples.insert(0, DictionaryExample(text=thai_text, translation=english_text))
                continue

        if thai_text and english_text:
            examples.append(DictionaryExample(text=thai_text, translation=english_text))

    return entry_id, examples


def parse_entry_definition(html: str) -> str | None:
    match = re.search(
        r">definition</td>\s*<td[^>]*class=['\"]?df['\"]?[^>]*>.*?<b>(.*?)</b>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if match is None:
        return None

    return clean_dictionary_text(match.group(1)) or None


def parse_audio_url(html: str) -> str | None:
    match = re.search(r"PlayAudioFile\('([^']+\.mp3)'\)", html)
    if match is None:
        return None

    return f"{THAI_LANGUAGE_BASE_URL}{match.group(1)}"


def clean_dictionary_text(text: str) -> str:
    no_tags = TAG_STRIP_PATTERN.sub("", text)
    normalized = unescape(no_tags).replace("\xa0", " ")
    return re.sub(r"\s+", " ", normalized).strip().strip('"')


def normalize_translation_candidate(text: str) -> str:
    cleaned = clean_dictionary_text(text)
    cleaned = re.sub(r"\s*/\s*", " / ", cleaned)
    cleaned = re.sub(r"\s*;\s*", "; ", cleaned)
    return cleaned


def highlight_word_in_sentence(word: str, sentence: str) -> str:
    return sentence.replace(word, f"[{word}]", 1) if word and word in sentence else sentence


def append_context(rationale: str, context_window: list[str]) -> str:
    formatted_context = format_context_window(context_window)
    if not context_window:
        return rationale

    return f"{rationale} Nearby context: {formatted_context}."


def format_context_window(context_window: list[str]) -> str:
    return ", ".join(context_window) if context_window else "no nearby tokens"


def get_context_window(word: str, sentence_tokens: list[str]) -> list[str]:
    if not sentence_tokens:
        return []

    try:
        index = sentence_tokens.index(word)
    except ValueError:
        return sentence_tokens[:4]

    start = max(0, index - 2)
    end = min(len(sentence_tokens), index + 3)
    return sentence_tokens[start:index] + sentence_tokens[index + 1 : end]


def build_pronunciation(word: str) -> Pronunciation:
    syllables = split_syllables(word)
    pronunciation_parts = split_pronunciation(pronunciate(word, engine="w2p"))

    syllable_entries = [
        build_pronunciation_syllable(
            syllable,
            pronunciation_parts[index] if index < len(pronunciation_parts) else syllable,
        )
        for index, syllable in enumerate(syllables)
    ]

    return Pronunciation(
        syllables=syllable_entries,
        romanized=safe_romanize(word),
        ipa=safe_ipa(word),
    )


def split_syllables(word: str) -> list[str]:
    try:
        from pythainlp.tokenize import syllable_tokenize
    except ImportError:
        syllable_tokenize = None

    if syllable_tokenize is not None:
        try:
            syllables = [syllable for syllable in syllable_tokenize(word) if syllable.strip()]
        except ImportError:
            syllables = []

        if syllables:
            return syllables

    fallback_syllables = split_pronunciation(pronunciate(word, engine="w2p"))
    heuristic_syllables = split_thai_syllables_heuristic(word)

    if heuristic_syllables and len(heuristic_syllables) > 1:
        return heuristic_syllables

    return fallback_syllables or heuristic_syllables or [word]


def split_pronunciation(pronunciation: str) -> list[str]:
    return [part.strip() for part in pronunciation.split("-") if part.strip()]


def split_thai_syllables_heuristic(word: str) -> list[str]:
    trimmed_word = word.strip()
    if not trimmed_word:
        return []

    characters = list(trimmed_word)
    if len(characters) <= 1:
        return [trimmed_word]

    syllables: list[str] = []
    current = ""

    for index, character in enumerate(characters):
        next_character = characters[index + 1] if index + 1 < len(characters) else None

        if (
            current
            and character in THAI_LEADING_VOWELS
            and any(current_character in THAI_CONSONANTS for current_character in current)
        ):
            syllables.append(current)
            current = character
        else:
            current += character

        if next_character and should_split_thai_syllable(current, next_character):
            syllables.append(current)
            current = ""

    if current:
        syllables.append(current)

    return [syllable for syllable in syllables if syllable.strip()]


def should_split_thai_syllable(current: str, next_character: str) -> bool:
    if next_character in THAI_LEADING_VOWELS:
        return True

    if next_character not in THAI_CONSONANTS:
        return False

    current_characters = list(current)
    consonants = [character for character in current_characters if character in THAI_CONSONANTS]
    if not consonants:
        return False

    has_vowel_signal = any(
        character in THAI_VOWEL_SIGNS or character in THAI_LEADING_VOWELS
        for character in current_characters
    )
    has_tone_mark = any(character in TONE_MARKS for character in current_characters)
    has_short_vowel_signal = any(character in SHORT_VOWEL_MARKS for character in current_characters)
    last_character = current_characters[-1] if current_characters else None

    if has_tone_mark:
        return True

    if has_short_vowel_signal and last_character in THAI_CONSONANTS:
        return True

    if last_character and last_character in THAI_CONSONANTS and has_vowel_signal:
        return True

    return False


def build_pronunciation_syllable(
    syllable: str,
    pronunciation_text: str,
) -> PronunciationSyllable:
    tone_analysis = analyze_tone(syllable)
    return PronunciationSyllable(
        text=syllable,
        pronunciation=pronunciation_text,
        romanized=safe_romanize(syllable),
        ipa=safe_ipa(syllable),
        tone=ToneMetadata(
            label=tone_analysis["label"],
            source="orthographic-guess",
            rule=tone_analysis["rule"],
            explanation=tone_analysis["explanation"],
            consonantClass=tone_analysis["consonant_class"],
            syllableType=tone_analysis["syllable_type"],
            toneMark=tone_analysis["tone_mark"],
        ),
    )


def safe_romanize(text: str) -> str:
    return romanize(text, engine="royin")


def safe_ipa(text: str) -> str | None:
    try:
        return transliterate(text, engine="ipa")
    except (ImportError, ModuleNotFoundError, NotImplementedError, ValueError):
        return None


def infer_tone_label(syllable: str) -> ToneLabel:
    return analyze_tone(syllable)["label"]


def analyze_tone(syllable: str) -> dict[str, str | ToneLabel | None]:
    cleaned = "".join(character for character in syllable if not character.isspace())
    if not cleaned:
        return {
            "label": "unknown",
            "rule": "Could not determine the tone rule.",
            "explanation": "No Thai syllable data was available to analyze.",
            "consonant_class": None,
            "syllable_type": None,
            "tone_mark": None,
        }

    tone_key = next((TONE_MARKS[character] for character in cleaned if character in TONE_MARKS), "none")
    consonant_class = infer_initial_consonant_class(cleaned)
    if consonant_class is None:
        return {
            "label": "unknown",
            "rule": "Could not determine the initial consonant class.",
            "explanation": "The syllable did not contain a recognizable Thai initial consonant.",
            "consonant_class": None,
            "syllable_type": None,
            "tone_mark": TONE_MARK_LABELS[tone_key],
        }

    syllable_type = infer_syllable_type(cleaned)
    label = TONE_TABLE[tone_key][consonant_class][syllable_type]
    rule = build_tone_rule(label, consonant_class, syllable_type, tone_key)
    explanation = build_tone_explanation(label, consonant_class, syllable_type, tone_key)
    return {
        "label": label,
        "rule": rule,
        "explanation": explanation,
        "consonant_class": consonant_class,
        "syllable_type": syllable_type,
        "tone_mark": TONE_MARK_LABELS[tone_key],
    }


def infer_initial_consonant_class(syllable: str) -> str | None:
    consonants = [character for character in syllable if character in THAI_CONSONANTS]
    if not consonants:
        return None

    first = consonants[0]
    if (
        first == "ห"
        and len(consonants) > 1
        and consonants[1] in LOW_SONORANTS
    ):
        return "high"

    if first in HIGH_CLASS_CONSONANTS:
        return "high"
    if first in MID_CLASS_CONSONANTS:
        return "mid"
    return "low"


def infer_syllable_type(syllable: str) -> str:
    final_consonant = find_final_consonant(syllable)
    if final_consonant in SONORANT_FINALS:
        return "live"
    if final_consonant in STOP_FINALS:
        return "dead"
    if contains_short_vowel(syllable):
        return "dead"
    return "live"


def find_final_consonant(syllable: str) -> str | None:
    consonants = [character for character in syllable if character in THAI_CONSONANTS]
    if not consonants:
        return None

    return consonants[-1]


def contains_short_vowel(syllable: str) -> bool:
    if any(marker in syllable for marker in SHORT_VOWEL_MARKS):
        return True

    return any(pattern.search(syllable) for pattern in SHORT_VOWEL_PATTERNS)


def build_tone_rule(
    label: ToneLabel,
    consonant_class: str,
    syllable_type: str,
    tone_key: str,
) -> str:
    mark_label = TONE_MARK_LABELS[tone_key]
    if tone_key == "none":
        return (
            f"{label} tone from a {consonant_class}-class consonant in a "
            f"{syllable_type} syllable with no tone mark."
        )

    return (
        f"{label} tone from a {consonant_class}-class consonant in a "
        f"{syllable_type} syllable with {mark_label}."
    )


def build_tone_explanation(
    label: ToneLabel,
    consonant_class: str,
    syllable_type: str,
    tone_key: str,
) -> str:
    if tone_key == "none":
        return (
            f"This syllable has no explicit tone mark, so Thai tone rules fall back to the "
            f"initial consonant class ({consonant_class}) and whether the syllable is "
            f"{syllable_type}."
        )

    return (
        f"This syllable uses {TONE_MARK_LABELS[tone_key]}, then resolves through the "
        f"{consonant_class}-class + {syllable_type} syllable rule to produce a {label} tone."
    )
