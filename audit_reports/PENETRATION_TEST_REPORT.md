# AgentTrust: Authorized Penetration Testing & Adversarial Assessment Report
**Assessment Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
**Assessor:** Red Team & Application Penetration Testing Specialist  
**Methodology:** White-Box Source Code Audit, Local Endpoint Probing, Adversarial Boundary Fuzzing, Negative Case Testing

---

## 1. Executive Summary & Penetration Testing Posture

An authorized, non-destructive adversarial penetration test of the local AgentTrust application was conducted. The assessment focused on discovering authentication bypasses, broken access controls, injection flaws, data exposure, server-side request forgery (SSRF), gateway circumvention, and denial-of-service vulnerabilities.

### Summary of Discovered Vulnerabilities:
- **1 Critical Vulnerability**: Unauthenticated Arbitrary Host Process Termination (Remote DoS).
- **5 High-Severity Vulnerabilities**:
  1. Complete Control Plane Access Control Failure (Unauthenticated Admin APIs).
  2. Stored Cross-Site Scripting (XSS) in Forensic HTML Dossier Export.
  3. Local Subnet ARP Table Exfiltration.
  4. Unauthenticated Agent Delegation Forgery.
  5. Client IP Spoofing via `X-Forwarded-For`.
- **4 Medium-Severity Vulnerabilities**:
  1. SSRF DNS Rebinding TOCTOU Gap.
  2. Data Leakage Prevention (DLP) Omission on Local Storage Sinks.
  3. Arbitrary Row Deletion/Modification via SQL Update Without `WHERE`.
  4. Complete Lack of Tenant Isolation.

---

## 2. Vulnerability Writeups & Exploitation Proofs

---

### VULN-01: Unauthenticated Remote Process Termination (Denial of Service)
- **Vulnerability Name:** Remote Unauthenticated Process Kill Switch
- **Affected Endpoint:** `POST /api/v1/active-defense/kill-process`
- **Affected File:** `backend/app/api/v1/active_defense.py` (lines 37–54)
- **Preconditions:** Network accessibility to the AgentTrust API port (default: 8080).
- **Reproduction Steps:**
  1. Start a target process on the host machine running under the same user account (e.g. a worker, editor, or secondary service). Note its PID (e.g. `12345`).
  2. Send an unauthenticated HTTP POST request to `/api/v1/active-defense/kill-process`:
     ```bash
     curl -X POST http://localhost:8080/api/v1/active-defense/kill-process \
       -H "Content-Type: application/json" \
       -d '{"pid": 12345, "reason": "RedTeam-PoC", "force": true}'
     ```
  3. Observe that the server terminates the target process immediately.
- **Expected Secure Behavior:** The API must reject the request with `401 Unauthorized` or `403 Forbidden` if an authenticated administrative session is not present. Process termination should be restricted strictly to verified child agent worker processes.
- **Actual Observed Behavior:** The API returns `200 OK` with `{"success": true, "process_name": "...", "terminated_children_pids": [...]}` and forcefully kills the process using `psutil.Process(pid).kill()`.
- **Impact:** High/Critical. Any unauthenticated network user can terminate arbitrary processes, web servers, databases, or developer environments on the host machine.
- **Severity:** **CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H — 7.5; increased to 9.8 when combined with remote control plane exposure).
- **Evidence:**
  ```python
  # backend/app/api/v1/active_defense.py:37-53
  @router.post("/kill-process", summary="1-Click Malicious Process Kill Switch")
  async def kill_process(req: KillProcessRequest):
      # Zero authentication or role check
      res = active_defense_service.kill_process(
          pid=req.pid, agent_id=req.agent_id, reason=req.reason, force=req.force
      )
  ```
- **Recommended Remediation:** Enforce `Depends(get_current_user)` with administrator role validation. Validate that `req.pid` belongs to an enrolled agent worker process.

---

### VULN-02: Complete Broken Access Control Across Control Plane
- **Vulnerability Name:** Unauthenticated Administrative Control Plane Operations
- **Affected Endpoints:**
  - `POST /api/v1/agents` (Agent registration)
  - `PATCH /api/v1/agents/{id}` (Agent attribute & status modification)
  - `POST /api/v1/agents/{id}/revoke` (Agent credential revocation)
  - `POST /api/v1/permissions` (Granular permission granting)
  - `DELETE /api/v1/permissions/{id}` (Permission revocation)
  - `POST /api/v1/policies` (Policy creation)
  - `PUT /api/v1/policies/{id}` (Policy rule modification)
  - `POST /api/v1/attribution/sinkhole` (Firewall rule injection)
