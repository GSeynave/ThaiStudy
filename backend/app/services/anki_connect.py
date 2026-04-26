from __future__ import annotations

import base64
import json
import re
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from app.models import (
    AnkiToneDetail,
    AnkiDecksResponse,
    AnkiExportRequest,
    AnkiExportResponse,
    AnkiSelfTestResponse,
    AnkiStatusResponse,
)


ANKI_CONNECT_URL = "http://127.0.0.1:8765"
ANKI_CONNECT_VERSION = 6
ANKI_MODEL_NAME = "ThaiStudyBasic"
ANKI_CONNECT_TIMEOUT_SECONDS = 8

ANKI_MODEL_FIELDS = [
    "Word",
    "Translation",
    "Sentence",
    "Romanization",
    "Tone",
    "Audio",
    "Video",
    "Source",
]

ANKI_CSS = """
.card {
  font-family: "Noto Sans Thai", "Noto Sans", sans-serif;
  font-size: 22px;
  text-align: left;
  color: #1f2b23;
  background:
    radial-gradient(circle at top, rgba(248, 252, 248, 0.98), rgba(239, 246, 240, 0.98) 54%, rgba(228, 238, 229, 0.98) 100%);
  padding: 32px 30px 30px;
  line-height: 1.5;
}
.card.night_mode {
  color: #e4eee7;
  background: linear-gradient(180deg, #111715 0%, #17201b 100%);
}
.frame {
  max-width: 34rem;
  margin: 0 auto;
}
.eyebrow {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #62786a;
  margin-bottom: 0.9rem;
}
.card.night_mode .eyebrow {
  color: #95afa0;
}
.word {
  font-size: 2.9rem;
  line-height: 1.08;
  letter-spacing: 0.01em;
  margin-bottom: 1rem;
  font-weight: 600;
}
.translation {
  font-size: 1.65rem;
  line-height: 1.24;
  color: #244536;
  font-weight: 600;
  margin: 0 0 1.2rem;
}
.card.night_mode .translation {
  color: #bbddc5;
}
.sentence {
  font-size: 1.16rem;
  line-height: 1.78;
  color: #32453a;
  margin: 0;
}
.card.night_mode .sentence {
  color: #cfddd3;
}
.answer {
  border: 0;
  border-top: 1px solid rgba(70, 101, 82, 0.24);
  margin: 1.35rem 0 1.35rem;
}
.card.night_mode .answer {
  border-top-color: rgba(184, 217, 196, 0.18);
}
.section {
  margin-top: 1.1rem;
}
.row {
  display: flex;
  gap: 0.8rem;
  align-items: baseline;
  padding: 0.34rem 0;
}
.label {
  flex: 0 0 6rem;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #6f8779;
}
.card.night_mode .label {
  color: #8ea697;
}
.meta {
  flex: 1;
  min-width: 0;
  color: #46594e;
  font-size: 0.98rem;
  line-height: 1.7;
}
.card.night_mode .meta {
  color: #c6d4cc;
}
.tone-block {
  padding-top: 0.2rem;
}
.tone-stack {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.tone-card {
  border: 1px solid rgba(70, 101, 82, 0.18);
  border-radius: 0.9rem;
  padding: 0.8rem 0.9rem 0.85rem;
  background: rgba(255, 255, 255, 0.42);
}
.card.night_mode .tone-card {
  border-color: rgba(184, 217, 196, 0.15);
  background: rgba(255, 255, 255, 0.04);
}
.tone-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}
.tone-word {
  font-size: 1.02rem;
  color: #22372c;
  font-weight: 600;
}
.card.night_mode .tone-word {
  color: #dbe8df;
}
.tone-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.16rem 0.52rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: rgba(47, 91, 69, 0.1);
}
.tone-mid { color: #1d5f91; }
.tone-low { color: #6a2ba0; }
.tone-falling { color: #b33b52; }
.tone-high { color: #9a5b00; }
.tone-rising { color: #1f7a4f; }
.tone-unknown { color: #51625a; }
.card.night_mode .tone-pill {
  background: rgba(255, 255, 255, 0.06);
}
.tone-pronunciation {
  margin-top: 0.35rem;
  color: #5b6f64;
  font-size: 0.84rem;
}
.card.night_mode .tone-pronunciation {
  color: #b1c2b8;
}
.tone-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.7rem;
}
.tone-detail {
  border-radius: 0.65rem;
  border: 1px solid rgba(70, 101, 82, 0.14);
  background: rgba(246, 250, 247, 0.72);
  padding: 0.45rem 0.55rem;
}
.card.night_mode .tone-detail {
  border-color: rgba(184, 217, 196, 0.12);
  background: rgba(255, 255, 255, 0.035);
}
.tone-detail-label {
  font-size: 0.56rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #708579;
}
.card.night_mode .tone-detail-label {
  color: #8ea697;
}
.tone-detail-value {
  margin-top: 0.18rem;
  font-size: 0.76rem;
  color: #42554b;
  line-height: 1.45;
}
.card.night_mode .tone-detail-value {
  color: #d0ddd5;
}
.tone-explanation {
  margin-top: 0.62rem;
  font-size: 0.8rem;
  line-height: 1.55;
  color: #51645a;
}
.card.night_mode .tone-explanation {
  color: #c7d6cd;
}
.media {
  margin-top: 1.1rem;
}
.media .replay-button,
.media a.replaybutton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 999px;
  background: #2f5b45;
  color: #f6faf7;
  text-decoration: none;
  box-shadow: none;
}
.card.night_mode .media .replay-button,
.card.night_mode .media a.replaybutton {
  background: #80a48e;
  color: #0f1512;
}
.links a,
a {
  color: #2f634a;
  text-decoration: none;
}
.card.night_mode .links a,
.card.night_mode a {
  color: #b9d7c2;
}
.links a:hover,
a:hover {
  text-decoration: underline;
}
"""

