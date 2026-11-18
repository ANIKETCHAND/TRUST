# AGENTTRUST — TECHNICAL AUDIT
## PRIORITIZED REMEDIATION ROADMAP

**Target Platform:** AgentTrust AI Security Platform  
**Audit Date:** November 12, 2026  
**Auditor:** DevSecOps & Security Engineering Advisory Board  

---

### 1. REMEDIATION TIMELINE & PHASING

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: IMMEDIATE CRITICAL SECURITY PATCHES             (48 Hours)   │
│ - Remediate unauthenticated incident tampering (SEC-01)                │
│ - Remediate unauthenticated audit log disclosure (SEC-02)              │
│ - Restrict permission creation to Administrator role (SEC-03)          │
│ - Lock down public user registration (SEC-05)                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: MULTI-TENANCY & ARCHITECTURAL HARDENING         (2 Weeks)     │
│ - Enforce tenant_id query scoping on all models (SEC-04)               │
│ - Deploy application-level rate limiting middleware (SEC-06)           │
│ - Inject standard OWASP defensive security headers (SEC-07)           │
│ - Formalize PostgreSQL production connection pooling                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: TRUE AI/ML RUNTIME & AGENTIC AUTONOMY           (4 Weeks)     │
│ - Implement autonomous LLM tool-calling loop in /agent-exec/run        │
│ - Integrate ONNX transformer classifier for prompt injection           │
│ - Replace first-octet heuristic geo with MaxMind GeoIP2                │
│ - Implement full Model Context Protocol (MCP) JSON-RPC client          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: ENTERPRISE DEPLOYMENT & OBSERVABILITY           (8 Weeks)     │
│ - Distributed Redis state for tarpit, sessions, and multi-worker sync  │
│ - Enterprise SSO integration (OIDC, SAML, Azure AD / Okta)             │
│ - Replace client HTTP polling with Server-Sent Events (SSE)            │
│ - Kubernetes Helm charts and production container hardening            │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. DETAILED ACTION ITEMS BY PHASE

#### PHASE 1: IMMEDIATE CRITICAL VULNERABILITY PATCHES (Days 1–2)

##### Task 1.1: Secure Incident Management Endpoints (SEC-01)
- **File:** `backend/app/api/v1/audit.py`
- **Action:** Add `current_user = Depends(get_current_operator_or_admin)` to `PATCH /incidents/{incident_id}`.
- **Verification:** Issue unauthenticated PATCH request; verify response is `HTTP 401 Unauthorized`.

##### Task 1.2: Restrict Audit Log Inspection & Bulk Export (SEC-02)
- **File:** `backend/app/api/v1/audit.py`
- **Action:** Add `current_user: User = Depends(get_current_user)` to `GET /audit`, `GET /audit/export`, `GET /audit/verify-chain`, and `GET /audit/incidents`.
- **Verification:** Verify that unauthenticated requests to `/audit` and `/audit/export` receive `HTTP 401 Unauthorized`.

##### Task 1.3: Enforce Administrator RBAC on Permission Creation (SEC-03)
- **File:** `backend/app/api/v1/permissions.py`
- **Action:** Change dependency on `create_permission` and `deactivate_permission` to `current_user = Depends(get_current_admin_user)`.
- **Verification:** Login as `OPERATOR` and attempt `POST /api/v1/permissions`; verify response is `HTTP 403 Forbidden`.

##### Task 1.4: Lock Down Public User Registration (SEC-05)
- **File:** `backend/app/api/v1/auth.py`
- **Action:** 
  1. If `settings.ENVIRONMENT == "production"`, completely disable public registration or require a cryptographic invitation token.
  2. If `settings.ENVIRONMENT != "production"`, prevent public registration of `UserRole.ADMIN` unless explicitly initiated via CLI seeding script.

---

#### PHASE 2: MULTI-TENANCY & ARCHITECTURAL HARDENING (Weeks 1–2)

##### Task 2.1: Implement Complete Multi-Tenant Scoping (SEC-04)
- **Files:** `backend/app/api/v1/agents.py`, `delegations.py`, `policies.py`, `audit.py`
- **Action:** In all database queries, filter records by the requesting user's tenant:
  ```python
  stmt = select(Agent).where(Agent.tenant_id == current_user.tenant_id)
  ```
- **Verification:** Seed Agent A under `tenant_alpha` and Agent B under `tenant_beta`. Authenticate as Tenant Alpha user; verify Agent B is completely invisible.

