import json
import shutil
from pathlib import Path


def test_admin_retry_failed_recovery(client, audio_files, isolated_store):
    """Test the administrative retry mechanism for failed audio recordings."""
    # 1. Login to obtain admin token
    res_login = client.post("/api/admin/login", json={"password": "test-secret-password"})
    token = res_login.json()["token"]
    headers = {"X-Admin-Token": token}

    dataset_dir = isolated_store["dataset_dir"]
    data_dir = isolated_store["data_dir"]

    # 2. Simulate a failed recording by staging an original file and a FAILED registry entry
    rec_id = "rec-failed-to-recover"
    orig_name = "SHEA_F002_D_BCH_R01_E01.wav"
    orig_path = dataset_dir / "originals" / "female" / orig_name
    orig_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(audio_files["valid"], orig_path)

    failed_record = {
        "recording_id": rec_id,
        "participant_id": "F02",
        "gender_category": "female",
        "class": "D",
        "section_class": "D",
        "phrase_id": "BCH",
        "word_code": "BCH",
        "phrase_text": "Bachao",
        "translation": "Save me / Help",
        "category": "Distress",
        "take_code": "R01",
        "take_number": 1,
        "intensity": "Mild",
        "loudness": "",
        "recording_number": 1,
        "environment": "E1",
        "environment_code": "E1",
        "environment_name": "Quiet room",
        "content_gender": "female",
        "age_group": "18-25",
        "native_language": "Urdu",
        "original_filename": orig_name,
        "standardized_filename": orig_name,
        "upload_status": "FAILED",
        "error": "Simulated initial drive/ffmpeg failure",
    }

    records = {rec_id: failed_record}
    registry_file = data_dir / "records.json"
    registry_file.write_text(json.dumps(records, indent=2), encoding="utf-8")

    # 3. Check stats shows 1 failed recording
    stats_before = client.get("/api/stats", headers=headers).json()
    assert stats_before["failed_recordings"] == 1
    assert stats_before["completed_recordings"] == 0

    # 4. Trigger retry-failed endpoint
    retry_res = client.post("/api/admin/retry-failed", headers=headers)
    assert retry_res.status_code == 200
    retry_data = retry_res.json()
    assert len(retry_data["results"]) == 1
    assert retry_data["results"][0]["upload_status"] == "COMPLETED"

    # 5. Check stats after recovery
    stats_after = client.get("/api/stats", headers=headers).json()
    assert stats_after["failed_recordings"] == 0
    assert stats_after["completed_recordings"] == 1
    assert stats_after["total_participants"] == 1
    assert stats_after["per_gender"]["female"]["count"] == 1
    assert stats_after["per_environment"]["E1"] == 1
