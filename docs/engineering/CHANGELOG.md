# AgentTrust Platform Engineering Changelog
**Current Version:** 0.2.0-enterprise  
**Release Classification:** Industrial Platform Transformation  

---

## [0.2.0] — November 11, 2026

### Security Architecture & Access Control
- **Fixed (SEC-01):** Restricted `/api/v1/active-defense/kill-process` to authenticated administrators (`Depends(get_current_admin_user)`). Enforced agent process PID ownership validation; protected system PIDs (PID <= 4) and AgentTrust platform processes from termination.
- **Fixed (SEC-02):** Eliminated client-side output rail mode bypass. Gateway now strictly enforces server-side `settings.DEFAULT_OUTPUT_RAILS_MODE` (default `"block"`), preventing cleartext leaks of private keys and credentials.
- **Fixed (SEC-03):** Attached `Depends(get_current_user)` and `require_roles([UserRole.ADMIN])` across all administrative routers (`agents.py`, `policies.py`, `permissions.py`, `active_defense.py`, `attribution.py`).
- **Fixed (SEC-04):** Unified Policy and Permission models. Gateway now evaluates active enterprise policies (filesystem prefixes, forbidden SQL statements, HTTPS rules) in tandem with granular agent permission grants.
- **Fixed (SEC-05):** Eliminated Stored XSS vulnerability in HTML forensic incident exports by enforcing `html.escape()` sanitization across all report template variables.
- **Fixed (SEC-08):** Hardened `DialogRails` multi-step tool sequence tracking by keying execution history to immutable `agent.id` rather than client-controllable `session_id`, preventing session randomization evasions.
- **Fixed (SEC-09):** Restricted `/api/v1/attribution/local-arp` endpoint to authenticated administrators to prevent unauthorized intranet topology reconnaissance.
- **Fixed (SEC-10):** Added production startup validator in `config.py` that halts initialization if `SECRET_KEY` or `ENROLLMENT_SECRET` is shorter than 32 characters or matches insecure defaults.
- **Fixed (SEC-11):** Hardened client IP resolution against `X-Forwarded-For` spoofing using trusted proxy IP validation.
- **Fixed (SEC-12):** Enforced parent agent credential authentication (`X-Parent-Agent-Key`) for non-admin delegation grant issuance.

### AI & LLM Guardrails
- **Added (SEC-18):** Implemented 5-layer prompt injection defense in `prompt_injection_service.py` including Unicode NFKD decomposition, zero-width character stripping, leetspeak transliteration, Base64 decoding, Shannon entropy heuristics, and character n-gram TF-IDF vectorization with cosine similarity against jailbreak centroids.
- **Added:** Implemented dynamic taint propagation in `gateway_service.py` and `policy_engine.py`. Agents ingesting untrusted inputs have their context tainted; outbound network egress is blocked for tainted contexts.

### Database & Multi-Tenancy
- **Fixed (SEC-06 & SEC-07):** Unified Alembic initial migration (`c0c4c1902c20_complete_platform_initial_schema.py`) supporting `parent_delegation_id`, foreign key cascades, and `tenant_id` columns. Anchored SQLite `DATABASE_URL` to an absolute path derived from project root.
- **Added (SEC-24):** Implemented cryptographic HMAC-SHA256 audit log chaining where each event signature is cryptographically linked to its predecessor. Added `/api/v1/audit/verify-integrity` tamper verification endpoint.

### Tool Execution & Boundary Protection
- **Fixed (SEC-21 & SEC-22):** Enhanced `db_tool.py` to reject unbounded `UPDATE` and `DELETE` queries lacking a `WHERE` clause. Added DLP inspection to filesystem write operations.
- **Fixed (SEC-25):** Strengthened anti-SSRF protections in `http_api_tool.py` with pre-flight DNS address resolution checks blocking loopback, link-local metadata (`169.254.169.254`), and RFC-1918 private subnets.
- **Added (SEC-19 & SEC-20):** Integrated standard MCP v1.0 JSON-RPC 2.0 schema translation in `mcp_tool.py` and connected external OPA and Pipelock sidecar adapters.

### Frontend Transformation
- **Added (SEC-15):** Built React `AuthContext.tsx` and dedicated `LoginScreen.tsx` with JWT storage and session invalidation.
- **Fixed (SEC-14):** Consolidated duplicate API clients into `frontend/src/services/api.client.ts` with automatic Authorization header injection. Added NGINX reverse-proxy service to `docker-compose.yml`.

### Endpoint & Browser Shield
- **Added (SEC-23):** Built native Windows sentry daemon in `endpoint-connector/` with heartbeat loop, process telemetry submission, and human-authorized firewall containment.
- **Added (SEC-24):** Hardened `browser-shield/` with synchronous keydown and submit-button interceptors evaluating sensitive credential patterns immediately before async dispatch.

### Automated Testing & CI/CD
- **Added:** GitHub Actions workflow `.github/workflows/ci.yml` running Alembic verification, Pytest suite, and frontend build.
- **Added:** 78 passing backend tests across 16 test modules covering all unit, integration, negative security, and migration lifecycles.
