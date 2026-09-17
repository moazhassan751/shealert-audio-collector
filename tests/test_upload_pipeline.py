import csv
import json
from pathlib import Path
import pytest


def make_payload(
    recording_id="rec-female-001",
    participant_id="F01",
    gender_category="female",
    phrase_id="BCH",
    phrase_text="Bachao",
    translation="Save me / Help",
    category="Distress",
    section_class="D",
    take_code="R01",
    recording_number="1",
    environment="E1",
    age_group="18-25",
    native_language="Urdu",
    consent="true",
):
    return {
        "recording_id": recording_id,
        "participant_id": participant_id,
        "gender_category": gender_category,
        "phrase_id": phrase_id,
        "phrase_text": phrase_text,
        "translation": translation,
        "category": category,
        "section_class": section_class,
        "take_code": take_code,
        "recording_number": recording_number,
        "environment": environment,
        "age_group": age_group,
        "native_language": native_language,
        "consent": consent,
    }


def test_successful_upload_female(client, audio_files, isolated_store):
    """Test full E2E upload flow for a female participant recording."""
    payload = make_payload()
    with open(audio_files["valid"], "rb") as f:
        response = client.post(
            "/api/recordings",
            data=payload,
            files={"audio": ("recording.wav", f, "audio/wav")},
        )

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["status"] == "COMPLETED"
    assert res_data["recording_id"] == "rec-female-001"
    assert res_data["standardized_filename"] == "SHEA_F001_D_BCH_R01_E01.wav"

    # Verify physical file existence in isolated directory
    dataset_dir = isolated_store["dataset_dir"]
    std_file = dataset_dir / "audio" / "female" / "SHEA_F001_D_BCH_R01_E01.wav"
    orig_file = dataset_dir / "originals" / "female" / "SHEA_F001_D_BCH_R01_E01.wav"
    assert std_file.exists()
    assert orig_file.exists()
    assert std_file.stat().st_size > 0

    # Verify CSV metadata
    csv_file = dataset_dir / "metadata" / "metadata.csv"
    assert csv_file.exists()
    with open(csv_file, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        assert len(rows) == 1
        assert rows[0]["recording_id"] == "rec-female-001"
        assert rows[0]["participant_id"] == "F01"
        assert rows[0]["gender_category"] == "female"
        assert rows[0]["upload_status"] == "COMPLETED"
        assert rows[0]["standardized_filename"] == "SHEA_F001_D_BCH_R01_E01.wav"

    # Verify Registry JSON
    reg_file = isolated_store["data_dir"] / "records.json"
    assert reg_file.exists()
    records = json.loads(reg_file.read_text(encoding="utf-8"))
    assert "rec-female-001" in records
    assert records["rec-female-001"]["upload_status"] == "COMPLETED"


def test_idempotent_duplicate_upload(client, audio_files):
    """Test submitting an already-completed recording returns COMPLETED immediately."""
    payload = make_payload(recording_id="rec-idempotent-1")
    with open(audio_files["valid"], "rb") as f:
        res1 = client.post("/api/recordings", data=payload, files={"audio": ("rec.wav", f, "audio/wav")})
    assert res1.status_code == 200

    # Repeat same upload
    with open(audio_files["valid"], "rb") as f:
        res2 = client.post("/api/recordings", data=payload, files={"audio": ("rec.wav", f, "audio/wav")})
    assert res2.status_code == 200
    data = res2.json()
    assert data["status"] == "COMPLETED"
    assert "already uploaded" in data["message"]


def test_successful_upload_male(client, audio_files, isolated_store):
    """Test successful upload for a male participant recording with male-specific take."""
    payload = make_payload(
        recording_id="rec-male-001",
        participant_id="M01",
        gender_category="male",
        take_code="R03",  # High urgency take available for males
    )
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("sample.wav", f, "audio/wav")})

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["standardized_filename"] == "SHEA_M001_D_BCH_R03_E01.wav"
    std_file = isolated_store["dataset_dir"] / "audio" / "male" / "SHEA_M001_D_BCH_R03_E01.wav"
    assert std_file.exists()


def test_successful_upload_unspecified(client, audio_files, isolated_store):
    """Test successful upload for an unspecified volunteer using female script."""
    payload = make_payload(
        recording_id="rec-unspecified-001",
        participant_id="U01",
        gender_category="unspecified",
        take_code="R01",
    )
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("sample.wav", f, "audio/wav")})

    assert response.status_code == 200
    res_data = response.json()
    assert res_data["standardized_filename"] == "SHEA_U001_D_BCH_R01_E01.wav"
    std_file = isolated_store["dataset_dir"] / "audio" / "unspecified" / "SHEA_U001_D_BCH_R01_E01.wav"
    assert std_file.exists()


def test_upload_rejection_silent_audio(client, audio_files):
    """Test that uploading silent audio is rejected with 422."""
    payload = make_payload(recording_id="rec-silent-test")
    with open(audio_files["silent"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("silent.wav", f, "audio/wav")})
    assert response.status_code == 422
    assert "no audible signal" in response.json()["detail"]


def test_upload_rejection_short_audio(client, audio_files):
    """Test that audio under the minimum duration limit is rejected."""
    payload = make_payload(recording_id="rec-short-test")
    with open(audio_files["short"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("short.wav", f, "audio/wav")})
    assert response.status_code == 422
    assert "at least 1" in response.json()["detail"]


def test_upload_rejection_gender_mismatch(client, audio_files):
    """Test that ID prefix mismatch with gender category is rejected."""
    payload = make_payload(gender_category="female", participant_id="M01")
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("test.wav", f, "audio/wav")})
    assert response.status_code == 422


def test_upload_rejection_nonmatching_phrase_text(client, audio_files):
    """Test that script text tampering or mismatch is rejected."""
    payload = make_payload(phrase_text="Tampered text not in dataset")
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("test.wav", f, "audio/wav")})
    assert response.status_code == 422
    assert "source-of-truth" in response.json()["detail"]


def test_upload_rejection_take_mismatch(client, audio_files):
    """Test that invalid take code for female session is rejected."""
    # Females only have R01 and R02 for BCH Distress, R03 is only in male section
    payload = make_payload(gender_category="female", take_code="R03")
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("test.wav", f, "audio/wav")})
    assert response.status_code == 422


def test_upload_rejection_missing_consent(client, audio_files):
    """Test that uploading without participant consent is rejected."""
    payload = make_payload(consent="false")
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("test.wav", f, "audio/wav")})
    assert response.status_code == 422


def test_upload_rejection_invalid_mime(client, audio_files):
    """Test that uploading non-audio MIME type is rejected with 415."""
    payload = make_payload()
    with open(audio_files["valid"], "rb") as f:
        response = client.post("/api/recordings", data=payload, files={"audio": ("test.txt", f, "text/plain")})
    assert response.status_code == 415
