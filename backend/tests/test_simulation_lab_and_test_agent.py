import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent, AgentStatus
from app.services.test_agent_service import test_agent_service, TEST_AGENT_ID, TEST_AGENT_NAME
from app.services.simulation_engine import simulation_engine
from app.tools.test_lab_tools import SafeCalculatorTool, WebSearchTool, SecurityEventAnalyzerTool, TestEnvDataTool


@pytest.mark.asyncio
async def test_agent_registration_and_configuration(client: AsyncClient, db_session: AsyncSession):
    """Verifies that the CrossX Security Test Agent is registered with full metadata and permissions."""
    agent = await test_agent_service.ensure_test_agent_registered(db_session)
    assert agent is not None
    assert agent.id == TEST_AGENT_ID
    assert agent.name == TEST_AGENT_NAME
    assert agent.role == "security_testing_agent"
    assert agent.environment == "test_lab"
    assert agent.risk_classification == "MEDIUM"

    details = await test_agent_service.get_agent_details(db_session)
    assert details["agent_id"] == TEST_AGENT_ID
    assert details["status"] == "active"
    assert details["health_status"] == "healthy"
    assert "safe_calculator:calculate" in details["allowed_tools"]
    assert "web_search_tool:search" in details["allowed_tools"]
    assert "filesystem_tool:read_file" in details["allowed_tools"]
    assert "postgres_tool:query_select" in details["allowed_tools"]
    assert details["execution_mode"] in ("deterministic-fallback", "external-llm")


@pytest.mark.asyncio
async def test_agent_lifecycle_and_state_transitions(client: AsyncClient, db_session: AsyncSession):
    """Verifies agent status transitions and test lab reset."""
    # 1. Monitoring
    a_mon = await test_agent_service.update_agent_status(db_session, AgentStatus.MONITORING, "Enable heightened monitoring")
    assert a_mon.status == AgentStatus.MONITORING

    # 2. Restricted
    a_res = await test_agent_service.update_agent_status(db_session, AgentStatus.RESTRICTED, "Suspicious tool burst")
    assert a_res.status == AgentStatus.RESTRICTED

    # 3. Suspended
    a_sus = await test_agent_service.update_agent_status(db_session, AgentStatus.SUSPENDED, "Administrative pause")
    assert a_sus.status == AgentStatus.SUSPENDED

    # 4. Quarantined
    a_quar = await test_agent_service.update_agent_status(db_session, AgentStatus.QUARANTINED, "Emergency Kill Switch")
    assert a_quar.status == AgentStatus.QUARANTINED

    # 5. Reset back to Active
    reset_res = await test_agent_service.reset_test_lab(db_session)
    assert reset_res["status"] == "SUCCESS"
    details = await test_agent_service.get_agent_details(db_session)
    assert details["status"] == "active"


