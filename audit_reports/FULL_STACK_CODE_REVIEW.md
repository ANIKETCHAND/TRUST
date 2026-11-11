# AgentTrust: Full-Stack Code & Database Architecture Review
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
**Reviewers:** Full-Stack Software Architect & Senior Backend/Database Engineer Panel

---

## 1. Executive Full-Stack Verdict

> **Main Question:** *Could another experienced engineering team maintain, extend, and operate this codebase without rewriting major parts of it?*

### Definitive Verdict: **NO.**
While the codebase has clean folder structures and adheres superficially to modern conventions (FastAPI + React + Vite + TypeScript + Tailwind CSS), it suffers from **fundamental architectural disconnects, broken migrations, code duplication, and inconsistent data models**.

Any engineering team attempting to maintain or scale this codebase would need to:
1. Re-architect the entire authentication and access control subsystem.
2. Re-write the database migration baseline from scratch.
3. Unify the decoupled `Policy` and `Permission` data models.
4. Replace simulated/mocked integrations with functional implementations.
5. Merge duplicate frontend API clients and establish an authenticated session architecture.

---

## 2. Frontend Architecture & UI-Backend Connectivity

### A. Architectural Overview
- **Stack:** React 19.3, TypeScript 7.0 (Vite 8.3), Tailwind CSS 3.4, Recharts 3.10, Lucide React.
- **Organization:** `src/components/layout/`, `src/components/tabs/`, `src/components/ui/`, `src/context/`, `src/hooks/`, `src/services/`.
- **Build Status:** Builds cleanly via `npm run build` with Vite (`tsc -b && vite build` generates 786 kB bundle in 790ms).

### B. UI vs. Backend Connectivity Audit
Our investigation evaluated every one of the 16 frontend tabs to determine whether it is **genuinely connected to the backend** or represents a **cosmetic demonstration**:

| Tab Name | File | Backend Endpoint(s) | Real Backend Action? | Connectivity Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Overview** | `OverviewTab.tsx` | `GET /overview/stats` | Yes (Queries DB count/aggregates) | **Connected & Real** |
| **Agents** | `AgentsTab.tsx` | `GET /agents`, `POST /agents`, `PATCH /agents/{id}`, `POST /agents/{id}/revoke` | Yes (Full DB CRUD + SHA-256 key generation) | **Connected & Real** |
| **Tools** | `ToolsTab.tsx` | `GET /tools`, `POST /gateway/execute` | Yes (Dispatches real tool calls) | **Connected & Real** |
| **Live Monitoring** | `LiveMonitoringTab.tsx`| `GET /audit?limit=50` | Yes (Polls real audit events) | **Connected & Real** |
| **Endpoints** | `EndpointsTab.tsx` | `GET /endpoints`, `POST /endpoints/{id}/contain` | Partial (Sets DB flag; endpoint connector ignores it) | **Partially Functional** |
| **Browser Shield** | `BrowserShieldTab.tsx` | `GET /browser-shield/status`, `GET /audit/incidents` | Partial (Status info real; DOM interception easily bypassed) | **Partially Functional** |
| **Delegation** | `DelegationTab.tsx` | `GET /delegations`, `POST /delegations` | **Broken at runtime** (DB crashes on missing column) | **Broken Integration** |
| **Provenance** | `ProvenanceTab.tsx` | `GET /provenance/graph` | Cosmetic (Auto-seeds 4 static mock nodes; no execution taint) | **Cosmetic Demo** |
| **Security Policies**| `PoliciesTab.tsx` | `GET /policies`, `PUT /policies/{id}`, `POST /policies/test` | **Illusionary** (Updates `policies` table; gateway only reads `permissions`) | **Architectural Illusion** |
| **Incidents** | `IncidentsTab.tsx` | `GET /audit/incidents`, `PATCH /audit/incidents/{id}` | Yes (Reads/updates real DB records) | **Connected & Real** |
| **Compliance Audit** | `AuditTab.tsx` | `GET /audit`, `GET /audit/export?format=csv/json` | Yes (Real DB logs and CSV/JSON export) | **Connected & Real** |
| **Agent Runner** | `AgentRunnerTab.tsx` | `POST /agent-exec/run` | **Scripted Demo** (Executes hardcoded 3-step Python script) | **Scripted Demo** |
| **Active Defense** | `ActiveDefenseTab.tsx` | `GET /active-defense/processes`, `POST /active-defense/kill-process`, `POST /attribution/sinkhole` | Yes (Real OS process kill / netsh invocation, but unauthenticated & dangerous) | **Dangerous / Unsecured** |
| **Threat Map** | `ThreatMapTab.tsx` | `GET /attribution/threat-map` | **Fake Data** (Calculates coordinates via IP octet math) | **Fabricated Visuals** |
| **Forensic Reports** | `ReportsTab.tsx` | `GET /reports/incident/{id}/export`, `GET /reports/executive-summary` | Real data, but **vulnerable to stored XSS** | **Vulnerable Endpoint** |
| **Settings** | `SettingsTab.tsx` | `GET /health` | Yes (Reads config flags) | **Connected & Real** |

