# AgentTrust: Prioritized Remediation Roadmap
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform` (Commit `06bf0fc`)  
**Target:** Industrial Enterprise AI Security Platform  

---

## 1. Remediation Strategy: Radical Focus Over Superficial Breadth

To become a viable, production-grade security solution, AgentTrust must abandon its attempts to be an EDR clone, OS firewall manager, and threat intelligence vendor. The engineering team must concentrate 100% of its resources on building a rock-solid, multi-tenant **Deterministic Tool Gateway for Autonomous AI Agents**.

```
+-----------------------------------------------------------------------------------+
|                           RECOMMENDED ARCHITECTURAL TARGET                        |
|                                                                                   |
|   [Autonomous AI Agents] ----> [ Authenticated In-Process / Sidecar Gateway ]    |
|   (LangGraph, CrewAI, AutoGen)  |                                                 |
|                                 +---> Identity & RBAC Validation (JWT / mTLS)    |
|                                 +---> True ML Guardrails (Prompt-Guard / Lakera)  |
|                                 +---> Deterministic Policy Engine (OPA / Rego)    |
|                                 +---> Fail-Closed DLP & Parameter Whitelisting    |
|                                 +---> Downstream Sandboxed Tools & Real MCP      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Four-Phase Engineering Roadmap

### Phase 1: Security Triage & Zero-Trust Control Plane Hardening (Weeks 1–4)
- **Goal:** Eliminate immediate critical vulnerabilities, enforce authentication across all endpoints, and fix broken database state.
- **Key Milestones:**
  1. **SEC-01 & SEC-02 Remediation**: Remove the unauthenticated host process killer (`/active-defense/kill-process`). Apply `Depends(get_current_user)` with role enforcement across all administrative endpoints.
  2. **Output Rails Hardening (SEC-02)**: Disallow caller-supplied `output_rails_mode`. Enforce server-side `mode = "block"` by default.
  3. **Dialog Rails State Machine Hardening (SEC-08)**: Key execution state by authenticated `agent.id` and signed session tokens rather than arbitrary client strings.
  4. **Database Reset & Unification (SEC-06 & SEC-07)**: Remove duplicate root `agenttrust.db`. Fix Alembic migration chain for `parent_delegation_id`. Anchor `DATABASE_URL` to an absolute path.
  5. **Stored XSS Elimination (SEC-05)**: Implement Jinja2 autoescaping or explicit `html.escape()` across all HTML report templates.

### Phase 2: Gateway & Policy Engine Unification (Weeks 5–8)
- **Goal:** Ensure all dashboard policy configurations actually govern gateway enforcement decisions.
- **Key Milestones:**
  1. **Policy-Permission Convergence (SEC-04)**: Unify `Policy.rules` with `policy_engine.evaluate()`. Enforce filesystem prefixes, database row caps, and HTTP policies at the gateway layer.
  2. **Multi-Tenancy Foundation (SEC-13)**: Add `tenant_id` to all database models and enforce row-level tenant filtering in queries.
  3. **Database Concurrency & PostgreSQL Transition**: Deprecate SQLite in favor of PostgreSQL for production concurrency; remove lock starvation risks.
  4. **Frontend Single Client & Auth Flow (SEC-14 & SEC-15)**: Consolidate `src/api/client.ts` and `src/services/api.client.ts`. Build a proper user login view and JWT auth context.

### Phase 3: Real AI Security & Protocol Integration (Weeks 9–13)
- **Goal:** Replace cosmetic mock features with genuine AI security defenses and protocol implementations.
- **Key Milestones:**
  1. **Genuine ML Prompt Injection Detection (SEC-18)**: Integrate a trained small language model / classifier (e.g. Meta Prompt-Guard-86M or ONNX runtime) alongside regexes.
  2. **Real Model Context Protocol (MCP) Bridge (SEC-19)**: Replace the stub with a real JSON-RPC 2.0 MCP client implementing standard STDIO and SSE transports.
  3. **Pipelock / OPA Sidecar Integration (SEC-20)**: Fully route outgoing traffic through Pipelock when enabled; unify OPA evaluation under `opa_service.py`.
  4. **Dynamic Taint Tracking for Provenance**: Instrument tool outputs to dynamically propagate taint across agent workflows.

### Phase 4: Enterprise Production Packaging & Compliance (Weeks 14–18)
- **Goal:** Deliver multi-container production deployments, observability, and compliance auditing.
- **Key Milestones:**
  1. **Docker Compose & Multi-Stage Builds (SEC-11)**: Build the React frontend into an NGINX reverse-proxy container alongside backend and postgres services.
  2. **Cryptographic Audit Log Signing (SEC-24)**: Implement Merkle tree or HMAC hash chains for immutable audit logs.
  3. **Browser Shield Hardening (SEC-24)**: Intercept submission events synchronously via Web Request API (`declarativeNetRequest` / service worker) rather than debounced DOM input events.
  4. **CI/CD Security Pipelines (SEC-25)**: Add GitHub Actions workflows running `bandit`, `semgrep`, `npm audit`, and `pip-audit`.
