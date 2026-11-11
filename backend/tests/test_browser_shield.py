import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_browser_shield_status_and_enrollment(client: AsyncClient):
    # 1. Status endpoint returns supported workflow matrix
    status_res = await client.get("/api/v1/browser-shield/status")
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["status"] in ["active", "disabled"]
    assert any(wf["domain"] == "chatgpt.com" for wf in data["supported_workflows"])
    assert any(wf["domain"] == "claude.ai" for wf in data["supported_workflows"])

    # 2. Enrollment rejection with invalid secret
    bad_enroll = await client.post(
        "/api/v1/browser-shield/enroll",
        json={
            "browser_name": "Chrome",
            "extension_version": "0.2.0",
            "enrollment_secret": "invalid_shield_key"
        }
    )
    assert bad_enroll.status_code == 403

    # 3. Successful enrollment with valid secret
    enroll_res = await client.post(
        "/api/v1/browser-shield/enroll",
        json={
            "browser_name": "Chrome",
            "extension_version": "0.2.0",
            "enrollment_secret": settings.ENROLLMENT_SECRET
        }
    )
    assert enroll_res.status_code == 200
    token = enroll_res.json()["extension_token"]
    assert token.startswith("absk_live_")


@pytest.mark.asyncio
async def test_browser_shield_preflight_dlp_checks(client: AsyncClient):
    # 1. Benign prompt allowed
    clean_check = await client.post(
        "/api/v1/browser-shield/check-action",
        json={
            "target_url": "https://chatgpt.com/c/finance-triage",
            "prompt_text": "Please summarize our quarterly EBITDA growth across regions.",
            "action_type": "submit_prompt"
        }
    )
    assert clean_check.status_code == 200
    assert clean_check.json()["decision"] == "ALLOWED"

    # 2. Sensitive prompt containing API key BLOCKED and incident created
    leak_check = await client.post(
        "/api/v1/browser-shield/check-action",
        json={
            "target_url": "https://claude.ai/chat/analysis",
            "prompt_text": "Here is our production backend key to run tests: agk_live_super_secret_stolen_token_48928374",
            "action_type": "submit_prompt"
        }
    )
    assert leak_check.status_code == 200
    data = leak_check.json()
    assert data["decision"] == "BLOCKED"
    assert "Sensitive data detected" in data["reason"]
    assert data["incident_id"] is not None

    # Verify incident recorded in audit incidents
    inc_res = await client.get("/api/v1/audit/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    assert any("Browser Shield" in inc["title"] for inc in incidents)


@pytest.mark.asyncio
async def test_browser_shield_token_authentication(client: AsyncClient):
    # 1. Enroll to receive valid token
    enroll_res = await client.post(
        "/api/v1/browser-shield/enroll",
        json={
            "browser_name": "Brave",
            "extension_version": "0.2.0",
            "enrollment_secret": settings.ENROLLMENT_SECRET
        }
    )
    assert enroll_res.status_code == 200
    valid_token = enroll_res.json()["extension_token"]

    # 2. Pre-flight check with valid token succeeds
    auth_check = await client.post(
        "/api/v1/browser-shield/check-action",
        headers={"X-Extension-Token": valid_token},
        json={
            "target_url": "https://chatgpt.com/c/work-session",
            "prompt_text": "Safe benign query to LLM",
            "action_type": "submit_prompt"
        }
    )
    assert auth_check.status_code == 200
    assert auth_check.json()["decision"] == "ALLOWED"

    # 3. Forged / invalid extension token is strictly rejected with 401
    bad_check = await client.post(
        "/api/v1/browser-shield/check-action",
        headers={"X-Extension-Token": "absk_live_forged_unregistered_token_12345678"},
        json={
            "target_url": "https://chatgpt.com/c/work-session",
            "prompt_text": "Safe query",
            "action_type": "submit_prompt"
        }
    )
    assert bad_check.status_code == 401
    assert "Invalid or revoked" in bad_check.json()["detail"]

