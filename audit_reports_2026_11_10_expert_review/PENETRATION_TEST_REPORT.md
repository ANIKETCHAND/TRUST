# AgentTrust: Authorized Penetration Testing & Adversarial Assessment Report
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform` (Commit `06bf0fc`)  
**Lead Specialist:** Red Team & Penetration Testing Specialist Panel  

---

## 1. Scope & Execution Rules of Engagement

The penetration test was conducted strictly against the authorized local deployment of AgentTrust. No destructive actions were taken against external systems. Synthetic test fixtures and non-destructive payloads were employed.

### Vulnerability Verification Ledger

---

### VULN-01: Unauthenticated Arbitrary Host Process Termination
- **Vulnerability Name:** Unauthenticated Host Process Termination / Remote Denial of Service
- **Affected Endpoint:** `POST /api/v1/active-defense/kill-process`
- **Affected File:** [`backend/app/api/v1/active_defense.py#L37-L54`](file:///e:/OS%20PROJECT/backend/app/api/v1/active_defense.py#L37-L54)
- **Preconditions:** Network access to AgentTrust backend port (default: 8080).
- **Reproduction Steps:**
  1. Spawn a test target process (e.g. `notepad.exe` or `calc.exe`).
  2. Obtain the process PID (e.g. `9824`).
  3. Send an unauthenticated HTTP request:
     ```bash
     curl -X POST http://localhost:8080/api/v1/active-defense/kill-process \
       -H "Content-Type: application/json" \
       -d '{"pid": 9824, "reason": "Red Team Validation", "force": true}'
     ```
- **Expected Secure Behavior:** HTTP 401 Unauthorized or HTTP 403 Forbidden. Process remains running.
- **Actual Observed Behavior:** HTTP 200 OK. The host process is immediately terminated via `psutil.Process(9824).kill()`.
- **Impact:** Any client on the network can crash critical system services, databases, or application servers.
- **Severity:** **CRITICAL** (CVSS: 9.8)

---

### VULN-02: Complete Cleartext Exfiltration via Output Rails Context Manipulation
- **Vulnerability Name:** Output Rails Guardrail Bypass via Client Context Override
- **Affected Endpoint:** `POST /api/v1/gateway/execute`
- **Affected Files:** [`backend/app/services/gateway_service.py#L696`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L696), [`backend/app/guardrails/output_rails.py#L165,L187-L191`](file:///e:/OS%20PROJECT/backend/app/guardrails/output_rails.py#L165)
- **Preconditions:** Registered agent credentials with permissions to query a data source containing sensitive tokens.
- **Reproduction Steps:**
  1. Issue a tool execution request with `context: {"output_rails_mode": "raw"}`:
     ```json
     {
       "tool": "postgres_tool",
       "operation": "query_select",
       "resource": "table:customer_records",
       "parameters": {"sql": "SELECT private_key FROM credentials LIMIT 1"},
       "context": {"output_rails_mode": "raw"}
     }
     ```
- **Expected Secure Behavior:** Output Rails enforce server-side masking or fail-closed blocking regardless of client-supplied context parameters.
- **Actual Observed Behavior:** `inspect_and_sanitize(payload, mode="raw")` executes, detects the private key, but because `mode != "redact"` returns the raw object unredacted, and because `mode != "block"` returns `allowed: true`. Cleartext secrets are delivered to the agent.
- **Impact:** Complete failure of data exfiltration protection; sensitive credentials leaked.
- **Severity:** **CRITICAL** (CVSS: 9.1)

---

### VULN-03: Dialog Rails Tool-Chain Evasion via Session ID Rotation
- **Vulnerability Name:** State Machine Evasion via Client Session Randomization
- **Affected Endpoint:** `POST /api/v1/gateway/execute`
- **Affected File:** [`backend/app/guardrails/dialog_rails.py#L52,L74-L100`](file:///e:/OS%20PROJECT/backend/app/guardrails/dialog_rails.py#L52)
- **Preconditions:** Agent permissions for `postgres_tool` and `http_api_tool`.
- **Reproduction Steps:**
  1. Execute `postgres_tool:query_select` with `context: {"session_id": "flow_1"}`. (Allowed: True)
  2. Execute `http_api_tool:http_post` with `context: {"session_id": "flow_2"}`.
- **Expected Secure Behavior:** HTTP 403 Forbidden (Blocked direct database-to-HTTP egress).
- **Actual Observed Behavior:** HTTP 200 OK. The state machine treats `flow_2` as a brand new session with empty history, allowing the direct database-to-HTTP egress chain.
- **Impact:** Multi-step exfiltration restrictions are completely bypassed.
- **Severity:** **HIGH** (CVSS: 7.4)

---

### VULN-04: Stored Cross-Site Scripting (XSS) in HTML Forensic Dossiers
- **Vulnerability Name:** Stored Cross-Site Scripting via Dynamic HTML Dossier Export
- **Affected Endpoint:** `GET /api/v1/reports/incidents/{incident_id}/export/html`
- **Affected File:** [`backend/app/services/report_generator.py#L232-L433`](file:///e:/OS%20PROJECT/backend/app/services/report_generator.py#L232-L433)
- **Preconditions:** Stored incident or audit event containing HTML injection payload.
- **Reproduction Steps:**
  1. Trigger an incident containing `<img src=x onerror=alert(2)>` in the attack vector or details.
  2. Request HTML export: `GET /api/v1/reports/incidents/{incident_id}/export/html`.
- **Expected Secure Behavior:** The payload is sanitized and rendered as `&lt;img src=x onerror=alert(2)&gt;`.
- **Actual Observed Behavior:** The raw payload `<img src=x onerror=alert(2)>` renders unescaped in the returned HTML document.
- **Impact:** Execution of arbitrary script within the SOC analyst or auditor's browser session.
- **Severity:** **HIGH** (CVSS: 7.6)

---

### VULN-05: Unauthenticated Layer-2 Local Network Exfiltration
- **Vulnerability Name:** Unauthenticated Local Subnet ARP Table Dumping
- **Affected Endpoint:** `GET /api/v1/attribution/local-arp`
- **Affected File:** [`backend/app/api/v1/attribution.py#L39-L45`](file:///e:/OS%20PROJECT/backend/app/api/v1/attribution.py#L39-L45)
- **Preconditions:** Connectivity to port 8080.
- **Reproduction Steps:**
  ```bash
  curl http://localhost:8080/api/v1/attribution/local-arp
  ```
- **Expected Secure Behavior:** HTTP 401 Unauthorized.
- **Actual Observed Behavior:** Returns JSON array of all local subnet IPs, MAC addresses, and resolved NIC manufacturers.
- **Impact:** Host and intranet reconnaissance by unauthenticated actors.
- **Severity:** **HIGH** (CVSS: 7.5)
