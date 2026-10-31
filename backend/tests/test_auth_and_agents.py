import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "service" in data


@pytest.mark.asyncio
async def test_user_registration_and_login(client: AsyncClient):
    # Register user
    reg_resp = await client.post(
        "/api/v1/auth/register",
        json={
            "username": "secops_admin",
            "email": "admin@agenttrust.sec",
            "password": "SuperSecretPassword123!",
            "role": "admin"
        }
    )
    assert reg_resp.status_code == 201
    user_data = reg_resp.json()
    assert user_data["username"] == "secops_admin"
    assert user_data["role"] == "admin"

    # Login
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "secops_admin", "password": "SuperSecretPassword123!"}
    )
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_agent_registration_and_revocation(client: AsyncClient):
    # Register an AI Agent
    agent_payload = {
        "name": "SecOps-Research-Agent",
        "description": "Autonomous researcher agent for security documentation",
        "role": "researcher",
        "agent_metadata": {"owner": "secops-team", "environment": "staging"}
    }
    reg_resp = await client.post("/api/v1/agents", json=agent_payload)
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "raw_api_key" in data
    assert data["raw_api_key"].startswith("agk_live_")
    assert "token_prefix" in data
    agent_id = data["agent"]["id"]
    api_key = data["raw_api_key"]

    # Verify agent is listed
    list_resp = await client.get("/api/v1/agents")
    assert list_resp.status_code == 200
    agents = list_resp.json()
    assert any(a["id"] == agent_id for a in agents)

    # Revoke Agent
    revoke_resp = await client.post(
        f"/api/v1/agents/{agent_id}/revoke",
        json={"reason": "Compromised credential test"}
    )
    assert revoke_resp.status_code == 200
    revoke_data = revoke_resp.json()
    assert revoke_data["status"] == "revoked"

    # Verify gateway rejects requests from the revoked agent
    gw_resp = await client.post(
        "/api/v1/gateway/execute",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "tool": "filesystem_tool",
            "operation": "list_directory",
            "resource": ".",
            "parameters": {}
        }
    )
    # The authentication dependency rejects inactive/revoked agents
    assert gw_resp.status_code in [401, 403]
