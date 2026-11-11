# AgentTrust Security Findings: Ranked Top 25 Vulnerabilities & Weaknesses
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
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
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Unauthenticated Arbitrary Host Process Termination | Access Control / DoS | **CRITICAL** | P0 | Small |
| **SEC-02** | Broken Access Control Across All Core Admin APIs | Access Control | **CRITICAL** | P0 | Medium |
| **SEC-03** | Architectural Disconnect: Policy UI Has Zero Gateway Enforcement | Architecture / Logic | **CRITICAL** | P0 | Large |
| **SEC-04** | Stored XSS in Incident Report HTML Export | Injection / XSS | **HIGH** | P1 | Small |
| **SEC-05** | Database Migration Desynchronization & Runtime Crash | Database / Reliability | **HIGH** | P0 | Medium |
| **SEC-06** | Unauthenticated Layer-2 Local ARP Network Exfiltration | Information Disclosure| **HIGH** | P1 | Small |
| **SEC-07** | Hardcoded Enrollment Secret & Missing Production Validation | Cryptography / Secrets | **HIGH** | P1 | Small |
| **SEC-08** | Client IP Spoofing via Untrusted `X-Forwarded-For` Header | Network / Spoofing | **HIGH** | P1 | Small |
| **SEC-09** | Unauthenticated Delegation Grant Forgery & Escalation | Authorization | **HIGH** | P1 | Medium |
| **SEC-10** | Complete Absence of Multi-Tenancy & Tenant Isolation | Architecture | **HIGH** | P2 | Large |
| **SEC-11** | Frontend Missing from Docker Compose Production Build | DevSecOps | **HIGH** | P1 | Medium |
| **SEC-12** | Complete Absence of User Authentication in Frontend Dashboard | Authentication / UI | **HIGH** | P1 | Medium |
| **SEC-13** | Fabricated ClamAV & YARA Antivirus Status | Integrity / Assurance | **MEDIUM** | P2 | Medium |
| **SEC-14** | Fabricated Geolocation & Threat Scoring via IP Octet Math | Integrity / Assurance | **MEDIUM** | P2 | Small |
| **SEC-15** | Prompt Injection Detection Relies on 6 Trivial Regexes | AI Security | **MEDIUM** | P1 | Large |
| **SEC-16** | Model Context Protocol (MCP) Tool Bridge Is a Stub | Integration / Mock | **MEDIUM** | P2 | Large |
| **SEC-17** | Pipelock AI Sidecar Disconnected from Execution Gateway | Integration / Logic | **MEDIUM** | P2 | Medium |
| **SEC-18** | Data Leakage Prevention (DLP) Ignored on Filesystem and Database Sinks | DLP / Exfiltration | **MEDIUM** | P1 | Small |
| **SEC-19** | Destructive Database Updates Without `WHERE` Clause Safeguards | Data Integrity | **MEDIUM** | P2 | Small |
| **SEC-20** | Non-Functional Endpoint Containment on Managed Devices | Endpoint Security | **MEDIUM** | P2 | Medium |
| **SEC-21** | Browser Shield Easily Bypassed via Debounce Race or Toggle | Endpoint Security | **MEDIUM** | P2 | Medium |
| **SEC-22** | SSRF Protection Susceptible to DNS Rebinding TOCTOU | SSRF / Network | **MEDIUM** | P2 | Medium |
| **SEC-23** | In-Memory Volatility of Dialog Rails & Active Defense State | Reliability / Scale | **MEDIUM** | P2 | Medium |
| **SEC-24** | Unsubstantiated "Tamper-Evident" Audit Log Claims | Compliance / Integrity| **LOW** | P3 | Medium |
| **SEC-25** | Unpinned Python Dependencies & Missing CI/CD Security Pipeline | Supply Chain | **LOW** | P2 | Small |

---

## Detailed Technical Findings

### SEC-01: Unauthenticated Arbitrary Host Process Termination
- **Category:** Access Control / Denial of Service
- **Severity:** **CRITICAL** (CVSS 9.8)
- **Priority:** P0 (Immediate Hotfix)
- **Affected Endpoint:** `POST /api/v1/active-defense/kill-process`
- **Affected File:** `backend/app/api/v1/active_defense.py` (lines 37–54)
- **Description:** The `/active-defense/kill-process` endpoint accepts a target PID and a boolean force flag. It performs no credential verification, token validation, or user role check. It immediately invokes `active_defense_service.kill_process()`, which calls `psutil.Process(pid).kill()`.
- **Evidence:**
  ```python
  # backend/app/api/v1/active_defense.py:37-54
  @router.post("/kill-process", summary="1-Click Malicious Process Kill Switch")
  async def kill_process(req: KillProcessRequest):
      import os
      if req.pid <= 4 or req.pid == os.getpid():
          raise HTTPException(status_code=400, detail="Protected system or AgentTrust platform PID cannot be terminated.")
      res = active_defense_service.kill_process(
          pid=req.pid, agent_id=req.agent_id, reason=req.reason, force=req.force
      )
  ```
