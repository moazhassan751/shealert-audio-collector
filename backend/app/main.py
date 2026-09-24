import csv
import io
import json
import logging
import secrets
import shutil
import time
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .google_services import GoogleDriveStore, GoogleSheetStore
from .models import AdminLogin, RecordingFields, RecordingResult
from .storage import DatasetStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()
content_path = Path(__file__).resolve().parents[2] / "session_content.json"
session_content = json.loads(content_path.read_text(encoding="utf-8"))
environments = session_content["environments"]


def flatten_content(content_gender: str) -> list[dict]:
    rows = []
    for section in session_content[content_gender]["sections"]:
        for item in section["items"]:
            for take in item["takes"]:
                rows.append({
                    "id": item["code"], "text_urdu": item["word"],
                    "translation": item.get("meaning") or item.get("prompt", ""),
                    "category": section["title"], "section_class": section["class"],
                    "take_code": take["code"], "intensity": take.get("intensity", ""),
                    "loudness": item.get("loudness", ""), "prompt": item.get("prompt", ""),
                    "instruction": section["instruction"],
                })
    return rows


phrases = flatten_content("female") + flatten_content("male")
phrase_lookup = {
    (gender, item["id"], item["take_code"], item["section_class"]): item
    for gender in ("female", "male") for item in flatten_content(gender)
}
tokens: set[str] = set()

drive = None
sheets = None
credentials_json = None
if settings.google_drive_root_folder_id:
    try:
        credentials_json = settings.google_credentials_json
        if not credentials_json:
            raise RuntimeError("Google service-account credentials are not configured")
        drive = GoogleDriveStore(credentials_json, settings.google_drive_root_folder_id,
                                 settings.google_drive_shared_drive_id)
        if settings.google_sheet_id:
            sheets = GoogleSheetStore(credentials_json, settings.google_sheet_id)
        logger.info("Google Drive integration enabled")
    except Exception:
        logger.exception("Google integration disabled; local storage remains active")
store = DatasetStore(settings, drive, sheets)
app = FastAPI(title="SheAlert Audio Dataset API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


def admin_required(x_admin_token: str | None = Header(default=None)) -> None:
    if not x_admin_token or x_admin_token not in tokens:
        raise HTTPException(status_code=401, detail="Administrator authentication required")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "storage": "google-drive+local" if drive else "local",
        "google_drive_connected": drive is not None,
        "phrases": len(phrases),
    }


@app.get("/api/phrases")
def get_phrases() -> list[dict]:
    return phrases


@app.get("/api/session-content")
def get_session_content() -> dict:
    return session_content


active_reservations: dict[str, float] = {}


@app.get("/api/next-participant-id")
def get_next_participant_id(gender: str) -> dict:
    gender = gender.lower()
    if gender not in {"female", "male", "unspecified"}:
        raise HTTPException(status_code=400, detail="Invalid gender")
    prefix = {"female": "F", "male": "M", "unspecified": "U"}[gender]
    max_num = {"female": 75, "male": 20, "unspecified": 99}[gender]

    now = time.time()
    for pid in list(active_reservations.keys()):
        if active_reservations[pid] < now:
            del active_reservations[pid]

    records = store.list_records()
    used_ids: set[str] = set()
    for rec in records:
        pid = (rec.get("participant_id") or "").strip().upper()
        if pid:
            used_ids.add(pid)
            if pid.startswith(prefix) and pid[1:].isdigit():
                used_ids.add(f"{prefix}{int(pid[1:]):02d}")
                used_ids.add(f"{prefix}{int(pid[1:]):03d}")

    reserved_set = set(active_reservations.keys())

    for num in range(1, max_num + 1):
        formatted_id = f"{prefix}{num:02d}"
        if formatted_id not in used_ids and formatted_id not in reserved_set:
            active_reservations[formatted_id] = now + (30 * 60)
            return {"participant_id": formatted_id, "available": True}

    for num in range(1, max_num + 1):
        formatted_id = f"{prefix}{num:02d}"
        if formatted_id not in used_ids:
            return {"participant_id": formatted_id, "available": True}

    return {"participant_id": f"{prefix}{max_num:02d}", "available": False, "message": "All slots are filled"}


@app.post("/api/admin/login")
def admin_login(payload: AdminLogin) -> dict:
    if not secrets.compare_digest(payload.password, settings.admin_password):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = secrets.token_urlsafe(32)
    tokens.add(token)
    return {"token": token}


@app.get("/api/stats")
def get_stats(_: None = Depends(admin_required)) -> dict:
    return store.stats()


@app.get("/api/metadata")
def get_metadata(_: None = Depends(admin_required)) -> list[dict]:
    return store.metadata()


@app.get("/api/metadata/export")
def export_metadata(_: None = Depends(admin_required)) -> StreamingResponse:
    rows = store.metadata()
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=store.CSV_FIELDS if hasattr(store, "CSV_FIELDS") else [
        "recording_id", "participant_id", "gender_category", "phrase_id", "phrase_text", "translation",
        "category", "recording_number", "environment", "age_group", "native_language", "timestamp",
        "duration_seconds", "sample_rate", "channels", "original_filename", "standardized_filename",
        "google_drive_file_id", "google_drive_folder_path", "upload_status",
    ])
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=metadata.csv"})