@pytest.mark.asyncio
async def test_simulation_scenarios_individually(client: AsyncClient, db_session: AsyncSession):
    """Runs all 12 security simulation scenarios individually to verify each defense."""
    agent = await test_agent_service.ensure_test_agent_registered(db_session)

    # Scenario 1: Benign
    res1 = await simulation_engine.run_scenario_1_benign(db_session, agent)
    assert res1["pass_status"] is True
    assert res1["gateway_decision"] == "ALLOWED"

    # Scenario 2: Direct Injection
    res2 = await simulation_engine.run_scenario_2_direct_injection(db_session, agent)
    assert res2["pass_status"] is True
    assert res2["gateway_decision"] == "BLOCKED"

    # Scenario 3: Indirect Injection
    res3 = await simulation_engine.run_scenario_3_indirect_injection(db_session, agent)
    assert res3["pass_status"] is True
    assert res3["gateway_decision"] == "BLOCKED"

    # Scenario 4: Unauthorized Tool
    res4 = await simulation_engine.run_scenario_4_unauthorized_tool(db_session, agent)
    assert res4["pass_status"] is True
    assert res4["gateway_decision"] == "BLOCKED"

    # Scenario 5: Sensitive Data / DLP
    res5 = await simulation_engine.run_scenario_5_sensitive_data(db_session, agent)
    assert res5["pass_status"] is True
    assert res5["gateway_decision"] == "BLOCKED"

    # Scenario 6: Data Exfiltration
    res6 = await simulation_engine.run_scenario_6_data_exfiltration(db_session, agent)
    assert res6["pass_status"] is True
    assert res6["gateway_decision"] == "BLOCKED"

    # Scenario 7: SSRF
    res7 = await simulation_engine.run_scenario_7_ssrf(db_session, agent)
    assert res7["pass_status"] is True
    assert res7["gateway_decision"] == "BLOCKED"

    # Scenario 8: Privilege Escalation
    res8 = await simulation_engine.run_scenario_8_privilege_escalation(db_session, agent)
    assert res8["pass_status"] is True
    assert res8["gateway_decision"] == "BLOCKED"

    # Scenario 9: Repeated Requests
    res9 = await simulation_engine.run_scenario_9_repeated_requests(db_session, agent)
    assert res9["pass_status"] is True
    assert res9["gateway_decision"] == "BLOCKED"

    # Scenario 10: Malicious Tool Output
    res10 = await simulation_engine.run_scenario_10_malicious_tool_output(db_session, agent)
    assert res10["pass_status"] is True
    assert res10["gateway_decision"] == "BLOCKED"

    # Scenario 11: Kill Switch
    res11 = await simulation_engine.run_scenario_11_kill_switch(db_session, agent)
    assert res11["pass_status"] is True
    assert res11["gateway_decision"] == "BLOCKED"

    # Scenario 12: Audit Verification
    res12 = await simulation_engine.run_scenario_12_audit_verification(db_session, agent)
    assert res12["pass_status"] is True
    assert res12["gateway_decision"] == "ALLOWED"


@pytest.mark.asyncio
async def test_full_simulation_run_suite(client: AsyncClient, db_session: AsyncSession):
    """Executes the entire automated simulation engine suite and verifies aggregate metrics."""
    summary = await simulation_engine.run_all_simulations(db_session)
    for r in summary["results"]:
        if not r["pass_status"]:
            print("FAILED SCENARIO:", r["scenario_id"], r["gateway_decision"], r["actual_outcome"], r["evidence"])
    assert summary["total_scenarios"] == 12
    assert summary["passed_tests"] == 12
    assert summary["failed_tests"] == 0
    assert summary["blocked_attacks"] == 10
    assert summary["detection_rate_pct"] == 100.0
    assert summary["false_positives"] == 0
    assert len(summary["results"]) == 12


