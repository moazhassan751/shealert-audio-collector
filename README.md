# SheAlert Audio Dataset Collector

Mobile-first React/Vite + Tailwind and FastAPI application for collecting consented Urdu speech recordings for the SheAlert academic project. It deliberately stores the browser original and a separate 16-bit PCM, mono, 16 kHz WAV copy. The original is never denoised or overwritten.

## Features

- Required, whitelisted voice/gender category (`female`, `male`, `unspecified`) used for folder routing and ML labels. Female IDs are F01–F75, male IDs are M01–M20, and unspecified IDs are U01–U99.
- Consent and minimal participant metadata (no CNIC, phone, email, name, or address).
- Structured, source-of-truth session content in `session_content.json`: female 20 clips, male 30 clips, and unspecified using female content flagged in metadata.
- Mobile MediaRecorder workflow with a local-only 5-second test clip, section-aware progress, timer, live level meter, playback, and re-record.
- IndexedDB pending queue: failed/time-out uploads remain on the device and can be retried; `recording_id` makes retries idempotent.
- FastAPI validation, size limits, safe filenames, duration/silence checks, FFmpeg conversion, local durable fallback, CSV metadata, structured logs, and private admin dashboard.
- Optional Google Drive and Google Sheets integration using a backend-only service account.

## Local setup

Requirements: Python 3.11+, Node.js 18+, and FFmpeg (including `ffprobe`) on `PATH`.

```powershell
Copy-Item .env.example .env
# Edit .env and set a strong ADMIN_PASSWORD
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn app.main:app --app-dir backend --reload
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite proxy sends `/api` to port 8000. Microphone access requires HTTPS in production (localhost is allowed by browsers).

## Google Drive / Sheets setup (optional)

1. Create a Google Cloud project and enable Google Drive API; enable Sheets API if metadata mirroring is wanted.
2. Create a service account and download its JSON key **outside this repository**.
3. Create a private `SheAlert_Dataset` Drive folder, share it with the service-account email as Editor, and copy its folder ID.
4. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the JSON contents (use a deployment secret, never source control), and set `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
5. The server creates `audio/female`, `audio/male`, `audio/unspecified` and matching `originals` folders on first upload.
6. For Sheets, create a private sheet, share it with the service account, set `GOOGLE_SHEET_ID`, and add the metadata headers in the order shown in `backend/app/storage.py`.
7. Restart the backend and test one upload in each category. Verify both Drive file ID and `gender_category` in metadata.

If Google is not configured or unavailable, completed files remain in `backend/dataset` and metadata in `backend/dataset/metadata/metadata.csv`; the dashboard identifies the local backend through `/api/health`. Configure Google before treating a remote backup as complete.

## Data layout and recovery

```text
backend/dataset/
  audio/{female,male,unspecified}/*.wav
  originals/{female,male,unspecified}/*.webm
  metadata/metadata.csv
backend/data/records.json
backend/temp/                 # only incomplete server uploads
```

The registry records `UPLOADING`, `AUDIO_VALIDATED`, `UPLOADED`, `COMPLETED`, and `FAILED`. Failed originals are preserved; the dashboard's **Retry failed** endpoint reprocesses them. A participant can retry IndexedDB items after a browser refresh. Never delete an original until it has been backed up and verified.

Standardized files use `SHEA_{VolunteerID}_{Class}_{Word}_{Take}_{Environment}.wav` with a three-digit volunteer number (for example `SHEA_F001_D_BCH_R01_E01.wav`). Class codes are D, A, and N; environment selection is E1–E6 and is zero-padded in filenames. The browser-only 5-second test clip is stored in IndexedDB and is never sent to the backend.

## Admin and API

Visit `/admin` (or use the dashboard link) and enter `ADMIN_PASSWORD`. The dashboard shows totals, duration, per-gender balance, recent records, failed recovery, refresh, and CSV export. Useful endpoints:

`GET /api/health`, `GET /api/session-content`, `GET /api/phrases`, `POST /api/recordings`, `POST /api/admin/login`, protected `GET /api/stats`, `GET /api/metadata`, `GET /api/metadata/export`, and `POST /api/admin/retry-failed`.

## Deployment

Build the frontend with `npm run build` and serve `frontend/dist` from a static host or reverse proxy. Run FastAPI with a process manager, for example `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Set `VITE_API_URL` to the HTTPS API origin when frontend and backend are separate, set `FRONTEND_ORIGINS` to the exact frontend origin, install FFmpeg on the server, and use persistent storage for `backend/dataset`, `backend/data`, and `backend/temp`. Keep `.env`, service-account JSON, and admin password in deployment secrets. Do not expose `backend/dataset` as a public static directory.

Free-tier limitations: Google Drive quota, service-account storage limits, and the hosting provider's disk/bandwidth limits still apply. Plan periodic offline backups by downloading the complete `SheAlert_Dataset` folder and `metadata.csv`; the application never deletes Drive files automatically.

## Testing checklist

Run the build and API smoke checks:

```powershell
cd frontend
npm run build
cd ..
python -c "import sys; sys.path.insert(0, 'backend'); from app.main import app; print(app.title)"
```

Manually test each gender option, consent rejection, microphone denial, short/silent audio, playback/re-record, duplicate submit, offline retry, refresh recovery, FFmpeg failure, Drive failure, metadata export, and admin failed-upload retry. Use the browser on Android Chrome and a desktop browser; production recording must be served over HTTPS.
