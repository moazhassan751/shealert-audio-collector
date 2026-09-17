import pytest


def test_health_endpoint(client):
    """Test the /api/health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["storage"] == "local"
    assert data["phrases"] == 50  # 20 female + 30 male clips


def test_get_phrases(client):
    """Test loading the flat list of phrases."""
    response = client.get("/api/phrases")
    assert response.status_code == 200
    phrases = response.json()
    assert isinstance(phrases, list)
    assert len(phrases) == 50
    # Verify sample phrase properties
    first = phrases[0]
    for key in ["id", "text_urdu", "category", "section_class", "take_code"]:
        assert key in first


def test_session_content(client):
    """Test retrieving full structured session content."""
    response = client.get("/api/session-content")
    assert response.status_code == 200
    content = response.json()
    assert "female" in content
    assert "male" in content
    assert "environments" in content
    assert content["female"]["clips"] == 20
    assert content["male"]["clips"] == 30
    assert len(content["environments"]) == 6


def test_next_participant_id_allocations(client):
    """Test auto-assignment of participant IDs for all categories and reservations."""
    # Female: F01 first, then F02 reserved next
    res_f1 = client.get("/api/next-participant-id?gender=female")
    assert res_f1.status_code == 200
    assert res_f1.json()["participant_id"] == "F01"
    assert res_f1.json()["available"] is True

    res_f2 = client.get("/api/next-participant-id?gender=female")
    assert res_f2.status_code == 200
    assert res_f2.json()["participant_id"] == "F02"

    # Male: M01
    res_m1 = client.get("/api/next-participant-id?gender=male")
    assert res_m1.status_code == 200
    assert res_m1.json()["participant_id"] == "M01"

    # Unspecified: U01
    res_u1 = client.get("/api/next-participant-id?gender=unspecified")
    assert res_u1.status_code == 200
    assert res_u1.json()["participant_id"] == "U01"


def test_next_participant_id_invalid_gender(client):
    """Test rejection of unknown gender categories."""
    response = client.get("/api/next-participant-id?gender=invalid_category")
    assert response.status_code == 400
    assert "Invalid gender" in response.json()["detail"]


def test_admin_authentication_and_protection(client):
    """Test admin login, token generation, and authorization checks."""
    # 1. Reject invalid password
    res_fail = client.post("/api/admin/login", json={"password": "wrong-password"})
    assert res_fail.status_code == 401

    # 2. Reject unauthorized access to protected endpoints
    assert client.get("/api/stats").status_code == 401
    assert client.get("/api/metadata").status_code == 401
    assert client.get("/api/metadata/export").status_code == 401
    assert client.post("/api/admin/retry-failed").status_code == 401

    # 3. Successful login with correct configured password
    res_login = client.post("/api/admin/login", json={"password": "test-secret-password"})
    assert res_login.status_code == 200
    token = res_login.json()["token"]
    assert len(token) > 20

    headers = {"X-Admin-Token": token}

    # 4. Access protected endpoints with valid token
    stats_res = client.get("/api/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_participants" in stats
    assert "completed_recordings" in stats
    assert "per_gender" in stats

    metadata_res = client.get("/api/metadata", headers=headers)
    assert metadata_res.status_code == 200
    assert isinstance(metadata_res.json(), list)

    export_res = client.get("/api/metadata/export", headers=headers)
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["content-type"]
    assert "recording_id" in export_res.text
