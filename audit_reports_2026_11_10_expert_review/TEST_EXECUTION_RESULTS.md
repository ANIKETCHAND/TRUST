# AgentTrust: Test Execution & Dynamic Validation Results
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform` (Commit `06bf0fc`)  
**Execution Environment:** Windows 11, Python 3.14.6, Node.js v26.13.0  

---

## 1. Automated Test Suite Execution (pytest)

### Command Executed:
```powershell
python -m pytest backend/tests
```

### Execution Log Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.14.6, pytest-9.1.1, pluggy-1.6.0
rootdir: E:\OS PROJECT\backend
configfile: pytest.ini
plugins: anyio-4.14.1, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 64 items

backend\tests\test_active_defense_and_killer.py ...........              [ 17%]
backend\tests\test_advanced_features.py ....                             [ 23%]
backend\tests\test_all_tabs_and_pages.py ...........                     [ 40%]
backend\tests\test_attribution_and_forensics.py .......                  [ 51%]
backend\tests\test_auth_and_agents.py ...                                [ 56%]
backend\tests\test_browser_shield.py ...                                 [ 60%]
backend\tests\test_complete_lifecycle_e2e.py .                           [ 62%]
backend\tests\test_delegation_cascades_and_boundaries.py ..              [ 65%]
backend\tests\test_endpoints_and_containment.py .                        [ 67%]
backend\tests\test_gateway_security.py .                                 [ 68%]
backend\tests\test_guardrails_pipeline.py ..........                     [ 84%]
backend\tests\test_open_source_integrations.py ...                       [ 89%]
backend\tests\test_production_hardening_and_safeguards.py ...            [ 93%]
backend\tests\test_security_deep_validation.py ....                      [100%]

============================= 64 passed in 3.91s ==============================
```

### Auditor Commentary on pytest Suite:
While all 64 unit and functional tests pass cleanly, **the test suite does not validate the production environment**:
1. `backend/tests/conftest.py` lines 41-42 drop and recreate a temporary database (`test_agenttrust.db`) directly using `Base.metadata.create_all`.
2. This completely circumvents Alembic migration scripts and masks the fact that the committed SQLite database lacks required columns.
3. Tests evaluate unit functions in isolation; negative security tests (e.g. unauthenticated control plane access, client context manipulation of output rails) are omitted.

---

## 2. End-to-End Platform Demonstration Execution

### Command Executed:
```powershell
python backend/scripts/demo_full_platform.py
```

### Execution Output & Crash Trace:
```text
================================================================================
   AGENTTRUST: PRODUCTION-ORIENTED AI AGENT SECURITY PLATFORM
                FULL END-TO-END SECURITY AUDIT & DEMO
================================================================================

[1] PLATFORM HEALTH CHECK: HTTP 200
    Service: AgentTrust AI Security Platform | Version: 0.2.0

[2] AGENT REGISTRATION: 'SecOps-Lead-Agent' (ID: 5481d76f-73c0-4ce8-aab7-284e9fc496ee)
    Raw API Key: agk_live_ZB7J8lhnY7CR2dleU7CKsM85TgIfYPQ9-t3CU3hNSNE

[3] TESTING DENY-BY-DEFAULT:
    Gateway Response: HTTP 403
    Decision: BLOCKED | Reason: Deny-by-default: No matching grant found...

[4] GRANTING GRANULAR PERMISSIONS:
    Granted Permission 1: ID 0a72e430-8ced-4b32-93de-627fe78a6ad4 -> postgres_tool:query_select
    Granted Permission 2: ID 81c1bf87-8f8d-4f23-9a38-96520d6ed280 -> filesystem_tool:write_file

[5] TESTING AUTHORIZED RELATIONAL DATABASE TOOL:
    Gateway Response: HTTP 200 | Decision: ALLOWED
    Rows Returned: 2

[6] TESTING SQL INJECTION / DESTRUCTIVE DDL ENFORCEMENT:
    Safety Error: Destructive DDL/administrative SQL statements are strictly forbidden.

[7] TESTING SSRF BOUNDARY ENFORCEMENT ON HTTP TOOL:
    Enforcement Error: Access to restricted destination '127.0.0.1' is strictly blocked.

[8] TESTING DATA LEAKAGE PREVENTION (DLP) ON OUTBOUND TRANSFER:
    Gateway Decision: BLOCKED
    DLP Violation Reason: Blocked outbound transfer containing Social Security Number.

[9] TESTING MULTI-AGENT DELEGATION:
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) table delegations has no column named parent_delegation_id
[SQL: INSERT INTO delegations (parent_agent_id, child_agent_id, parent_delegation_id, scope, max_depth, current_depth, status, token_hash, expires_at, revoked_at, revocation_reason, id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)]
```

### Result: **CRASH AT STEP 9 (100% REPRODUCIBLE)**
The live demonstration script fails due to database migration desynchronization.

---

## 3. Alembic Migration State Verification

### Command Executed:
```powershell
cd backend; python -m alembic current
```

### Execution Output:
```text
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
ERROR [alembic.util.messaging] Can't locate revision identified by 'baa8a3fbd940'
FAILED: Can't locate revision identified by 'baa8a3fbd940'
```

### Root Cause:
Commit `7fc5171` deleted migration `baa8a3fbd940_initial_schema_with_endpoints.py` and introduced `c0c4c1902c20_complete_platform_initial_schema.py`. The database was never upgraded to match.

---

## 4. Adversarial Proof-of-Concept Validations

### A. Output Rails Bypass via Client Context
```powershell
$env:PYTHONPATH="backend"
python -c "from app.guardrails.output_rails import output_rails; res = output_rails.inspect_and_sanitize('Private key: -----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----', mode='raw'); print('Allowed:', res.allowed); print('Payload:', res.sanitized_payload)"
```
- **Observed Result:** `Allowed: True`, `Payload: Private key: -----BEGIN RSA PRIVATE KEY-----...`
- **Verdict:** Confirmed Critical Bypass.

### B. Dialog Rails State Machine Evasion via Session ID Rotation
```powershell
$env:PYTHONPATH="backend"
python -c "from app.guardrails.dialog_rails import dialog_rails; r1 = dialog_rails.evaluate_transition('agent1', 'sess_A', 'postgres_tool', 'query_select'); r2 = dialog_rails.evaluate_transition('agent1', 'sess_A', 'http_api_tool', 'http_post'); r3 = dialog_rails.evaluate_transition('agent1', 'sess_B', 'http_api_tool', 'http_post'); print('Call 1 (DB):', r1.allowed); print('Call 2 (HTTP same sess):', r2.allowed); print('Call 3 (HTTP diff sess):', r3.allowed)"
```
- **Observed Result:**
  `Call 1 (DB): True`
  `Call 2 (HTTP same sess): False (Blocked)`
  `Call 3 (HTTP diff sess): True (Allowed)`
- **Verdict:** Confirmed High Severity Evasion.
