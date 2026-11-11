# AgentTrust Trust Boundaries & Security Perimeter Specification
**Document Version:** 2.0.0  
**Classification:** Enterprise Security Architecture  

---

## 1. System Trust Boundary Map

AgentTrust establishes five explicit, non-bypassable trust boundaries across the autonomous agent lifecycle. Every cross-boundary interaction requires cryptographic authentication, schema validation, and deterministic authorization.

```
+===================================================================================================+
|                                    UNTRUSTED EXTERNAL DOMAIN                                      |
|  - Autonomous AI Agents (LangGraph, CrewAI, AutoGen)                                              |
|  - Untrusted Public Web & API Sinks                                                               |
|  - User Browser DOM & External LLM Portals (ChatGPT, Claude, Gemini)                              |
+===================================================================================================+
                                         |
                                         | [BOUNDARY 1: AGENT-TO-GATEWAY INGRESS]
                                         | Cryptographic API Key Verification & Scoped Delegation
                                         v
+---------------------------------------------------------------------------------------------------+
|                              AGENTTRUST DETERMINISTIC GATEWAY PERIMETER                           |
|  - Layer 1-5 Guardrails (Prompt Guard, Leetspeak, Unicode Normalization, Base64 Decode)           |
|  - Dialog Rails Sequence State Machine                                                            |
|  - Deterministic Policy Engine (Explicit DENY Precedence + Active Grants + Enterprise Rules)      |
+---------------------------------------------------------------------------------------------------+
             |                                                       |
             | [BOUNDARY 4: TOOL SINK BOUNDARY]                      | [BOUNDARY 5: TENANT ISOLATION]
             | Path Traversal / SSRF / AST Parameterization          | tenant_id Query Scoping
             v                                                       v
+------------------------------------------+    +---------------------------------------------------+
|        SANDBOXED EXECUTION SINKS         |    |            PERSISTENCE & AUDIT TIER               |
| - Filesystem Sandbox (5MB Limit)         |    | - PostgreSQL / SQLite Datastore                   |
| - HTTP Egress (SSRF, Private IP Block)   |    | - HMAC-SHA256 Chained Audit Trail                 |
| - Relational DB Tool (Parameterized AST) |    | - Dynamic Provenance DAG (Taint Tracking)         |
+------------------------------------------+    +---------------------------------------------------+
             ^                                                       ^
             | [BOUNDARY 3: ENDPOINT CONNECTOR OS BOUNDARY]          | [BOUNDARY 2: HUMAN ADMIN CONSOLE]
             | Mutual HMAC Token / Controlled Containment            | JWT Bearer / Strict RBAC
             |                                                       |
+------------------------------------------+    +---------------------------------------------------+
|         MANAGED WORKSTATION / OS         |    |            SOC MANAGEMENT CONSOLE                 |
| - Native Sentry Daemon (Unprivileged)    |    | - Enterprise React Dashboard                      |
| - Windows Firewall (netsh) Containment   |    | - Role-Based Administration (ADMIN / OPERATOR)    |
| - Process Telemetry Collector            |    | - Incident Response & Forensic Dossiers           |
+===================================================================================================+
```

---

## 2. Detailed Boundary Specifications

### Boundary 1: Untrusted Agent Execution vs Control Plane
- **Separation:** Agents run in external runtimes (Python, Node.js, LangChain, CrewAI) and communicate with AgentTrust solely via HTTPS REST calls.
- **Trust Assumption:** **Zero Trust.** All agent payloads, context dictionaries, tool parameters, and prompt strings are treated as potentially malicious or compromised.
- **Enforcement Mechanism:**
  - Mandatory API key authentication (`Authorization: Bearer agk_live_...` or `X-Agent-Key`).
  - Strict validation that identity claims in request bodies are ignored in favor of the cryptographic credential subject.
  - Fail-closed deny-by-default execution: an agent without an explicit, active `ALLOW` grant cannot execute any operation.
  - Active defense IP sinkholing and tarpit traps to intercept automated scanners.

