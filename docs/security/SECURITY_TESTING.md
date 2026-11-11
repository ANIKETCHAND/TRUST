# AgentTrust Automated Security Testing & Red Team Verification
**Document Version:** 2.0.0  
**Classification:** Technical Security Quality Assurance Record  

---

## 1. Security Testing Strategy & Methodologies

AgentTrust employs a test-driven adversarial verification methodology. Rather than relying on simple happy-path unit tests, the engineering organization validates controls against active bypass attempts, negative security scenarios, edge-case malformations, and privilege escalation payloads.

```
+---------------------------------------------------------------------------------------------------+
|                              AUTOMATED SECURITY TEST SUITES (78 TESTS)                            |
+---------------------------------------------------------------------------------------------------+
|  1. Negative Authorization & RBAC       4. AI Injection & Guardrails     7. Database Integrity    |
|  - Unauthenticated Admin Rejection      - Unicode Homoglyph Evasion      - Migration Lifecycle    |
|  - Non-Admin HTTP 403 Verification      - Leetspeak Obfuscation          - Ast Parameterization   |
|  - Request Body Identity Forgery        - Base64 Payload Smuggling       - Unbounded UPDATE Block |
|  - Parent Delegation Key Verification   - ML Jailbreak Vectorization                              |
|                                                                                                   |
|  2. Gateway Enforcement Bypass          5. Host & Process Protection     8. Active Defense        |
|  - Deny-by-Default Execution            - Host Process Kill Switch       - IP / CIDR Sinkholing   |
|  - Explicit DENY Precedence             - System PID Protected Bounds    - Malformed IP Drop      |
|  - Policy UI Rule Enforcement           - Process Self-Kill Rejection    - Honeypot Tarpit Traps  |
|                                                                                                   |
|  3. Tool Boundary Hardening             6. Cryptographic Audit           9. Endpoint & Browser    |
|  - Filesystem Path Traversal (../)      - HMAC-SHA256 Hash Chaining      - Device Token Auth      |
|  - SSRF Cloud Metadata Block            - In-Memory Tamper Detection     - Contained Net Isolation|
|  - Null-Byte Path Injection (\x00)      - Deleted Event Chain Break      - Synchronous DOM Block  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Key Negative Security Test Cases

### 2.1 Negative Authorization & Role Enforcement
- **Test File:** [`backend/tests/test_negative_security_and_auth.py`](file:///e:/OS%20PROJECT/backend/tests/test_negative_security_and_auth.py)
- **Verified Behaviors:**
  - `test_unauthenticated_requests_strictly_rejected`: Ensures unauthenticated requests to `/api/v1/agents`, `/policies`, `/permissions`, `/active-defense/kill-process`, and `/attribution/sinkhole` return HTTP 401.
  - `test_role_based_access_control_non_admin_forbidden`: Verifies that authenticated `OPERATOR` users cannot execute administrative actions (e.g., creating policies or killing host processes), returning HTTP 403 Forbidden.
  - `test_identity_cannot_be_spoofed_in_payload`: Confirms that an agent cannot forge identity by supplying another agent's ID in request JSON; identity is derived exclusively from cryptographic headers.
  - `test_non_admin_delegation_requires_parent_key`: Validates that non-admin callers cannot create delegations without the verified API key of the parent delegator.

### 2.2 Output Rails & DLP Bypass Defense
- **Test File:** [`backend/tests/test_negative_security_and_auth.py`](file:///e:/OS%20PROJECT/backend/tests/test_negative_security_and_auth.py)
- **Verified Behaviors:**
  - `test_output_rails_mode_raw_cannot_bypass_secrets_leakage`: Proves that client context `{"output_rails_mode": "raw"}` cannot bypass output DLP. Output rails enforce server-side `block` mode, preventing the leak of RSA private keys, AWS access keys, and valid payment cards.

### 2.3 Dialog Rails Sequence State Machine
- **Test File:** [`backend/tests/test_guardrails_pipeline.py`](file:///e:/OS%20PROJECT/backend/tests/test_guardrails_pipeline.py)
- **Verified Behaviors:**
  - `test_dialog_rails_agent_history_tracking_prevents_session_randomization_bypass`: Proves that an agent cannot evade multi-step tool sequence restrictions (database read followed by HTTP egress) by randomizing `session_id`. Tracking is keyed to the immutable `agent.id`.

### 2.4 Prompt Injection & Multi-Layer Guardrails
- **Test File:** [`backend/tests/test_negative_security_and_auth.py`](file:///e:/OS%20PROJECT/backend/tests/test_negative_security_and_auth.py)
- **Verified Behaviors:**
  - `test_prompt_injection_detector_multilayer_defense`: Evaluates direct instruction overrides, zero-width spaces, leetspeak (`1gn0r3 @ll pr10r rUl3z`), and base64 encoded strings (`aWdub3JlIGFsbCBwcmV2aW91cw==`).
  - `test_ml_semantic_prompt_injection_detection`: Tests subword/character n-gram TF-IDF vectorization and cosine similarity against adversarial jailbreak centroids.

### 2.5 Cryptographic HMAC-SHA256 Audit Integrity
- **Test File:** [`backend/tests/test_negative_security_and_auth.py`](file:///e:/OS%20PROJECT/backend/tests/test_negative_security_and_auth.py)
- **Verified Behaviors:**
  - `test_hmac_audit_log_tamper_detection`: Simulates database tampering by modifying an event payload in the database. Verifies that `/api/v1/audit/verify-integrity` immediately flags the broken hash chain and identifies the tampered record ID.

### 2.6 Real Alembic Database Migrations
- **Test File:** [`backend/tests/test_real_migrations_and_db.py`](file:///e:/OS%20PROJECT/backend/tests/test_real_migrations_and_db.py)
- **Verified Behaviors:**
  - `test_alembic_full_migration_lifecycle`: Runs Alembic migrations (`upgrade head` -> `downgrade base` -> `upgrade head`) against a dynamic SQLite instance, verifying that all schema definitions, constraints, and foreign key cascades apply cleanly without runtime errors.

---

## 3. Test Execution Verification Commands

```powershell
# Execute the complete automated security test suite
$env:PYTHONPATH = "backend"
& "C:\Python314\python.exe" -m pytest backend/tests -v --durations=10

# Execute only negative security and authorization tests
& "C:\Python314\python.exe" -m pytest backend/tests/test_negative_security_and_auth.py -v

# Run the complete end-to-end platform demonstration
& "C:\Python314\python.exe" backend/scripts/demo_full_platform.py
```
