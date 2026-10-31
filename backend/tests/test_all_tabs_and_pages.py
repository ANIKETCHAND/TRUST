from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_tab_1_overview(client: AsyncClient):
    resp = await client.get("/api/v1/overview/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "metrics" in data
    assert "total_agents" in data["metrics"]
    assert "timeline" in data
    assert "tool_distribution" in data
    assert "recent_events" in data


@pytest.mark.asyncio
async def test_tab_2_agents_management(client: AsyncClient):
    # 1. Register agent
    reg = await client.post(
        "/api/v1/agents",
        json={"name": "TabTestAgent", "role": "tester", "description": "Tab 2 verification"}
    )
    assert reg.status_code == 201
    ag_data = reg.json()
    ag_id = ag_data["agent"]["id"]
    api_key = ag_data["raw_api_key"]
    assert api_key.startswith("agk_live_")

    # 2. List agents
    lst = await client.get("/api/v1/agents")
    assert lst.status_code == 200
    assert any(a["id"] == ag_id for a in lst.json())

    # 3. Update agent
    upd = await client.patch(f"/api/v1/agents/{ag_id}", json={"description": "Updated description"})
    assert upd.status_code == 200
    assert upd.json()["description"] == "Updated description"

    # 4. Revoke agent
    rev = await client.post(f"/api/v1/agents/{ag_id}/revoke", json={"reason": "Audit completion"})
    assert rev.status_code == 200
    assert rev.json()["status"] == "revoked"


@pytest.mark.asyncio
async def test_tab_3_tools_management(client: AsyncClient):
    # List tools
    tools_res = await client.get("/api/v1/tools")
    assert tools_res.status_code == 200
    tool_names = [t["name"] for t in tools_res.json()]
    assert "filesystem_tool" in tool_names
    assert "postgres_tool" in tool_names
    assert "http_api_tool" in tool_names
    assert "mcp_tool" in tool_names


@pytest.mark.asyncio
async def test_tab_4_live_monitoring(client: AsyncClient):
    stream_res = await client.get("/api/v1/audit?limit=20")
    assert stream_res.status_code == 200
    assert isinstance(stream_res.json(), list)


@pytest.mark.asyncio
async def test_tab_5_delegation_graph(client: AsyncClient):
    # Register parent and child agents
    p_res = await client.post("/api/v1/agents", json={"name": "DelegationParent", "role": "lead"})
    c_res = await client.post("/api/v1/agents", json={"name": "DelegationChild", "role": "subordinate"})
    p_id = p_res.json()["agent"]["id"]
    c_id = c_res.json()["agent"]["id"]

    # Grant parent permission on filesystem
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": p_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "public/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Issue valid delegation
    expires = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()
    del_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": p_id,
            "child_agent_id": c_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "read_file"},
            "expires_at": expires,
            "max_depth": 2
        }
    )
    assert del_res.status_code == 201
    del_id = del_res.json()["delegation"]["id"]

    # List delegations
    list_del = await client.get("/api/v1/delegations")
    assert list_del.status_code == 200
    assert any(d["id"] == del_id for d in list_del.json())

    # Revoke delegation
    rev_del = await client.post(f"/api/v1/delegations/{del_id}/revoke", json={"reason": "Testing revoke"})
    assert rev_del.status_code == 200


@pytest.mark.asyncio
async def test_tab_6_provenance_explorer(client: AsyncClient):
    # Get provenance graph (seeds automatically if empty)
    graph_res = await client.get("/api/v1/provenance/graph")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data
    assert len(graph_data["nodes"]) >= 1


@pytest.mark.asyncio
async def test_tab_7_security_policies_and_simulator(client: AsyncClient):
    # 1. List policies
    p_res = await client.get("/api/v1/policies")
    assert p_res.status_code == 200
    policies = p_res.json()
    assert len(policies) >= 1

    # 2. Test policy simulator dry-run
    ag_res = await client.post("/api/v1/agents", json={"name": "SimulatorAgent", "role": "analyst"})
    ag_id = ag_res.json()["agent"]["id"]

    sim_res = await client.post(
        "/api/v1/policies/test",
        json={
            "agent_id": ag_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource": "confidential/payroll.csv"
        }
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["decision"] == "BLOCKED"
    assert sim_data["is_allowed"] is False


@pytest.mark.asyncio
async def test_tab_8_incidents_management(client: AsyncClient):
    inc_res = await client.get("/api/v1/audit/incidents")
    assert inc_res.status_code == 200
    incidents = inc_res.json()
    if incidents:
        inc_id = incidents[0]["id"]
        patch_res = await client.patch(
            f"/api/v1/audit/incidents/{inc_id}",
            json={"status": "INVESTIGATING", "resolution_notes": "Auditor reviewing logs"}
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "INVESTIGATING"


@pytest.mark.asyncio
async def test_tab_9_audit_logs_and_exports(client: AsyncClient):
    # CSV export
    csv_res = await client.get("/api/v1/audit/export?format=csv")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")

    # JSON export
    json_res = await client.get("/api/v1/audit/export?format=json")
    assert json_res.status_code == 200
    assert "application/json" in json_res.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_tab_10_agent_runner_workflow_and_prompt_injection(client: AsyncClient):
    # Register agent
    ag_res = await client.post("/api/v1/agents", json={"name": "WorkflowRunnerAgent", "role": "compliance"})
    ag_id = ag_res.json()["agent"]["id"]

    # Grant database and filesystem permissions
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": ag_id,
            "tool_name": "postgres_tool",
            "operation": "query_select",
            "resource_pattern": "table:customer_records",
            "effect": "ALLOW",
            "priority": 10
        }
    )
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": ag_id,
            "tool_name": "filesystem_tool",
            "operation": "write_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Run multi-step agent workflow with simulated prompt injection attack
    wf_res = await client.post(
        "/api/v1/agent-exec/run",
        json={
            "agent_id": ag_id,
            "task_prompt": "Scan customer revenue and write compliance summary",
            "simulate_injection_attack": True
        }
    )
    assert wf_res.status_code == 200
    wf_data = wf_res.json()
    assert wf_data["status"] == "COMPLETED"
    assert len(wf_data["steps"]) == 3

    # Step 1: Database allowed
    assert wf_data["steps"][0]["decision"] == "ALLOWED"
    # Step 2: Filesystem write allowed
    assert wf_data["steps"][1]["decision"] == "ALLOWED"
    # Step 3: Outbound Prompt Injection exfiltration BLOCKED by AgentTrust
    assert wf_data["steps"][2]["decision"] == "BLOCKED"
    assert wf_data["steps"][2]["security_blocked"] is True


@pytest.mark.asyncio
async def test_tab_11_settings_and_health(client: AsyncClient):
    health_res = await client.get("/api/v1/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"