### C. Frontend Code Quality & Engineering Issues
1. **Critical Code Duplication in API Clients**:
   - `frontend/src/api/client.ts` (113 lines) defines `export const api = { ... }`.
   - `frontend/src/services/api.client.ts` (137 lines) defines `export class ApiError` and another `export const api = { ... }`.
   - Different tabs import from different files (e.g. `PoliciesTab.tsx` imports from `services/api.client.ts`, while older components import from `api/client.ts`).
2. **Missing User Authentication & Route Protection**:
   - There is no `<ProtectedRoute>` component, no login screen, no auth token management, and no user profile store.
3. **Bundle Size & Chunking Warning**:
   - Vite warns during production build: `(!) Some chunks are larger than 500 kB after minification (index-CVCcpzrx.js: 786.52 kB)`. There is zero code-splitting or dynamic `React.lazy()` chunking applied.

---

## 3. Backend Architecture & API Design

### A. Modular Monolith Layout
The FastAPI backend (`backend/app/`) is structured logically:
- `api/v1/`: API route controllers.
- `core/`: Database connections, settings, security utilities.
- `guardrails/`: Handcrafted regex rails.
- `models/`: SQLAlchemy 2.0 async ORM models.
- `schemas/`: Pydantic models for request/response validation.
- `services/`: Business logic services.
- `tools/`: Tool execution implementations.

### B. API Routing and Design Critique
1. **Inconsistent Endpoint Authentication**:
   - In `backend/app/api/deps.py`:
     - `get_current_user`: Mandatory authentication dependency checking JWT Bearer token.
     - `get_current_user_optional`: Soft dependency returning `None` if unauthenticated.
     - `get_current_agent`: Checks `X-Agent-Key` or `Authorization: Bearer <key>`.
   - **Critical Vulnerability**: `get_current_user` is **never used in any API route**. Only `get_current_user_optional` is used in 3 places (`agent_exec.py`, `browser_shield.py`, `endpoints.py`). All other routers (`agents.py`, `policies.py`, `permissions.py`, `delegations.py`, `attribution.py`, `active_defense.py`) have **zero authentication checks**.
2. **Unvalidated JSON Payloads in Pydantic Schemas**:
   - Several schemas accept arbitrary dictionaries without schema validation:
     - `PolicyCreateRequest.rules`: `Dict[str, Any]`
     - `NodeCreateRequest.metadata_info`: `Dict[str, Any]`
     - `TelemetryItem.telemetry_details`: `Optional[Dict[str, Any]]`
   - This bypasses Pydantic's data validation and allows arbitrary, unvalidated structures to persist into the database.
3. **HTTP Verb & REST Inconsistencies**:
   - `POST /api/v1/reports/incident/{incident_id}/export` is an export/read action but defined as both `GET` and `POST`.
   - `POST /api/v1/agents/{agent_id}/revoke` uses `POST` instead of `PATCH` or `DELETE`.

---

## 4. Database Architecture & Persistence Review

### A. ORM Models & Relationships
- **ORM**: SQLAlchemy 2.0 declarative models using modern `Mapped[...]` and `mapped_column(...)`.
- **Models Inspected**:
  - `User`: `id`, `username`, `email`, `hashed_password`, `role`, `is_active`.
  - `Agent`: `id`, `name`, `description`, `role`, `api_key_hash`, `api_key_prefix`, `status`, `agent_metadata`.
  - `Permission`: `id`, `agent_id`, `tool_name`, `operation`, `resource_pattern`, `effect`, `priority`, `conditions`, `expires_at`, `is_active`.
  - `Delegation`: `id`, `parent_agent_id`, `child_agent_id`, `parent_delegation_id`, `scope`, `max_depth`, `current_depth`, `status`, `token_hash`, `expires_at`, `revoked_at`, `revocation_reason`.
  - `Policy` & `PolicyVersion`: `id`, `name`, `version`, `is_active`, `default_effect`, `rules`.
  - `AuditEvent`: `id`, `request_id`, `agent_id`, `agent_name`, `tool_name`, `operation`, `target_resource`, `decision`, `decision_reason`, `policy_id_triggered`, `delegation_id`, `provenance_id`, `execution_status`, `execution_duration_ms`, `context_metadata`, `error_message`.
  - `SecurityIncident`: `id`, `audit_event_id`, `agent_id`, `severity`, `title`, `description`, `status`, `incident_metadata`.
  - `EndpointDevice`, `EndpointTelemetryEvent`, `EndpointContainmentAction`, `BrowserShieldExtension`.

