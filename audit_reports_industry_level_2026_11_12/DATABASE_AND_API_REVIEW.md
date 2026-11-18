# AGENTTRUST — TECHNICAL AUDIT
## DATABASE ARCHITECTURE & REST API REVIEW

**Target Platform:** AgentTrust AI Security Platform  
**Audit Date:** November 12, 2026  
**Auditor:** Database Architect & API Standards Audit Specialist  

---

### 1. DATABASE ARCHITECTURE & DATA MODELING

The platform utilizes **SQLAlchemy 2.0 Declarative Mapping** with asynchronous driver support (`async_sessionmaker`, `AsyncSession`).

#### A. Core Table Entities & Relationships:

```
┌─────────────────┐       1:N       ┌───────────────────────┐
│     agents      │────────────────▶│   agent_credentials   │
└─────────────────┘                 └───────────────────────┘
         │ 1:N                                  │
         │                                      │
         ▼                                      ▼
┌─────────────────┐                 ┌───────────────────────┐
│   permissions   │                 │      delegations      │
└─────────────────┘                 └───────────────────────┘
         │                                      │
         │                                      ▼
         │                          ┌───────────────────────┐
         │                          │   revocation_records  │
         │                          └───────────────────────┘
         ▼
┌─────────────────┐       1:1       ┌───────────────────────┐
│  audit_events   │────────────────▶│   security_incidents  │
└─────────────────┘                 └───────────────────────┘
         │
         ▼
┌─────────────────┐       1:N       ┌───────────────────────┐
│ provenance_nodes│────────────────▶│   provenance_edges    │
└─────────────────┘                 └───────────────────────┘
```

#### B. Architectural Highlights:
1. **Base Model Standards (`TimeStampedModel`):**
   - Every entity inherits UUIDv4 primary keys (`String(36)`), `created_at` (UTC timezone-aware), and `updated_at` (auto-updating timestamp).
   - Every entity includes a `tenant_id: String(64)` column with an index for enterprise multi-tenancy.
2. **Credential Security:**
   - Raw agent API keys (`agk_live_...`) are NEVER stored in plaintext. Only SHA-256 digests (`token_hash`) are persisted in `agent_credentials`.
   - Token prefixes (`token_prefix`) are preserved for dashboard visibility.
   - Deletion of an agent cascades to delete its associated credentials (`cascade="all, delete-orphan"`).
3. **Audit Ledger Immutability & Chaining:**
   - `audit_events` stores the full context of every decision (`ALLOWED`, `BLOCKED`, `APPROVAL_REQUIRED`), execution status, execution duration, and JSON context metadata.
   - Includes `previous_hash` and `hmac_signature` (HMAC-SHA256) columns implementing a tamper-evident blockchain-like sequential hash chain.
4. **Policy Versioning:**
   - Changes to policies automatically increment the `version` counter and insert an immutable `PolicyVersion` audit record capturing `rules`, `changed_by`, and `change_summary`.

---

### 2. DATABASE MIGRATION ENGINE (ALEMBIC)

The project utilizes Alembic for declarative schema migrations.

#### Migration Evaluation:
- **Migration File:** [5676b4452e39_complete_platform_initial_schema.py](file:///E:/OS%20PROJECT/backend/alembic/versions/5676b4452e39_complete_platform_initial_schema.py)
- **Engine Support:** Uses `batch_alter_table` context managers throughout, ensuring complete cross-compatibility with SQLite's table alteration limitations while supporting full PostgreSQL DDL.
- **Automated Verification:** The pytest suite executes `test_alembic_full_migration_lifecycle`, which starts from a clean, empty database, runs `alembic upgrade head`, inserts sample records, and verifies model consistency without migration failure.

---

### 3. DATABASE CONCURRENCY: SQLITE VS. POSTGRESQL

#### Development & Testing (SQLite):
- By default, AgentTrust runs on `sqlite+aiosqlite:///agenttrust.db`.
- While SQLite provides zero-dependency local execution and passed all 84 automated tests, it utilizes file-level locking during write operations (`database locked` / concurrency bottlenecks).
- SQLite is strictly unsuited for high-concurrency production deployments with multiple worker processes or distributed containers.

#### Production Readiness (PostgreSQL):
- The codebase uses dialect-agnostic SQLAlchemy types (`sa.DateTime(timezone=True)`, `sa.JSON()`, `sa.Enum`).
- [config.py](file:///E:/OS%20PROJECT/backend/app/core/config.py) explicitly warns when SQLite is detected in a production environment:
  ```python
  if self.DATABASE_URL.startswith("sqlite"):
      logger.warning("PRODUCTION WARNING: Running SQLite in production is not recommended for concurrent multi-tenant workloads. Configure PostgreSQL via DATABASE_URL.")
  ```
- Connection pool configuration is present (`DB_POOL_SIZE: 20`, `DB_MAX_OVERFLOW: 10`, `DB_POOL_TIMEOUT: 30`).

---

### 4. REST API DESIGN & OPENAPI AUDIT

The API exposes **44 distinct REST endpoints** organized under `/api/v1`.

#### A. HTTP Method Compliance:
- **GET:** Used idempotently for retrieving agents, tools, policies, delegations, provenance graphs, audit logs, and metrics.
- **POST:** Used for creating agents, permissions, delegations, policies, and executing tool requests.
- **PATCH:** Used for partial updates to agent attributes and incident resolution notes.
- **PUT:** Used for full replacement of policy configurations.
- **DELETE:** Used for deactivating permissions, purging quarantine vault items, and releasing firewall sinkholes.

#### B. Status Code Correctness:
- `200 OK`: Standard successful retrieval and updates.
- `201 Created`: Resource creation (`POST /agents`, `POST /permissions`, `POST /delegations`).
- `400 Bad Request`: Validation failures, missing parameters, malformed IP addresses.
- `401 Unauthorized`: Missing, expired, or invalid JWT user tokens or agent API keys.
- `403 Forbidden`: Gateway policy denials, deactivated agent requests, or insufficient role privileges.
- `404 Not Found`: Non-existent agents, tools, delegations, or incidents.

#### C. API Flaws & Inconsistencies:
1. **Unprotected Audit Endpoints:** `GET /api/v1/audit`, `GET /api/v1/audit/export`, and `GET /api/v1/audit/verify-chain` lack authentication dependencies.
2. **Unprotected Incident Mutation:** `PATCH /api/v1/audit/incidents/{incident_id}` lacks authentication, permitting unauthorized status changes.
3. **Query Multi-Tenancy Defect:** `GET /api/v1/agents`, `GET /api/v1/delegations`, and `GET /api/v1/policies` lack `tenant_id` query scoping, permitting cross-tenant visibility.