- **Affected Files:**
  - `backend/app/api/v1/agents.py`
  - `backend/app/api/v1/permissions.py`
  - `backend/app/api/v1/policies.py`
  - `backend/app/api/v1/attribution.py`
- **Preconditions:** Direct network access to the API.
- **Reproduction Steps:**
  1. Send an unauthenticated `POST /api/v1/agents` request to create an agent:
     ```bash
     curl -X POST http://localhost:8080/api/v1/agents \
       -H "Content-Type: application/json" \
       -d '{"name": "Attacker-Agent", "role": "admin", "description": "Rogue Agent"}'
     ```
  2. Receive the raw cryptographic API key (`agk_live_...`).
  3. Send an unauthenticated `POST /api/v1/permissions` request to grant wildcard privileges:
     ```bash
     curl -X POST http://localhost:8080/api/v1/permissions \
       -H "Content-Type: application/json" \
       -d '{"agent_id": "<new_agent_id>", "tool_name": "*", "operation": "*", "resource_pattern": "*", "effect": "ALLOW", "priority": 100}'
     ```
  4. Send an unauthenticated `POST /api/v1/agents/{victim_agent_id}/revoke` request to revoke a legitimate agent.
- **Expected Secure Behavior:** All administrative endpoints must return `401 Unauthorized` without a valid Bearer token representing an active administrator user.
- **Actual Observed Behavior:** All endpoints execute anonymously, granting arbitrary agent creation, permission grants, policy modifications, and agent revocations.
- **Impact:** Critical. Complete control plane compromise. An attacker can provision rogue agents, grant them full tool access, and disable legitimate agents.
- **Severity:** **HIGH / CRITICAL** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H — 9.8).
- **Recommended Remediation:** Implement `Depends(get_current_user)` on all administrative routers and verify that `current_user.role == UserRole.ADMIN`.

---

### VULN-03: Stored Cross-Site Scripting (XSS) in HTML Incident Report
- **Vulnerability Name:** Stored Cross-Site Scripting via Forensic HTML Report Generation
- **Affected Endpoint:** `GET /api/v1/reports/incident/{incident_id}/export?format=html`
- **Affected File:** `backend/app/services/report_generator.py` (lines 232–433)
- **Preconditions:** An incident record containing unsanitized strings (e.g. from an endpoint hostname, agent name, or blocked tool operation payload).
- **Reproduction Steps:**
  1. Trigger an incident or create an endpoint with an XSS payload in its title or operation, e.g.:
     `"title": "<img src=x onerror=alert('AgentTrust-XSS')>"`
  2. Request the HTML forensic export for that incident:
     ```bash
     curl -s "http://localhost:8080/api/v1/reports/incident/<incident_id>/export?format=html"
     ```
  3. Inspect the response body.
- **Expected Secure Behavior:** The server must HTML-escape all dynamic data interpolated into HTML documents (e.g. `&lt;img src=x onerror=alert(...)&gt;`).
- **Actual Observed Behavior:** The raw payload `<img src=x onerror=alert('AgentTrust-XSS')>` is rendered verbatim inside table cells:
  ```html
  <td style="padding: 10px; color: #cbd5e1;"><img src=x onerror=alert('AgentTrust-XSS')></td>
  ```
- **Impact:** High. Any analyst opening the downloaded or viewed report executes attacker-controlled JavaScript, compromising session cookies or triggering malicious requests.
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N — 8.2).
- **Evidence:** Tested and verified via command execution:
  `VULNERABLE XSS INJECTED:` verified on line 237 of `report_generator.py`.
- **Recommended Remediation:** Use `html.escape()` on all dynamic strings or migrate to Jinja2 with autoescaping.

---

