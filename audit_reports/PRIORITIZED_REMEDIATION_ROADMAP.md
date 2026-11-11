# AgentTrust: Prioritized Engineering Remediation Roadmap
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
**Target Milestone:** Production-Ready Enterprise AI Security Platform (v1.0.0)

---

## 1. Remediation Strategy Overview

This roadmap defines an actionable, evidence-based engineering plan to remediate the vulnerabilities, architectural flaws, and feature gaps discovered during the audit. The plan is structured into four sequential phases:

```
[Phase 1: Emergency Security Hotfixes]  ---> [Phase 2: Architectural Stabilization]
           (Weeks 1 - 2)                                 (Weeks 3 - 6)
                 |                                             |
                 v                                             v
[Phase 3: Real AI Security Modernization] -> [Phase 4: Enterprise Hardening & Launch]
           (Weeks 7 - 12)                                (Weeks 13 - 18)
```

---

## 2. Phase 1: Emergency Security Hotfixes (Weeks 1 – 2)

**Objective:** Neutralize critical vulnerabilities that expose the host to remote denial-of-service, stored XSS, and unauthenticated control plane takeover.

### Tasks & Implementation Specs:

#### 1.1 Secure or Remove the Process Killer (SEC-01)
- **Action:** Remove `POST /api/v1/active-defense/kill-process` from the public API, or restrict it strictly to verified child worker processes tracked in an internal agent PID table.
- **Enforcement:** Add `Depends(get_current_user)` requiring `role == UserRole.ADMIN`. Verify `req.pid != os.getpid()` and that `req.pid` is registered in an active agent execution context.
- **Acceptance Criteria:** Unauthenticated requests receive `401 Unauthorized`. Requests targeting arbitrary host PIDs receive `403 Forbidden`.
- **Effort:** 1–2 days.

#### 1.2 Enforce Mandatory Authentication on All Control Plane APIs (SEC-02, SEC-09)
- **Action:** Apply `current_user: User = Depends(get_current_user)` across all management routers (`agents.py`, `permissions.py`, `policies.py`, `delegations.py`, `attribution.py`).
- **Enforcement:** In `POST /api/v1/delegations`, require the caller to authenticate either as the parent agent (via `X-Agent-Key`) or as an active administrator.
- **Acceptance Criteria:** No agent, permission, policy, or delegation can be created, modified, or revoked without a valid Bearer token.
- **Effort:** 3 days.

#### 1.3 Fix Stored XSS in HTML Incident Reports (SEC-04)
- **Action:** Replace manual Python f-string HTML assembly in `report_generator.py` with Jinja2 templates configured with `autoescape=True`. Alternatively, apply `html.escape()` to all dynamic incident fields (`title`, `agent_name`, `client_ip`, `timeline` details).
- **Acceptance Criteria:** Submitting `<script>` or `<img>` event handler payloads renders as escaped text (`&lt;script&gt;`) without executing JavaScript.
- **Effort:** 1 day.

#### 1.4 Validate `ENROLLMENT_SECRET` on Production Startup (SEC-07)
- **Action:** In `backend/app/core/config.py`, update `validate_production_security()` to check `self.ENROLLMENT_SECRET`. Reject default or placeholder secrets if `ENVIRONMENT == "production"`.
- **Acceptance Criteria:** Backend fails to start in production mode if `ENROLLMENT_SECRET` is the known default.
- **Effort:** 0.5 days.

#### 1.5 Fix Docker Compose Frontend Serving (SEC-11)
- **Action:** Update `Dockerfile.backend` to use a multi-stage build that compiles `frontend/` with Node.js and copies `dist/` into `/app/frontend/dist`, or add a dedicated `frontend` service using `Dockerfile.frontend` and Nginx in `docker-compose.yml`.
- **Acceptance Criteria:** Navigating to `http://localhost:8080/` after `docker-compose up -d --build` loads the React dashboard.
- **Effort:** 2 days.

---

## 3. Phase 2: Architectural Stabilization & Core Data Unification (Weeks 3 – 6)

**Objective:** Repair the broken database migration pipeline, eliminate the Policy-Permission disconnect, and build a unified authentication layer.

### Tasks & Implementation Specs:

