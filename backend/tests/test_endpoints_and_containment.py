import pytest
from httpx import AsyncClient
from app.core.config import settings


@pytest.mark.asyncio
async def test_endpoint_enrollment_and_authentication(client: AsyncClient):
    # 1. Invalid secret rejected
    bad_res = await client.post(
        "/api/v1/endpoints/enroll",
        json={
            "hostname": "SEC-NODE-01",
            "os_platform": "windows",
            "enrollment_secret": "wrong_secret_key"
        }
    )
    assert bad_res.status_code == 403
    assert "Invalid enrollment secret" in bad_res.json()["detail"]

    # 2. Valid enrollment
    enroll_res = await client.post(
        "/api/v1/endpoints/enroll",
        json={
            "hostname": "SEC-NODE-01",
            "os_platform": "windows",
            "os_version": "Windows 11 Pro",
            "agent_version": "0.2.0",
            "ip_address": "192.168.1.105",
            "mac_address": "00:1A:2B:3C:4D:5E",
            "enrollment_secret": settings.ENROLLMENT_SECRET
        }
    )
    assert enroll_res.status_code == 201
    data = enroll_res.json()
    assert data["hostname"] == "SEC-NODE-01"
    assert data["device_token"].startswith("epk_live_")
    device_token = data["device_token"]
    device_id = data["device_id"]

    # 3. Heartbeat with device token
    hb_res = await client.post(
        "/api/v1/endpoints/heartbeat",
        headers={"X-Device-Token": device_token}
    )
    assert hb_res.status_code == 200
    assert hb_res.json()["status"] == "ONLINE"
    assert hb_res.json()["is_contained"] is False

    # 4. Telemetry submission with authorized agent workflow
    telem_res = await client.post(
        "/api/v1/endpoints/telemetry",
        headers={"X-Device-Token": device_token},
        json={
            "events": [
                {
                    "event_type": "process_spawn",
                    "process_name": "python.exe",
                    "process_pid": 4120,
                    "command_line": "python -m agenttrust.runner --task audit",
                    "severity": "INFO",
                    "is_authorized_agent_workflow": True
                }
            ]
        }
    )
    assert telem_res.status_code == 200
    assert telem_res.json()["events_recorded"] == 1

    # 5. Telemetry with suspicious activity triggers automated SecurityIncident
    susp_res = await client.post(
        "/api/v1/endpoints/telemetry",
        headers={"X-Device-Token": device_token},
        json={
            "events": [
                {
                    "event_type": "suspicious_spawn",
                    "process_name": "cmd.exe",
                    "process_pid": 9988,
                    "command_line": "powershell -enc JABzAD0ATgBlAHcALQBPAGIAagBlAGMAdAAgAE4AZQB0AC4AVwBlAGIAQwBsAGkAZQBuAHQA...",
                    "severity": "HIGH",
                    "is_authorized_agent_workflow": False
                }
            ]
        }
    )
    assert susp_res.status_code == 200

    # Verify incident was created
    inc_res = await client.get("/api/v1/audit/incidents?severity=HIGH")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    assert any("Suspicious Endpoint Activity" in inc["title"] for inc in incidents)

    # 6. Controlled Containment Safeguard: Fails without explicit human approval
    bad_contain = await client.post(
        f"/api/v1/endpoints/{device_id}/contain",
        json={
            "scope": "PROCESS_SUSPENSION",
            "reason": "Test unapproved action",
            "authorized_by": "secops_admin",
            "human_approved": False
        }
    )
    assert bad_contain.status_code == 400
    assert "Safeguard" in bad_contain.json()["detail"] or "human approval" in bad_contain.json()["detail"].lower()

    # 7. Controlled Containment with explicit human approval
    contain_res = await client.post(
        f"/api/v1/endpoints/{device_id}/contain",
        json={
            "scope": "PROCESS_SUSPENSION",
            "reason": "Suspicious reverse shell invocation detected",
            "authorized_by": "secops_admin@corp.internal",
            "human_approved": True
        }
    )
    assert contain_res.status_code == 200
    assert contain_res.json()["status"] == "CONTAINED"

    # Verify heartbeat now reports is_contained: True
    hb_contained = await client.post(
        "/api/v1/endpoints/heartbeat",
        headers={"X-Device-Token": device_token}
    )
    assert hb_contained.json()["is_contained"] is True

    # 8. Release Containment: returns device to ONLINE status
    release_res = await client.post(
        f"/api/v1/endpoints/{device_id}/release",
        json={
            "released_by": "secops_lead",
            "release_notes": "Forensic triage completed. Host sanitized."
        }
    )
    assert release_res.status_code == 200
    assert release_res.json()["status"] == "RELEASED"

    # Verify status restored
    dev_detail = await client.get(f"/api/v1/endpoints/{device_id}")
    assert dev_detail.status_code == 200
    assert dev_detail.json()["device"]["status"] == "ONLINE"
    assert dev_detail.json()["device"]["is_contained"] is False