ANKI_FRONT_TEMPLATE = """
<div class="frame">
  <div class="eyebrow">Thai Study</div>
  <div class="word">{{Word}}</div>
  {{#Sentence}}
  <div class="section">
    <div class="sentence">{{Sentence}}</div>
  </div>
  {{/Sentence}}
  {{#Audio}}
  <div class="media">{{Audio}}</div>
  {{/Audio}}
</div>
"""

ANKI_BACK_TEMPLATE = """
<div class="frame">
  <div class="eyebrow">Thai Study</div>
  <div class="word">{{Word}}</div>
  {{#Translation}}
  <div class="translation">{{Translation}}</div>
  {{/Translation}}
  {{#Sentence}}
  <div class="sentence">{{Sentence}}</div>
  {{/Sentence}}
  {{#Audio}}
  <div class="media">{{Audio}}</div>
  {{/Audio}}
  <hr class="answer">
  <div class="section">
    {{#Romanization}}
    <div class="row">
      <div class="label">Romanized</div>
      <div class="meta">{{Romanization}}</div>
    </div>
    {{/Romanization}}
    {{#Tone}}
    <div class="row">
      <div class="label">Tone</div>
      <div class="meta tone-block">{{Tone}}</div>
    </div>
    {{/Tone}}
    {{#Video}}
    <div class="row links">
      <div class="label">Video</div>
      <div class="meta">{{Video}}</div>
    </div>
    {{/Video}}
    {{#Source}}
    <div class="row links">
      <div class="label">Source</div>
      <div class="meta">{{Source}}</div>
    </div>
    {{/Source}}
  </div>
</div>
"""


class AnkiConnectError(Exception):
    pass


def get_anki_status() -> AnkiStatusResponse:
    try:
        version = int(_call_anki_connect("version"))
        model_ready = ensure_anki_model()
        return AnkiStatusResponse(
            available=True,
            version=version,
            modelName=ANKI_MODEL_NAME if model_ready else None,
        )
    except AnkiConnectError as error:
        return AnkiStatusResponse(available=False, error=str(error), modelName=ANKI_MODEL_NAME)


def get_anki_decks() -> AnkiDecksResponse:
    decks = _call_anki_connect("deckNames")
    if not isinstance(decks, list):
        raise AnkiConnectError("AnkiConnect returned an invalid deck list.")

    return AnkiDecksResponse(decks=sorted(str(deck) for deck in decks))


def get_anki_self_test() -> AnkiSelfTestResponse:
    try:
        version = int(_call_anki_connect("version"))
        model_ready = ensure_anki_model()
        decks = get_anki_decks()
        return AnkiSelfTestResponse(
            available=True,
            version=version,
            modelReady=model_ready,
            canListDecks=len(decks.decks) >= 0,
        )
    except AnkiConnectError as error:
        return AnkiSelfTestResponse(
            available=False,
            version=None,
            modelReady=False,
            canListDecks=False,
            error=str(error),
        )


