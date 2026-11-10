# AgentTrust Security Findings: Ranked Top 25 Vulnerabilities & Weaknesses
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform` (Commit `06bf0fc`)  
**Classification:** Technical Vulnerability Ledger  

---

## Severity & Priority Framework

- **CRITICAL**: Immediate risk of full system compromise, remote process termination, or complete security boundary collapse.
- **HIGH**: Major security weakness allowing significant privilege escalation, stored code execution, or data exposure.
- **MEDIUM**: Substantial architectural defect, partial security bypass, or data integrity failure.
- **LOW**: Minor security hygiene issue, configuration limitation, or defense-in-depth gap.
- **INFORMATIONAL**: Design observation or documentation inconsistency.

---

## Summary Matrix of Top 25 Findings

| Finding ID | Title | Category | Severity | Priority | Effort |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **SEC-01** | Unauthenticated Arbitrary Host Process Termination | Access Control / DoS | **CRITICAL** | P0 | Small |
| **SEC-02** | Output Rails Complete Cleartext Leak via Client Context Manipulation | Guardrail Bypass / Exfiltration | **CRITICAL** | P0 | Small |
| **SEC-03** | Broken Access Control Across All Core Admin APIs | Access Control | **CRITICAL** | P0 | Medium |
| **SEC-04** | Architectural Disconnect: Policy UI Has Zero Gateway Enforcement | Architecture / Logic | **CRITICAL** | P0 | Large |
| **SEC-05** | Stored XSS in Incident Report HTML Export | Injection / XSS | **HIGH** | P1 | Small |
| **SEC-06** | Database Migration Desynchronization & Runtime Crash | Database / Reliability | **HIGH** | P0 | Medium |
| **SEC-07** | Dual SQLite Database Split & Working Directory Path Divergence | Architecture / State | **HIGH** | P1 | Small |
| **SEC-08** | Dialog Rails State Machine Evasion via Session ID Randomization | Guardrail Bypass | **HIGH** | P1 | Small |
| **SEC-09** | Unauthenticated Layer-2 Local ARP Network Exfiltration | Information Disclosure| **HIGH** | P1 | Small |
| **SEC-10** | Hardcoded Enrollment Secret & Missing Production Validation | Cryptography / Secrets | **HIGH** | P1 | Small |
| **SEC-11** | Client IP Spoofing via Untrusted `X-Forwarded-For` Header | Network / Spoofing | **HIGH** | P1 | Small |
| **SEC-12** | Unauthenticated Delegation Grant Forgery & Escalation | Authorization | **HIGH** | P1 | Medium |
| **SEC-13** | Complete Absence of Multi-Tenancy & Tenant Isolation | Architecture | **HIGH** | P2 | Large |
| **SEC-14** | Frontend Missing from Docker Compose Production Build | DevSecOps | **HIGH** | P1 | Medium |
| **SEC-15** | Complete Absence of User Authentication in Frontend Dashboard | Authentication / UI | **HIGH** | P1 | Medium |
| **SEC-16** | Fabricated ClamAV & YARA Antivirus Status & 1KB Silent Truncation | Integrity / Assurance | **MEDIUM** | P2 | Medium |
| **SEC-17** | Fabricated Geolocation & Threat Scoring via IP Octet Math | Integrity / Assurance | **MEDIUM** | P2 | Small |
| **SEC-18** | Prompt Injection Detection Relies on 6 Trivial Regexes | AI Security | **MEDIUM** | P1 | Large |
| **SEC-19** | Model Context Protocol (MCP) Tool Bridge Is a Stub | Integration / Mock | **MEDIUM** | P2 | Large |
| **SEC-20** | Pipelock AI Sidecar Disconnected from Execution Gateway | Integration / Logic | **MEDIUM** | P2 | Medium |
| **SEC-21** | Data Leakage Prevention (DLP) Ignored on Filesystem and Database Sinks | DLP / Exfiltration | **MEDIUM** | P1 | Small |
| **SEC-22** | Destructive Database Updates Without `WHERE` Clause Safeguards | Data Integrity | **MEDIUM** | P2 | Small |
| **SEC-23** | Non-Functional Endpoint Containment on Managed Devices | Endpoint Security | **MEDIUM** | P2 | Medium |
| **SEC-24** | Browser Shield Easily Bypassed via Debounce Race or Toggle | Endpoint Security | **MEDIUM** | P2 | Medium |
| **SEC-25** | SSRF Protection Susceptible to DNS Rebinding TOCTOU | SSRF / Network | **MEDIUM** | P2 | Medium |

---

## Detailed Technical Findings

### SEC-01: Unauthenticated Arbitrary Host Process Termination
- **Category:** Access Control / Denial of Service
- **Severity:** **CRITICAL** (CVSS: 9.8 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`)
- **Priority:** P0 (Immediate Hotfix)
- **Affected Endpoint:** `POST /api/v1/active-defense/kill-process`
- **Affected File:** [`backend/app/api/v1/active_defense.py#L37-L54`](file:///e:/OS%20PROJECT/backend/app/api/v1/active_defense.py#L37-L54)
- **Description:** The `/active-defense/kill-process` endpoint accepts an arbitrary target PID and a boolean force flag. It performs no credential verification, token validation, or user role check. It immediately invokes `active_defense_service.kill_process()`, which calls `psutil.Process(pid).kill()`.
- **Evidence:**
  ```python
  @router.post("/kill-process", summary="1-Click Malicious Process Kill Switch")
  async def kill_process(req: KillProcessRequest):
      if req.pid <= 4 or req.pid == os.getpid():
          raise HTTPException(status_code=400, detail="Protected system or AgentTrust platform PID cannot be terminated.")
      res = active_defense_service.kill_process(
          pid=req.pid, agent_id=req.agent_id, reason=req.reason, force=req.force
      )
  ```
- **Impact:** Any unauthenticated remote network client with connectivity to port 8080 can terminate arbitrary host processes, including developer IDEs, database daemons, web servers, and platform runtime workers.
- **Recommended Remediation:** Require administrative session authentication (`Depends(get_current_user)` with `role == UserRole.ADMIN`), enforce agent process PID ownership validation, and disallow killing arbitrary host processes outside a registered agent PID ledger.

---

### SEC-02: Output Rails Complete Cleartext Leak via Client Context Manipulation
- **Category:** Guardrail Bypass / Data Exfiltration
- **Severity:** **CRITICAL** (CVSS: 9.1 - `CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`)
- **Priority:** P0
- **Affected Endpoint:** `POST /api/v1/gateway/execute`
- **Affected File:** [`backend/app/services/gateway_service.py#L696`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L696), [`backend/app/guardrails/output_rails.py#L165,L187-L191`](file:///e:/OS%20PROJECT/backend/app/guardrails/output_rails.py#L165)
- **Description:** In `gateway_service.py:696`, the output rail execution mode is derived directly from the unverified request context: `output_mode = context.get("output_rails_mode", "redact")`. In `output_rails.py:165`, if `mode != "redact"`, `_traverse` returns `obj` (the raw unmodified string). Furthermore, `allowed` is only set to `False` if `mode == "block"`. Thus, when an agent supplies `context: {"output_rails_mode": "raw"}`, `OutputRails` detects the leak, but returns the raw payload unredacted with `allowed: true`.
- **Proof-of-Concept Command Output:**
  ```powershell
  $env:PYTHONPATH="backend"
  python -c "from app.guardrails.output_rails import output_rails; res = output_rails.inspect_and_sanitize('Private key: -----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----', mode='raw'); print('Allowed:', res.allowed); print('Payload:', res.sanitized_payload)"
  # Output:
  Allowed: True
  Payload: Private key: -----BEGIN RSA PRIVATE KEY-----
  MIIEowIBAAKCAQEA0
  -----END RSA PRIVATE KEY-----
  ```
- **Impact:** Agents can extract private cryptographic keys, AWS credentials, JWT tokens, and credit cards in cleartext by appending a single property to their tool execution request context.
- **Recommended Remediation:** Never allow the caller context to specify `output_rails_mode`. The enforcement mode must be determined server-side by enterprise policy, and defaults must always fail closed (`mode = "block"`).

---

### SEC-03: Broken Access Control Across All Core Admin APIs
- **Category:** Access Control / Authorization
- **Severity:** **CRITICAL** (CVSS: 9.8 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Priority:** P0
- **Affected Endpoints:** `POST /api/v1/agents`, `POST /api/v1/permissions`, `POST /api/v1/policies`, `DELETE /api/v1/permissions/{id}`, `POST /api/v1/agents/{id}/revoke`, `POST /api/v1/attribution/sinkhole`
- **Affected Files:** [`backend/app/api/v1/agents.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/agents.py), [`policies.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/policies.py), [`permissions.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/permissions.py), [`active_defense.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/active_defense.py), [`attribution.py`](file:///e:/OS%20PROJECT/backend/app/api/v1/attribution.py)
- **Description:** `get_current_user` is defined in `backend/app/api/deps.py:15`, but **is not used as a dependency in a single API route across the entire application**. The administrative endpoints permit any unauthenticated network caller to register rogue agents, issue wildcard permissions (`*` on all tools), revoke active agents, and inject host firewall rules.
- **Impact:** Complete compromise of the control plane without authentication.
- **Recommended Remediation:** Attach `Depends(get_current_user)` to all administrative router endpoints and enforce role-based access control.

---

### SEC-04: Architectural Disconnect: Policy UI Has Zero Gateway Enforcement
- **Category:** Architecture / Logic Flaw
- **Severity:** **CRITICAL** (CVSS: 8.5)
- **Priority:** P0
- **Affected Endpoints:** `POST /api/v1/policies`, `PUT /api/v1/policies/{id}`
- **Affected Files:** [`backend/app/services/policy_engine.py#L94-L105`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L94-L105), [`backend/app/api/v1/policies.py#L37-L136`](file:///e:/OS%20PROJECT/backend/app/api/v1/policies.py#L37-L136)
- **Description:** The dashboard provides a "Security Policies" editor where users configure JSON rules (e.g. `allowed_prefixes`, `max_rows_per_query`, `forbidden_statements`). These endpoints write to the `Policy` and `PolicyVersion` database tables. However, [`policy_engine.evaluate()`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L94-L105) queries **only the `Permission` table**. The gateway never evaluates `Policy` or `PolicyVersion`.
- **Evidence:**
  ```python
  # backend/app/services/policy_engine.py:94
  stmt = (
      select(Permission)
      .where(
          or_(Permission.agent_id == agent.id, Permission.agent_id.is_(None)),
          Permission.is_active == True,
          or_(Permission.expires_at.is_(None), Permission.expires_at > now)
      )
      .order_by(Permission.priority.desc())
  )
  ```
- **Impact:** Security administrators believe they are configuring defensive guardrails in the dashboard, but their policy edits have zero effect on agent tool execution.
- **Recommended Remediation:** Unify the data model. Either migrate permissions into the policy engine or compile policy definitions into active permission records upon policy publication.

---

### SEC-05: Stored XSS in Incident Report HTML Export
- **Category:** Injection / Cross-Site Scripting (XSS)
- **Severity:** **HIGH** (CVSS: 7.6 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N`)
- **Priority:** P1
- **Affected Endpoint:** `GET /api/v1/reports/incidents/{incident_id}/export/html`
- **Affected File:** [`backend/app/services/report_generator.py#L232-L433`](file:///e:/OS%20PROJECT/backend/app/services/report_generator.py#L232-L433)
- **Description:** The HTML incident report export constructs HTML via raw Python f-strings without HTML escaping. Attacker-controlled data in event details or incident summaries (such as `<img src=x onerror=alert(1)>`) is written verbatim into the document.
- **Evidence:**
  ```python
  timeline_rows = "".join([
      f"""
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px; color: #cbd5e1;">{t['event']}</td>
        <td style="padding: 10px; color: #94a3b8; font-size: 12px;">{t['details']}</td>
      </tr>
      """
      for t in dossier["timeline"]
  ])
  ```
- **Impact:** Arbitrary JavaScript execution in the browser of SOC analysts or executives viewing exported HTML forensic dossiers.
- **Recommended Remediation:** Use Jinja2 with autoescaping enabled or wrap all interpolated variables with `html.escape()`.

---

### SEC-06: Database Migration Desynchronization & Runtime Crash
- **Category:** Database / Reliability
- **Severity:** **HIGH** (CVSS: 7.5)
- **Priority:** P0
- **Affected Files:** [`backend/alembic/versions/`](file:///e:/OS%20PROJECT/backend/alembic/versions/), [`backend/app/models/delegation.py#L24`](file:///e:/OS%20PROJECT/backend/app/models/delegation.py#L24)
- **Description:** In git commit `7fc5171843f45c0cd0af477b43536efb8f85a87a` (`fix: resolve critical database migration, delegation cascade, and boundary vulnerabilities`), the file `backend/alembic/versions/baa8a3fbd940_initial_schema_with_endpoints.py` was **deleted** and replaced with `c0c4c1902c20_complete_platform_initial_schema.py`. However, the committed SQLite database was already stamped with revision `baa8a3fbd940`. Running `alembic current` fails with `Can't locate revision identified by 'baa8a3fbd940'`, and running `demo_full_platform.py` crashes on Step 9 with `sqlite3.OperationalError: table delegations has no column named parent_delegation_id`.
- **Impact:** System crashes on all delegation operations when running against the shipped database.
- **Recommended Remediation:** Delete the stale SQLite databases and run `alembic upgrade head` from a clean state.

---

### SEC-07: Dual SQLite Database Split & Working Directory Path Divergence
- **Category:** Architecture / State Desynchronization
- **Severity:** **HIGH** (CVSS: 7.0)
- **Priority:** P1
- **Affected Files:** `e:\OS PROJECT\agenttrust.db`, `e:\OS PROJECT\backend\agenttrust.db`, [`backend/app/core/config.py#L35`](file:///e:/OS%20PROJECT/backend/app/core/config.py#L35)
- **Description:** `DATABASE_URL` is configured as `"sqlite+aiosqlite:///./agenttrust.db"`. Because the path is relative (`./agenttrust.db`), commands run from `e:\OS PROJECT\` connect to the root database (356 KB), while commands run from `backend/` connect to `backend/agenttrust.db` (331 KB). The root database does not even have an `alembic_version` table, leading to state divergence and mysterious test failures.
- **Impact:** Database updates made by the backend are invisible to scripts run from other directories.
- **Recommended Remediation:** Anchor `DATABASE_URL` to an absolute path derived from project root or `backend/app/core/config.py`.

---

### SEC-08: Dialog Rails State Machine Evasion via Session ID Randomization
- **Category:** Guardrail Bypass / Logic Flaw
- **Severity:** **HIGH** (CVSS: 7.4)
- **Priority:** P1
- **Affected File:** [`backend/app/guardrails/dialog_rails.py#L52,L74-L100`](file:///e:/OS%20PROJECT/backend/app/guardrails/dialog_rails.py#L52)
- **Description:** `DialogRails` attempts to prevent immediate database-to-HTTP tool chaining (`("postgres_tool", "http_api_tool")`). However, history is indexed by `session_id`, which is derived from client-provided `context.get("session_id")`. An agent can execute `postgres_tool:query_select` under `session_id="session_1"`, and immediately execute `http_api_tool:http_post` under `session_id="session_2"`. `DialogRails` sees an empty history for `session_2` and permits the egress.
- **Impact:** Complete evasion of multi-step tool sequence restrictions.
- **Recommended Remediation:** Track execution flow by `agent.id` or cryptographically signed session tokens rather than unverified client strings.

---

### SEC-09: Unauthenticated Layer-2 Local ARP Network Exfiltration
- **Category:** Information Disclosure
- **Severity:** **HIGH** (CVSS: 7.5)
- **Priority:** P1
- **Affected Endpoint:** `GET /api/v1/attribution/local-arp`
- **Affected File:** [`backend/app/api/v1/attribution.py#L39-L45`](file:///e:/OS%20PROJECT/backend/app/api/v1/attribution.py#L39-L45), [`backend/app/services/attribution_service.py#L102-L151`](file:///e:/OS%20PROJECT/backend/app/services/attribution_service.py#L102-L151)
- **Description:** The endpoint executes `arp -a` on the host OS and returns parsed IP-to-MAC mappings and resolved hardware vendors (e.g. VMware, Intel, Apple). It has zero authentication.
- **Impact:** External attackers can enumerate intranet network topologies, virtualization platforms, and MAC addresses.
- **Recommended Remediation:** Delete the endpoint or restrict to authenticated administrators.

---

### SEC-10: Hardcoded Enrollment Secret & Missing Production Validation
- **Category:** Cryptography / Secrets
- **Severity:** **HIGH** (CVSS: 7.5)
- **Priority:** P1
- **Affected File:** [`backend/app/core/config.py#L68,L87-L111`](file:///e:/OS%20PROJECT/backend/app/core/config.py#L68)
- **Description:** `ENROLLMENT_SECRET` defaults to `"agenttrust-enrollment-secret-key-32chars-minimum"`. While `validate_production_security()` enforces high entropy for `SECRET_KEY`, it never validates `ENROLLMENT_SECRET`.
- **Impact:** Rogue browser extensions and endpoints can enroll themselves on production instances.
- **Recommended Remediation:** Add `ENROLLMENT_SECRET` validation to `validate_production_security()`.
