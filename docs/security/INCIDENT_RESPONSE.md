# AgentTrust Incident Response & Forensic Workflow
**Document Version:** 2.0.0  
**Classification:** Enterprise Security Operations Guide (SOP)  

---

## 1. Incident Lifecycle & State Machine

Every detected security violation within AgentTrust is tracked as a structured `SecurityIncident` entity. Incidents transition through a strict six-stage lifecycle:

```
[ Automated Detection Trigger ]
              |
              v
         +----------+
         |   OPEN   | <---+ (Reopened upon new evidence)
         +----------+     |
              |           |
              v           |
    +-------------------+ |
    |   ACKNOWLEDGED    | |
    +-------------------+ |
              |           |
              v           |
    +-------------------+ |
    |   INVESTIGATING   | |
    +-------------------+ |
         |         |      |
         |         +------+
         v                |
   +-----------+          |
   | CONTAINED |          |
   +-----------+          |
         |                |
         +---------+------+
                   |
         +---------+---------+
         |                   |
         v                   v
   +------------+     +----------------+
   |  RESOLVED  |     | FALSE_POSITIVE |
   +------------+     +----------------+
```

### Stage Definitions & Transition Rules:
1. **OPEN:** Initial state upon automated creation by Gateway, Endpoint Connector, or Browser Shield. Alerts on SOC dashboards.
2. **ACKNOWLEDGED:** SOC analyst has claimed the incident and commenced triage.
3. **INVESTIGATING:** In-depth forensic analysis underway. Timeline reconstruction, provenance graph traversal, and taint lineage evaluation.
4. **CONTAINED:** Active containment countermeasures deployed (agent revoked, device isolated, process killed, or IP sinkholed).
5. **RESOLVED:** Threat mitigated, policy gap addressed, and incident closed with resolution summary.
6. **FALSE_POSITIVE:** Analyst verification confirms legitimate behavior; guardrail rules tuned accordingly.

---

## 2. Automated Incident Triggers & Severity Classification

| Trigger Condition | Category | Initial Severity | Automated Actions Taken |
| :--- | :--- | :---: | :--- |
| **Direct / Indirect Prompt Injection Detected** | AI Safety Violation | **CRITICAL** | Gateway blocks execution; taint flag applied to provenance graph; incident generated. |
| **Output Rails DLP Violation (Secrets / PCI)** | Exfiltration Hazard | **CRITICAL** | Outbound payload blocked; sanitized error returned; alert emitted to audit trail. |
| **Unauthorized Host Subprocess Spawn (Endpoint)** | Host Compromise | **HIGH** | Endpoint connector flags process; incident created; pending human SOC containment approval. |
| **Explicit Deny Policy Violation** | Access Violation | **HIGH** | Execution blocked immediately; security event recorded. |
| **SSRF Attempt Against Metadata / Private Subnet** | Network Boundary | **HIGH** | HTTP connection terminated pre-flight; target host logged. |
| **Repeated Deny-by-Default Threshold Exceeded** | Policy Violation | **MEDIUM** | Incident flagged after 3 consecutive unmapped tool call attempts. |

---

## 3. Authorized Containment Procedures

AgentTrust strictly requires explicit authorization before executing destructive host containment actions. SOC operators utilize the following procedures:

### Procedure A: Agent Credential Revocation
- **When to Use:** Rogue or compromised agent exhibiting persistent injection behaviors.
- **API Endpoint:** `POST /api/v1/agents/{id}/revoke` (Requires `ADMIN` role).
- **Effect:** Immediately transitions agent status to `REVOKED`. Subsequent calls fail at Stage 1 of the gateway.

### Procedure B: Endpoint Device Network Isolation
- **When to Use:** Workstation infected with malicious tool runner or unauthorized reverse shell.
- **API Endpoint:** `POST /api/v1/endpoints/{device_id}/contain` (Requires `ADMIN` role and human confirmation `authorized_by`).
- **Effect:** Sentry daemon applies Windows Defender Firewall rule (`netsh advfirewall firewall add rule ... action=block`), isolating the host from all external network communications while preserving gateway telemetry.

### Procedure C: Malicious Host Process Termination
- **When to Use:** Unauthorized background process spawned by an agent worker.
- **API Endpoint:** `POST /api/v1/active-defense/kill-process` (Requires `ADMIN` role).
- **Effect:** Restrictive validation confirms target PID is within monitored agent process ledger and not a system PID (PID <= 4). Process and all child processes terminated via `psutil`.

### Procedure D: Perimeter Ingress Sinkholing
- **When to Use:** Reconnaissance scanning or automated brute force attacks detected from a specific IP or CIDR subnet.
- **API Endpoint:** `POST /api/v1/active-defense/sinkhole` (Requires `ADMIN` role).
- **Effect:** Ingress traffic dropped at gateway entry; subsequent requests immediately return `BLOCKED`.

---

## 4. Forensic Reporting & Audit Export

AgentTrust generates two standardized investigation artifacts for every incident:
1. **Executive Incident Summary:** High-level overview detailing business impact, affected agents, timeline of events, and containment status.
2. **Technical Forensic Dossier:** Comprehensive timeline, exact tool invocation parameters, prompt text snippets, raw provenance graph edges, and cryptographic HMAC audit hashes.
   - HTML exports (`GET /api/v1/reports/incidents/{id}/export/html`) enforce strict `html.escape()` sanitization on all event metadata to eliminate Stored XSS risks.
