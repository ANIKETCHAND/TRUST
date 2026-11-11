# AgentTrust: Test Execution & Verification Results
**Assessment Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
**Execution Environment:** Windows 11 x64, Python 3.14.6 / Python 3.11, Node.js v26.13.0, npm 11.20.0, Vite 8.3.5

---

## 1. Executive Summary of Testing

During this audit, the Independent Technical Review Board executed:
1. **The Automated Pytest Suite**: Ran all 14 test modules in `backend/tests/`.
2. **Frontend Production Build**: Tested TypeScript compilation and Vite asset bundling.
3. **End-to-End Platform Demo Script**: Attempted execution of `backend/scripts/demo_full_platform.py` against the application database.
4. **Database & Alembic Migration State**: Inspected Alembic revision stamps and schema definitions.
5. **Adversarial Negative Testing**: Validated vulnerability reproduction scripts for XSS, process termination, ARP leaking, and IP spoofing.

---

## 2. Automated Backend Test Suite Results

The automated test suite was executed using Python 3.14 with pytest 9.1.1:

```bash
C:\Python314\python.exe -m pytest backend/tests
```

### Execution Output:
```
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

============================= 64 passed in 4.12s ==============================
```

### Critical Auditor Analysis of the Test Suite:
1. **Why do all 64 tests pass while the real system has fatal bugs?**
   - In `backend/tests/conftest.py`, the test environment intercepts `DATABASE_URL` and redirects to an isolated file `test_agenttrust.db`.
   - The fixture executes `Base.metadata.drop_all` followed by `Base.metadata.create_all`, creating a fresh database from scratch on every test session.
   - This masked the fact that the **real application database** (`backend/agenttrust.db`) was generated from an obsolete schema lacking `parent_delegation_id`.
2. **Missing Negative Tests**:
   - The test suite tests successful executions and basic simulated attacks, but never tests authentication on the control plane.
   - There are zero tests asserting that `POST /agents`, `POST /permissions`, `POST /policies`, or `POST /active-defense/kill-process` require authentication.

---

## 3. Real Application Demo Script Execution (Failure Observed)

The project includes an end-to-end verification script: `backend/scripts/demo_full_platform.py`. This script simulates realistic workflows using the actual application routes.

```bash
C:\Python314\python.exe backend\scripts\demo_full_platform.py
```

### Observed Runtime Behavior & Stack Trace:
Steps 1 through 8 succeed (Health check, Agent registration, Deny-by-default, Permission granting, Database query, SQL DDL blocking, SSRF blocking, DLP inspection).

At **Step 9 (Multi-Agent Delegation)**, the execution crashes with a fatal SQLAlchemy operational error:

```
[9] TESTING MULTI-AGENT DELEGATION:
Traceback (most recent call last):
  ...
  File "C:\Python314\Lib\site-packages\sqlite3\__init__.py", line ...
sqlite3.OperationalError: table delegations has no column named parent_delegation_id
[SQL: INSERT INTO delegations (parent_agent_id, child_agent_id, parent_delegation_id, scope, max_depth, current_depth, status, token_hash, expires_at, revoked_at, revocation_reason, id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)]
```

### Finding:
The application fails when performing real multi-agent delegation operations against the shipped database because migrations were never properly applied.

---

## 4. Alembic Migration State Verification

To investigate why the database schema was missing columns, Alembic migration commands were executed directly:

```bash
cd backend
C:\Python314\python.exe -m alembic current
```

### Observed Output:
```
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
ERROR [alembic.util.messaging] Can't locate revision identified by 'baa8a3fbd940'
FAILED: Can't locate revision identified by 'baa8a3fbd940'
```

### Finding:
The database file `backend/agenttrust.db` stores an active revision `baa8a3fbd940` in its `alembic_version` table. However, directory `backend/alembic/versions/` contains only `c0c4c1902c20_complete_platform_initial_schema.py`. The migration chain is fractured and broken.

---

## 5. Frontend Production Build Verification

The React frontend build pipeline was tested using Node.js v26.13.0:

```bash
cd frontend
npm run build
```