#### 2.1 Re-Initialize Alembic Migrations and Fix Database Desynchronization (SEC-05)
- **Action:**
  1. Remove `backend/agenttrust.db` from version control (add to `.gitignore`).
  2. Clear out corrupt Alembic revision tracking (`baa8a3fbd940`).
  3. Generate a clean initial migration script reflecting the exact SQLAlchemy ORM models (including `parent_delegation_id`).
  4. Ensure `demo_full_platform.py` runs end-to-end without database schema exceptions.
- **Acceptance Criteria:** `alembic upgrade head` executes cleanly on a fresh SQLite or PostgreSQL database. All demo scripts pass with zero errors.
- **Effort:** 3 days.

#### 2.2 Unify Policy and Permission Engines (SEC-03)
- **Action:**
  - Bridge `Policy.rules` with `PolicyEngine.evaluate()`.
  - When an administrator saves a policy via `PUT /api/v1/policies/{id}` or `PoliciesTab.tsx`, either compile the JSON rules into active `Permission` records or rewrite `PolicyEngine` to directly evaluate the active `Policy` rules and version history.
- **Acceptance Criteria:** Modifying a rule in `PoliciesTab.tsx` immediately changes the decision rendered by `POST /api/v1/gateway/execute` and `POST /api/v1/policies/test`.
- **Effort:** 1.5 weeks.

#### 2.3 Implement Frontend Authentication & Session Management (SEC-12)
- **Action:**
  - Create a dedicated Login view in the frontend.
  - Implement an `AuthContext` managing JWT access tokens.
  - Automatically attach `Authorization: Bearer <token>` to all requests originating from `src/services/api.client.ts`.
  - Consolidate and delete duplicate `src/api/client.ts`.
- **Acceptance Criteria:** Visiting the dashboard unauthenticated redirects to `/login`. Upon successful authentication, user role and permissions are stored in memory.
- **Effort:** 4 days.

#### 2.4 Expand DLP Inspection to Filesystem and Database Sinks (SEC-18)
- **Action:** Remove `if has_leak and tool_name in ["http_api_tool"]:` from `gateway_service.py`. Enforce DLP inspection across `filesystem_tool:write_file` and `postgres_tool:query_insert`.
- **Acceptance Criteria:** Writing an AWS key or private key to a local report file is blocked by the gateway with a DLP incident recorded.
- **Effort:** 2 days.

#### 2.5 Fix Untrusted Proxy IP Spoofing (SEC-08)
- **Action:** Update `gateway.py` to only inspect `X-Forwarded-For` if `request.client.host` matches a configured list of trusted reverse proxy CIDRs (`TRUSTED_PROXIES`).
- **Acceptance Criteria:** Direct clients sending spoofed `X-Forwarded-For` headers have their real socket IP recorded in audit events.
- **Effort:** 1 day.

---

## 4. Phase 3: Real AI Security Modernization (Weeks 7 – 12)

**Objective:** Replace regex masquerading with real machine learning models, implement true Model Context Protocol (MCP) mediation, and build dynamic taint tracking.

### Tasks & Implementation Specs:

