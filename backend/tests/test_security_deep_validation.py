from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_authentication_failures(client: AsyncClient):
    # 1. No Authorization Header
    res1 = await client.post(
        "/api/v1/gateway/execute",
        json={"tool": "filesystem_tool", "operation": "read_file", "resource": "a.txt", "parameters": {}}
    )
    assert res1.status_code == 401
    assert "Missing agent credentials" in res1.json()["detail"]

    # 2. Bogus Bearer Key
    res2 = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": "Bearer agk_live_totally_fabricated_key_1234567890"},
        json={"tool": "filesystem_tool", "operation": "read_file", "resource": "a.txt", "parameters": {}}
    )
    assert res2.status_code == 401
    assert "Invalid, expired, or revoked" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_blocked_operation_has_no_side_effects(client: AsyncClient):
    # Create an Agent
    agent_res = await client.post(
        "/api/v1/agents",
        json={"name": "AttackerAgent", "role": "untrusted"}
    )
    agent_info = agent_res.json()
    api_key = agent_info["raw_api_key"]
    agent_id = agent_info["agent"]["id"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Attempt to write to critical_system_file.txt without permission
    canary_path = Path("./test_sandbox_storage/critical_system_file.txt")
    if canary_path.exists():
        canary_path.unlink()

    write_attempt = await client.post(
        "/api/v1/gateway/execute",
        headers=headers,
        json={
            "tool": "filesystem_tool",
            "operation": "write_file",
            "resource": "critical_system_file.txt",
            "parameters": {"content": "MALICIOUS PAYLOAD"}
        }
    )
    # MUST be blocked
    assert write_attempt.status_code == 403
    assert write_attempt.json()["decision"] == "BLOCKED"

    # CRITICAL: Verify file was NEVER created on the filesystem (zero side effects)
    assert not canary_path.exists(), "Security Violation: Blocked operation produced filesystem side-effects!"


@pytest.mark.asyncio
async def test_identity_cannot_be_spoofed_in_payload(client: AsyncClient):
    # Create Agent 1 (Victim with high privileges)
    ag1_res = await client.post("/api/v1/agents", json={"name": "HighPrivilegeAgent", "role": "admin_agent"})
    ag1_info = ag1_res.json()
    ag1_id = ag1_info["agent"]["id"]

    # Grant HighPrivilegeAgent permission to write to root
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": ag1_id,
            "tool_name": "filesystem_tool",
            "operation": "write_file",
            "resource_pattern": "*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Create Agent 2 (Low privilege attacker)
    ag2_res = await client.post("/api/v1/agents", json={"name": "LowPrivilegeAgent", "role": "guest"})
    ag2_info = ag2_res.json()
    ag2_key = ag2_info["raw_api_key"]

    # Attacker tries to impersonate HighPrivilegeAgent by putting ag1_id into context/body
    spoof_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {ag2_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "write_file",
            "resource": "spoofed_action.txt",
            "parameters": {"content": "Spoof test"},
            "context": {"agent_id": ag1_id, "claims": {"role": "admin_agent"}}
        }
    )
    # Must be BLOCKED because gateway derives identity SOLELY from the token, not payload
    assert spoof_res.status_code == 403
    assert spoof_res.json()["decision"] == "BLOCKED"
    assert "Deny-by-default" in spoof_res.json()["reason"]


@pytest.mark.asyncio
async def test_audit_log_completeness(client: AsyncClient):
    # Register an agent
    agent_res = await client.post("/api/v1/agents", json={"name": "AuditBot", "role": "compliance"})
    ag_data = agent_res.json()
    ag_id = ag_data["agent"]["id"]
    ag_key = ag_data["raw_api_key"]

    # Fire an unauthorized request
    await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {ag_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "protected/data.txt",
            "parameters": {},
            "context": {"trace_id": "test-trace-123", "secret_token": "SHOULD_NOT_LEAK"}
        }
    )

    # Inspect audit record in DB
    audit_resp = await client.get(f"/api/v1/audit?agent_id={ag_id}")
    assert audit_resp.status_code == 200
    events = audit_resp.json()
    assert len(events) >= 1
    evt = events[0]

    # Verify all required audit fields
    assert "id" in evt
    assert "request_id" in evt
    assert evt["agent_id"] == ag_id
    assert evt["tool_name"] == "filesystem_tool"
    assert evt["operation"] == "read_file"
    assert evt["target_resource"] == "protected/data.txt"
    assert evt["decision"] == "BLOCKED"
    assert "reason" in evt["decision_reason"].lower() or "deny" in evt["decision_reason"].lower()
    assert evt["execution_status"] == "BLOCKED"
    assert "created_at" in evt

    # Verify sensitive data was redacted from context_metadata
    assert evt["context_metadata"].get("secret_token") == "[REDACTED]"
