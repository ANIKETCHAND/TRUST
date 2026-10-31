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


async def run_phase1_demo():
    print("=" * 70)
    print("   AGENTTRUST PHASE 1: SECURITY GATEWAY LIVE DEMONSTRATION")
    print("=" * 70)

    # Ensure DB and tools are initialized
    await init_db()
    async with async_session_maker() as session:
        await tool_registry.sync_tools_to_db(session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://agenttrust.local") as client:
        # Step 1: Health check
        health = await client.get("/api/v1/health")
        print(f"\n[1] Gateway Health Check: HTTP {health.status_code}")
        print(f"    Payload: {json.dumps(health.json(), indent=2)}")

        # Step 2: Register a new AI Agent
        agent_payload = {
            "name": "SecOps-Compliance-Bot",
            "description": "Autonomous compliance auditor for secure environments",
            "role": "compliance_auditor",
            "agent_metadata": {"cluster": "us-east-1", "tier": "production"}
        }
        reg_resp = await client.post("/api/v1/agents", json=agent_payload)
        reg_data = reg_resp.json()
        agent_id = reg_data["agent"]["id"]
        raw_key = reg_data["raw_api_key"]
        print(f"\n[2] Agent Registered: '{reg_data['agent']['name']}' (ID: {agent_id})")
        print(f"    Assigned Cryptographic API Key: {raw_key}")
        print(f"    Token Prefix in DB: {reg_data['token_prefix']}")

        headers = {"Authorization": f"Bearer {raw_key}"}

        # Step 3: Blocked Unauthorized Execution (Deny-by-default)
        print("\n[3] ATTEMPTING UNAUTHORIZED OPERATION (Deny-by-default Enforcement)...")
        blocked_req = {
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "confidential/payroll_q3.csv",
            "parameters": {}
        }
        blocked_resp = await client.post("/api/v1/gateway/execute", headers=headers, json=blocked_req)
        print(f"    Gateway Interception Status: HTTP {blocked_resp.status_code}")
        print(f"    Gateway Decision: {json.dumps(blocked_resp.json(), indent=2)}")

        # Step 4: Grant Authorized Permission
        print("\n[4] ADMINISTRATOR GRANTS PERMISSION TO AGENT...")
        perm_payload = {
            "agent_id": agent_id,
            "tool_name": "filesystem_tool",
            "operation": "write_file",
            "resource_pattern": "reports/*",
            "effect": "ALLOW",
            "priority": 10,
            "description": "Permit SecOps bot to write compliance reports"
        }
        perm_resp = await client.post("/api/v1/permissions", json=perm_payload)
        perm_data = perm_resp.json()
        print(f"    Permission Granted: ID {perm_data['id']}")
        print(f"    Rule: {perm_data['tool_name']}:{perm_data['operation']} on '{perm_data['resource_pattern']}' -> {perm_data['effect']}")

        # Step 5: Successful Authorized Execution
        print("\n[5] ATTEMPTING AUTHORIZED OPERATION VIA GATEWAY...")
        auth_req = {
            "tool": "filesystem_tool",
            "operation": "write_file",
            "resource": "reports/audit_2026.txt",
            "parameters": {
                "content": "AUDIT REPORT: System integrity verified. Zero unauthorized leaks."
            }
        }
        auth_resp = await client.post("/api/v1/gateway/execute", headers=headers, json=auth_req)
        auth_data = auth_resp.json()
        print(f"    Gateway Interception Status: HTTP {auth_resp.status_code}")
        print(f"    Gateway Decision: {auth_data['decision']}")
        print(f"    Execution Status: {auth_data['execution_status']}")
        print(f"    Execution Result: {json.dumps(auth_data['result'], indent=2)}")
        print(f"    Execution Latency: {auth_data['execution_duration_ms']:.2f} ms")

        # Step 6: Verify file existence on disk
        sandbox_file = Path("./sandbox_storage/reports/audit_2026.txt")
        print(f"\n[6] Physical Sandbox Verification:")
        print(f"    File path on disk: {sandbox_file.resolve()}")
        print(f"    File exists: {sandbox_file.exists()}")
        if sandbox_file.exists():
            print(f"    Content read from disk: '{sandbox_file.read_text()}'")

        # Step 7: Inspect Audit Events in Database
        audit_res = await client.get(f"/api/v1/audit?agent_id={agent_id}")
        events = audit_res.json()
        print(f"\n[7] Database Audit Log Verification:")
        print(f"    Recorded Audit Events for Agent: {len(events)}")
        for i, ev in enumerate(events, 1):
            print(f"    Event #{i}: Decision={ev['decision']} | Tool={ev['tool_name']}:{ev['operation']} | Resource={ev['target_resource']} | Duration={ev['execution_duration_ms']}ms")

        # Step 8: Inspect Security Incidents in Database
        inc_res = await client.get("/api/v1/audit/incidents")
        incidents = inc_res.json()
        print(f"\n[8] Security Incident Management Verification:")
        print(f"    Active Security Incidents: {len(incidents)}")
        for inc in incidents:
            print(f"    Incident ID={inc['id']} | Severity={inc['severity']} | Title='{inc['title']}' | Status={inc['status']}")

    print("\n" + "=" * 70)
    print("   DEMONSTRATION COMPLETED: ALL SECURITY CONTROLS OPERATIONAL")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_phase1_demo())
