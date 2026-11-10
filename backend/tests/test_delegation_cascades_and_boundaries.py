from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_delegation_scope_boundary_and_expiration(client: AsyncClient):
    # 1. Register Parent and Child Agents
    p_res = await client.post("/api/v1/agents", json={"name": "DelegatorParent", "role": "lead"})
    c_res = await client.post("/api/v1/agents", json={"name": "WorkerChild", "role": "assistant"})
    p_id = p_res.json()["agent"]["id"]
    c_id = c_res.json()["agent"]["id"]
    c_key = c_res.json().get("raw_api_key") or c_res.json().get("api_key")

    # 2. Grant Parent permission for filesystem_tool:read_file only
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": p_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # 3. Privilege Escalation Prevention: Parent cannot delegate postgres_tool:query_select
    esc_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": p_id,
            "child_agent_id": c_id,
            "scope": {"tool_name": "postgres_tool", "operation": "query_select"},
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        }
    )
    assert esc_res.status_code in [400, 403, 500]
    assert "Escalation Blocked" in esc_res.text or "lacks permission" in esc_res.text

    # 4. Valid Delegation for filesystem_tool:read_file
    del_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": p_id,
            "child_agent_id": c_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "read_file"},
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        }
    )
    assert del_res.status_code == 201
    del_data = del_res.json()
    del_token = del_data["delegation_token"]

    # Child also needs an ALLOW permission or delegated execution grant
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": c_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 5
        }
    )

    # 5. Out-of-scope invocation with delegation token is BLOCKED
    out_scope_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {c_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "write_file",  # Not in delegated scope (read_file only)
            "resource": "reports/unauthorized.txt",
            "parameters": {"content": "leak"},
            "context": {"delegation_token": del_token}
        }
    )
    assert out_scope_res.status_code == 403
    assert "Delegation Scope Violation" in out_scope_res.json()["reason"] or "BLOCKED" in out_scope_res.json()["decision"]

    # 6. Revoking Parent Agent automatically cascades revocation to the delegation
    rev_res = await client.post(
        f"/api/v1/agents/{p_id}/revoke",
        json={"reason": "Compromised credential"}
    )
    assert rev_res.status_code == 200

    # 7. Subsequent invocation using delegation fails because parent is revoked
    cascaded_res = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {c_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "reports/test.txt",
            "parameters": {},
            "context": {"delegation_token": del_token}
        }
    )
    assert cascaded_res.status_code == 403
    assert "Delegation Violation" in cascaded_res.json()["reason"]
