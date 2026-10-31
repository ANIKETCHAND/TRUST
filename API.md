# AgentTrust: REST API Specification (v1)

Base URL: `http://localhost:8080/api/v1`

---

## 1. Authentication & Security Headers

| Header | Description | Example |
| :--- | :--- | :--- |
| `X-Agent-Key` | Cryptographic raw API key used by agents for gateway executions. | `agk_live_a3f890b1c72e...` |
| `Authorization` | Bearer token for user / administrator sessions or agent gateway calls. | `Bearer <jwt_or_key>` |
| `Content-Type` | Standard JSON payload format. | `application/json` |

---

## 2. API Endpoints

### Health & Diagnostics
#### `GET /health`
Returns system status, active environment, and engine configuration.
- **Response `200 OK`**:
```json
{
  "status": "healthy",
  "service": "AgentTrust AI Security Platform",
  "version": "0.1.0",
  "environment": "development",
  "opa_enabled": false
}
```

---

### Security Overview
#### `GET /overview/stats`
Aggregated telemetry metrics, 24-hour enforcement trends, and tool usage distribution.
- **Response `200 OK`**:
```json
{
  "metrics": {
    "total_agents": 4,
    "active_agents": 3,
    "registered_tools": 4,
    "allowed_operations": 142,
    "blocked_operations": 19,
    "security_incidents": 2
  },
  "timeline_24h": [
    { "hour": "10:00", "allowed": 24, "blocked": 3 },
    { "hour": "11:00", "allowed": 31, "blocked": 1 }
  ],
  "tool_distribution": [
    { "name": "filesystem_tool", "invocations": 68 },
    { "name": "postgres_tool", "invocations": 52 }
  ],
  "recent_events": [ ... ]
}
```

---

### Security Gateway (Protected Execution)
#### `POST /gateway/execute`
The single entry point for all agent actions. Denied requests return `403 Forbidden` with full structured audit metadata.
- **Headers**: `X-Agent-Key: <key>`
- **Request Body**:
```json
{
  "tool": "filesystem_tool",
  "operation": "read_file",
  "resource": "reports/q3_summary.txt",
  "parameters": {
    "encoding": "utf-8"
  },
  "context": {
    "user_session_id": "usr_99812",
    "prompt_id": "prm_1002"
  }
}
```
- **Response `200 OK` (Allowed)**:
```json
{
  "request_id": "req_88f01b92",
  "decision": "ALLOWED",
  "reason": "Request matches explicit grant on filesystem_tool:read_file",
  "execution_status": "SUCCESS",
  "result": {
    "content": "Quarterly performance report...",
    "size_bytes": 1024
  },
  "execution_duration_ms": 3.42,
  "audit_event_id": "aud_1928301"
}
```
- **Response `403 Forbidden` (Blocked by Policy / Traversal)**:
```json
{
  "request_id": "req_998a120c",
  "decision": "BLOCKED",
  "reason": "Path traversal attempt detected: access outside sandboxed boundary denied.",
  "execution_status": "BLOCKED",
  "result": null,
  "execution_duration_ms": 1.15,
  "audit_event_id": "aud_1928302"
}
```

---

### Agent Management
#### `GET /agents?status=active`
List all registered AI agents with optional status filtering.

#### `POST /agents`
Register a new AI agent and receive the raw cryptographic API key (shown only once).
- **Request Body**:
```json
{
  "name": "AuditBot-Alpha",
  "role": "Security Auditor",
  "description": "Reviews financial records and generates compliance reports."
}
```
- **Response `201 Created`**:
```json
{
  "agent": {
    "id": "c92841-...",
    "name": "AuditBot-Alpha",
    "role": "Security Auditor",
    "status": "ACTIVE",
    "created_at": "2026-10-31T10:00:00Z"
  },
  "api_key": "agk_live_f89a7102b3c489..."
}
```

#### `POST /agents/{agent_id}/revoke`
Immediately invalidate an agent's credentials. All future gateway calls from this agent fail closed.
- **Request Body**:
```json
{
  "reason": "Compromised prompt injection suspected in session #882."
}
```

---

### Tool Registry
#### `GET /tools`
List all registered protected tools, supported operations, and active guardrails.

#### `GET /tools/{tool_id}`
Get detailed schema and parameter definitions for a specific tool.

---

### Delegation Management
#### `GET /delegations`
List all parent-to-child delegation tokens and active scopes.

#### `POST /delegations`
Issue a cryptographic delegation token from parent agent to child agent.
- **Request Body**:
```json
{
  "delegator_id": "agent-parent-uuid",
  "delegatee_id": "agent-child-uuid",
  "scope": ["filesystem_tool:read_file"],
  "max_depth": 2,
  "expires_in_hours": 24
}
```

#### `POST /delegations/{delegation_id}/revoke`
Revoke a delegation token. Cascades to any sub-delegations issued by the child.

---

### Provenance Tracking
#### `GET /provenance/graph`
Returns nodes and edges representing the complete data-flow lineage graph across agents and tools.

---

### Security Policies
#### `GET /policies`
List all registered security policies.

#### `POST /policies`
Create a new deterministic access policy.
- **Request Body**:
```json
{
  "name": "Block Sensitive Files",
  "description": "Prevent access to passwords and environment files",
  "target_tool": "filesystem_tool",
  "target_operation": "read_file",
  "resource_pattern": ".*(password|secret|\\.env).*",
  "effect": "DENY",
  "priority": 100
}
```

#### `POST /policies/test`
Simulate policy evaluation against a hypothetical tool request without executing side effects.

---

### Incidents & Alerts
#### `GET /incidents?severity=CRITICAL&status=OPEN`
List security alerts generated by gateway blocks and policy violations.

#### `PATCH /incidents/{incident_id}`
Update the forensic investigation status and resolution notes of an incident.
- **Request Body**:
```json
{
  "status": "RESOLVED",
  "resolution_notes": "Root cause identified as untrusted vendor attachment. Filter updated."
}
```

---

### Audit Trail
#### `GET /audit?decision=BLOCKED&tool_name=filesystem_tool&limit=50`
Retrieve paginated, immutable audit trail records.

#### `GET /audit/export?format=csv`
Export audit events as a downloadable CSV file.

#### `GET /audit/export?format=json`
Export audit events as a downloadable JSON file.

---

### Autonomous Agent Runner
#### `POST /agents/run-workflow`
Dispatches a real multi-step autonomous workflow to demonstrate end-to-end gateway interception and indirect prompt injection defense.
- **Request Body**:
```json
{
  "agent_id": "c92841-...",
  "task_prompt": "Read client records and write summary report to reports/",
  "simulate_injection_attack": true
}
```
- **Response `200 OK`**:
Returns the multi-step execution timeline detailing each tool call, gateway decision (`ALLOWED` or `BLOCKED`), policy reason, and intermediate output.