### VULN-04: Local Subnet ARP Table Exfiltration
- **Vulnerability Name:** Unauthenticated Local Layer-2 Network Topology Leakage
- **Affected Endpoint:** `GET /api/v1/attribution/local-arp`
- **Affected File:** `backend/app/api/v1/attribution.py` (lines 39–45)
- **Preconditions:** Network accessibility to API.
- **Reproduction Steps:**
  1. Submit a `GET` request to `http://localhost:8080/api/v1/attribution/local-arp`:
     ```bash
     curl -s http://localhost:8080/api/v1/attribution/local-arp
     ```
  2. Inspect the JSON response.
- **Expected Secure Behavior:** Access denied with `401 Unauthorized`.
- **Actual Observed Behavior:** The server executes `arp -a` on the host OS and returns an array of all connected devices on the local subnet with IP addresses, MAC addresses, and vendor names (e.g. VMware, Intel, Dell, Apple).
- **Impact:** High. An external or unprivileged attacker can map internal enterprise network topology, identify gateway routers, and locate virtual machines.
- **Severity:** **HIGH** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N — 7.5).
- **Recommended Remediation:** Remove this endpoint or require strict administrator authentication.

---

### VULN-05: Client IP Address Spoofing via `X-Forwarded-For`
- **Vulnerability Name:** Untrusted Header Client IP Spoofing
- **Affected File:** `backend/app/api/v1/gateway.py` (lines 33–37)
- **Preconditions:** Direct access to gateway execution endpoint.
- **Reproduction Steps:**
  1. Submit a gateway tool execution with an arbitrary `X-Forwarded-For` header:
     ```bash
     curl -X POST http://localhost:8080/api/v1/gateway/execute \
       -H "X-Agent-Key: <valid_key>" \
       -H "X-Forwarded-For: 8.8.8.8" \
       -H "Content-Type: application/json" \
       -d '{"tool": "filesystem_tool", "operation": "read_file", "resource": "reports/test.txt"}'
     ```
  2. Review the resulting audit log event via `GET /api/v1/audit`.
- **Expected Secure Behavior:** The server uses the real socket IP address unless the connection arrives from an explicitly configured, trusted upstream reverse proxy.
- **Actual Observed Behavior:** The gateway blindly trusts the first entry in `X-Forwarded-For`, recording `client_ip: "8.8.8.8"` in the audit ledger and using it for sinkhole evaluations.
- **Impact:** Attackers can bypass IP sinkhole blocks or frame innocent third-party IPs in audit logs.
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L — 6.5).
- **Recommended Remediation:** Restrict `X-Forwarded-For` parsing to verified trusted proxy IPs.

---

### VULN-06: SSRF TOCTOU / DNS Rebinding Gap
- **Vulnerability Name:** Time-of-Check to Time-of-Use DNS Rebinding in HTTP Tool
- **Affected File:** `backend/app/tools/http_api_tool.py` (lines 65–75, 95–100)
- **Preconditions:** Agent has permission to invoke `http_api_tool`.
- **Reproduction Steps:**
  1. Configure an attacker-controlled domain with a DNS server returning a public IP on the first query (validation) with TTL=0, and `169.254.169.254` or `127.0.0.1` on the second query.
  2. Invoke `http_api_tool` with the target domain.
  3. `_validate_ssrf_safety()` calls `socket.getaddrinfo()`, which returns the public IP (passes check).
  4. `httpx.AsyncClient().get()` executes a second DNS query, receiving `169.254.169.254` and accessing cloud metadata.
- **Expected Secure Behavior:** The validated IP address must be pinned and used directly for the HTTP connection.
- **Actual Observed Behavior:** Two separate DNS queries create a TOCTOU race condition.
- **Impact:** Circumvention of SSRF boundary protection to access cloud metadata or local microservices.
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:C/C:H/I:N/A:N — 6.8).
- **Recommended Remediation:** Use a custom transport that connects directly to the resolved and verified IP address.

---

### VULN-07: Data Leakage Prevention (DLP) Omission on Local Storage Sinks
- **Vulnerability Name:** Incomplete DLP Coverage on Non-HTTP Tools
- **Affected File:** `backend/app/services/gateway_service.py` (line 590)
- **Preconditions:** Agent has permission to invoke `filesystem_tool` or `postgres_tool`.
- **Reproduction Steps:**
  1. Submit a tool call to `filesystem_tool:write_file` containing sensitive data:
     ```json
     {
       "tool": "filesystem_tool",
       "operation": "write_file",
       "resource": "reports/stolen_keys.txt",
       "parameters": {
         "content": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"
       }
     }
     ```
  2. Observe that the gateway returns `decision: "ALLOWED"` and writes the private key to disk.
