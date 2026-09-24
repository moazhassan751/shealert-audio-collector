import csv
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .audio import AudioError, convert_to_standard_wav
from .config import Settings
from .models import RecordingFields

logger = logging.getLogger(__name__)

CSV_FIELDS = [
    "recording_id", "volunteer_id", "participant_id", "gender_category", "class",
    "section_class", "word_code", "phrase_id", "phrase_text",
    "translation", "category", "take_code", "intensity", "loudness",
    "recording_number", "take_number", "environment", "environment_code", "environment_name",
    "environment_label", "content_gender", "age_group",
    "native_language", "timestamp", "duration_seconds", "sample_rate", "channels",
    "original_filename", "standardized_filename", "google_drive_file_id",
    "google_drive_folder_path", "upload_status",
]
BUCKETS = {"female": "female", "male": "male", "unspecified": "unspecified"}


def safe_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", value)[:80]


class DatasetStore:
    CSV_FIELDS = CSV_FIELDS

    def __init__(self, settings: Settings, drive: Any = None, sheets: Any = None):
        self.settings = settings
        self.drive = drive
        self.sheets = sheets
        self.lock = threading.RLock()
        self.dataset_root = settings.data_root.resolve()
        self.data_root = settings.data_file_root.resolve()
        self.temp_root = settings.temp_root.resolve()
        self.registry_path = self.data_root / "records.json"
        self.csv_path = self.dataset_root / "metadata" / "metadata.csv"
        for bucket in BUCKETS.values():
            (self.dataset_root / "audio" / bucket).mkdir(parents=True, exist_ok=True)
            (self.dataset_root / "originals" / bucket).mkdir(parents=True, exist_ok=True)
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)
        self.data_root.mkdir(parents=True, exist_ok=True)
        self.temp_root.mkdir(parents=True, exist_ok=True)
        if not self.registry_path.exists():
            self._write_registry({})
        if not self.csv_path.exists():
            with self.csv_path.open("w", newline="", encoding="utf-8") as handle:
                csv.DictWriter(handle, fieldnames=CSV_FIELDS).writeheader()

    def _read_registry(self) -> dict[str, dict[str, Any]]:
        try:
            return json.loads(self.registry_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _write_registry(self, records: dict[str, dict[str, Any]]) -> None:
        temporary = self.registry_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporary, self.registry_path)

    def get(self, recording_id: str) -> dict[str, Any] | None:
        with self.lock:
            return self._read_registry().get(recording_id)

    def list_records(self) -> list[dict[str, Any]]:
        with self.lock:
            return list(self._read_registry().values())

    def _record_name(self, fields: RecordingFields, extension: str) -> str:
        volunteer_id = f"{fields.participant_id[0]}{int(fields.participant_id[1:]):03d}"
        environment_code = f"E{int(fields.environment[1:]):02d}"
        base = f"SHEA_{volunteer_id}_{fields.section_class}_{safe_part(fields.phrase_id)}_{fields.take_code}_{environment_code}"
        return f"{base}.{extension}"

    def process(self, fields: RecordingFields, source: Path | None) -> dict[str, Any]:
        with self.lock:
            records = self._read_registry()
            existing = records.get(fields.recording_id)
            if existing and existing.get("status") == "COMPLETED":
                return existing
            bucket = BUCKETS[fields.gender_category.value]
            extension = "wav" if "wav" in fields.mime_type.lower() else ("ogg" if "ogg" in fields.mime_type.lower() else "webm")
            original_name = self._record_name(fields, extension)
            standardized_name = self._record_name(fields, "wav")
            original_path = self.dataset_root / "originals" / bucket / original_name
            standardized_path = self.dataset_root / "audio" / bucket / standardized_name
            if not original_path.exists():
                if source is None or not source.exists() or source.stat().st_size == 0:
                    raise AudioError("The uploaded file is missing or empty.")
                original_path.parent.mkdir(parents=True, exist_ok=True)
                source.replace(original_path)
            record = {
                "recording_id": fields.recording_id,
                "volunteer_id": fields.participant_id,
                "participant_id": fields.participant_id,
                "gender_category": fields.gender_category.value,
                "class": fields.section_class,
                "phrase_id": fields.phrase_id,
                "word_code": fields.phrase_id,
                "phrase_text": fields.phrase_text,
                "translation": fields.translation,
                "category": fields.category,
                "section_class": fields.section_class,
                "take_code": fields.take_code,
                "take_number": int(fields.take_code[1:]),
                "intensity": fields.intensity,
                "loudness": fields.loudness,
                "recording_number": fields.recording_number,
                "environment": fields.environment,
                "environment_code": fields.environment,
                "environment_name": fields.environment_name,
                "environment_label": fields.environment_name,
                "content_gender": fields.content_gender,
                "age_group": fields.age_group,
                "native_language": fields.native_language,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "original_filename": original_name,
                "standardized_filename": standardized_name,
                "upload_status": "UPLOADING",
            }
            records[fields.recording_id] = record
            self._write_registry(records)
            try:
                duration, sample_rate, channels = convert_to_standard_wav(
                    original_path, standardized_path, self.settings.ffmpeg_path, self.settings.min_duration_seconds
                )
                record.update({
                    "duration_seconds": round(duration, 3),
                    "sample_rate": sample_rate,
                    "channels": channels,
                    "upload_status": "AUDIO_VALIDATED",
                })
                drive_file_id = None
                folder_path = f"audio/{bucket}"
                drive_error = None
                if self.drive:
                    try:
                        drive_file_id = self.drive.upload_verified(standardized_path, standardized_name, bucket)
                        self.drive.upload_verified(original_path, original_name, bucket, originals=True)
                        folder_path = f"SheAlert_Dataset/audio/{bucket}"
                    except Exception as drive_exc:
                        drive_error = str(drive_exc)
                        if getattr(self.settings, "google_drive_required", False):
                            raise
                        logger.warning(
                            "Drive upload skipped/failed for recording_id=%s: %s. Local audio is safely stored.",
                            fields.recording_id, drive_exc
                        )
                upload_status = "SAVED_LOCAL_DRIVE_PENDING" if drive_error else "COMPLETED"
                record.update({
                    "google_drive_file_id": drive_file_id or "",
                    "google_drive_folder_path": folder_path,
                    "upload_status": upload_status,
                })
                if drive_error:
                    record["drive_error"] = drive_error[:500]
                self._upsert_csv(record)
                if self.sheets and not drive_error:
                    try:
                        self.sheets.append(record)
                    except Exception as sheet_exc:
                        logger.warning("Sheet append failed: %s", sheet_exc)
                record["upload_status"] = upload_status
                records[fields.recording_id] = record
                self._write_registry(records)
                self._upsert_csv(record)
                logger.info("recording_id=%s participant_id=%s gender=%s phrase=%s status=%s drive_file_id=%s",
                            fields.recording_id, fields.participant_id, bucket, fields.phrase_id, upload_status, drive_file_id)
                return record
            except Exception as exc:
                record["upload_status"] = "FAILED"
                record["error"] = str(exc)[:500]
                records[fields.recording_id] = record
                self._write_registry(records)
                logger.exception("recording_id=%s gender=%s status=FAILED", fields.recording_id, bucket)
                raise

    def retry_failed(self, recording_id: str) -> dict[str, Any]:
        with self.lock:
            record = self._read_registry().get(recording_id)
            if not record:
                raise KeyError(recording_id)
            if record.get("upload_status") == "COMPLETED" and record.get("google_drive_file_id"):
                return record
            fields = RecordingFields(
                recording_id=record["recording_id"], participant_id=record["participant_id"],
                age_group=record["age_group"], gender_category=record["gender_category"],
                native_language=record["native_language"], environment=record["environment"],
                phrase_id=record["phrase_id"], phrase_text=record["phrase_text"],
                translation=record["translation"], category=record["category"],
                section_class=record.get("section_class", "D"), take_code=record.get("take_code", "R01"),
                intensity=record.get("intensity", ""), loudness=record.get("loudness", ""),
                environment_name=record.get("environment_name", ""), content_gender=record.get("content_gender", "female"),
                recording_number=record["recording_number"], consent=True,
            )
            bucket = BUCKETS[fields.gender_category.value]
            original_path = self.dataset_root / "originals" / bucket / record["original_filename"]
            return self.process(fields, original_path)

    def sync_drive_pending(self) -> dict[str, Any]:
        if not self.drive:
            raise RuntimeError("Google Drive integration is not connected. Please re-authenticate Google Drive.")
        with self.lock:
            records = self._read_registry()
            synced = []
            failed = []
            for rid, rec in records.items():
                if rec.get("google_drive_file_id"):
                    continue
                bucket = rec.get("gender_category", "unspecified")
                std_name = rec.get("standardized_filename")
                orig_name = rec.get("original_filename")
                std_path = self.dataset_root / "audio" / bucket / std_name if std_name else None
                orig_path = self.dataset_root / "originals" / bucket / orig_name if orig_name else None
                if not std_path or not std_path.exists():
                    continue
                try:
                    drive_id = self.drive.upload_verified(std_path, std_name, bucket)
                    if orig_path and orig_path.exists():
                        self.drive.upload_verified(orig_path, orig_name, bucket, originals=True)
                    rec["google_drive_file_id"] = drive_id
                    rec["google_drive_folder_path"] = f"SheAlert_Dataset/audio/{bucket}"
                    rec["upload_status"] = "COMPLETED"
                    rec.pop("drive_error", None)
                    rec.pop("error", None)
                    self._upsert_csv(rec)
                    if self.sheets:
                        try:
                            self.sheets.append(rec)
                        except Exception as sheet_exc:
                            logger.warning("Sheet append failed: %s", sheet_exc)
                    synced.append({"recording_id": rid, "filename": std_name, "drive_file_id": drive_id})
                except Exception as exc:
                    rec["drive_error"] = str(exc)[:500]
                    rec["upload_status"] = "SAVED_LOCAL_DRIVE_PENDING"
                    failed.append({"recording_id": rid, "filename": std_name, "error": str(exc)})
            self._write_registry(records)
            return {"synced_count": len(synced), "failed_count": len(failed), "synced": synced, "failed": failed}

    def sync_from_drive(self) -> int:
        if not self.drive:
            return 0
        with self.lock:
            records = self._read_registry()
            try:
                q = "name contains 'SHEA_' and trashed = false"
                res = self.drive.service.files().list(
                    q=q, fields="files(id, name)", pageSize=1000, **self.drive._list_params()
                ).execute()
                files = res.get("files", [])
                added = 0
                for f in files:
                    fname = f.get("name", "")
                    fid = f.get("id", "")
                    m = re.match(r"^SHEA_([FMU])(\d{3})_([DAN])_([A-Za-z0-9_-]+)_(R\d{2})_(E\d{2})", fname)
                    if not m or not fname.endswith(".wav"):
                        continue
                    prefix, num_str, sec_class, word_code, take_code, env_code = m.groups()
                    part_id = f"{prefix}{int(num_str):02d}"
                    gender = "female" if prefix == "F" else ("male" if prefix == "M" else "unspecified")

                    existing = next(
                        (r for r in records.values() if r.get("participant_id") == part_id
                         and r.get("section_class") == sec_class
                         and r.get("phrase_id") == word_code
                         and r.get("take_code") == take_code), None
                    )
                    if existing:
                        if not existing.get("google_drive_file_id"):
                            existing["google_drive_file_id"] = fid
                            existing["upload_status"] = "COMPLETED"
                        continue

                    rec = {
                        "recording_id": f"drive-{fid[:20]}",
                        "volunteer_id": part_id,
                        "participant_id": part_id,
                        "gender_category": gender,
                        "class": sec_class,
                        "section_class": sec_class,
                        "phrase_id": word_code,
                        "word_code": word_code,
                        "phrase_text": word_code,
                        "translation": "",
                        "category": "Distress" if sec_class == "D" else ("Aggression" if sec_class == "A" else "Everyday"),
                        "take_code": take_code,
                        "take_number": int(take_code[1:]),
                        "recording_number": 1,
                        "environment": f"E{int(env_code[1:])}",
                        "environment_code": env_code,
                        "environment_name": "",
                        "content_gender": gender,
                        "age_group": "",
                        "native_language": "Urdu",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "original_filename": fname.replace(".wav", ".webm"),
                        "standardized_filename": fname,
                        "upload_status": "COMPLETED",
                        "google_drive_file_id": fid,
                        "google_drive_folder_path": f"SheAlert_Dataset/audio/{gender}",
                    }
                    records[rec["recording_id"]] = rec
                    self._upsert_csv(rec)
                    added += 1
                if added > 0:
                    self._write_registry(records)
                    logger.info("Synchronized %d recordings from Google Drive into local database", added)
                return added
            except Exception as exc:
                logger.warning("Error syncing records from Drive: %s", exc)
                return 0

    def _upsert_csv(self, record: dict[str, Any]) -> None:
        rows = self.metadata()
        replacement = {key: record.get(key, "") for key in CSV_FIELDS}
        for index, row in enumerate(rows):
            if row.get("recording_id") == record.get("recording_id"):
                rows[index] = replacement
                break
        else:
            rows.append(replacement)
        temporary = self.csv_path.with_suffix(".tmp")
        with temporary.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        os.replace(temporary, self.csv_path)

    def metadata(self) -> list[dict[str, str]]:
        with self.csv_path.open("r", newline="", encoding="utf-8") as handle:
            return list(csv.DictReader(handle))

    def stats(self) -> dict[str, Any]:
        records = self.list_records()
        completed = [row for row in records if row.get("upload_status") == "COMPLETED"]
        per_gender = {bucket: {"count": 0, "duration_seconds": 0.0} for bucket in BUCKETS.values()}
        per_phrase: dict[str, int] = {}
        per_section = {section: 0 for section in ("D", "A", "N")}
        per_environment = {f"E{number}": 0 for number in range(1, 7)}
        per_gender_environment: dict[str, dict[str, int]] = {
            gender: {environment: 0 for environment in per_environment} for gender in BUCKETS
        }
        participants: set[str] = set()
        durations: list[float] = []
        for row in completed:
            bucket = row.get("gender_category", "unspecified")
            if bucket not in per_gender:
                bucket = "unspecified"
            duration = float(row.get("duration_seconds") or 0)
            per_gender[bucket]["count"] += 1
            per_gender[bucket]["duration_seconds"] += duration
            per_phrase[row.get("phrase_id", "")] = per_phrase.get(row.get("phrase_id", ""), 0) + 1
            section = row.get("section_class", "")
            if section in per_section:
                per_section[section] += 1
            environment = row.get("environment", "")
            if environment in per_environment:
                per_environment[environment] += 1
                per_gender_environment[bucket][environment] += 1
            participants.add(row.get("participant_id", ""))
            durations.append(duration)
        return {
            "total_participants": len(participants),
            "total_recordings": len(records),
            "completed_recordings": len(completed),
            "pending_recordings": sum(row.get("upload_status") in {"PENDING", "UPLOADING"} for row in records),
            "failed_recordings": sum(row.get("upload_status") == "FAILED" for row in records),
            "total_audio_duration": round(sum(durations), 3),
            "average_duration": round(sum(durations) / len(durations), 3) if durations else 0,
            "per_gender": per_gender,
            "per_phrase": per_phrase,
            "per_section": per_section,
            "per_environment": per_environment,
            "per_gender_environment": per_gender_environment,
            "targets": {
                "female": {"volunteers": 75, "clips_per_volunteer": 20, "total_clips": 1500},
                "male": {"volunteers": 20, "clips_per_volunteer": 30, "total_clips": 600},
            },
            "recent": sorted(records, key=lambda row: row.get("timestamp", ""), reverse=True)[:25],
        }
