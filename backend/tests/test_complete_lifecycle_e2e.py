from datetime import datetime, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_complete_enterprise_security_lifecycle_e2e(client: AsyncClient):
    """
    Simulates the complete enterprise security request lifecycle:
    1. Register user/admin
    2. Authenticate user & receive access token
    3. Enroll authorized agent & obtain raw API key
    4. Register / inspect tool
    5. Configure deterministic security policy (ALLOW & explicit DENY)
    6. Submit authorized tool request through Gateway -> Verify 200 ALLOWED
    7. Submit unauthorized tool request -> Verify 403 BLOCKED
    8. Trigger synthetic suspicious tool exfiltration (DLP violation)
    9. Verify incident automatically created with forensic metadata
    10. Review and resolve incident through Audit API
    11. Revoke agent credentials
    12. Verify subsequent gateway requests fail closed with 403 BLOCKED
    """
    # Step 1: User / Organization Registration
    user_res = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "secops_lead",
            "email": "secops@example.com",
            "password": "SuperSecurePassword123!",
            "role": "admin"
        }
    )
    assert user_res.status_code == 201

    # Step 2: Login to obtain access token
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "username": "secops_lead",
            "password": "SuperSecurePassword123!"
        }
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token is not None

    # Step 3: Enroll Authorized Agent
    agent_res = await client.post(
        "/api/v1/agents",
        json={
            "name": "AuditBot-Industrial",
            "role": "Security Compliance Auditor",
            "description": "Reviews records and generates signed compliance reports."
        }
    )
    assert agent_res.status_code == 201
    agent_data = agent_res.json()
    agent_id = agent_data["agent"]["id"]
    agent_key = agent_data.get("raw_api_key") or agent_data.get("api_key")
    assert agent_key.startswith("agk_live_")

    # Step 4: Tool Verification
    tools_res = await client.get("/api/v1/tools")
    assert tools_res.status_code == 200
    tools = tools_res.json()
    assert any(t["name"] == "filesystem_tool" for t in tools)

    # Step 5: Configure Deterministic Permissions
    # 5a. Allow reading within reports/*
    p_allow = await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": agent_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )
    assert p_allow.status_code == 201

    # 5b. Explicit DENY on sensitive files within reports/
    p_deny = await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": agent_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "reports/confidential_keys.txt",
            "effect": "DENY",
            "priority": 100
        }
    )
    assert p_deny.status_code == 201

    # Seed test report file in sandbox
    from app.core.config import settings
    report_file = settings.absolute_sandbox_path / "reports" / "quarterly_summary.txt"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text("Quarterly compliance audit verified.", encoding="utf-8")

    # Step 6: Submit Authorized Request -> 200 ALLOWED
    auth_exec_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {agent_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "reports/quarterly_summary.txt",
            "parameters": {"encoding": "utf-8"}
        }
    )
    assert auth_exec_res.status_code == 200
    exec_data = auth_exec_res.json()
    assert exec_data["decision"] == "ALLOWED"
    assert exec_data["result"]["content"] == "Quarterly compliance audit verified."

    # Step 7: Submit Request Matching Explicit DENY -> 403 BLOCKED
    deny_exec_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {agent_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "reports/confidential_keys.txt",
            "parameters": {"encoding": "utf-8"}
        }
    )
    assert deny_exec_res.status_code == 403
    assert deny_exec_res.json()["decision"] == "BLOCKED"
    assert "Explicit DENY" in deny_exec_res.json()["reason"]

    # Step 8: Submit Request Without Any Policy Match (Deny-by-default) -> 403 BLOCKED
    default_deny_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {agent_key}"},
        json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:unregistered_table",
            "parameters": {"sql": "SELECT * FROM unregistered_table"}
        }
    )
    assert default_deny_res.status_code == 403
    assert "Deny-by-default" in default_deny_res.json()["reason"]

    # Step 9: Trigger Synthetic DLP Violation -> BLOCKED & Incident Created
    dlp_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {agent_key}"},
        json={
            "tool": "http_api_tool",
            "operation": "http_post",
            "resource": "https://synthetic-sink.agenttrust.internal/leak",
            "parameters": {
                "json": {
                    "credit_card": "4532-1234-5678-9012"
                }
            }
        }
    )
    assert dlp_res.status_code == 403
    assert "Data Leakage Prevention" in dlp_res.json()["reason"]

    # Step 10: Verify Incident Generation in Audit
    incidents_res = await client.get("/api/v1/audit/incidents")
    assert incidents_res.status_code == 200
    incidents = incidents_res.json()
    assert len(incidents) > 0
    recent_inc = incidents[0]
    incident_id = recent_inc["id"]

    # Step 11: Update & Resolve Incident
    patch_res = await client.patch(
        f"/api/v1/audit/incidents/{incident_id}",
        json={
            "status": "RESOLVED",
            "resolution_notes": "Forensic review confirmed synthetic test leak. Rules confirmed effective."
        }
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "RESOLVED"

    # Step 12: Revoke the Agent
    revoke_res = await client.post(
        f"/api/v1/agents/{agent_id}/revoke",
        json={"reason": "Routine decommission after audit"}
    )
    assert revoke_res.status_code == 200

    # Step 13: Verify that Further Requests from this Agent are Rejected
    after_revoke_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {agent_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "reports/quarterly_summary.txt",
            "parameters": {}
        }
    )
    assert after_revoke_res.status_code in [401, 403]
