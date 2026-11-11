# AgentTrust Technical Security Controls Catalog
**Document Version:** 2.0.0  
**Classification:** Enterprise Security Architecture Specification  

---

## 1. Control Plane Authentication & Centralized Authorization

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-AUTH-01** | **Cryptographic Token Verification** | [`backend/app/api/deps.py`](file:///e:/OS%20PROJECT/backend/app/api/deps.py#L15) | Validates JWT tokens using HS256 and server-side `SECRET_KEY`. Rejects expired, tampered, or missing tokens with HTTP 401. |
| **CTL-AUTH-02** | **Role-Based Access Control (RBAC)** | [`backend/app/api/deps.py`](file:///e:/OS%20PROJECT/backend/app/api/deps.py#L41) | Route-level dependency `require_roles([UserRole.ADMIN])` enforced across all administrative endpoints (`/agents`, `/policies`, `/permissions`, `/active-defense`). |
| **CTL-AUTH-03** | **Zero-Trust Agent Identity** | [`backend/app/api/deps.py`](file:///e:/OS%20PROJECT/backend/app/api/deps.py#L74) | Agent identity derived strictly from verified `Authorization: Bearer <key>` or `X-Agent-Key` headers. Request body claims are discarded. |
| **CTL-AUTH-04** | **Credential Hashing & Seeding** | [`backend/app/core/security.py`](file:///e:/OS%20PROJECT/backend/app/core/security.py#L22) | User passwords hashed using bcrypt (12 rounds). Agent API keys hashed with SHA-256 before persistence; raw keys never stored in cleartext. |
| **CTL-AUTH-05** | **Production Secret Hardening** | [`backend/app/core/config.py`](file:///e:/OS%20PROJECT/backend/app/core/config.py#L92) | In production (`ENVIRONMENT=production`), fails initialization if `SECRET_KEY` or `ENROLLMENT_SECRET` is shorter than 32 characters or matches known placeholder sets. |

---

## 2. Deterministic Gateway Policy Engine

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-POL-01** | **Deny-by-Default Execution** | [`backend/app/services/policy_engine.py`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L133) | Any agent request lacking an active, unexpired `ALLOW` grant is immediately blocked with a structured security event. |
| **CTL-POL-02** | **Explicit DENY Precedence** | [`backend/app/services/policy_engine.py`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L126) | Explicit `DENY` rules take immediate precedence over any wildcard or granular `ALLOW` permissions. |
| **CTL-POL-03** | **Policy-Permission Convergence** | [`backend/app/services/policy_engine.py`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L152) | Active enterprise `Policy` records (filesystem prefixes, forbidden SQL statements, HTTPS rules) are verified directly during gateway request evaluation. |
| **CTL-POL-04** | **Dynamic Taint Containment** | [`backend/app/services/policy_engine.py`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L143) | Outbound network egress (`http_api_tool`) is strictly blocked for agents whose context has been tainted by untrusted inputs. |

---

## 3. AI Guardrails & Injection Defense Pipeline

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-GRD-01** | **Unicode & Homoglyph Normalization** | [`backend/app/services/prompt_injection_service.py`](file:///e:/OS%20PROJECT/backend/app/services/prompt_injection_service.py#L85) | Decomposes NFKD homoglyphs, strips zero-width non-printing characters, and collapses intra-word spaces. |
| **CTL-GRD-02** | **Leetspeak Transliteration** | [`backend/app/services/prompt_injection_service.py`](file:///e:/OS%20PROJECT/backend/app/services/prompt_injection_service.py#L99) | Converts leetspeak substitutions (`!gn0r3` -> `ignore`, `p@$$w0rd` -> `password`) to unmask hidden keywords. |
| **CTL-GRD-03** | **ML Semantic Jailbreak Classifier** | [`backend/app/services/prompt_injection_service.py`](file:///e:/OS%20PROJECT/backend/app/services/prompt_injection_service.py#L148) | Subword/character n-gram TF-IDF vectorization evaluating cosine similarity against adversarial jailbreak centroids. |
| **CTL-GRD-04** | **Dialog State Machine Protection** | [`backend/app/guardrails/dialog_rails.py`](file:///e:/OS%20PROJECT/backend/app/guardrails/dialog_rails.py#L48) | Tracks multi-step tool transitions by cryptographic `agent.id`; blocks unauthorized tool chaining (e.g., DB query -> HTTP post) across randomized session IDs. |
| **CTL-GRD-05** | **Server-Side Fail-Closed Output DLP** | [`backend/app/guardrails/output_rails.py`](file:///e:/OS%20PROJECT/backend/app/guardrails/output_rails.py#L140) | Scans tool return payloads for private keys, AWS tokens, JWTs, SSNs, and credit cards (verified with Luhn check). Defaults to `block` mode. |

---

## 4. Cryptographic Auditing & Tamper Evident Logging

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-AUD-01** | **HMAC-SHA256 Chained Hash** | [`backend/app/services/audit_service.py`](file:///e:/OS%20PROJECT/backend/app/services/audit_service.py#L52) | Each audit record computes an HMAC-SHA256 signature linking its payload to the previous event's signature (`audit_hash = HMAC(prev_hash + data)`). |
| **CTL-AUD-02** | **Cryptographic Tamper Detection** | [`backend/app/services/audit_service.py`](file:///e:/OS%20PROJECT/backend/app/services/audit_service.py#L125) | API endpoint `/api/v1/audit/verify-integrity` recomputes the entire event chain and flags any modified, inserted, or deleted records. |

---

## 5. Tool Sandbox & Network Boundary Enforcement

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-TOOL-01** | **Filesystem Sandbox Traversal Protection** | [`backend/app/tools/filesystem_tool.py`](file:///e:/OS%20PROJECT/backend/app/tools/filesystem_tool.py#L20) | Resolves all file paths against `sandbox_storage`; rejects null bytes (`\x00`) and relative traversal escapes; enforces 5MB file cap. |
| **CTL-TOOL-02** | **Anti-SSRF Network Boundary** | [`backend/app/tools/http_api_tool.py`](file:///e:/OS%20PROJECT/backend/app/tools/http_api_tool.py#L39) | Validates URLs against blocked hostnames, RFC-1918 private subnets, cloud metadata addresses (`169.254.169.254`), and performs pre-flight DNS lookups. |
| **CTL-TOOL-03** | **Relational Database SQL Safety** | [`backend/app/tools/db_tool.py`](file:///e:/OS%20PROJECT/backend/app/tools/db_tool.py#L75) | Forbids DDL and administrative operations (`DROP`, `ALTER`, `TRUNCATE`, `GRANT`); rejects unbounded `UPDATE` statements lacking a `WHERE` clause. |
| **CTL-TOOL-04** | **Model Context Protocol (MCP) Bridge** | [`backend/app/tools/mcp_tool.py`](file:///e:/OS%20PROJECT/backend/app/tools/mcp_tool.py#L14) | Translates MCP v1.0 JSON-RPC 2.0 schemas and validates input parameters before routing to registered sandbox tools. |

---

## 6. Active Defense & Endpoint Containment Controls

| Control ID | Control Name | Implementation Location | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **CTL-DEF-01** | **Controlled Host Process Kill Switch** | [`backend/app/services/active_defense_service.py`](file:///e:/OS%20PROJECT/backend/app/services/active_defense_service.py#L158) | Terminates rogue agent processes; restricted to registered agent PIDs; requires `ADMIN` role; protects system critical PIDs (PID <= 4). |
| **CTL-DEF-02** | **Perimeter IP & Subnet Sinkholing** | [`backend/app/services/active_defense_service.py`](file:///e:/OS%20PROJECT/backend/app/services/active_defense_service.py#L82) | Drops incoming requests from hostile IP addresses or CIDR subnets at the gateway entry point. |
| **CTL-DEF-03** | **Deception Honeypot Tarpit** | [`backend/app/services/active_defense_service.py`](file:///e:/OS%20PROJECT/backend/app/services/active_defense_service.py#L130) | Traps automated reconnaissance scanners by serving synthetic honeypot data without executing backend tools. |
| **CTL-DEF-04** | **Controlled Endpoint Containment** | [`backend/app/api/v1/endpoints.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/endpoints.py#L130) | Implements network isolation (`netsh advfirewall`) on managed workstations strictly upon explicit human SOC approval. |