### B. Database Deficiencies

#### 1. The Policy vs. Permission Disconnect
The database contains two entirely parallel models for authorization:
- `Policy` (in `models/policy.py`): Contains versioned JSON rules (`rules = mapped_column(JSON)`).
- `Permission` (in `models/permission.py`): Contains individual tool/operation/resource glob grants.

There is **no relationship, foreign key, or synchronization logic** between `Policy` and `Permission`. When an administrator edits a policy in the UI, `Policy` is updated, but `Permission` remains untouched. When the gateway evaluates requests, it only queries `Permission`. This is a severe architectural flaw.

#### 2. Alembic Migration Failure
- Running `alembic current` in `backend/` outputs:
  ```
  INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
  INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
  ERROR [alembic.util.messaging] Can't locate revision identified by 'baa8a3fbd940'
  FAILED: Can't locate revision identified by 'baa8a3fbd940'
  ```
- The database file `backend/agenttrust.db` contains a migration stamp `baa8a3fbd940` that does not exist in `alembic/versions/`. The only migration file present is `c0c4c1902c20_complete_platform_initial_schema.py`.
- The database is completely decoupled from the migration system.

#### 3. Missing Column in Live Database
- The table `delegations` in `backend/agenttrust.db` is missing the `parent_delegation_id` column.
- Because `init_db()` in `main.py` uses `Base.metadata.create_all`, SQLAlchemy only creates tables that do not exist; **it never alters existing tables to add newly added model columns**.
- Consequently, executing any delegation creation against the application database throws a fatal runtime exception:
  `sqlite3.OperationalError: table delegations has no column named parent_delegation_id`

#### 4. Total Lack of Multi-Tenant Architecture
- No table in the entire schema has a `tenant_id` column.
- All database queries (`select(Agent)`, `select(Policy)`, `select(AuditEvent)`) execute globally across the entire database.

#### 5. Missing Indexes on High-Volume Audit Queries
- The `audit_events` table contains indexes on `agent_id`, `tool_name`, and `created_at`.
- However, the `GET /overview/stats` endpoint performs an unindexed aggregation on `created_at` with 4-hour bucket intervals, which will degrade to full-table scans as millions of events accumulate.

---

## 5. Service-Layer Design & Quality Assessment

1. **Tool Handlers (`backend/app/tools/`)**:
   - `filesystem_tool.py`: Well implemented. Strict directory jail resolution (`target_path.relative_to(self.root_path)`), null-byte prevention, and file size limits (5 MB).
   - `http_api_tool.py`: Competent SSRF validation (blocks loopback, private RFC1918, link-local, cloud metadata), but susceptible to DNS rebinding TOCTOU between validation and request.
   - `db_tool.py`: Named `postgres_tool`, but connects directly to a local SQLite database (`sandbox_data.db`). SQL parsing uses naive regex on the first word (`clean_sql.split()[0].upper() != 'SELECT'`). UPDATE statements do not require a `WHERE` clause.
   - `mcp_tool.py`: Pure stub. Returns static JSON dictionaries; does not route or execute tools.
2. **State Volatility in Memory Services**:
   - `dialog_rails.py`: Stores `self._session_history` in process memory.
   - `active_defense_service.py`: Stores `self._sinkholed_ips`, `self._tarpit_targets`, and `self._countermeasures_log` in process memory.
   - Any server restart or worker fork wipes all active defense null-routes and session states.
3. **Untested and Unused Code**:
   - `backend/app/services/pipelock_service.py` is fully defined but never imported or invoked by `gateway_service.py`.

---

## 6. Recommendations for Engineering Overhaul

1. **Unify Policy and Permission Models**:
   - Eliminate the separate `permissions` table or make it a compiled projection of active `Policy` rules.
   - Ensure that updating a policy immediately updates the policy engine's active evaluation cache.
2. **Re-initialize Alembic Migrations**:
   - Discard the corrupt SQLite database file (`agenttrust.db`) from version control.
   - Generate a single, clean initial migration covering the entire current schema.
   - Configure CI to run `alembic upgrade head` against a test PostgreSQL instance on every PR.
3. **Implement Universal Auth Middleware**:
   - Create a global FastAPI dependency or middleware requiring valid authentication on all `/api/v1/` routes except `/health`, `/auth/login`, and `/auth/register`.
4. **Consolidate Frontend API Clients**:
   - Delete `frontend/src/api/client.ts`.
   - Standardize all tabs and hooks to consume `frontend/src/services/api.client.ts`.
   - Add a centralized authentication provider with token storage in memory or HTTP-only cookies.
5. **Implement Real PostgreSQL Connection in `db_tool.py`**:
   - If the tool is named `postgres_tool`, it should connect to a real PostgreSQL instance via `asyncpg`, rather than creating a local SQLite file.