def export_flashcard_to_anki(payload: AnkiExportRequest) -> AnkiExportResponse:
    ensure_anki_model()

    duplicate_note_ids = find_duplicate_notes(payload.word, payload.sentence)
    if duplicate_note_ids:
        return AnkiExportResponse(
            noteId=duplicate_note_ids[0],
            duplicate=True,
            mediaStored=[],
            modelName=ANKI_MODEL_NAME,
        )

    media_fields = maybe_store_audio(payload.dictionaryAudioUrl, payload.word)
    note = {
        "deckName": payload.deckName,
        "modelName": ANKI_MODEL_NAME,
        "fields": build_anki_fields(payload, media_fields["audio"]),
        "options": {
            "allowDuplicate": False,
        },
        "tags": build_tags(payload.tags),
    }

    note_id = _call_anki_connect("addNote", {"note": note})
    if not isinstance(note_id, int):
        raise AnkiConnectError("AnkiConnect did not return a valid note id.")

    return AnkiExportResponse(
        noteId=note_id,
        duplicate=False,
        mediaStored=media_fields["stored_files"],
        modelName=ANKI_MODEL_NAME,
    )


def ensure_anki_model() -> bool:
    model_names = _call_anki_connect("modelNames")
    if not isinstance(model_names, list):
        raise AnkiConnectError("AnkiConnect returned an invalid model list.")

    if ANKI_MODEL_NAME in model_names:
        sync_anki_model()
        return True

    result = _call_anki_connect(
        "createModel",
        {
            "modelName": ANKI_MODEL_NAME,
            "inOrderFields": ANKI_MODEL_FIELDS,
            "css": ANKI_CSS,
            "cardTemplates": [
                {
                    "Name": "Card 1",
                    "Front": ANKI_FRONT_TEMPLATE,
                    "Back": ANKI_BACK_TEMPLATE,
                }
            ],
        },
    )

    if result is None:
        return True

    return bool(result)


def sync_anki_model() -> None:
    _update_model_styling()
    _update_model_templates()


def _update_model_styling() -> None:
    payload_options = [
        {"model": {"name": ANKI_MODEL_NAME, "css": ANKI_CSS}},
        {"modelName": ANKI_MODEL_NAME, "css": ANKI_CSS},
    ]

    _try_anki_payloads("updateModelStyling", payload_options)


def _update_model_templates() -> None:
    payload_options = [
        {
            "model": {
                "name": ANKI_MODEL_NAME,
                "templates": {
                    "Card 1": {
                        "Front": ANKI_FRONT_TEMPLATE,
                        "Back": ANKI_BACK_TEMPLATE,
                    }
                },
            }
        },
        {
            "modelName": ANKI_MODEL_NAME,
            "templates": {
                "Card 1": {
                    "Front": ANKI_FRONT_TEMPLATE,
                    "Back": ANKI_BACK_TEMPLATE,
                }
            },
        },
    ]

    _try_anki_payloads("updateModelTemplates", payload_options)


def find_duplicate_notes(word: str, sentence: str) -> list[int]:
    query = (
        f'note:"{ANKI_MODEL_NAME}" '
        f'Word:"{escape_anki_query(word.strip())}" '
        f'Sentence:"{escape_anki_query(sentence.strip())}"'
    )
    note_ids = _call_anki_connect("findNotes", {"query": query})
    if not isinstance(note_ids, list):
        raise AnkiConnectError("AnkiConnect returned an invalid duplicate search result.")

    return [int(note_id) for note_id in note_ids]


def build_anki_fields(payload: AnkiExportRequest, audio_markup: str) -> dict[str, str]:
    video_markup = ""
    if payload.sourceUrl:
        video_markup = (
            f"<a href='{escape_html(payload.sourceUrl)}'>Source link</a>"
        )

    return {
        "Word": escape_html(payload.word.strip()),
        "Translation": escape_html(payload.translation.strip()),
        "Sentence": escape_html(payload.sentence.strip()),
        "Romanization": escape_html((payload.romanized or "").strip()),
        "Tone": build_tone_markup(payload),
        "Audio": audio_markup,
        "Video": video_markup,
        "Source": video_markup,
    }


def build_tone_markup(payload: AnkiExportRequest) -> str:
    if payload.toneDetails:
        cards = "".join(build_tone_detail_card(detail) for detail in payload.toneDetails)
        return f"<div class='tone-stack'>{cards}</div>"

    if payload.tones:
        return escape_html(", ".join(payload.tones))

    return ""