- **Business Impact:** Any malicious actor with network access to the API can terminate critical operating system processes, database instances, web services, or developer tools running under the server's user context, causing immediate denial of service.
- **Technical Impact:** Arbitrary local process termination without authorization or audit attribution.
- **Recommended Remediation:**
  1. Add mandatory administrative authentication dependency (`Depends(get_current_user)`).
  2. Restrict process termination strictly to child PIDs tracked in an enrolled agent execution registry.
  3. Validate that the requesting user possesses administrative permissions.
- **Estimated Effort:** Small (1–2 days).

---

### SEC-02: Broken Access Control Across All Core Admin APIs
- **Category:** Broken Access Control
- **Severity:** **CRITICAL** (CVSS 9.1)
- **Priority:** P0
- **Affected Endpoints:** `POST /api/v1/agents`, `PATCH /api/v1/agents/{id}`, `POST /api/v1/agents/{id}/revoke`, `POST /api/v1/permissions`, `DELETE /api/v1/permissions/{id}`, `POST /api/v1/policies`, `PUT /api/v1/policies/{id}`, `POST /api/v1/attribution/sinkhole`.
- **Affected Files:**
  - `backend/app/api/v1/agents.py` (lines 19–87)
  - `backend/app/api/v1/permissions.py` (lines 13–65)
  - `backend/app/api/v1/policies.py` (lines 37–136)
  - `backend/app/api/v1/attribution.py` (lines 55–82)
- **Description:** All control plane endpoints for provisioning agents, granting permissions, altering policies, and issuing sinkhole commands have no authentication dependency. The function `get_current_user` in `deps.py` is defined but **not used on a single API router in the entire application**.
- **Evidence:**
  ```python
  # backend/app/api/v1/agents.py:19-23
  @router.post("", response_model=AgentRegistrationResponse, status_code=status.HTTP_201_CREATED)
  async def register_agent(req: AgentCreate, db: AsyncSession = Depends(get_db)):
      registration = await agent_service.register_agent(db, req)
      return registration
  ```
- **Business Impact:** Zero trust boundary on the management plane. Any network client can revoke legitimate enterprise agents, create rogue agents with unrestricted permissions, or delete existing security rules.
- **Technical Impact:** Complete control plane takeover by unauthenticated callers.
- **Recommended Remediation:** Enforce `current_user: User = Depends(get_current_user)` on every management router. Implement RBAC checking that `current_user.role == UserRole.ADMIN`.
- **Estimated Effort:** Medium (3–4 days).

---

### SEC-03: Architectural Disconnect: Policy UI Has Zero Gateway Enforcement
- **Category:** Architectural Defect / Security Illusion
- **Severity:** **CRITICAL** (CVSS 8.6)
- **Priority:** P0
- **Affected Files:**
  - `backend/app/api/v1/policies.py` (lines 37–136)
  - `backend/app/models/policy.py` (lines 13–43)
  - `backend/app/services/policy_engine.py` (lines 92–158)
  - `frontend/src/components/tabs/PoliciesTab.tsx` (lines 64–89)
- **Description:** The platform presents a "Security Policies" management tab in the frontend where administrators can edit JSON policy rules (e.g. `allowed_prefixes`, `forbidden_statements`, `max_rows_per_query`). These are saved to the `policies` and `policy_versions` database tables. However, when an agent executes a tool via `/api/v1/gateway/execute`, `policy_engine.evaluate()` **only queries the `permissions` table** (`Permission` model). It never queries the `policies` table. Modifications made in the policy editor are completely ignored by the execution gateway.
- **Evidence:**
  ```python
  # backend/app/services/policy_engine.py:94-105
  stmt = (
      select(Permission)
      .where(
          or_(Permission.agent_id == agent.id, Permission.agent_id.is_(None)),
          Permission.is_active == True,
          or_(Permission.expires_at.is_(None), Permission.expires_at > now)
      )
      .order_by(Permission.priority.desc())
  )
  result = await db.execute(stmt)
  permissions: List[Permission] = list(result.scalars().all())
  # Policy and PolicyVersion tables are NEVER queried.
  ```
- **Business Impact:** Administrators believe they have applied protective policies, but the gateway ignores them entirely, creating a catastrophic false sense of security.
- **Technical Impact:** The policy configuration subsystem is an architectural dead end.
- **Recommended Remediation:** Either unify `Policy` and `Permission` into a single unified schema evaluated by `PolicyEngine`, or implement a policy compilation engine that translates `Policy.rules` into active `Permission` records upon commitment.
- **Estimated Effort:** Large (1–2 weeks).

