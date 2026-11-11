# AgentTrust Open-Source Integrations Register
**Document Version:** 2.0.0  
**Classification:** Enterprise Integrations & Third-Party Ecosystem  

---

## 1. Integration Matrix & Compliance Status

AgentTrust evaluates and integrates specialized open-source security technologies to augment its deterministic execution gateway:

| Component | Upstream Repository | Purpose & Role | License | Status | Failure Mode |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Model Context Protocol (MCP)** | `modelcontextprotocol` | Tool schema discovery & JSON-RPC execution bridge. | MIT | **Active** | Fail-Closed |
| **Open Policy Agent (OPA)** | `open-policy-agent/opa` | External Rego policy evaluation engine. | Apache 2.0 | **Active (Optional)** | Fail-Closed |
| **Pipelock** | `pipelab-org/pipelock` | AI agent security proxy & inspection sidecar. | Apache 2.0 | **Active (Optional)** | Fail-Closed |
| **ClamAV** | `Cisco-Talos/clamav` | Antivirus daemon for uploaded files & tool payloads. | GPLv2 | **Active (Optional)** | Fail-Closed |
| **YARA** | `VirusTotal/yara` | Pattern-based heuristic & malware classification. | BSD 3-Clause | **Active (Optional)** | Fallback Heuristic |
| **OSQuery** | `osquery/osquery` | Authorized endpoint process telemetry. | Apache 2.0 | **Evaluated / Roadmap** | Fail-Open Telemetry |
| **Wazuh** | `wazuh/wazuh` | Host-based intrusion detection & SIEM connector. | GPLv2 | **Evaluated / Roadmap** | Fail-Open Telemetry |
| **OpenTelemetry** | `open-telemetry/opentelemetry-collector` | Distributed trace propagation & telemetry export. | Apache 2.0 | **Active (Optional)** | Fail-Open Telemetry |

---

## 2. Integration Architecture & Contracts

### 2.1 Model Context Protocol (MCP) Bridge
- **Service Implementation:** [`backend/app/tools/mcp_tool.py`](file:///e:/OS%20PROJECT/backend/app/tools/mcp_tool.py)
- **Protocol:** MCP v1.0 over JSON-RPC 2.0
- **Contract:** Translates registered AgentTrust tools (`filesystem_tool`, `postgres_tool`, `http_api_tool`) into standard MCP tool descriptions and input schemas.
- **Security Control:** Incoming MCP tool calls are routed through the AgentTrust gateway, ensuring all deterministic permissions, DLP scans, and audit chains apply before native tool handlers execute.

### 2.2 Open Policy Agent (OPA) Adapter
- **Service Implementation:** [`backend/app/services/opa_service.py`](file:///e:/OS%20PROJECT/backend/app/services/opa_service.py)
- **Endpoint:** `POST ${OPA_URL}` (Default: `http://localhost:8181/v1/data/agenttrust/authz`)
- **Input Contract:**
  ```json
  {
    "input": {
      "agent_id": "92fe12b8-9b64-4622-9951-6c92a0e7ddb5",
      "agent_role": "analyst",
      "tool": "postgres_tool",
      "operation": "query_select",
      "resource": "table:customer_records",
      "context": {}
    }
  }
  ```
- **Failure Behavior:** If OPA is enabled (`OPA_ENABLED=true`) but unreachable or returns `allow: false`, the gateway **fails closed** and blocks the execution.

### 2.3 Pipelock AI Security Proxy Sidecar
- **Service Implementation:** [`backend/app/services/pipelock_service.py`](file:///e:/OS%20PROJECT/backend/app/services/pipelock_service.py)
- **Endpoint:** `POST ${PIPELOCK_PROXY_URL}` (Default: `http://localhost:8090/v1/inspect`)
- **Contract:** Routes prompts and tool parameters through Pipelock's inspection proxy for additional deep packet inspection.
- **Failure Behavior:** Fails closed if proxy returns an anomaly or connection fails while enabled.

### 2.4 File Scanner Service (ClamAV & YARA)
- **Service Implementation:** [`backend/app/services/file_scanner_service.py`](file:///e:/OS%20PROJECT/backend/app/services/file_scanner_service.py)
- **Contract:**
  - Files larger than 0 bytes written to `sandbox_storage` are evaluated.
  - If ClamAV daemon is reachable on `localhost:3310`, performs `INSTREAM` scanning.
  - If ClamAV is offline or disabled, runs internal YARA heuristic signatures (detecting reverse shell one-liners, PowerShell download cradles, base64 blobs).
  - Infected files are moved to `sandbox_storage/quarantine/` and flagged with a `SecurityIncident`.

---

## 3. License Compliance & Software Bill of Materials (SBOM)

All third-party libraries integrated into AgentTrust have been audited for commercial suitability.
- Direct core runtime dependencies (FastAPI, SQLAlchemy, Pydantic, httpx, React, TailwindCSS) use permissive MIT or Apache 2.0 licenses.
- Copyleft dependencies (ClamAV, Wazuh) operate as external decoupled daemons communicating over network sockets (TCP/IP), preserving full license isolation for the core proprietary codebase.
