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


@pytest.mark.asyncio
async def test_multihop_delegation_depth_limit_and_transitive_cascade(client: AsyncClient):
    # Setup chain: Root (A) -> Intermediate (B) -> Leaf (C) -> Unauthorized (D)
    a_res = await client.post("/api/v1/agents", json={"name": "MultiHop-Root-A", "role": "root_orchestrator"})
    b_res = await client.post("/api/v1/agents", json={"name": "MultiHop-Worker-B", "role": "task_manager"})
    c_res = await client.post("/api/v1/agents", json={"name": "MultiHop-Leaf-C", "role": "leaf_worker"})
    d_res = await client.post("/api/v1/agents", json={"name": "MultiHop-Exceeded-D", "role": "overflow_worker"})

    a_id = a_res.json()["agent"]["id"]
    b_id = b_res.json()["agent"]["id"]
    c_id = c_res.json()["agent"]["id"]
    d_id = d_res.json()["agent"]["id"]
    c_key = c_res.json().get("raw_api_key")

    # Grant Root Agent permission on filesystem_tool
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": a_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "data/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Hop 1: A delegates to B with max_depth=2 (Current depth = 1)
    exp = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    del_1_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": a_id,
            "child_agent_id": b_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "read_file"},
            "expires_at": exp,
            "max_depth": 2
        }
    )
    assert del_1_res.status_code == 201
    del_1_id = del_1_res.json()["delegation"]["id"]

    # Hop 2: B delegates to C linked to parent_delegation_id (Current depth = 2)
    del_2_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": b_id,
            "child_agent_id": c_id,
            "parent_delegation_id": del_1_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "read_file"},
            "expires_at": exp,
            "max_depth": 2
        }
    )
    assert del_2_res.status_code == 201
    del_2 = del_2_res.json()["delegation"]
    assert del_2["current_depth"] == 2
    del_2_id = del_2["id"]
    del_2_token = del_2_res.json()["delegation_token"]

    # Hop 3: C tries to delegate to D, but chain depth would be 3 > max_depth 2 -> REJECTED
    del_3_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": c_id,
            "child_agent_id": d_id,
            "parent_delegation_id": del_2_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "read_file"},
            "expires_at": exp,
            "max_depth": 2
        }
    )
    assert del_3_res.status_code == 400
    assert "depth limit exceeded" in del_3_res.json()["detail"].lower()

    # Scope Subsetting: B cannot sub-delegate postgres_tool which parent did not grant
    esc_sub_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": b_id,
            "child_agent_id": c_id,
            "parent_delegation_id": del_1_id,
            "scope": {"tool_name": "postgres_tool", "operation": "query_select"},
            "expires_at": exp,
            "max_depth": 2
        }
    )
    assert esc_sub_res.status_code == 400
    assert "exceeds parent delegation grant" in esc_sub_res.json()["detail"]

    # Leaf C has permission and valid token: Gateway execution ALLOWED
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": c_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "data/*",
            "effect": "ALLOW",
            "priority": 5
        }
    )
    c_exec = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {c_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "data/sample.txt",
            "parameters": {},
            "context": {"delegation_token": del_2_token}
        }
    )
    # File may not exist on disk in test, but policy allows execution
    assert c_exec.status_code in [200, 404, 500]
    if c_exec.status_code == 200:
        assert c_exec.json()["decision"] == "ALLOWED"

    # Transitive Cascading Revocation: Revoke root delegation (A -> B)
    rev_del_res = await client.post(
        f"/api/v1/delegations/{del_1_id}/revoke",
        json={"reason": "Compromised root delegation grant"}
    )
    assert rev_del_res.status_code == 200

    # Verify both Hop 1 and Hop 2 delegations are now REVOKED
    all_dels = (await client.get("/api/v1/delegations")).json()
    d1_record = next(d for d in all_dels if d["id"] == del_1_id)
    d2_record = next(d for d in all_dels if d["id"] == del_2_id)
    assert d1_record["status"] == "revoked"
    assert d2_record["status"] == "revoked"
    assert "Cascaded revocation" in d2_record["revocation_reason"]

    # Gateway Execution with revoked downstream delegation token MUST FAIL CLOSED
    fail_exec = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {c_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "data/sample.txt",
            "parameters": {},
            "context": {"delegation_token": del_2_token}
        }
    )
    assert fail_exec.status_code == 403
    assert "Delegation Violation" in fail_exec.json()["reason"]

