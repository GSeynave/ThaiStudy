from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    AppUserAccountResponse,
    AnkiDecksResponse,
    AnkiExportRequest,
    AnkiExportResponse,
    AnkiSelfTestResponse,
    AnkiStatusResponse,
    ContextualTranslationRequest,
    ContextualTranslationResponse,
    StudyPlanResponse,
    StudyAnkiExportRequest,
    StudyPreferencesResponse,
    StudyPreferencesUpdateRequest,
    StudyVideoHistoryEntry,
    StudyVideoHistoryResponse,
    StudyQuotaResponse,
    StudyVideoOpenRequest,
    StudyWordActivityResponse,
    StudyWordInteractionRequest,
    StudyWordStatsResponse,
)
from app.services.anki_connect import (
    AnkiConnectError,
    export_flashcard_to_anki,
    get_anki_decks,
    get_anki_self_test,
    get_anki_status,
)
from app.services.contextual_translation import build_contextual_translation
from app.services.study_history import (
    get_video_history,
    get_study_quota,
    get_study_plan,
    get_study_preferences,
    get_word_stats,
    list_word_activity,
    record_anki_export,
    record_video_open,
    record_word_click,
    update_study_preferences,
)
from app.services.supabase_auth import (
    AuthenticatedSupabaseUser,
    SupabaseAuthError,
    verify_bearer_token,
)
from app.services.user_accounts import get_app_user_account, purge_app_user_data, sync_app_user_account


app = FastAPI(
    title="Thai Study backend",
    version="0.1.0",
    description="Contextual translation backend for the Thai Study frontend.",
)


def get_authenticated_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> AuthenticatedSupabaseUser:
    try:
        return verify_bearer_token(authorization)
    except SupabaseAuthError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error


def get_study_user_id(user: AuthenticatedSupabaseUser = Depends(get_authenticated_user)) -> str:
    sync_app_user_account(user.id, user.email)
    return user.id

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/contextual-translation", response_model=ContextualTranslationResponse)
def contextual_translation(
    payload: ContextualTranslationRequest,
) -> ContextualTranslationResponse:
    return build_contextual_translation(payload.word, payload.sentence)


@app.post("/api/study/video-open", response_model=StudyVideoHistoryEntry)
def study_video_open(
    payload: StudyVideoOpenRequest,
    user_id: str = Depends(get_study_user_id),
) -> StudyVideoHistoryEntry:
    return record_video_open(user_id, payload.videoId, payload.videoTitle)


@app.get("/api/study/video-history", response_model=StudyVideoHistoryResponse)
def study_video_history(
    limit: int = 10,
    user_id: str = Depends(get_study_user_id),
) -> StudyVideoHistoryResponse:
    return get_video_history(user_id, limit=limit)


@app.get("/api/study/words", response_model=StudyWordActivityResponse)
def study_word_activity(
    limit: int = 20,
    user_id: str = Depends(get_study_user_id),
) -> StudyWordActivityResponse:
    return list_word_activity(user_id, limit=limit)


@app.get("/api/study/quota", response_model=StudyQuotaResponse)
def study_quota(
    user_id: str = Depends(get_study_user_id),
) -> StudyQuotaResponse:
    return get_study_quota(user_id)


@app.get("/api/study/preferences", response_model=StudyPreferencesResponse)
def study_preferences(
    user_id: str = Depends(get_study_user_id),
) -> StudyPreferencesResponse:
    return get_study_preferences(user_id)


@app.put("/api/study/preferences", response_model=StudyPreferencesResponse)
def study_preferences_update(
    payload: StudyPreferencesUpdateRequest,
    user_id: str = Depends(get_study_user_id),
) -> StudyPreferencesResponse:
    return update_study_preferences(user_id, payload)


@app.get("/api/study/plan", response_model=StudyPlanResponse)
def study_plan(
    user_id: str = Depends(get_study_user_id),
) -> StudyPlanResponse:
    return get_study_plan(user_id)


@app.get("/api/account", response_model=AppUserAccountResponse)
def app_account(
    user: AuthenticatedSupabaseUser = Depends(get_authenticated_user),
) -> AppUserAccountResponse:
    return get_app_user_account(user.id) or sync_app_user_account(
        user.id,
        user.email,
    )


@app.delete("/api/account/data", response_model=AppUserAccountResponse)
def app_account_purge_data(
    user: AuthenticatedSupabaseUser = Depends(get_authenticated_user),
) -> AppUserAccountResponse:
    return purge_app_user_data(user.id, user.email)


@app.get("/api/study/word-stats", response_model=StudyWordStatsResponse)
def study_word_stats(
    word: str,
    user_id: str = Depends(get_study_user_id),
) -> StudyWordStatsResponse:
    return get_word_stats(user_id, word)


@app.post("/api/study/word-click", response_model=StudyWordStatsResponse)
def study_word_click(
    payload: StudyWordInteractionRequest,
    user_id: str = Depends(get_study_user_id),
) -> StudyWordStatsResponse:
    return record_word_click(user_id, payload.videoId, payload.word, payload.sentence)


@app.post("/api/study/anki-exported", response_model=StudyWordStatsResponse)
def study_anki_exported(
    payload: StudyAnkiExportRequest,
    user_id: str = Depends(get_study_user_id),
) -> StudyWordStatsResponse:
    return record_anki_export(user_id, payload)


@app.get("/api/anki/status", response_model=AnkiStatusResponse)
def anki_status() -> AnkiStatusResponse:
    return get_anki_status()


@app.get("/api/anki/decks", response_model=AnkiDecksResponse)
def anki_decks() -> AnkiDecksResponse:
    try:
        return get_anki_decks()
    except AnkiConnectError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/api/anki/self-test", response_model=AnkiSelfTestResponse)
def anki_self_test() -> AnkiSelfTestResponse:
    return get_anki_self_test()


@app.post("/api/anki/export-note", response_model=AnkiExportResponse)
def anki_export_note(payload: AnkiExportRequest) -> AnkiExportResponse:
    try:
        return export_flashcard_to_anki(payload)
    except AnkiConnectError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