---

### SEC-04: Stored Cross-Site Scripting (XSS) in Incident Report HTML Export
- **Category:** Injection / Cross-Site Scripting
- **Severity:** **HIGH** (CVSS 7.6)
- **Priority:** P1
- **Affected Endpoint:** `GET /api/v1/reports/incident/{incident_id}/export?format=html`
- **Affected File:** `backend/app/services/report_generator.py` (lines 232–433)
- **Description:** The incident export service dynamically renders an HTML dossier. It formats attacker-controllable strings—such as `incident['title']`, `incident['agent_name']`, `incident['client_ip']`, and timeline event details—directly into the HTML output using Python f-strings without HTML escaping (`html.escape` is never called).
- **Evidence:**
  ```python
  # backend/app/services/report_generator.py:232-243
  timeline_rows = "".join([
      f"""
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 10px; font-family: monospace; color: #38bdf8;">{t['timestamp'][:19]}</td>
        <td style="padding: 10px; font-weight: 600; color: #f1f5f9;">{t['phase']}</td>
        <td style="padding: 10px; color: #cbd5e1;">{t['event']}</td>
        ...
      </tr>
      """
      for t in dossier["timeline"]
  ])
  ```
  Verified via test payload `<img src=x onerror=alert(2)>`, which renders raw unescaped HTML in output.
- **Business Impact:** When a SOC analyst or administrator downloads or views an exported incident dossier, attacker-injected JavaScript executes within their browser session, risking credential theft or control plane manipulation.
- **Technical Impact:** Stored Cross-Site Scripting in forensic artifacts.
- **Recommended Remediation:** Use Jinja2 templates with automatic HTML escaping enabled by default, or explicitly apply `html.escape()` to all dynamic values.
- **Estimated Effort:** Small (1 day).

---

### SEC-05: Database Migration Desynchronization & Runtime Crash
- **Category:** Database / System Reliability
- **Severity:** **HIGH** (CVSS 7.5)
- **Priority:** P0
- **Affected Files:**
  - `backend/alembic/versions/`
  - `backend/agenttrust.db`
  - `backend/app/models/delegation.py` (line 33)
  - `backend/scripts/demo_full_platform.py` (line 148)
- **Description:** The SQLite database file shipped in the repository (`backend/agenttrust.db`) was generated from an older schema version where the `delegations` table lacked `parent_delegation_id`. Furthermore, the `alembic_version` stored in the database references revision `baa8a3fbd940`, which does not exist in `alembic/versions/`. Running migrations with `alembic upgrade head` fails with `Can't locate revision identified by 'baa8a3fbd940'`. Attempting to insert a delegation via the API or demo script crashes the application with `sqlite3.OperationalError: table delegations has no column named parent_delegation_id`.
- **Evidence:**
  Command execution output:
  `ERROR [alembic.util.messaging] Can't locate revision identified by 'baa8a3fbd940'`
  `FAILED: Can't locate revision identified by 'baa8a3fbd940'`
  Demo script crash output:
  `sqlite3.OperationalError: table delegations has no column named parent_delegation_id`
- **Business Impact:** Out-of-the-box system crash when executing multi-agent delegations against the shipped database.
- **Technical Impact:** Database schema desynchronization, broken migration pipeline.
- **Recommended Remediation:**
  1. Re-initialize Alembic migration chain.
  2. Include proper migration scripts for SQLite and PostgreSQL.
  3. Never ship stale local database files in source repositories.
- **Estimated Effort:** Medium (2–3 days).

---

### SEC-06: Unauthenticated Layer-2 Local ARP Network Exfiltration
- **Category:** Information Disclosure
- **Severity:** **HIGH** (CVSS 7.5)
- **Priority:** P1
- **Affected Endpoint:** `GET /api/v1/attribution/local-arp`
- **Affected File:** `backend/app/api/v1/attribution.py` (lines 39–45) and `backend/app/services/attribution_service.py` (lines 102–151)
- **Description:** The `/attribution/local-arp` endpoint executes `arp -a` on the host operating system via `subprocess.run()`, parses the output, and returns the complete ARP cache (internal IP addresses, MAC addresses, and resolved hardware vendors) to unauthenticated callers.
- **Evidence:**
  ```python
  # backend/app/services/attribution_service.py:107-111
  cmd = ["arp", "-a"]
  res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
  lines = res.stdout.splitlines()
  ```
- **Business Impact:** Attackers can map the internal network topology, identify virtual machines, and discover hardware appliances without needing internal network access.
- **Technical Impact:** Unauthenticated reconnaissance and network layer leakage.
- **Recommended Remediation:** Restrict this endpoint behind strict administrator authentication or remove it entirely.
- **Estimated Effort:** Small (1 day).

---

