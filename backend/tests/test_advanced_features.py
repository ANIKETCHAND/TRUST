from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_database_tool_sql_safety(client: AsyncClient):
    # 1. Register agent
    agent_res = await client.post("/api/v1/agents", json={"name": "DBAuditorBot", "role": "dba"})
    agent_info = agent_res.json()
    agent_id = agent_info["agent"]["id"]
    api_key = agent_info["raw_api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # 2. Grant permission for postgres_tool:query_select on customer_records
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": agent_id,
            "tool_name": "postgres_tool",
            "operation": "query_select",
            "resource_pattern": "table:customer_records",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # 3. Successful safe SELECT query
    select_res = await client.post(
        "/api/v1/gateway/execute",
        headers=headers,
        json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "SELECT customer_name, annual_spend FROM customer_records"}
        }
    )
    assert select_res.status_code == 200
    select_data = select_res.json()
    assert select_data["decision"] == "ALLOWED"
    assert select_data["result"]["row_count"] >= 1

    # 4. Attempt dangerous destructive DDL statement (DROP TABLE) -> Must FAIL
    drop_res = await client.post(
        "/api/v1/gateway/execute",
        headers=headers,
        json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "DROP TABLE customer_records"}
        }
    )
    assert drop_res.status_code == 200  # Gateway allowed select_query pattern, but tool rejected destructive query
    assert drop_res.json()["execution_status"] == "FAILED"
    assert "destructive" in drop_res.json()["error"].lower() or "forbidden" in drop_res.json()["error"].lower()


@pytest.mark.asyncio
async def test_ssrf_protection_on_http_tool(client: AsyncClient):
    # Register agent
    agent_res = await client.post("/api/v1/agents", json={"name": "WebScraperBot", "role": "scraper"})
    api_key = agent_res.json()["raw_api_key"]
    agent_id = agent_res.json()["agent"]["id"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Grant wide permission for http_api_tool
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": agent_id,
            "tool_name": "http_api_tool",
            "operation": "http_get",
            "resource_pattern": "*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Attempt to access localhost / internal metadata service
    loopback_res = await client.post(
        "/api/v1/gateway/execute",
        headers=headers,
        json={
            "tool": "http_api_tool",
            "operation": "http_get",
            "resource": "http://127.0.0.1:8080/internal-secrets",
            "parameters": {}
        }
    )
    # SSRF protection must reject internal IP access
    assert loopback_res.json()["execution_status"] == "FAILED"
    assert "ssrf" in loopback_res.json()["error"].lower() or "blocked" in loopback_res.json()["error"].lower()


@pytest.mark.asyncio
async def test_delegation_security_and_privilege_escalation(client: AsyncClient):
    # Register Parent Agent (authorized for filesystem only)
    parent_res = await client.post("/api/v1/agents", json={"name": "ParentAgent", "role": "manager"})
    parent_id = parent_res.json()["agent"]["id"]

    # Register Child Agent
    child_res = await client.post("/api/v1/agents", json={"name": "ChildAgent", "role": "worker"})
    child_id = child_res.json()["agent"]["id"]

    # Grant Parent agent permission for filesystem_tool:read_file
    await client.post(
        "/api/v1/permissions",
        json={
            "agent_id": parent_id,
            "tool_name": "filesystem_tool",
            "operation": "read_file",
            "resource_pattern": "public/*",
            "effect": "ALLOW",
            "priority": 10
        }
    )

    # Parent attempts to delegate postgres_tool (which it does NOT possess)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    escalation_res = await client.post(
        "/api/v1/delegations",
        json={
            "parent_agent_id": parent_id,
            "child_agent_id": child_id,
            "scope": {"tool_name": "postgres_tool", "operation": "query_select"},
            "expires_at": expires_at,
            "max_depth": 1
        }
    )
    # Must reject privilege escalation!
    assert escalation_res.status_code == 400
    assert "Privilege Escalation Blocked" in escalation_res.json()["detail"]


@pytest.mark.asyncio
async def test_overview_statistics_endpoint(client: AsyncClient):
    stats_res = await client.get("/api/v1/overview/stats")
    assert stats_res.status_code == 200
    data = stats_res.json()
    assert "metrics" in data
    assert data["metrics"]["total_agents"] >= 1
    assert data["metrics"]["registered_tools"] >= 4
    assert "timeline" in data
    assert "recent_events" in data