#### 3.1 Integrate True Machine Learning Prompt Injection Classifiers (SEC-15)
- **Action:**
  - Introduce an optional lightweight local embedding/classifier pipeline (e.g. Meta's **Prompt-Guard** via ONNX Runtime or `transformers`).
  - Add fallback connectors for enterprise cloud moderation APIs (Azure AI Content Safety, Lakera Guard API).
  - Measure inference latency, keeping local CPU evaluation under 20ms.
- **Acceptance Criteria:** Adversarial paraphrased injection prompts and multi-language jailbreaks are detected and blocked with precision/recall exceeding 92% on standard benchmarks.
- **Effort:** 2 weeks.

#### 3.2 Build Real Model Context Protocol (MCP) Client/Server Bridge (SEC-16)
- **Action:**
  - Replace `backend/app/tools/mcp_tool.py` stub with real integration using the official `mcp` Python SDK.
  - Implement JSON-RPC tool discovery and execution over standard I/O (`stdio`) and Server-Sent Events (`sse`).
  - Mediate all tool calls through `GatewayService.execute_tool_request()` before forwarding them to the external MCP server.
- **Acceptance Criteria:** A real external MCP server (e.g. SQLite MCP or GitHub MCP) is enrolled, discovered, and mediated by AgentTrust, blocking unauthorized calls.
- **Effort:** 2 weeks.

#### 3.3 Implement Dynamic Runtime Taint Propagation (Provenance)
- **Action:**
  - When untrusted content (web scraping, third-party emails, external documents) enters the agent context, generate an ephemeral session taint record (`trust_level: UNTRUSTED`).
  - Propagate this taint state to any subsequent tool execution requests sharing the same `session_id` or `correlation_id`.
  - Block unmediated outbound transfers (e.g. `http_post`) when execution state is tainted.
- **Acceptance Criteria:** Ingesting an untrusted document dynamically blocks downstream outbound data egress without needing static dummy nodes.
- **Effort:** 2 weeks.

#### 3.4 Replace Scripted Runner with Real Multi-Agent Adapter
- **Action:**
  - Replace the hardcoded 3-step script in `agent_exec.py` with an actual LangGraph / CrewAI workflow calling an LLM (local Ollama or OpenAI API).
  - Configure the agent's tool bindings to route all function invocations through the AgentTrust HTTP gateway.
- **Acceptance Criteria:** Real non-deterministic LLM tool calls are intercepted, evaluated, and displayed live in the dashboard.
- **Effort:** 1.5 weeks.

---

## 5. Phase 4: Enterprise Hardening & Launch Readiness (Weeks 13 – 18)

**Objective:** Deliver true multi-tenancy, eliminate cosmetic gimmicks, and complete enterprise operational requirements.

### Tasks & Implementation Specs:

#### 5.1 Implement Multi-Tenancy Architecture (SEC-10)
- **Action:**
  - Add `tenant_id: Mapped[str] = mapped_column(String(36), index=True)` across all database models (`agents`, `tools`, `permissions`, `policies`, `audit_events`, `incidents`, `endpoints`).
  - Implement tenancy resolution middleware extracting `tenant_id` from verified JWT claims or API key metadata.
  - Add SQLAlchemy query interceptors enforcing `where(Model.tenant_id == current_tenant_id)`.
- **Acceptance Criteria:** Tenant A cannot view, modify, or execute tools belonging to Tenant B under any circumstance.
- **Effort:** 3 weeks.

#### 5.2 Decommission Cosmetic & Unsafe Features
- **Action:**
  - Delete `POST /active-defense/kill-process` and the OS firewall manipulator.
  - Remove the fake Threat Map and IP-octet math attribution engine (`attribution_service.py:228-262`).
  - Replace the Threat Map UI tab with an **Enterprise Audit & SIEM Streaming Dashboard**.
- **Acceptance Criteria:** Zero fabricated data generated by the platform.
- **Effort:** 1 week.

#### 5.3 Cryptographic Audit Log Integrity (SEC-24)
- **Action:**
  - Implement RFC 6962 Merkle tree hash chaining on `audit_events`: each new audit event stores `previous_event_hash` and `event_signature` computed using an HMAC or private signing key.
  - Provide an audit verification API (`GET /api/v1/audit/verify`) that proves the chain has not been tampered with.
- **Acceptance Criteria:** Modifying an audit row directly in the database invalidates the cryptographic verification check.
- **Effort:** 1.5 weeks.

#### 5.4 CI/CD Pipeline & Supply Chain Hardening (SEC-25)
- **Action:**
  - Create `.github/workflows/ci.yml` running pytest, TypeScript compilation, ESLint, and Bandit on every PR.
  - Generate pinned `requirements.lock` with SHA-256 hashes.
  - Add Trivy container scanning and CycloneDX SBOM generation to release workflows.
- **Acceptance Criteria:** Fully automated, passing CI gates on all pull requests.
- **Effort:** 1 week.

---

## 6. Engineering Resource Allocation & Milestones

| Milestone | Target Date | Primary Deliverables | Resource Allocation |
| :--- | :--- | :--- | :--- |
| **Milestone 1: Security Baseline** | Month 1 | SEC-01 to SEC-09 fixed; Docker Compose working; Alembic reset. | 2 Backend Engineers |
| **Milestone 2: Unified Platform** | Month 2 | Unified Policy engine; Frontend auth; DLP expanded. | 1 Full-Stack + 1 Backend |
| **Milestone 3: Real AI Gateway** | Month 3 | Real MCP bridge; Prompt-Guard ML classifier; LangGraph integration. | 1 AI/ML Engineer + 1 Backend |
| **Milestone 4: Multi-Tenant Enterprise**| Month 4 | Multi-tenancy; Cryptographic audit chain; CI/CD pipeline. | 2 Senior Backend / Cloud |
| **Milestone 5: Pilot Launch (v1.0.0)** | Month 5–6 | Security re-audit; customer pilot deployment; documentation refresh.| Full Team |