### SEC-07: Hardcoded Enrollment Secret & Missing Production Validation
- **Category:** Cryptography / Secret Management
- **Severity:** **HIGH** (CVSS 7.4)
- **Priority:** P1
- **Affected Files:**
  - `backend/app/core/config.py` (lines 68, 87–111)
  - `backend/app/api/v1/endpoints.py` (line 114)
- **Description:** `Settings.ENROLLMENT_SECRET` defaults to `"agenttrust-enrollment-secret-key-32chars-minimum"`. While `Settings.validate_production_security()` verifies that `SECRET_KEY` is not a placeholder, **it completely omits any check on `ENROLLMENT_SECRET`**. Consequently, a production deployment that fails to explicitly set `ENROLLMENT_SECRET` silently runs with the hardcoded default. Anyone with this default secret can enroll rogue endpoints and browser extensions.
- **Evidence:**
  ```python
  # backend/app/core/config.py:68
  ENROLLMENT_SECRET: str = "agenttrust-enrollment-secret-key-32chars-minimum"
  # validate_production_security checks self.SECRET_KEY, but never self.ENROLLMENT_SECRET
  ```
- **Business Impact:** Rogue endpoints can enroll and inject false telemetry into the security control plane.
- **Technical Impact:** Compromised device enrollment trust boundary.
- **Recommended Remediation:** Add `ENROLLMENT_SECRET` to the production validator in `config.py` to enforce high entropy and reject defaults.
- **Estimated Effort:** Small (1 day).

---

### SEC-08: Client IP Spoofing via Untrusted `X-Forwarded-For` Header
- **Category:** Network Security / Spoofing
- **Severity:** **HIGH** (CVSS 7.3)
- **Priority:** P1
- **Affected File:** `backend/app/api/v1/gateway.py` (lines 33–37)
- **Description:** The gateway execution endpoint extracts the client IP address from the `X-Forwarded-For` header without checking whether the direct connecting client is an authorized reverse proxy:
  ```python
  forwarded = request.headers.get("x-forwarded-for")
  if forwarded:
      client_ip = forwarded.split(",")[0].strip()
  ```
- **Evidence:** Any caller can send `X-Forwarded-For: 1.1.1.1` to spoof their identity, circumventing sinkhole blocks or framing third-party IPs.
- **Business Impact:** Tainted audit logs, bypassed IP sinkhole defenses, and false forensic attribution.
- **Technical Impact:** Blind trust in client-supplied network headers.
- **Recommended Remediation:** Only parse `X-Forwarded-For` if the direct connection originates from a configured trusted proxy CIDR range.
- **Estimated Effort:** Small (1 day).

---

### SEC-09: Unauthenticated Delegation Grant Forgery & Escalation
- **Category:** Authorization / Delegation
- **Severity:** **HIGH** (CVSS 7.2)
- **Priority:** P1
- **Affected Endpoint:** `POST /api/v1/delegations`
- **Affected File:** `backend/app/api/v1/delegations.py` (lines 28–60)
- **Description:** An agent delegation grant allows a child agent to inherit permissions from a parent agent. However, `POST /api/v1/delegations` requires neither authentication from the parent agent nor an administrative token. Any caller knowing a parent agent's UUID can delegate that parent's permissions to a child agent, obtaining a signed delegation token.
- **Evidence:**
  ```python
  # backend/app/api/v1/delegations.py:28-32
  @router.post("", status_code=status.HTTP_201_CREATED, tags=["Delegation"])
  async def create_delegation(
      req: DelegationCreateRequest, db: AsyncSession = Depends(get_db)
  ):
      # No authentication dependency; accepts parent_agent_id directly from JSON body
  ```
- **Business Impact:** Unauthorized downstream permission grants issued on behalf of high-privilege agents without their consent.
- **Technical Impact:** Compromise of the multi-agent delegation security chain.
- **Recommended Remediation:** Require the request to be authenticated with the parent agent's API key (`X-Agent-Key`) or an administrator session.
- **Estimated Effort:** Medium (2 days).

---

### SEC-10: Complete Absence of Multi-Tenancy & Tenant Isolation
- **Category:** Architecture / Multi-Tenancy
- **Severity:** **HIGH** (CVSS 7.1)
- **Priority:** P2
- **Affected Files:** All ORM models in `backend/app/models/`
- **Description:** Despite product redesign documentation claiming a "tenant-aware API" and "tenant authorization", not a single database table in the entire system contains a `tenant_id` column. All agents, policies, tools, audit events, endpoints, and incidents coexist in a single flat namespace.
- **Evidence:** Inspection of `backend/app/models/*.py` confirms zero occurrences of `tenant_id`.
- **Business Impact:** The application cannot be deployed in any multi-tenant, SaaS, or multi-department enterprise environment. Cross-tenant data leakage is guaranteed.
- **Technical Impact:** Missing tenant isolation boundary.
- **Recommended Remediation:** Add `tenant_id` to all data models, indexes, and API schemas. Enforce row-level security (RLS) or tenant-filtering database middleware.
- **Estimated Effort:** Large (2–3 weeks).

