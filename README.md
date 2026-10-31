# AgentTrust: Production-Oriented AI Agent Security Platform

AgentTrust is a deterministic, enterprise-grade cybersecurity platform that sits between autonomous AI agents and protected resources (relational databases, sandboxed filesystems, external APIs, MCP endpoints, and inter-agent communication).

It intercepts every agent action, validates credentials, evaluates security policies, prevents unauthorized operations, stops prompt-injection-driven data exfiltration, and logs tamper-evident audit trails.

---

## 1. System Architecture

```
                                  +------------------------------------+
                                  |         AI Agents / LLMs           |
                                  +-----------------+------------------+
                                                    |
                                                    | Protected Tool Execution Request
                                                    v
                                  +------------------------------------+
                                  |       AgentTrust API Gateway       |
                                  |     /api/v1/gateway/execute        |
                                  +-----------------+------------------+
                                                    |
         +------------------------------------------+------------------------------------------+
         |                      |                   |                  |                       |
         v                      v                   v                  v                       v
+------------------+  +-------------------+  +---------------+  +---------------+  +---------------------+
| Agent Auth       |  | Deterministic     |  | Multi-Agent   |  | Data Leakage  |  | Tamper-Evident      |
| - Key Hash SHA256|  | Policy Engine     |  | Delegation    |  | Prevention    |  | Audit & Incidents   |
| - Revocation     |  | - Deny-by-default |  | - Depth check |  | - PII / Keys  |  | - Structured events |
| - Anti-spoofing  |  | - Explicit Deny   |  | - No scaling  |  | - Block leaks |  | - Auto incidents    |
+------------------+  +-------------------+  +---------------+  +---------------+  +---------------------+
                                                    |
                                                    v
                                        +-----------------------+
                                        | Controlled Execution  |
                                        |  (Allowed Actions)    |
                                        +-----------+-----------+
                                                    |
             +-----------------------+--------------+---------------+-----------------------+
             |                       |                              |                       |
             v                       v                              v                       v
+-------------------------+ +------------------------+ +------------------------+ +---------------------+
| Sandboxed Filesystem    | | PostgreSQL / Relational| | Outbound HTTP API      | | Model Context       |
| - Directory Traversal   | | - SQL DDL Block        | | - SSRF Protection      | | Protocol (MCP)      |
| - Path Jail Restriction | | - Safe Query Select    | | - Loopback/IP block    | | - Tool Bridge       |
+-------------------------+ +------------------------+ +------------------------+ +---------------------+
```

---

## 2. Platform Modules & Dashboard Pages

The platform features 11 integrated modules and frontend views:

1. **Overview Dashboard**: Real-time aggregated metrics (Agents, Tools, Allowed, Blocked, Security Incidents), 24h Gateway Enforcement Timeline (Recharts), and Tool Invocation Distribution.
2. **Agent Registry & Credential Management**: Provision agents, generate cryptographic API keys (`agk_live_...`), inspect identities, assign roles, view granular permissions, and trigger instant revocation.
3. **Protected Tool Registry & Live Tester**: Server-side tool definitions for Relational DB, Sandboxed Filesystem, Outbound HTTP, and MCP Bridge. Includes an interactive console to test tool calls directly through the gateway.
4. **Live Monitoring**: Real-time interception telemetry stream with auto-polling (every 3s), decision filters, and a JSON inspector for every request and response.
5. **Multi-Agent Delegation Graph**: Issue cryptographic parent-to-child delegation tokens with scope constraints, depth limits, and anti-privilege escalation checks.
6. **Provenance Explorer**: Visual data-flow lineage graph connecting origin sources (prompts, untrusted PDFs, emails), agent transforms, and influenced tool actions with Trust Level badges (`TRUSTED`, `UNTRUSTED`, `SANITIZED`).
7. **Security Policies & Simulator**: Manage versioned declarative policies with immutable revision tracking, and dry-run access decisions against test agents and resources without side-effects.
8. **Security Incidents & Alerts**: Triage security alerts generated from blocked tool requests, view severity classifications (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), update investigation notes, and change resolution states.
9. **Security Audit Trail & Compliance Export**: Search, filter, and sort all historical gateway decisions, with one-click export to **CSV** or **JSON**.
10. **Autonomous Agent Workflow Runner**: Execute stateful multi-step agent tasks and simulate indirect prompt injection attacks to verify AgentTrust intercepting and halting data exfiltration.
11. **Platform Configuration & System Health**: Service health status, OPA connectivity, default deny-by-default rules, and sandbox storage jail information.

---

## 3. Database Schema

All models are built with SQLAlchemy 2.0 async engine support:
- `users`: Administrative operators, auditors, password hashes (bcrypt).
- `agents`: Registered AI agent identities, roles, and status (`active`, `revoked`, `suspended`).
- `agent_credentials`: SHA-256 token hashes (`token_hash`), key preview prefix, revocation status, expiration dates.
- `tools`: Registered tools, categories, supported operations, and protection status.
- `permissions`: Granular rules mapping agents, tools, operations, resource globs, effects (`ALLOW`/`DENY`), priorities, and expiration.
- `delegations`: Inter-agent delegation hierarchy, delegation scopes, maximum depths, and validity tokens.
- `policies` & `policy_versions`: Declarative policy rules with version history.
- `provenance_nodes` & `provenance_edges`: Graph representation for sources, transformations, and handoffs.
- `audit_events`: Tamper-evident execution logs storing request IDs, agent IDs, decisions, durations, and context.
- `security_incidents`: Security incident tracker linking blocked operations with severity and resolution states.
- `revocation_records`: Formal audit records of revocation actions.

---

## 4. Quick Start & Execution

### Prerequisites
- Python 3.11+
- Node.js 18+

### Setup & Dependencies
```powershell
# Backend
cd "e:\OS PROJECT\backend"
pip install -r requirements.txt

# Frontend
cd "e:\OS PROJECT\frontend"
npm install
npm run build
```

### Running All Automated Tests (23/23 Passing)
```powershell
cd "e:\OS PROJECT\backend"
python -m pytest -v
```

### Running the End-to-End Security Demonstration
```powershell
python "e:\OS PROJECT\backend\scripts\demo_full_platform.py"
```

### Starting the Platform Server
```powershell
cd "e:\OS PROJECT\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Web Dashboard**: `http://localhost:8000/`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`
