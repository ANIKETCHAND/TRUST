# AgentTrust: Production-Oriented AI Agent Security Platform

AgentTrust is a deterministic security platform that sits between AI agents and the sensitive resources they access (APIs, databases, files, and inter-agent communication).

It intercepts every agent action, validates credentials, evaluates security policies, prevents unauthorized operations, and logs tamper-evident audit trails.

---

## 1. System Architecture

```
                                  +------------------------------------+
                                  |         AI Agents / LLMs           |
                                  +-----------------+------------------+
                                                    |
                                                    | Protected Tool Requests
                                                    v
                                  +------------------------------------+
                                  |       AgentTrust API Gateway       |
                                  |     /api/v1/gateway/execute        |
                                  +-----------------+------------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                          |                          |
                         v                          v                          v
             +-----------------------+  +-----------------------+  +-----------------------+
             | Agent Authentication  |  | Policy & Auth Engine  |  |  Audit & Incident     |
             |  - Credential Hashing |  |  - Deny-by-default    |  |  - Tamper-evident log |
             |  - Revocation checks  |  |  - Explicit Deny      |  |  - Auto incidents     |
             |  - Anti-spoofing      |  |  - Glob/pattern match |  |  - Secret redaction   |
             +-----------------------+  +-----------------------+  +-----------------------+
                                                    |
                                                    v
                                        +-----------------------+
                                        | Controlled Execution  |
                                        |  (Allowed Actions)    |
                                        +-----------+-----------+
                                                    |
                           +------------------------+------------------------+
                           |                                                 |
                           v                                                 v
             +---------------------------+                     +---------------------------+
             |  Sandboxed Filesystem     |                     |    PostgreSQL Database    |
             |  - Traversal Prevention   |                     |    - Dedicated credentials|
             |  - Strict Root Jail       |                     |    - Query validation     |
             +---------------------------+                     +---------------------------+
```

---

## 2. Phase 1 Implementation Summary

Phase 1 establishes the deterministic security gateway, authentication foundation, and real sandboxed tool execution:

1. **Central Security Gateway (`/api/v1/gateway/execute`)**:
   - Intercepts all tool execution requests.
   - Derives agent identity strictly from authenticated cryptographic credentials (`agk_live_...`), ignoring any caller-supplied payload IDs.
   - Fail-closed evaluation: unhandled exceptions, unknown tools, or invalid operations abort execution before reaching tool handlers.
   - Blocked actions have **zero side-effects**.

2. **Deterministic Authorization Engine**:
   - Deny-by-default access model.
   - Agent-level, tool-level, operation-level, and resource pattern matching.
   - Explicit `DENY` precedence over `ALLOW`.
   - Automatic expiration checks for time-bounded grants.
   - Defense-in-depth directory traversal protection.
   - Open Policy Agent (OPA) integration support with fail-closed fallback.

3. **Agent Registry & Credential Management**:
   - Unique agent registration with metadata.
   - Generation of high-entropy API keys (`agk_live_...`).
   - SHA-256 cryptographic credential hashing (raw keys are never stored).
   - Real-time agent revocation that instantly invalidates credentials.

4. **Real Sandboxed Tool Execution**:
   - `filesystem_tool`: real, path-jailed file I/O operations (`read_file`, `write_file`, `list_directory`, `delete_file`).
   - Enforces strict boundary verification to block `../` directory traversal attacks.

5. **Tamper-Evident Audit & Security Incident Management**:
   - Persistent relational storage for all audit events (request ID, agent ID, tool, operation, decision, reason, duration, context).
   - Automatic redaction of sensitive credentials and secrets in audit metadata.
   - Automated creation of `SecurityIncident` records whenever an operation is blocked.

---

## 3. Database Schema

The database models are implemented using SQLAlchemy 2.0 with async engine support:

- **`users`**: Administrative operators, auditors, and admin credentials (bcrypt hashed).
- **`agents`**: Registered AI agent identities, roles, status (`active`, `revoked`, `suspended`), and metadata.
- **`agent_credentials`**: Hashed agent API keys (`token_hash`), key prefixes, revocation status, expiration dates.
- **`tools`**: Registered tools, supported operations, and protection status.
- **`permissions`**: Granular grants (`tool_name`, `operation`, `resource_pattern`, `effect`, `priority`, `conditions`, `expires_at`).
- **`delegations`**: Multi-agent delegation hierarchy, scopes, max delegation depth, and revocation status.
- **`policies` & `policy_versions`**: Versioned security policies and rule sets.
- **`provenance_nodes` & `provenance_edges`**: Observable provenance graph tracking sources, agent handoffs, and trust levels.
- **`audit_events`**: Immutable audit logs capturing all gateway decisions and tool execution durations.
- **`security_incidents`**: Security alerts generated from blocked actions and policy violations.
- **`revocation_records`**: Audit logs of administrative revocation events.

---

## 4. API Endpoints

### Authentication & Users
- `POST /api/v1/auth/register` - Register platform administrator/auditor.
- `POST /api/v1/auth/login` - Authenticate and obtain JWT Bearer token.

### Agents
- `POST /api/v1/agents` - Register a new AI agent (returns one-time raw API key).
- `GET /api/v1/agents` - List registered agents with status filtering.
- `GET /api/v1/agents/{agent_id}` - Retrieve agent identity and configuration.
- `PATCH /api/v1/agents/{agent_id}` - Update agent metadata or state.
- `POST /api/v1/agents/{agent_id}/revoke` - Immediately revoke an agent and all its keys.

### Tools
- `GET /api/v1/tools` - List registered tools and supported operations.
- `GET /api/v1/tools/{tool_id}` - Get tool details.

### Permissions
- `POST /api/v1/permissions` - Create an `ALLOW` or `DENY` permission grant.
- `GET /api/v1/permissions` - List active permissions.
- `DELETE /api/v1/permissions/{permission_id}` - Deactivate a grant.

### Security Gateway
- `POST /api/v1/gateway/execute` - Gateway execution interceptor. Requires `Authorization: Bearer <agent_api_key>` or `X-Agent-Key: <key>`.

### Audit & Incidents
- `GET /api/v1/audit` - Search and filter audit events.
- `GET /api/v1/audit/incidents` - List security incidents.

### Health
- `GET /api/v1/health` - Platform status and configuration.

---

## 5. Quick Start Instructions

### Prerequisites
- Python 3.11+ (Python 3.14 verified)
- Node.js 18+ (for frontend in later phases)

### Installation
```bash
cd backend
pip install -r requirements.txt
```

### Running Automated Security Tests
```bash
cd backend
python -m pytest -v
```

### Running the Live Security Demonstration
```bash
cd backend
python scripts/demo_phase1.py
```

### Starting the Backend Server
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI documentation will be available at: `http://localhost:8000/docs`

---

## 6. Phase 1 Verification Results

Automated test suite passing (8/8 tests passed in 0.99s):
- `test_health_check`: PASSED
- `test_user_registration_and_login`: PASSED
- `test_agent_registration_and_revocation`: PASSED
- `test_gateway_enforcement_lifecycle`: PASSED
- `test_authentication_failures`: PASSED
- `test_blocked_operation_has_no_side_effects`: PASSED
- `test_identity_cannot_be_spoofed_in_payload`: PASSED
- `test_audit_log_completeness`: PASSED

Demonstration script execution:
- Attempted unauthorized file read -> **BLOCKED (HTTP 403)**, zero tool execution, security incident recorded.
- Granted permission `reports/*` -> **ALLOWED (HTTP 200)**, file written in sandbox in 0.85 ms.
- Disk verification confirmed file content at `sandbox_storage/reports/audit_2026.txt`.
- Audit log confirmed both events persisted with latency, agent ID, and redacted metadata.