def build_tone_detail_card(detail: AnkiToneDetail) -> str:
    tone_class = f"tone-{detail.label}"
    pronunciation_parts = [
        escape_html(part.strip())
        for part in (detail.pronunciation, detail.romanized, detail.ipa)
        if part and part.strip()
    ]
    tone_meta = [
        ("Class", detail.consonantClass),
        ("Type", detail.syllableType),
        ("Mark", detail.toneMark),
        ("Result", detail.label),
    ]
    meta_markup = "".join(
        (
            "<div class='tone-detail'>"
            f"<div class='tone-detail-label'>{escape_html(label)}</div>"
            f"<div class='tone-detail-value'>{escape_html(format_tone_value(value))}</div>"
            "</div>"
        )
        for label, value in tone_meta
    )
    explanation = detail.explanation or detail.rule

    pronunciation_markup = (
        f"<div class='tone-pronunciation'>{' · '.join(pronunciation_parts)}</div>"
        if pronunciation_parts
        else ""
    )
    explanation_markup = (
        f"<div class='tone-explanation'>{escape_html(explanation.strip())}</div>"
        if explanation and explanation.strip()
        else ""
    )

    return (
        "<div class='tone-card'>"
        "<div class='tone-head'>"
        f"<span class='tone-word'>{escape_html(detail.text.strip())}</span>"
        f"<span class='tone-pill {tone_class}'>{escape_html(detail.label)} tone</span>"
        "</div>"
        f"{pronunciation_markup}"
        f"<div class='tone-grid'>{meta_markup}</div>"
        f"{explanation_markup}"
        "</div>"
    )


def format_tone_value(value: str | None) -> str:
    if not value:
        return "Unknown"

    if value == "none":
        return "None"

    return value.replace("_", " ").title()


def maybe_store_audio(audio_url: str | None, word: str) -> dict[str, str | list[str]]:
    if not audio_url:
        return {"audio": "", "stored_files": []}

    audio_bytes = _fetch_binary(audio_url)
    if audio_bytes is None:
        return {"audio": "", "stored_files": []}

    filename = build_audio_filename(word, audio_url)
    _call_anki_connect(
        "storeMediaFile",
        {
            "filename": filename,
            "data": base64.b64encode(audio_bytes).decode("ascii"),
        },
    )
    return {"audio": f"[sound:{filename}]", "stored_files": [filename]}


def build_audio_filename(word: str, audio_url: str) -> str:
    parsed = urlparse(audio_url)
    suffix = parsed.path.split("/")[-1].split(".")[-1].lower() or "mp3"
    normalized_word = re.sub(r"[^\w\u0E00-\u0E7F-]+", "-", word.strip()).strip("-")
    if not normalized_word:
        normalized_word = "thai-study"
    return f"thai-study-{normalized_word}.{suffix}"


def build_tags(tags: list[str]) -> list[str]:
    normalized_tags = {"thai-study"}
    for tag in tags:
        cleaned = tag.strip().replace(" ", "-")
        if cleaned:
            normalized_tags.add(cleaned)

    return sorted(normalized_tags)


def escape_html(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def escape_anki_query(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"', '\\"')


def _fetch_binary(url: str) -> bytes | None:
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 ThaiStudy/0.1"})
    try:
        with urlopen(request, timeout=ANKI_CONNECT_TIMEOUT_SECONDS) as response:
            return response.read()
    except Exception:
        return None


def _call_anki_connect(action: str, params: dict | None = None):
    request_payload = {
        "action": action,
        "version": ANKI_CONNECT_VERSION,
        "params": params or {},
    }
    request = Request(
        ANKI_CONNECT_URL,
        data=json.dumps(request_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    try:
        with urlopen(request, timeout=ANKI_CONNECT_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except URLError as error:
        raise AnkiConnectError(
            "Could not reach AnkiConnect at http://127.0.0.1:8765. Start Anki and enable AnkiConnect."
        ) from error
    except json.JSONDecodeError as error:
        raise AnkiConnectError("AnkiConnect returned invalid JSON.") from error

    if payload.get("error"):
        raise AnkiConnectError(str(payload["error"]))

    return payload.get("result")


def _try_anki_payloads(action: str, payload_options: list[dict]) -> None:
    last_error: AnkiConnectError | None = None
    for params in payload_options:
        try:
            _call_anki_connect(action, params)
            return
        except AnkiConnectError as error:
            last_error = error

    if last_error is not None:
        raise last_error