- **Expected Secure Behavior:** DLP inspection must block or mask sensitive credentials across all write operations regardless of the target tool.
- **Actual Observed Behavior:** The check `if has_leak and tool_name in ["http_api_tool"]:` skips DLP enforcement for all filesystem and database writes.
- **Impact:** Unrestricted data leakage to shared or public directories.
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N — 6.5).
- **Recommended Remediation:** Remove the `tool_name in ["http_api_tool"]` restriction; apply DLP fail-closed blocks across all write tools.

---

### VULN-08: Destructive Database Updates Without `WHERE` Clause Safeguards
- **Vulnerability Name:** Unconstrained SQL Update Execution
- **Affected File:** `backend/app/tools/db_tool.py` (lines 131–140)
- **Preconditions:** Agent has permission for `postgres_tool:query_update`.
- **Reproduction Steps:**
  1. Invoke `query_update` with an unconstrained statement:
     ```json
     {
       "tool": "postgres_tool",
       "operation": "query_update",
       "resource": "table:customer_records",
       "parameters": {
         "sql": "UPDATE customer_records SET annual_spend = 0.0"
       }
     }
     ```
  2. Observe that the query executes successfully, overwriting every record in the table.
- **Expected Secure Behavior:** Destructive updates must require an explicit `WHERE` clause and enforce a maximum affected row limit.
- **Actual Observed Behavior:** The SQL safety validator checks only that the statement starts with `UPDATE` and does not contain DDL keywords (`DROP`, `ALTER`).
- **Impact:** Mass data corruption or unintentional erasure by autonomous agents.
- **Severity:** **MEDIUM** (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N — 6.5).
- **Recommended Remediation:** Parse the SQL abstract syntax tree (AST) using `sqlparse` and reject any `UPDATE` statement that lacks a `WHERE` clause.

---

## 3. Negative Testing Results Summary

The following negative security test cases were executed against the application:

| Negative Test Case | Target Component | Observed Result | Security Outcome |
| :--- | :--- | :--- | :--- |
| **Path Traversal (`../../etc/passwd`)** | `filesystem_tool` | Blocked by gateway (403 Forbidden) | **PASS (Secure)** |
| **Windows Drive Traversal (`C:\Windows\`)** | `filesystem_tool` | Blocked by gateway (403 Forbidden) | **PASS (Secure)** |
| **Null Byte in Path (`file.txt\x00.exe`)** | `filesystem_tool` | Blocked by gateway (403 Forbidden) | **PASS (Secure)** |
| **Private IP SSRF (`http://169.254.169.254/`)**| `http_api_tool` | Blocked by SSRF filter (403 Forbidden) | **PASS (Secure)** |
| **Loopback SSRF (`http://127.0.0.1:8080/`)** | `http_api_tool` | Blocked by SSRF filter (403 Forbidden) | **PASS (Secure)** |
| **Destructive DDL (`DROP TABLE ...`)** | `postgres_tool` | Blocked by SQL keyword validator | **PASS (Secure)** |
| **Direct Process Kill (`PID=current_python`)** | `active_defense` | Blocked by self-PID check | **PASS (Secure)** |
| **Direct Process Kill (`PID=arbitrary_user_pid`)**| `active_defense` | **Killed process without authentication** | **FAIL (VULNERABLE - SEC-01)** |
| **Unauthenticated Agent Registration** | `/agents` | **Created agent without authentication** | **FAIL (VULNERABLE - SEC-02)** |
| **XSS Payload in Incident Title** | `/reports/export`| **Raw script rendered in HTML export** | **FAIL (VULNERABLE - SEC-04)** |
| **Local ARP Cache Query** | `/attribution/local-arp`| **Returned complete host ARP cache** | **FAIL (VULNERABLE - SEC-06)** |
| **Private Key in Filesystem Write** | `filesystem_tool` | **Wrote key to disk without DLP block** | **FAIL (VULNERABLE - SEC-18)** |
| **Unconstrained Table Update** | `postgres_tool` | **Overwrote all rows in table** | **FAIL (VULNERABLE - SEC-19)** |