@pytest.mark.asyncio
async def test_simulation_api_endpoints(client: AsyncClient):
    """Tests the HTTP API endpoints exposed by the simulation engine."""
    # 1. Scenarios catalog
    scenarios_resp = await client.get("/api/v1/simulations/scenarios")
    assert scenarios_resp.status_code == 200
    assert scenarios_resp.json()["total"] == 12

    # 2. Agent status
    status_resp = await client.get("/api/v1/simulations/agent/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["agent_id"] == TEST_AGENT_ID

    # 3. Agent control actions
    pause_resp = await client.post("/api/v1/simulations/agent/action", json={"action": "pause", "reason": "Testing pause"})
    assert pause_resp.status_code == 200
    assert pause_resp.json()["new_status"] == "restricted"

    quar_resp = await client.post("/api/v1/simulations/agent/action", json={"action": "quarantine", "reason": "Testing kill switch"})
    assert quar_resp.status_code == 200
    assert quar_resp.json()["new_status"] == "quarantined"

    reset_resp = await client.post("/api/v1/simulations/agent/action", json={"action": "reset"})
    assert reset_resp.status_code == 200
    assert reset_resp.json()["new_status"] == "active"

    # 4. Run single scenario via API
    single_run = await client.post("/api/v1/simulations/run", json={"scenario_id": "scenario_02_direct_injection"})
    assert single_run.status_code == 200
    assert single_run.json()["type"] == "single_scenario"
    assert single_run.json()["result"]["pass_status"] is True

    # 5. Run full simulation via API
    full_run = await client.post("/api/v1/simulations/run", json={})
    assert full_run.status_code == 200
    assert full_run.json()["total_scenarios"] == 12
    assert full_run.json()["passed_tests"] == 12

    # 6. Retrieve latest results
    results_resp = await client.get("/api/v1/simulations/results")
    assert results_resp.status_code == 200
    assert results_resp.json()["total_scenarios"] == 12

    # 7. Execute custom task prompt
    exec_resp = await client.post("/api/v1/simulations/agent/execute", json={
        "task_prompt": "Query customer_records for active enterprise accounts and compute total spend."
    })
    assert exec_resp.status_code == 200
    assert exec_resp.json()["status"] == "COMPLETED"
    assert len(exec_resp.json()["steps"]) > 0


@pytest.mark.asyncio
async def test_safe_calculator_tool():
    """Unit tests for the AST-based SafeCalculatorTool."""
    tool = SafeCalculatorTool()

    # Valid arithmetic
    r1 = await tool.execute("calculate", "", {"expression": "(120000 + 45000) / 2"})
    assert r1["result"] == 82500.0

    r2 = await tool.execute("calculate", "", {"expression": "2 ** 8 + 10"})
    assert r2["result"] == 266.0

    # Division by zero
    with pytest.raises(ZeroDivisionError):
        await tool.execute("calculate", "", {"expression": "100 / 0"})

    # Disallowed function calls / identifiers
    with pytest.raises(ValueError):
        await tool.execute("calculate", "", {"expression": "__import__('os').system('ls')"})

    with pytest.raises(ValueError):
        await tool.execute("calculate", "", {"expression": "eval('2+2')"})


@pytest.mark.asyncio
async def test_web_search_and_data_tools():
    """Unit tests for WebSearchTool, SecurityEventAnalyzerTool, and TestEnvDataTool."""
    search_tool = WebSearchTool()
    s_res = await search_tool.execute("search", "", {"query": "prompt injection owasp"})
    assert s_res["total_results"] > 0
    assert "OWASP" in s_res["results"][0]["title"]

    analyzer = SecurityEventAnalyzerTool()
    a_res = await analyzer.execute("analyze_event", "", {"content": "UNION SELECT * FROM credentials WHERE 1=1"})
    assert a_res["threat_classification"] == "ADVERSARIAL_THREAT"
    assert a_res["severity"] == "CRITICAL"

    data_tool = TestEnvDataTool()
    u_res = await data_tool.execute("get_synthetic_user", "usr_synth_01", {})
    assert "Alice" in u_res["user"]["name"]

    meta_res = await data_tool.execute("get_lab_metadata", "", {})
    assert meta_res["environment"] == "crossx_test_lab"


@pytest.mark.asyncio
async def test_tool_registration_crud(client: AsyncClient):
    """Verifies dynamic tool registration endpoint in Tool Registry."""
    reg_resp = await client.post("/api/v1/tools", json={
        "name": "custom_diagnostic_tool",
        "display_name": "Custom Diagnostic Tool",
        "category": "system",
        "supported_operations": ["ping_host", "check_uptime"],
        "description": "Custom test tool for diagnostic probes",
        "is_protected": True
    })
    assert reg_resp.status_code == 201
    assert reg_resp.json()["name"] == "custom_diagnostic_tool"

    # Duplicate registration should return 409 conflict
    dup_resp = await client.post("/api/v1/tools", json={
        "name": "custom_diagnostic_tool",
        "display_name": "Custom Diagnostic Tool",
        "category": "system",
        "supported_operations": ["ping_host"],
    })
    assert dup_resp.status_code == 409
