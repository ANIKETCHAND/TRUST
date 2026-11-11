# AgentTrust Industrial Architecture Specification
**Document Version:** 2.0.0  
**Classification:** Enterprise System Architecture  
**Target Audience:** Enterprise Cybersecurity Teams, Security Architects, DevSecOps Engineers, AI Researchers  

---

## 1. Executive Mission & System Overview

AgentTrust is an industrial-grade, zero-trust security platform and deterministic execution gateway designed specifically for autonomous AI agents (e.g., LangGraph, CrewAI, AutoGen, OpenAI Assistants, Anthropic Claude tools).

Modern enterprise AI deployments suffer from a critical architectural defect: autonomous LLM agents are frequently granted direct network sockets, database connections, and filesystem access without mediation. Prompt injection attacks, tool manipulation, unsafe multi-agent delegations, and model hallucinations can force an agent into executing destructive commands or exfiltrating confidential data.

AgentTrust solves this by positioning itself as the **mandatory enforcement perimeter** between autonomous AI models and the host execution environment.

```
+---------------------------------------------------------------------------------------------------+
|                                  AGENTTRUST ENTERPRISE ECOSYSTEM                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ AI Agent Applications ]           [ Enterprise Web Portals ]          [ Managed Workstations ] |
|  - LangGraph / CrewAI                - ChatGPT / Claude / Gemini         - Windows 11 / Server    |
|  - Custom Python/Node SDKs           - Perplexity / DeepSeek             - Developer Endpoints    |
|               |                                  |                                  |             |
|               v                                  v                                  v             |
|      (mTLS / Bearer Key)                 (Manifest V3 DLP)                  (Sentry Daemon)       |
|               |                                  |                                  |             |
|               +------------------+---------------+----------------------------------+             |
|                                  |                                                                |
|                                  v                                                                |
|               +--------------------------------------+                                            |
|               |     AGENTTRUST SECURE GATEWAY        |                                            |
|               |     /api/v1/gateway/execute          |                                            |
|               +--------------------------------------+                                            |
|                                  |                                                                |
|         +------------------------+------------------------+                                       |
|         |                        |                        |                                       |
|         v                        v                        v                                       |
|  [ Guardrails Engine ]    [ Policy & RBAC ]      [ Scoped Delegation ]                            |
|  - Unicode Normalization  - Explicit DENY Rules  - Maximum Depth Limits                           |
|  - 5-Layer Prompt Guard   - Prefix Whitelist     - Transitive Revocation                          |
|  - Dialog State Machine   - SQL AST Restrictions - Effective Grant Bounds                         |
|  - Server-Side Output DLP - HTTPS Enforced       - Expiration Timestamps                          |
|         |                        |                        |                                       |
|         +------------------------+------------------------+                                       |
|                                  |                                                                |
|                                  v                                                                |
|               +--------------------------------------+                                            |
|               |       SERVER-OWNED TOOL SINK         |                                            |
|               |  - Sandboxed Filesystem Tool         |                                            |
|               |  - Controlled Relational DB Tool     |                                            |
|               |  - SSRF-Protected Outbound HTTP Tool |                                            |
|               |  - Model Context Protocol (MCP) Tool |                                            |
|               +--------------------------------------+                                            |
|                                  |                                                                |
|         +------------------------+------------------------+                                       |
|         |                                                 |                                       |
|         v                                                 v                                       |
|  [ Cryptographic Audit Log ]                 [ Dynamic Provenance DAG ]                           |
|  - HMAC-SHA256 Chained Hash                  - Node & Edge Lineage                                |
|  - Tamper Verification Endpoint              - Real-Time Taint Propagation                        |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Product Layers

AgentTrust consists of three tightly coupled product layers:

### Layer A: AgentTrust Core (Control Plane & Gateway)
The central Python/FastAPI control plane providing deterministic authorization, runtime inspection, cryptographic auditing, and administration APIs.
- Operates statelessly behind NGINX or cloud application load balancers.
- Connects to PostgreSQL for relational entity storage and SQLite for embedded environments.
- Implements strict deny-by-default execution semantics.

### Layer B: AgentTrust Browser Shield
A Manifest V3 browser extension designed to protect enterprise users and browser-based AI agents interacting with web-hosted LLMs.
- Enforces pre-flight Data Loss Prevention (DLP) and prompt injection inspection before payloads reach browser network layers.
- Utilizes dual interception: synchronous pre-submit blocking via DOM keydown/click handlers and asynchronous verification via background service worker.
- Never logs sensitive credentials; displays real-time security pill status in the DOM.

### Layer C: AgentTrust Endpoint Connector
A native Windows (and Linux-ready) sentry daemon that continuously validates agent execution at the OS level.
- Cryptographically enrolls managed endpoints using an enterprise enrollment secret.
- Submits authorized process execution telemetry and flags anomalous subprocess spawning.
- Enforces containment actions (device network isolation via `netsh advfirewall` and process suspension) strictly upon human SOC authorization.

---

## 3. Core Modules & Subsystems

| Module # | Subsystem Name | Primary Function & Responsibility | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **01** | **Organization & Multi-Tenancy** | Partitioning of agent configurations, policies, and telemetry by enterprise tenant. | `tenant_id` foreign key isolation on all core database tables. |
| **02** | **User Authentication** | Identity management for human administrators, operators, and analysts. | JWT (HS256) bearer tokens with bcrypt-hashed credentials (`/api/v1/auth/login`). |
| **03** | **Role-Based Access Control (RBAC)** | Granular authorization separating ADMIN, OPERATOR, and AUDITOR privileges. | FastAPI dependencies (`require_roles`, `get_current_admin_user`) on all router endpoints. |
| **04** | **Agent Identity Management** | Unique cryptographic identity registration for autonomous agents. | High-entropy raw API keys (`agk_live_...`) with SHA-256 database hashing. |
| **05** | **Agent Enrollment** | Secure registration, rotation, and revocation of agent credentials. | Dynamic status management (`ACTIVE`, `SUSPENDED`, `REVOKED`) evaluated at each call. |
| **06** | **Secure Execution Gateway** | Central request interception, validation, and execution dispatcher. | `/api/v1/gateway/execute` lifecycle pipeline. |
| **07** | **Tool Registry** | Central catalog of authorized tools, permitted operations, and parameter schemas. | `ToolRegistry` singleton verifying tool registration prior to execution. |
| **08** | **Tool Execution Control** | Server-side execution of handlers without granting direct OS privileges to agents. | Strict parameter sanitization and timeout enforcement (max 15.0s). |
| **09** | **Policy Engine** | Central deterministic rule evaluator unifying permissions and enterprise policies. | `policy_engine.evaluate()` with explicit DENY precedence and prefix enforcement. |
| **10** | **Delegation Management** | Scoped authorization delegation between parent and child agents. | Multi-hop depth restrictions, tool restriction clamping, and cascading revocation. |
| **11** | **Data Provenance Engine** | Directed Acyclic Graph (DAG) tracking lineage of data flows and prompt artifacts. | `ProvenanceNode` and `ProvenanceEdge` tables with dynamic taint propagation. |
| **12** | **Data Loss Prevention (DLP)** | Regex and Luhn-validated detection of PII, PCI, and cryptographic secrets. | Server-side `output_rails.py` running in fail-closed `block` mode by default. |
| **13** | **MCP Security Bridge** | Model Context Protocol v1.0 interface with schema validation and access control. | Standard JSON-RPC 2.0 schema translation with strict parameter whitelisting. |
| **14** | **Incident Management** | State machine for tracking and remediating agent security breaches. | Status progression: `OPEN` -> `ACKNOWLEDGED` -> `INVESTIGATING` -> `CONTAINED` -> `RESOLVED`. |
| **15** | **Cryptographic Audit Logging** | Immutable, verifiable ledger of all gateway interactions and decisions. | HMAC-SHA256 hash chaining where each event links cryptographically to its predecessor. |
| **16** | **Security Analytics** | Real-time calculation of risk indices, violation densities, and attack patterns. | Aggregation queries across audit records and security incident ledgers. |
| **17** | **Threat Intelligence** | Enrichment of IP addresses, hostnames, and domain IOCs. | MaxMind GeoIP / RFC-1918 private address classification and sinkhole tracking. |
| **18** | **Device Management** | Inventory, enrollment, and health monitoring of managed endpoints. | Heartbeat monitoring (`/api/v1/endpoints/heartbeat`) and token authentication (`X-Device-Token`). |
| **19** | **Browser Extension Management** | Policy distribution and telemetry aggregation for enrolled browser shields. | Token-authenticated pre-flight checking (`/api/v1/browser-shield/check-action`). |
| **20** | **System Health & Monitoring** | Live health checks and subsystem status reporting for load balancers and orchestrators. | `/api/v1/health` verifying database connectivity and filesystem accessibility. |

---

## 4. Architectural Decision Records (ADRs)

### ADR-001: Deterministic Server-Side Authorization vs LLM Judge Authority
- **Status:** ACCEPTED & ENFORCED.
- **Context:** Prior AI security frameworks frequently utilize an LLM (e.g., GPT-4) as an evaluator or "judge" to decide whether an agent tool call is safe.
- **Decision:** AgentTrust strictly rejects using an LLM as the final authority for sensitive authorization decisions. All access decisions are evaluated deterministically using mathematical path matching, regular expressions, SQL AST parsing, and relational database constraints.
- **Rationale:** LLMs are non-deterministic, vulnerable to prompt injection, introduce 500ms–2000ms latency, and can be coerced through adversarial semantic framing.

### ADR-002: Dual-Model Policy & Permission Convergence (SEC-04 Remediation)
- **Status:** ACCEPTED & ENFORCED.
- **Context:** Previously, permissions (`Permission` model) and UI security policies (`Policy` model) were disconnected; policies edited in the UI had no effect on the gateway.
- **Decision:** The gateway evaluator (`policy_engine.evaluate()`) evaluates both individual permission grants and active enterprise policies in a single pipeline. If any enterprise policy rule is violated (e.g., path outside allowed prefix, forbidden SQL keyword, insecure HTTP domain), the execution is blocked regardless of permission grants.
- **Rationale:** Guarantees that global security guardrails cannot be overridden by broad agent permission grants.

### ADR-003: Output Rails Server-Side Fail-Closed Enforcement (SEC-02 Remediation)
- **Status:** ACCEPTED & ENFORCED.
- **Context:** An agent could previously bypass output redaction by sending `context: {"output_rails_mode": "raw"}`.
- **Decision:** The output rail execution mode is derived exclusively from server-side platform configuration (`settings.DEFAULT_OUTPUT_RAILS_MODE`), defaulting to `"block"`. Any leak of private keys, AWS tokens, or payment card numbers results in immediate execution termination and an auditable security alert.
- **Rationale:** Client request context is untrusted input and must never dictate security boundary behavior.

### ADR-004: HMAC-SHA256 Cryptographic Audit Log Chaining (SEC-24 Remediation)
- **Status:** ACCEPTED & ENFORCED.
- **Context:** In early prototypes, audit logs were mutable SQLite rows susceptible to administrative modification or database tampering.
- **Decision:** Every audit event includes an HMAC-SHA256 signature calculated from its payload concatenated with the signature of the immediately preceding event (`audit_hash = HMAC(prev_hash + event_data)`).
- **Rationale:** Provides tamper-evident auditability. Any modification or deletion of past records invalidates all subsequent hash signatures in the chain.

### ADR-005: Multi-Tenant Schema Partitioning via `tenant_id` (SEC-13 Remediation)
- **Status:** ACCEPTED & ENFORCED.
- **Context:** Enterprise deployments require strict isolation between distinct corporate organizations.
- **Decision:** All core models (`User`, `Agent`, `Permission`, `Policy`, `AuditEvent`, `SecurityIncident`, `ManagedEndpoint`) include a `tenant_id` field. Alembic migrations establish foreign key relationships to an `organizations` table.
- **Rationale:** Eliminates cross-tenant data leakage risks and satisfies enterprise compliance (SOC 2, ISO 27001).

---

## 5. Component Interconnect & Communication Contracts

```
[Agent Client] 
     |
     | HTTPS POST /api/v1/gateway/execute
     | Headers: Authorization: Bearer agk_live_...
     v
[FastAPI Gateway Engine]
     |
     +---> 1. Authenticate Agent (SHA-256 API Key Match)
     +---> 2. Active Defense Check (IP Sinkhole / Honeypot Tarpit)
     +---> 3. Guardrail Pre-Flight:
     |        - InputRails: Unicode normalization, leetspeak, regex, ML TF-IDF
     |        - DialogRails: Multi-step tool sequence tracking by agent.id
     +---> 4. Delegation Validation (Depth, Scope, Expiration)
     +---> 5. Policy Engine Deterministic Evaluation (Explicit DENY -> Grants -> Global Policies)
     +---> 6. Server-Side Tool Execution (Filesystem / DB / HTTP / MCP)
     +---> 7. Guardrail Post-Flight:
     |        - OutputRails: Fail-closed PII/Secret redaction & blocking
     +---> 8. Provenance Engine: Emit DAG Node & Propagate Taint
     +---> 9. Cryptographic Audit Service: Append HMAC-SHA256 Event
     v
[Caller Response (GatewayExecuteResponse)]
```