### Boundary 2: Human Administrative Console vs Control Plane
- **Separation:** Enterprise web frontend communicating with FastAPI backend API endpoints.
- **Trust Assumption:** Human operators may have different levels of trust and privilege; browser sessions are susceptible to CSRF, XSS, and token theft if unmanaged.
- **Enforcement Mechanism:**
  - JWT tokens signed with HS256 (32+ byte server-side `SECRET_KEY`).
  - Role-Based Access Control enforced at the route level using `require_roles([UserRole.ADMIN])`.
  - Non-administrative users cannot create agents, grant wildcard permissions, terminate processes, modify policies, or initiate network containment.
  - HTML escaping (`html.escape()`) across all forensic report exports to eliminate Stored XSS risks.

### Boundary 3: Host OS / Managed Endpoint vs Gateway
- **Separation:** Sentry daemon executing on Windows/Linux client devices reporting telemetry to the central gateway.
- **Trust Assumption:** Endpoint device tokens (`epk_live_...`) authenticate the machine, but endpoint commands must never permit arbitrary remote code execution or unilateral process destruction.
- **Enforcement Mechanism:**
  - Enrollment requires an enterprise enrollment secret (`ENROLLMENT_SECRET`) verified against server settings.
  - Device authentication via `X-Device-Token`.
  - **No Unilateral Remote Execution:** Containment actions (process killing, network isolation) require explicit human SOC authorization recorded in the audit trail.
  - Process termination is restricted to known, monitored agent PIDs; system critical PIDs (PID <= 4, OS kernel, AgentTrust runtime PIDs) are strictly protected.

### Boundary 4: Server-Side Tool Sinks vs External Resources
- **Separation:** Gateway executing native tool handlers against host filesystems, internal networks, external APIs, and database instances.
- **Trust Assumption:** Unsanitized parameters could cause arbitrary file writes, SSRF attacks against cloud metadata services (e.g., AWS IMDSv2 at `169.254.169.254`), or SQL injection.
- **Enforcement Mechanism:**
  - **Filesystem Tool:** Strict boundary resolution (`target_path.relative_to(sandbox_root)`); null-byte injection rejection; 5MB payload size caps; enterprise extension blacklists.
  - **HTTP API Tool:** Comprehensive SSRF validation checking RFC-1918 private IPv4/IPv6 networks, link-local metadata addresses, loopbacks, and DNS rebinding resolution before issuing requests; request timeout caps (max 15s).
  - **Database Tool:** Parameterized SQL queries; abstract syntax tree (AST) inspection forbidding DDL (`DROP`, `ALTER`, `TRUNCATE`) and administrative statements (`GRANT`, `REVOKE`, `ATTACH`).
  - **Output Rails:** Server-side DLP scan running in `block` mode, inspecting outbound data for credentials, AWS access keys, private keys, and Luhn-valid credit card numbers.

### Boundary 5: Multi-Tenant Data Isolation
- **Separation:** Multiple organizational units or enterprise customers co-existing on the same AgentTrust deployment.
- **Trust Assumption:** Organization A must never view, execute against, or modify agents, policies, audit events, or incidents belonging to Organization B.
- **Enforcement Mechanism:**
  - Every primary database entity contains a `tenant_id` foreign key.
  - Database queries and service methods filter by `tenant_id` derived from the verified user session or agent credential.
  - Cross-tenant queries are blocked at the ORM layer.

---

## 3. The Advisory vs Deterministic Boundary

A foundational architectural principle of AgentTrust is the strict separation between **Deterministic Security Enforcement** and **AI-Assisted Security Advisory**:

| Characteristic | Deterministic Enforcement Layer | AI-Assisted Advisory Layer |
| :--- | :--- | :--- |
| **Modules** | Gateway, Policy Engine, Guardrails, Tool Sinks | Incident Summarizer, Threat Explainer, Forensic Assistant |
| **Technology** | Boolean Logic, Regex, AST, Luhn, HMAC, Path Check | LLMs, Vector Embeddings, Cosine Similarity |
| **Authority** | **Absolute (Final Decision Maker)** | **Advisory Only (Never Authorizes Actions)** |
| **Failure Mode** | Fail-Closed (DENY) | Recommendations labeled as unverified analysis |
| **Audit Status** | Emits immutable cryptographic audit records | Output appended as contextual analyst notes |

Under no circumstances is an LLM output permitted to override a deterministic security policy or authorize a tool execution.
