# AgentTrust End-to-End Data Flow Architecture
**Document Version:** 2.0.0  
**Classification:** Technical System Specification  

---

## 1. Gateway Tool Invocation & Enforcement Flow

The execution gateway (`POST /api/v1/gateway/execute`) is the central operational pipeline of the AgentTrust platform. All requests from autonomous agents pass through ten synchronous stages before returning a result to the caller.

```
Caller (Agent)               AgentTrust Gateway               Guardrails / Sinks               Database
      |                               |                                |                           |
      | 1. POST /gateway/execute      |                                |                           |
      |------------------------------>|                                |                           |
      | (X-Agent-Key: agk_live_...)   | 2. Authenticate Agent Creds    |                           |
      |                               |----------------------------------------------------------->|
      |                               |<-----------------------------------------------------------|
      |                               |                                |                           |
      |                               | 3. Check IP Sinkhole / Tarpit  |                           |
      |                               |    (active_defense_service)    |                           |
      |                               |                                |                           |
      |                               | 4. Input Guardrails Pre-flight |                           |
      |                               |------------------------------->|                           |
      |                               |    - Unicode & Leet Norm       |                           |
      |                               |    - ML Jailbreak Cosine Sim   |                           |
      |                               |<-------------------------------|                           |
      |                               |                                |                           |
      |                               | 5. Dialog Rails State Machine  |                           |
      |                               |    (Sequence tracking by ID)   |                           |
      |                               |                                |                           |
      |                               | 6. Delegation Scope Check      |                           |
      |                               |----------------------------------------------------------->|
      |                               |<-----------------------------------------------------------|
      |                               |                                |                           |
      |                               | 7. Deterministic Policy Eval   |                           |
      |                               |    - Explicit DENY check       |                           |
      |                               |    - Active permission grants  |                           |
      |                               |    - Enterprise policy rules   |                           |
      |                               |                                |                           |
      |                               | 8. Execute Server-Owned Handler|                           |
      |                               |------------------------------->|                           |
      |                               |    - Filesystem / DB / HTTP    |                           |
      |                               |<-------------------------------|                           |
      |                               |                                |                           |
      |                               | 9. Output Guardrails Scan      |                           |
      |                               |------------------------------->|                           |
      |                               |    - Secret / PII / PCI Check  |                           |
      |                               |    - Fail-Closed Redact/Block  |                           |
      |                               |<-------------------------------|                           |
      |                               |                                |                           |
      |                               | 10. Record Provenance & Audit  |                           |
      |                               |----------------------------------------------------------->|
      |                               |    - Dynamic Taint Propagation |                           |
      |                               |    - Append HMAC-SHA256 Hash   |                           |
      |                               |<-----------------------------------------------------------|
      |                               |                                |                           |
      | 11. GatewayExecuteResponse    |                                |                           |
      |<------------------------------|                                |                           |
```

### Detailed Lifecycle Stages:
1. **Agent Authentication:** Gateway extracts `X-Agent-Key` or `Authorization: Bearer <key>`, computes SHA-256 hash, and verifies agent status is `ACTIVE`.
2. **Active Defense Check:** Evaluates client IP against in-memory null-route sinkholes. If tarpitted, returns synthetic honeypot data immediately without executing the downstream tool.
3. **Input Rails Inspection:** Normalizes Unicode NFKD homoglyphs, strips zero-width characters, expands leetspeak, evaluates regexes, and checks TF-IDF cosine similarity against adversarial centroids.
4. **Dialog Rails Evaluation:** Verifies tool invocation sequence against agent history. Blocks unsafe chaining (e.g., immediate database dump followed by external HTTP post) regardless of session ID.
5. **Delegation Scope Verification:** If operating under a delegated identity, validates that parent delegation has not expired, recursion depth does not exceed configured maximum, and tool is explicitly listed in delegation grants.
6. **Deterministic Policy Evaluation:** 
   - Checks for matching explicit `DENY` rules (takes immediate precedence).
   - Validates existence of an active `ALLOW` grant (fail-closed, deny-by-default).
   - Evaluates active enterprise policies (validating filesystem prefixes, database SQL forbidden statements, outbound HTTP domain whitelists).
7. **Server-Side Tool Execution:** Executes tool in isolated Python sandbox. Tools enforce strict internal safety:
   - `filesystem_tool`: Path resolution constrained within `sandbox_storage`; path traversal blocked; max size 5MB.
   - `http_api_tool`: Validates RFC-1918, link-local, loopback, and cloud metadata SSRF addresses via direct IP and DNS resolution checks; max timeout 15s.
   - `db_tool`: Parameterized queries only; DDL and destructive statements blocked.
   - `mcp_tool`: Validates MCP JSON-RPC 2.0 schemas.