---

### SEC-11: Frontend Missing from Docker Compose Production Build
- **Category:** DevSecOps / Deployment
- **Severity:** **HIGH** (CVSS 7.0)
- **Priority:** P1
- **Affected Files:**
  - `docker-compose.yml` (lines 22–49)
  - `Dockerfile.backend` (lines 1–21)
  - `backend/app/main.py` (lines 64–67)
- **Description:** `docker-compose.yml` defines only `postgres` and `backend` services. `Dockerfile.backend` copies only `backend/` files and does not build the frontend. Inside the container, `main.py` looks for `frontend/dist`, which does not exist. Consequently, deploying via `docker-compose up` serves only a raw JSON status response at `http://localhost:8080/`; the web UI is completely inaccessible.
- **Evidence:**
  ```python
  # backend/app/main.py:64-67
  frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
  if frontend_dist.exists():
      app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
  ```
  `Dockerfile.backend` does not copy or build `frontend/`.
- **Business Impact:** Customers attempting Docker deployment are greeted with a missing interface, making the product unusable out of the box.
- **Technical Impact:** Broken container orchestration.
- **Recommended Remediation:** Use a multi-stage Dockerfile that builds the Vite frontend and copies `dist/` into the backend image, or add a dedicated Nginx service in `docker-compose.yml`.
- **Estimated Effort:** Medium (2 days).

---

### SEC-12: Complete Absence of User Authentication in Frontend Dashboard
- **Category:** Authentication / UI Security
- **Severity:** **HIGH** (CVSS 7.0)
- **Priority:** P1
- **Affected Files:** `frontend/src/App.tsx`, `frontend/src/context/`
- **Description:** The React dashboard provides immediate access to all 16 administration consoles upon visiting the URL. There is no login view, no session check, no token storage in `localStorage` or `sessionStorage`, and no logout mechanism. Any person navigating to `http://localhost:8080` has immediate unrestricted access to all controls.
- **Evidence:** Codebase search for `login` or `token` in `frontend/src` confirms that neither authentication forms nor auth contexts exist.
- **Business Impact:** Unauthenticated web interface provides global administrative access.
- **Technical Impact:** Missing UI authentication gate.
- **Recommended Remediation:** Implement a Login tab, AuthProvider context, JWT storage, and route guards.
- **Estimated Effort:** Medium (3–4 days).

---

### SEC-13: Fabricated ClamAV & YARA Antivirus Status
- **Category:** Integrity / False Security Assurance
- **Severity:** **MEDIUM** (CVSS 6.5)
- **Priority:** P2
- **Affected Endpoint:** `GET /api/v1/integrations`
- **Affected Files:**
  - `backend/app/api/v1/integrations.py` (lines 54–60)
  - `backend/app/services/file_scanner_service.py` (lines 48–120)
- **Description:** The `/integrations` endpoint reports `ClamAV & YARA Scanner` as `enabled: True` and `status: "ACTIVE"`. In reality, neither ClamAV nor YARA is installed, imported, or executed. The scanner simply inspects the first 1,024 bytes of a file for 9 hardcoded strings. If malware is placed at offset 1,025 or uses obfuscated payloads, it is reported as `is_clean: True`.
- **Evidence:**
  ```python
  # backend/app/services/file_scanner_service.py:65
  content_preview = file_path.read_bytes()[:1024]
  # Only scans first 1KB against 9 byte strings
  ```
- **Business Impact:** Enterprises relying on this feature believe their files are being vetted by ClamAV/YARA, leaving them vulnerable to malware execution.
- **Technical Impact:** False positive clean certifications.
- **Recommended Remediation:** Either integrate real `pyclamd` / `yara-python` engines with a running daemon, or accurately report the integration as `DISABLED / NOT CONFIGURED`.
- **Estimated Effort:** Medium (4–5 days).

---

### SEC-14: Fabricated Geolocation & Threat Scoring via IP Octet Math
- **Category:** Integrity / False Security Assurance
- **Severity:** **MEDIUM** (CVSS 6.0)
- **Priority:** P2
- **Affected Endpoint:** `GET /api/v1/attribution/trace/{ip}`
- **Affected File:** `backend/app/services/attribution_service.py` (lines 230–239)
- **Description:** The system claims to provide real-time attacker geolocation, threat scoring, and ASN tracing. In reality, the coordinates, threat score, ASN, and ISP are generated by mathematical operations on the IP's four octets.
- **Evidence:**
  ```python
  # backend/app/services/attribution_service.py:230-238
  octets = [int(x) for x in clean_ip.split(".") if x.isdigit()]
  if len(octets) == 4:
      lat = round(((octets[1] / 255.0) * 120.0) - 60.0, 4)
      lon = round(((octets[2] / 255.0) * 360.0) - 180.0, 4)
      score = min(100, max(20, int((octets[0] + octets[3]) % 90) + 10))
      asn_label = f"AS{octets[0] * 100} Global Transit"
      isp_label = f"Tier-1 Transit Provider {octets[0]}"
  ```