### Execution Output:
```
> frontend@0.0.0 build
> tsc -b && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 2656 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-DwL1eEZn.css   28.32 kB │ gzip:   5.88 kB
dist/assets/index-CVCcpzrx.js   786.52 kB │ gzip: 216.05 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 790ms
```

### Finding:
The frontend compiles and builds successfully without TypeScript syntax or typecheck errors. However, bundle size exceeds 500 kB because dynamic code splitting has not been implemented.

---

## 6. Adversarial Verification & Negative Testing Results

### A. Verification of Stored XSS in Report HTML Export
- **Script Executed:**
  ```powershell
  $env:PYTHONPATH="backend"
  C:\Python314\python.exe -c "from app.services.report_generator import report_generator; dossier = {'report_id': 'REP-1', 'incident': {'id': '1', 'title': '<script>alert(1)</script>', 'severity': 'CRITICAL', 'status': 'OPEN', 'created_at': '2026-11-10T00:00:00', 'agent_id': 'a1', 'agent_name': 'bot', 'client_ip': '1.2.3.4'}, 'mitre_attack': {'id': 'T1', 'name': 'test', 'tactic': 't', 'description': 'd'}, 'attribution': {'origin_type': 'WAN', 'geolocation': {'city': 'c', 'country': 'C'}, 'network': {'asn': 'A'}}, 'timeline': [{'timestamp': '2026-11-10T00:00:00', 'phase': 'p', 'event': '<img src=x onerror=alert(2)>', 'status': 's', 'details': 'd'}], 'countermeasures_engaged': []}; html = report_generator.export_as_html(dossier); print('VULNERABLE XSS INJECTED:' if '<img src=x onerror=alert(2)>' in html else 'SAFE')"
  ```
- **Observed Result:** `VULNERABLE XSS INJECTED:`
- **Finding:** Raw HTML tags are interpolated without escaping.

### B. Verification of Unauthenticated Process Kill Switch
- **Endpoint Inspected:** `backend/app/api/v1/active_defense.py:37-54`
- **Observed Result:** Zero authentication dependencies (`Depends(get_current_user)` is missing). Function invokes `psutil.Process(pid).kill()`.
- **Finding:** Critical unauthenticated remote process termination flaw confirmed.

### C. Verification of Policy UI vs. Gateway Disconnect
- **Code Inspected:** `backend/app/api/v1/policies.py:40` updates `Policy` model; `backend/app/services/policy_engine.py:95` evaluates `Permission` model.
- **Observed Result:** Modifying `Policy.rules` has no programmatic path to reach `policy_engine.evaluate()`.
- **Finding:** Architectural disconnect confirmed.

---

## 7. Inventory of What Was Tested vs. What Could Not Be Tested

### Successfully Tested & Verified:
- [x] Full automated pytest test suite (64 tests).
- [x] Frontend build and packaging via Vite + TypeScript compiler.
- [x] End-to-end full platform execution script (`demo_full_platform.py`).
- [x] Alembic migration state and revision synchronization.
- [x] Filesystem path traversal jailing logic (`filesystem_tool.py`).
- [x] SSRF private IP validation logic (`http_api_tool.py`).
- [x] Luhn payment card verification algorithm (`output_rails.py`).
- [x] Stored XSS reproduction in HTML report generation.
- [x] All 16 frontend tabs and layout navigation.
- [x] All backend API route definitions and dependency bindings.

### What Could Not Be Tested & Why:
- **Real ClamAV / YARA daemon scanning**: NOT TESTED because ClamAV and YARA daemons are not installed on the local test machine, and the application does not contain real client code to communicate with them.
- **Live Open Policy Agent (OPA) sidecar**: NOT TESTED because OPA is disabled by default in settings (`OPA_ENABLED=False`) and no OPA sidecar service was running.
- **Live Pipelock Go sidecar**: NOT TESTED because Pipelock is not running and `gateway_service.py` contains no code to route calls to it.
- **Docker Compose cluster deployment**: NOT TESTED via Docker engine directly because tests were conducted on the local Windows environment; Dockerfile analysis proved frontend is missing from the container build.
- **Hardware-level NIC vendor resolution**: Tested via `arp -a` parser simulation; real enterprise hardware ARP cache is limited to local development subnet.