##### Task 2.2: Add Application-Level Rate Limiting (SEC-06)
- **Files:** `backend/app/main.py`, `backend/requirements.txt`
- **Action:** Install `slowapi`. Configure rate limits:
  - `POST /api/v1/auth/login`: 10 requests / minute
  - `POST /api/v1/auth/register`: 5 requests / hour
  - `POST /api/v1/gateway/execute`: 300 requests / minute per agent key
- **Verification:** Automated burst script receives `HTTP 429 Too Many Requests`.

##### Task 2.3: Inject OWASP Defensive Security Headers (SEC-07)
- **File:** `backend/app/main.py`
- **Action:** Add a custom middleware setting:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy: default-src 'self'`

##### Task 2.4: Eliminate Arbitrary SQL Strings in `postgres_tool` (SEC-08)
- **File:** `backend/app/tools/db_tool.py`
- **Action:** Whitelist allowed queries, enforce parameterized bindings, and reject raw multi-statement syntax.

---

#### PHASE 3: TRUE AI/ML RUNTIME & AGENTIC AUTONOMY (Weeks 3–4)

##### Task 3.1: Autonomous LLM Tool-Calling Loop
- **File:** `backend/app/api/v1/agent_exec.py`
- **Action:** Integrate a true autonomous LLM tool-calling loop (e.g. via LangChain or native OpenAI/Anthropic SDK):
  - Agent prompt is submitted to the LLM.
  - LLM dynamically chooses tools based on available tool definitions from `tool_registry`.
  - Every tool execution proposed by the LLM is intercepted and sent to `gateway_service.execute_tool_request`.
  - Tool execution returns are fed back into the LLM context.
  - Halts dynamically upon goal completion or gateway policy denial.

##### Task 3.2: Modern Transformer-Based Prompt Injection Classifier
- **Files:** `backend/app/services/prompt_injection_service.py`
- **Action:** Integrate an ONNX Runtime optimized transformer classifier (e.g. ProtectAI DeBERTa-v3 or Llama-Guard-3-1B quantized):
  - Provides sub-30ms local neural network evaluation of semantic jailbreaks.
  - Benchmark against HackAPrompt and AdvGLUE datasets to measure precision and recall.

##### Task 3.3: Production GeoIP Attribution Provider
- **File:** `backend/app/services/attribution_service.py`
- **Action:** Replace the first-octet heuristic bucket with an official MaxMind GeoLite2 or IP2Location database reader (`geoip2`), accurately mapping WAN IPs to verified country, city, ASN, and coordinates.

##### Task 3.4: Real Model Context Protocol (MCP) Bridge
- **File:** `backend/app/tools/mcp_tool.py`
- **Action:** Replace the routing envelope stub with a full MCP client implementation supporting JSON-RPC 2.0 tool discovery and execution over stdio and Server-Sent Events.

---

#### PHASE 4: ENTERPRISE INFRASTRUCTURE & OBSERVABILITY (Weeks 5–8)

##### Task 4.1: Centralized Redis State Store
- **File:** `backend/app/core/config.py`
- **Action:** Integrate Redis (`redis-py` async) for:
  - Centralized rate limiting across multiple backend workers
  - Distributed deception tarpit registry and perimeter sinkhole state
  - Distributed session histories for Dialog Rails across multi-worker clusters

##### Task 4.2: Real-Time Event Streaming (Server-Sent Events)
- **Files:** `backend/app/api/v1/overview.py`, `frontend/src/hooks/useMonitoring.ts`
- **Action:** Replace client-side HTTP polling with an SSE stream (`GET /api/v1/events/stream`), pushing live audit events, blocked operations, and containment notices to the frontend with sub-second latency.

##### Task 4.3: Frontend Code Splitting
- **File:** `frontend/src/App.tsx`
- **Action:** Wrap all 17 tab components in `React.lazy()` and `Suspense`, reducing initial JavaScript bundle size from 952 kB to under 200 kB.

##### Task 4.4: Production Container Hardening & Kubernetes Manifests
- **Files:** `Dockerfile.backend`, `Dockerfile.frontend`, `deploy/helm/`
- **Action:** 
  - Ensure backend runs as non-root user (`USER appuser`).
  - Provide production Docker Compose with PostgreSQL 16 and Redis 7.
  - Create Kubernetes deployment manifests with Horizontal Pod Autoscaling (HPA) and health probes.
