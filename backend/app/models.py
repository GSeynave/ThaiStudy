from typing import Literal

from pydantic import BaseModel, Field


ToneLabel = Literal["mid", "low", "falling", "high", "rising", "unknown"]
StudyTheme = Literal["cozy", "night"]
PlanTier = Literal["free", "paid"]
PlanStatus = Literal["active", "inactive", "canceled", "past_due", "trialing"]


class ContextualTranslationRequest(BaseModel):
    word: str = Field(min_length=1)
    sentence: str = Field(min_length=1)


class TranslationSuggestion(BaseModel):
    translation: str
    score: float = Field(ge=0.0, le=1.0)
    rationale: str


class ToneMetadata(BaseModel):
    label: ToneLabel
    source: str
    rule: str | None = None
    explanation: str | None = None
    consonantClass: str | None = None
    syllableType: str | None = None
    toneMark: str | None = None


class PronunciationSyllable(BaseModel):
    text: str
    pronunciation: str
    romanized: str
    ipa: str | None
    tone: ToneMetadata


class Pronunciation(BaseModel):
    syllables: list[PronunciationSyllable]
    romanized: str
    ipa: str | None


class ExampleSentence(BaseModel):
    text: str
    translationHint: str
    source: str


class FlashcardFront(BaseModel):
    word: str
    hints: list[str]


class FlashcardBack(BaseModel):
    word: str
    chosenTranslation: str
    exampleSentence: str
    dictionaryAudioUrl: str | None = None


class FlashcardPreview(BaseModel):
    front: FlashcardFront
    back: FlashcardBack


class ContextualTranslationResponse(BaseModel):
    word: str
    sentence: str
    sentenceTokens: list[str]
    suggestions: list[TranslationSuggestion]
    pronunciation: Pronunciation
    dictionaryAudioUrl: str | None = None
    dictionarySourceUrl: str | None = None
    exampleSentences: list[ExampleSentence]
    flashcardPreview: FlashcardPreview


class StudyVideoOpenRequest(BaseModel):
    videoId: str = Field(min_length=1)
    videoTitle: str | None = None


class StudyWordInteractionRequest(BaseModel):
    videoId: str = Field(min_length=1)
    word: str = Field(min_length=1)
    sentence: str = Field(min_length=1)


class StudyAnkiExportRequest(StudyWordInteractionRequest):
    noteId: int
    deckName: str = Field(min_length=1)
    modelName: str = Field(min_length=1)


class StudyWordStatsResponse(BaseModel):
    word: str
    clickCount: int
    flashcardCount: int
    lastClickedAt: str | None = None
    lastFlashcardAt: str | None = None
    lastSentence: str | None = None
    exportedToAnki: bool = False
    exportedNoteId: int | None = None
    exportedDeckName: str | None = None
    exportedModelName: str | None = None
    exportedAt: str | None = None


class StudyVideoHistoryEntry(BaseModel):
    videoId: str
    videoTitle: str | None = None
    openedCount: int
    totalWordClicks: int
    flashcardsCreated: int
    uniqueWordsClicked: int
    lastOpenedAt: str


class StudyVideoHistoryResponse(BaseModel):
    videos: list[StudyVideoHistoryEntry]


class StudyWordActivityResponse(BaseModel):
    words: list[StudyWordStatsResponse]


class StudyQuotaResponse(BaseModel):
    monthlyFlashcardLimit: int
    monthlyFlashcardExportsUsed: int
    monthlyFlashcardExportsRemaining: int
    resetsAt: str
    hasReachedMonthlyFlashcardLimit: bool


class StudyPreferencesUpdateRequest(BaseModel):
    defaultDeck: str | None = None
    autoExportToAnki: bool = False
    theme: StudyTheme = "cozy"
    showToneColors: bool = False


class StudyPreferencesResponse(StudyPreferencesUpdateRequest):
    hasStoredPreferences: bool


class StudyPlanResponse(BaseModel):
    planTier: PlanTier
    planStatus: PlanStatus
    monthlyFlashcardLimit: int
    currentPeriodStartsAt: str | None = None
    currentPeriodEndsAt: str | None = None


class AppUserAccountResponse(BaseModel):
    id: str
    email: str | None = None
    createdAt: str
    updatedAt: str
    lastSeenAt: str
    deletionRequestedAt: str | None = None
    dataPurgedAt: str | None = None


class AnkiStatusResponse(BaseModel):
    available: bool
    version: int | None = None
    error: str | None = None
    modelName: str | None = None


class AnkiDecksResponse(BaseModel):
    decks: list[str]


class AnkiSelfTestResponse(BaseModel):
    available: bool
    version: int | None = None
    modelReady: bool
    canListDecks: bool
    error: str | None = None


class AnkiToneDetail(BaseModel):
    text: str = Field(min_length=1)
    label: ToneLabel
    pronunciation: str | None = None
    romanized: str | None = None
    ipa: str | None = None
    consonantClass: str | None = None
    syllableType: str | None = None
    toneMark: str | None = None
    rule: str | None = None
    explanation: str | None = None


class AnkiExportRequest(BaseModel):
    deckName: str = Field(min_length=1)
    word: str = Field(min_length=1)
    translation: str = Field(min_length=1)
    sentence: str = Field(min_length=1)
    romanized: str | None = None
    tones: list[str] = Field(default_factory=list)
    toneDetails: list[AnkiToneDetail] = Field(default_factory=list)
    sourceUrl: str | None = None
    dictionaryAudioUrl: str | None = None
    tags: list[str] = Field(default_factory=list)


class AnkiExportResponse(BaseModel):
    noteId: int
    duplicate: bool = False
    mediaStored: list[str] = []
    modelName: str