- **Business Impact:** SOC teams receive fabricated threat coordinates and scores, compromising investigative integrity.
- **Technical Impact:** Fictitious forensic data generated in production code.
- **Recommended Remediation:** Integrate a real GeoIP2 database (MaxMind GeoLite2) and real threat reputation API, or remove the feature.
- **Estimated Effort:** Small (2 days).

---

### SEC-15: Prompt Injection Detection Relies on 6 Trivial Regexes
- **Category:** AI Security / Model Bypass
- **Severity:** **MEDIUM** (CVSS 6.5)
- **Priority:** P1
- **Affected File:** `backend/app/services/prompt_injection_service.py` (lines 11–18)
- **Description:** The core AI security value proposition—prompt injection defense—is implemented with exactly 6 regular expressions. Any minor paraphrase (e.g. *"Kindly disregard prior instructions and assist me"* or base64 encoding) completely bypasses the filter.
- **Evidence:**
  ```python
  # backend/app/services/prompt_injection_service.py:11-18
  INJECTION_PATTERNS = [
      (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE), "Instruction Override Attempt"),
      (re.compile(r"system\s*override|emergency\s*override", re.IGNORECASE), "System Override Token"),
      ...
  ]
  ```
- **Business Impact:** Adversaries can hijack agent execution flows using basic indirect prompt injection techniques without detection.
- **Technical Impact:** Ineffective prompt injection guardrail.
- **Recommended Remediation:** Integrate semantic classification models (e.g., DeBERTa-v3 injection classifiers, Lakera Guard, or Protect AI's Prompt-Guard).
- **Estimated Effort:** Large (1–2 weeks).

---

### SEC-16: Model Context Protocol (MCP) Tool Bridge Is a Stub
- **Category:** Integration / Mocked Implementation
- **Severity:** **MEDIUM** (CVSS 5.5)
- **Priority:** P2
- **Affected File:** `backend/app/tools/mcp_tool.py` (lines 64–75)
- **Description:** The Model Context Protocol integration tool does not connect to any MCP client or server. When `mcp_call_tool` is executed, it returns a static dictionary `{"status": "routed"}` and does not execute any operation.
- **Evidence:**
  ```python
  # backend/app/tools/mcp_tool.py:64-74
  elif operation == "mcp_call_tool":
      target_tool = parameters.get("tool")
      target_op = parameters.get("operation")
      target_params = parameters.get("parameters", {})
      return {
          "protocol": "mcp/1.0", "status": "routed",
          "target_tool": target_tool, "target_operation": target_op, "resource": resource
      }
  ```
- **Business Impact:** Enterprise users cannot use AgentTrust to mediate real MCP server tools.
- **Technical Impact:** Mock implementation marketed as functional capability.
- **Recommended Remediation:** Implement real MCP client integration using the official Model Context Protocol Python SDK over stdio and SSE transports.
- **Estimated Effort:** Large (2 weeks).

---

### SEC-17: Pipelock AI Sidecar Disconnected from Execution Gateway
- **Category:** Integration / Dead Code
- **Severity:** **MEDIUM** (CVSS 5.5)
- **Priority:** P2
- **Affected File:** `backend/app/services/gateway_service.py`
- **Description:** A dedicated service adapter `pipelock_service.py` exists to mediate traffic through the Pipelock AI firewall sidecar. However, `gateway_service.py` never imports or invokes `pipelock_service`. Even when `PIPELOCK_ENABLED=True`, Pipelock is never called during request execution.
- **Evidence:** `grep -r "pipelock" backend/app/services/gateway_service.py` yields zero matches.
- **Business Impact:** Setting configuration flags has no operational effect.
- **Technical Impact:** Dead integration code.
- **Recommended Remediation:** Hook `pipelock_service.inspect_egress()` into `gateway_service.py` step 4 or 7.
- **Estimated Effort:** Medium (2–3 days).

---

### SEC-18: Data Leakage Prevention (DLP) Ignored on Filesystem and Database Sinks
- **Category:** DLP / Data Exfiltration
- **Severity:** **MEDIUM** (CVSS 6.2)
- **Priority:** P1
- **Affected File:** `backend/app/services/gateway_service.py` (lines 586–612)
- **Description:** The gateway's DLP check is explicitly restricted to `tool_name in ["http_api_tool"]`. If an agent writes sensitive data (SSNs, AWS keys, private keys, credit cards) to the local filesystem (`filesystem_tool:write_file`) or inserts them into a database (`postgres_tool:query_insert`), DLP is bypassed and the operation succeeds.
- **Evidence:**
  ```python
  # backend/app/services/gateway_service.py:590
  if has_leak and tool_name in ["http_api_tool"]:
      # DLP is ONLY blocked for http_api_tool!
  ```
- **Business Impact:** Malicious or confused agents can exfiltrate sensitive credentials to public or shared filesystem locations without detection.
- **Technical Impact:** Incomplete DLP mediation boundary.
- **Recommended Remediation:** Enforce DLP inspection on all outbound tool operations, parameter payloads, and write sinks.
- **Estimated Effort:** Small (1 day).

---

### SEC-19: Destructive Database Updates Without `WHERE` Clause Safeguards
- **Category:** Data Integrity / Tool Safety
- **Severity:** **MEDIUM** (CVSS 6.0)
- **Priority:** P2
- **Affected File:** `backend/app/tools/db_tool.py` (lines 131–140)
- **Description:** While `SandboxedDatabaseTool` blocks DDL (`DROP`, `ALTER`, `TRUNCATE`), it accepts arbitrary `UPDATE` SQL without verifying the presence of a `WHERE` clause. An agent executing `UPDATE customer_records SET annual_spend = 0` will overwrite every row in the database table without restriction.
- **Evidence:**
  ```python
  # backend/app/tools/db_tool.py:131-137
  elif operation == "query_update":
      sql = parameters.get("sql", "")
      self._validate_sql_safety(sql, "query_update")
      cursor.execute(sql, params)
  ```
- **Business Impact:** Autonomous agents can accidentally or maliciously wipe entire database tables during update operations.
- **Technical Impact:** Missing semantic validation on destructive SQL DML.
- **Recommended Remediation:** Require an explicit `WHERE` clause for all `UPDATE` queries, or reject bulk updates that affect more than a configurable number of rows.
- **Estimated Effort:** Small (1 day).

---

### SEC-20: Non-Functional Endpoint Containment on Managed Devices
- **Category:** Endpoint Security / Functional Gap
- **Severity:** **MEDIUM** (CVSS 5.8)
- **Priority:** P2
- **Affected Files:**
  - `endpoint-connector/agenttrust_endpoint/service.py` (lines 32–40)
  - `backend/app/api/v1/endpoints.py` (lines 403–437)
- **Description:** When an administrator isolates an endpoint via `/api/v1/endpoints/{id}/contain`, the backend marks `device.is_contained = True`. The endpoint connector daemon receives this flag during its periodic heartbeat call, but **takes no action whatsoever**. It merely logs `Heartbeat OK`. The device is not isolated, no processes are suspended, and no network controls are applied.
- **Evidence:**
  ```python
  # endpoint-connector/agenttrust_endpoint/service.py:32-39
  async def _heartbeat_loop(self):
      while self.is_running:
          try:
              res = await self.client.send_heartbeat()
              logger.debug(f"Heartbeat OK: status={res.get('status')}")
              # No check on res.get('is_contained')!
  ```
- **Business Impact:** Administrators believe an endpoint is isolated, while the agent continues running unrestricted on the target host.
- **Technical Impact:** Non-functional incident response feature.
- **Recommended Remediation:** Implement client-side containment handlers in `service.py` that invoke `EndpointContainmentManager.suspend_agent_process()` when `is_contained` is received.
- **Estimated Effort:** Medium (3 days).

---

### SEC-21: Browser Shield Easily Bypassed via Debounce Race or Toggle
- **Category:** Endpoint Security / Bypass
- **Severity:** **MEDIUM** (CVSS 5.5)
- **Priority:** P2
- **Affected Files:**
  - `browser-shield/content.js` (lines 180–220)
  - `browser-shield/background.js` (lines 73–75)
- **Description:** Browser Shield DOM interception uses a 250ms debounce on `input` events. If a user pastes a sensitive prompt and immediately presses Enter or clicks Submit before 250ms elapses, the pre-flight check has not completed, and the prompt is transmitted. Furthermore, `background.js` allows the user to disable protection with a local toggle (`if (!protectionEnabled) return { decision: "ALLOWED" }`).
- **Evidence:**
  ```javascript
  // browser-shield/background.js:73-75
  if (!protectionEnabled) {
    return { decision: "ALLOWED", reason: "Browser Shield protection disabled by user." };
  }
  ```
- **Business Impact:** Malicious or non-compliant users can easily bypass Browser Shield controls.
- **Technical Impact:** Weak client-side enforcement boundary.
- **Recommended Remediation:** Synchronously block submission on Enter/Click until an in-flight scan completes. Enforce extension management policies that prevent users from toggling protection off.
- **Estimated Effort:** Medium (3 days).

---

### SEC-22: SSRF Protection Susceptible to DNS Rebinding TOCTOU
- **Category:** Network Security / SSRF
- **Severity:** **MEDIUM** (CVSS 5.5)
- **Priority:** P2
- **Affected File:** `backend/app/tools/http_api_tool.py` (lines 65–77, 95–100)
- **Description:** `_validate_ssrf_safety()` resolves the hostname using `socket.getaddrinfo()` to verify that the IP is not private or loopback. Once validated, `httpx.AsyncClient` makes a subsequent HTTP request, which performs an independent DNS lookup. An attacker using a DNS rebinding service (TTL=0) can return a public IP during the validation lookup and return `127.0.0.1` or `169.254.169.254` during the HTTP connection.
- **Evidence:** Time-of-check to time-of-use (TOCTOU) gap between `socket.getaddrinfo` and `httpx.AsyncClient`.
- **Business Impact:** Potential access to internal microservices and cloud metadata services.
- **Technical Impact:** Classic DNS rebinding SSRF vulnerability.
- **Recommended Remediation:** Pin the resolved IP address and connect directly to the verified IP, passing the original hostname only in the HTTP `Host` header, or use custom `httpx` transport hooks.
- **Estimated Effort:** Medium (3 days).

---

### SEC-23: In-Memory Volatility of Dialog Rails & Active Defense State
- **Category:** Reliability / Scalability
- **Severity:** **MEDIUM** (CVSS 5.0)
- **Priority:** P2
- **Affected Files:**
  - `backend/app/guardrails/dialog_rails.py` (line 52)
  - `backend/app/services/active_defense_service.py` (lines 29–31)
- **Description:** Dialog rails session histories, active IP sinkholes, and deception tarpits are stored in process-local Python dictionaries (`self._session_history`, `self._sinkholed_ips`). In a multi-worker deployment (e.g. Uvicorn with multiple workers or Kubernetes pods), each process has an isolated, divergent view. Any server restart wipes all active sinkholes and session tracking.
- **Evidence:**
  ```python
  # backend/app/guardrails/dialog_rails.py:52
  self._session_history: Dict[str, List[Tuple[str, str, float]]] = defaultdict(list)
  # backend/app/services/active_defense_service.py:29
  self._sinkholed_ips: Dict[str, Dict[str, Any]] = {}
  ```
- **Business Impact:** Security state is lost on restart; ineffective in distributed production environments.
- **Technical Impact:** State inconsistency and lack of horizontal scaling.
- **Recommended Remediation:** Back session history and sinkholes with Redis or database tables.
- **Estimated Effort:** Medium (4 days).

---

### SEC-24: Unsubstantiated "Tamper-Evident" Audit Log Claims
- **Category:** Compliance / False Security Assurance
- **Severity:** **LOW** (CVSS 3.5)
- **Priority:** P3
- **Affected File:** `backend/app/services/audit_service.py` (lines 44–64)
- **Description:** Documentation repeatedly claims "tamper-evident audit trails" and "signed audit events". In reality, audit events are inserted into a standard SQLite or PostgreSQL table with no digital signatures, no HMACs, no Merkle tree root, and no cryptographic hash chaining. Any database administrator or attacker with SQL write access can modify or delete records without detection.
- **Evidence:** Inspection of `AuditEvent` and `audit_service.py` reveals zero cryptographic signing logic.
- **Business Impact:** Failure of compliance audits (SOC 2, ISO 27001) that require true tamper-evident logging.
- **Technical Impact:** Unprotected relational audit logging.
- **Recommended Remediation:** Implement RFC 6962 Merkle tree chaining or forward logs to an immutable append-only WORM storage sink.
- **Estimated Effort:** Medium (1 week).

---

### SEC-25: Unpinned Python Dependencies & Missing CI/CD Security Pipeline
- **Category:** DevSecOps / Supply Chain Security
- **Severity:** **LOW** (CVSS 3.0)
- **Priority:** P2
- **Affected Files:** `backend/requirements.txt`, repository root
- **Description:** Dependencies in `backend/requirements.txt` use loose `>=` operators instead of pinned `==` versions with hashes. Furthermore, there are no CI workflows (`.github/workflows`), no automated dependency auditing (`pip-audit`, Dependabot), and no container scanning configurations.
- **Evidence:** `fastapi>=0.119.0`, `pydantic>=2.10.0`, `pyjwt>=2.10.0` with no lockfile or hash verification.
- **Business Impact:** Deployments are vulnerable to supply-chain attacks and breaking dependency updates.
- **Technical Impact:** Lack of build reproducibility.
- **Recommended Remediation:** Generate a locked `requirements.lock` with SHA-256 hashes using `pip-compile --generate-hashes` and implement GitHub Actions CI gates.
- **Estimated Effort:** Small (1 day).