8. **Output Rails Evaluation:** Evaluates tool return payload for sensitive information (private keys, AWS tokens, JWTs, credit card numbers with Luhn verification, SSNs). Applies server-enforced mode (`block` or `redact`).
9. **Provenance Tracking:** Instantiates `ProvenanceNode` and `ProvenanceEdge`. If an untrusted source or tainted context was involved, propagates `tainted: true` downstream.
10. **HMAC-SHA256 Audit Chaining:** Computes HMAC signature of event linked to the previous event's hash and commits transaction to the database.

---

## 2. Browser Shield DOM Interception & Pre-Flight Flow

The Browser Shield protects browser-based AI workflows (e.g., ChatGPT, Claude, Gemini, DeepSeek) through a dual interception mechanism:

```
User Action                  Content Script (DOM)           Service Worker (Background)      AgentTrust Core API
     |                               |                               |                               |
     | 1. User types prompt          |                               |                               |
     |------------------------------>|                               |                               |
     |                               | 2. Debounced scan (250ms)     |                               |
     |                               |------------------------------>|                               |
     |                               |                               | 3. POST /browser-shield/check |
     |                               |                               |------------------------------>|
     |                               |                               |<------------------------------|
     |                               |<------------------------------|    (Decision: BLOCKED/ALLOWED)
     |                               | 4. Update Status Pill & State |                               |
     |                               |                               |                               |
     | 5. User presses Enter         |                               |                               |
     |------------------------------>|                               |                               |
     |                               | 6. Synchronous regex match    |                               |
     |                               |    - If blocked:              |                               |
     |                               |      e.preventDefault()       |                               |
     |                               |      e.stopPropagation()      |                               |
     |                               |      Display Red Alert Banner |                               |
     |                               |    - If clean:                |                               |
     |                               |      Allow DOM event to pass  |                               |
     v                               v                                                               
[Submission Halted]           [DOM Event Suppressed]
```

---

## 3. Endpoint Connector Telemetry & Containment Loop

The Endpoint Connector operates as an unprivileged sentry daemon with an optional elevated containment worker:

```
Endpoint Connector Daemon                  AgentTrust Core                     SOC Administrator
          |                                       |                                    |
          | 1. Periodic Heartbeat (30s)           |                                    |
          |    POST /endpoints/heartbeat          |                                    |
          |-------------------------------------->|                                    |
          |<--------------------------------------|                                    |
          |    {is_contained: false}              |                                    |
          |                                       |                                    |
          | 2. Process Telemetry Collection (60s) |                                    |
          |    POST /endpoints/telemetry          |                                    |
          |-------------------------------------->|                                    |
          |    (Monitored agent processes)        | 3. Automated Anomaly Detection     |
          |                                       |    (Creates SecurityIncident)      |
          |                                       |----------------------------------->|
          |                                       |                                    | 4. SOC Reviews Evidence
          |                                       |                                    |    & Authorizes Action
          |                                       | 5. POST /endpoints/{id}/contain    |<------------------------
          |                                       |    {authorized_by: "soc_admin"}    |
          |                                       |                                    |
          | 6. Next Heartbeat Cycle               |                                    |
          |    POST /endpoints/heartbeat          |                                    |
          |-------------------------------------->|                                    |
          |<--------------------------------------|                                    |
          |    {is_contained: true,               |                                    |
          |     scope: "NETWORK_ISOLATION"}       |                                    |
          |                                       |                                    |
          | 7. Enforce Containment                |                                    |
          |    netsh advfirewall add rule ...     |                                    |
          |    Isolate host network               |                                    |
          v                                       v                                    v
```

---

## 4. Human Authentication & RBAC Control Flow

```
Human User / Browser Console            FastAPI Auth Router                 Database / JWT Engine
            |                                    |                                     |
            | 1. POST /api/v1/auth/login         |                                     |
            |    {username, password}            |                                     |
            |----------------------------------->|                                     |
            |                                    | 2. Query user & verify bcrypt hash  |
            |                                    |------------------------------------>|
            |                                    |<------------------------------------|
            |                                    |                                     |
            |                                    | 3. Issue JWT Access Token           |
            |                                    |    (claims: role, user_id, tenant)  |
            |<-----------------------------------|                                     |
            |    {access_token, token_type}      |                                     |
            |                                    |                                     |
            | 4. GET /api/v1/policies            |                                     |
            |    (Authorization: Bearer <jwt>)   |                                     |
            |----------------------------------->|                                     |
            |                                    | 5. Validate JWT & Role Dependency   |
            |                                    |    (require_roles([ADMIN]))         |
            |                                    |    - If non-admin: HTTP 403         |
            |                                    |    - If valid: Return policies      |
            |<-----------------------------------|                                     |
            |    {policies: [...]}               |                                     |
```