@app.post("/api/admin/retry-failed")
def retry_failed(_: None = Depends(admin_required)) -> dict:
    results = []
    for record in store.list_records():
        if record.get("upload_status") in ("FAILED", "SAVED_LOCAL_DRIVE_PENDING") or not record.get("google_drive_file_id"):
            try:
                results.append(store.retry_failed(record["recording_id"]))
            except Exception as exc:
                results.append({"recording_id": record["recording_id"], "upload_status": "FAILED", "error": str(exc)})
    return {"results": results}


@app.post("/api/admin/sync-drive")
def sync_drive(_: None = Depends(admin_required)) -> dict:
    if not drive:
        raise HTTPException(
            status_code=503,
            detail="Google Drive is not connected. Please re-authenticate using 'python scripts/setup_google_drive_oauth.py'."
        )
    return store.sync_drive_pending()


@app.post("/api/recordings", response_model=RecordingResult)
async def upload_recording(
    audio: UploadFile = File(...),
    recording_id: str = Form(...), participant_id: str = Form(...), age_group: str = Form(...),
    gender_category: str = Form(...), native_language: str = Form(...), environment: str = Form(...),
    phrase_id: str = Form(...), phrase_text: str = Form(...), translation: str = Form(...),
    category: str = Form(...), section_class: str = Form(...), take_code: str = Form(...),
    recording_number: int = Form(...), consent: bool = Form(...),
) -> RecordingResult:
    try:
        fields = RecordingFields(
            recording_id=recording_id, participant_id=participant_id, age_group=age_group,
            gender_category=gender_category, native_language=native_language, environment=environment,
            phrase_id=phrase_id, phrase_text=phrase_text, translation=translation, category=category,
            section_class=section_class, take_code=take_code,
            recording_number=recording_number, consent=consent, mime_type=audio.content_type or "audio/webm",
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    prefix = fields.participant_id[0]
    if fields.gender_category.value == "female" and prefix != "F":
        raise HTTPException(status_code=422, detail="Female volunteers must use an F01-F75 ID.")
    if fields.gender_category.value == "male" and prefix != "M":
        raise HTTPException(status_code=422, detail="Male volunteers must use an M01-M20 ID.")
    if fields.gender_category.value == "unspecified" and prefix != "U":
        raise HTTPException(status_code=422, detail="Unspecified volunteers must use a U01-U99 ID.")
    content_gender = "male" if fields.gender_category.value == "male" else "female"
    expected = phrase_lookup.get((content_gender, fields.phrase_id, fields.take_code, fields.section_class))
    if not expected:
        raise HTTPException(
            status_code=422,
            detail=(
                "The item and take do not match this volunteer's session. "
                f"Received {content_gender}/{fields.phrase_id}/{fields.take_code}/{fields.section_class}."
            ),
        )
    if fields.phrase_text != expected["text_urdu"] or fields.category != expected["category"]:
        raise HTTPException(status_code=422, detail="The submitted script text does not match the source-of-truth session.")
    fields.environment_name = environments[fields.environment]
    fields.content_gender = content_gender
    fields.intensity = expected["intensity"]
    fields.loudness = expected["loudness"]
    allowed_types = {"audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mp4", "application/octet-stream"}
    content_type = (audio.content_type or "").lower().split(";", 1)[0].strip()
    if content_type and content_type not in allowed_types:
        raise HTTPException(status_code=415, detail="Unsupported audio file type")
    existing = store.get(fields.recording_id)
    if existing and existing.get("upload_status") == "COMPLETED":
        return RecordingResult(
            recording_id=fields.recording_id,
            status="COMPLETED",
            message="This recording was already uploaded.",
            original_filename=existing.get("original_filename"),
            standardized_filename=existing.get("standardized_filename"),
            drive_file_id=existing.get("google_drive_file_id") or None,
        )
    suffix = ".wav" if "wav" in (audio.content_type or "").lower() else (".ogg" if "ogg" in (audio.content_type or "").lower() else ".webm")
    if (audio.filename or "").lower().endswith(".wav") or "wav" in (audio.content_type or ""):
        suffix = ".wav"
    temporary = settings.temp_root.resolve() / f"{fields.recording_id}{suffix}.uploading"
    total = 0
    try:
        with temporary.open("wb") as handle:
            while chunk := await audio.read(1024 * 1024):
                total += len(chunk)
                if total > settings.max_upload_mb * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="Recording exceeds the upload size limit")
                handle.write(chunk)
        record = store.process(fields, temporary)
        return RecordingResult(recording_id=fields.recording_id, status="COMPLETED",
                               message="Recording submitted successfully.",
                               original_filename=record.get("original_filename"),
                               standardized_filename=record.get("standardized_filename"),
                               drive_file_id=record.get("google_drive_file_id") or None)
    except HTTPException:
        if temporary.exists():
            temporary.unlink()
        raise
    except Exception as exc:
        if temporary.exists():
            # Preserve a failed upload in temp for server-side recovery rather than deleting data.
            failed = settings.temp_root.resolve() / f"{fields.recording_id}.failed{suffix}"
            shutil.move(str(temporary), str(failed))
        raise HTTPException(status_code=422, detail=str(exc)) from exc


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (frontend_dist / "index.html").exists():
    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = frontend_dist / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")

