# AgentTrust: Production-Oriented AI Agent Security Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Tests Passing](https://img.shields.io/badge/Tests-23%20Passed-brightgreen.svg)]()
[![Security Model](https://img.shields.io/badge/Security_Model-Fail--Closed_Deny--by--Default-red.svg)]()

**AgentTrust** is a real, deterministic, enterprise-grade cybersecurity platform that sits between autonomous AI agents and protected resources (relational databases, sandboxed filesystems, external APIs, MCP endpoints, and inter-agent communication).

It intercepts every agent action, validates credentials, evaluates security policies, prevents unauthorized operations, stops indirect prompt-injection-driven data exfiltration, and logs tamper-evident audit trails.

> **CRITICAL SECURITY GUARANTEE**: Security enforcement is strictly **deterministic**. An LLM is never the final authority for granting or denying sensitive operations. The platform operates on a **Fail-Closed, Deny-by-Default** architecture.

---

## System Architecture

```
                                  +------------------------------------+
                                  |         AI Agents / LLMs           |
                                  +-----------------+------------------+
                                                    |
                                                    | Protected Tool Execution Request
                                                    v
                                  +------------------------------------+
                                  |       AgentTrust API Gateway       |
                                  |     /api/v1/gateway/execute        |
                                  +-----------------+------------------+
                                                    |
         +------------------------------------------+------------------------------------------+
         |                      |                   |                  |                       |
         v                      v                   v                  v                       v
+------------------+  +-------------------+  +---------------+  +---------------+  +---------------------+
| Agent Auth       |  | Deterministic     |  | Multi-Agent   |  | Data Leakage  |  | Tamper-Evident      |
| - Key Hash SHA256|  | Policy Engine     |  | Delegation    |  | Prevention    |  | Audit & Incidents   |
| - Revocation     |  | - Deny-by-default |  | - Depth check |  | - PII / Keys  |  | - Structured events |
| - Anti-spoofing  |  | - Explicit Deny   |  | - No scaling  |  | - Block leaks |  | - Auto incidents    |
+------------------+  +-------------------+  +---------------+  +---------------+  +---------------------+
                                                    |
                                                    v
                                        +-----------------------+
                                        | Controlled Execution  |
                                        |  (Allowed Actions)    |
                                        +-----------+-----------+
                                                    |
             +-----------------------+--------------+---------------+-----------------------+
             |                       |                              |                       |
             v                       v                              v                       v
+-------------------------+ +------------------------+ +------------------------+ +---------------------+
| Sandboxed Filesystem    | | PostgreSQL / Relational| | Outbound HTTP API      | | Model Context       |
| - Directory Traversal   | | - SQL DDL Block        | | - SSRF Protection      | | Protocol (MCP)      |
| - Path Jail Restriction | | - Safe Query Select    | | - Loopback/IP block    | | - Tool Bridge       |
+-------------------------+ +------------------------+ +------------------------+ +---------------------+
```

---

## Clean Project Folder Structure

AgentTrust is architected with complete separation of concerns:

```
TRUST/
├── backend/                         # FastAPI Backend Modular Monolith
│   ├── app/
│   │   ├── api/v1/                  # Scalable REST API Routers
│   │   │   ├── router.py            # Central v1 Router Registry
│   │   │   ├── gateway.py           # Core Interception Entrypoint
│   │   │   ├── agents.py            # Agent Provisioning & Revocation
│   │   │   ├── tools.py             # Protected Tool Endpoints
│   │   │   ├── delegations.py       # Cryptographic Delegation Chain
│   │   │   ├── provenance.py        # Lineage Graph & Taint Tracking
│   │   │   ├── policies.py          # Deterministic Policy Engine
│   │   │   ├── incidents.py         # Incident Alerts & Forensics
│   │   │   ├── audit.py             # Tamper-Evident Audit Logs
│   │   │   ├── agent_exec.py        # Autonomous Agent Runner
│   │   │   ├── overview.py          # Real-Time Telemetry Stats
│   │   │   └── health.py            # Diagnostic Health Check
│   │   ├── core/                    # Security, Settings & Async DB
│   │   ├── models/                  # SQLAlchemy ORM Data Models
│   │   ├── services/                # Decoupled Business Logic Services
│   │   └── tools/                   # Hardened Real Tool Implementations
│   └── tests/                       # 23 Automated Security & Gateway Tests
├── frontend/                        # React 18 + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/              # Sidebar & TopNavbar Layout
│   │   │   ├── tabs/                # 11 Dedicated Security Consoles
│   │   │   └── ui/                  # Reusable UI Primitives (Badges, Modals, Spinners)
│   │   ├── context/                 # Central State (SecurityPlatform, Toast)
│   │   ├── hooks/                   # Business Logic Custom Hooks
│   │   ├── services/                # Typed API Client & Service Layer
│   │   ├── types/                   # Domain TypeScript Interfaces
│   │   └── utils/                   # Shared Formatters & Utilities
├── ARCHITECTURE.md                  # Comprehensive Threat Model & Security Specs
├── API.md                           # REST API Reference Documentation
├── Dockerfile.backend               # Container configuration for backend
├── Dockerfile.frontend              # Multi-stage production container for frontend
└── docker-compose.yml               # One-click Docker deployment
```

---

## 11 Integrated Security Consoles

1. **Executive Overview**: Real-time aggregated statistics, 24h gateway enforcement timeline (Recharts), and tool usage distribution.
2. **AI Agent Registry**: Cryptographic agent provisioning, API key management (`agk_live_...`), role assignment, and instant credential revocation.
3. **Protected Tool Registry & Tester**: Server-side tool catalog (DB, Filesystem, HTTP API, MCP) with interactive in-browser tester.
4. **Live Monitoring**: Real-time telemetry stream with background polling, decision filters (`ALLOWED` / `BLOCKED`), and deep payload inspection.
5. **Delegation Graph**: Cryptographic parent-to-child delegation tokens, depth limits, and anti-privilege escalation verification.
6. **Provenance Explorer**: Visual data-flow lineage graph tracking origin sources, agent transformations, and trust levels (`TRUSTED`, `SANITIZED`, `UNTRUSTED`).
7. **Security Policies**: Deterministic rule editor with regex resource matching, explicit deny rules, and a dry-run policy simulator.
8. **Security Alerts & Incidents**: Automated incident generation for blocked attacks, indirect prompt injection attempts, and path traversal detection.
9. **Compliance Audit Trail**: Paginated, tamper-evident audit logs with microsecond execution latencies and one-click CSV / JSON exports.
10. **Autonomous Agent Runner**: Live multi-step agent execution playground demonstrating end-to-end gateway interception and prompt injection neutralization.
11. **Platform Settings & Health**: Gateway diagnostics, fail-closed enforcement mode toggles, and live polling controls.

---

## Quickstart: Running on Localhost

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### 1. Run the Backend & Unified Platform
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080
```
Open **`http://localhost:8080`** in your browser. The backend serves both the complete REST API under `/api/v1` and the compiled production frontend directly at `/`.

### 2. Run Frontend in Development Mode (Optional)
If you wish to edit frontend code with Vite Hot Module Replacement (HMR):
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`**.

---

## Quickstart: Docker Compose

To deploy AgentTrust in a containerized environment:
```bash
docker-compose up -d --build
```
Navigate to **`http://localhost:8080`**.

---

## Running Automated Security Tests

AgentTrust includes 23 automated integration and security tests validating:
- Strict path traversal prevention (`../../windows/system32`, `../../etc/passwd`)
- SSRF protection against private IP ranges and cloud metadata
- Anti-privilege escalation in multi-agent delegations
- Safe parameterized SQL queries and DDL blocking
- Indirect prompt injection data exfiltration blocks
- Tamper-evident audit completeness and non-side-effect guarantees on denied actions

Run the test suite:
```bash
cd backend
python -m pytest -v
```

---

## License & Security Compliance

Developed under strict Cybersecurity and Zero Trust AI standards. Deterministic enforcement guarantees safety across enterprise LLM deployments.
