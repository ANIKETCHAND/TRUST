# AgentTrust Endpoint Connector (Windows)

**AgentTrust Endpoint Connector** is a separately installed, lightweight Windows endpoint security component engineered to monitor, synchronize policy with, and defend authorized AI-agent workflows.

---

## 1. Architectural Role & Trust Boundaries

- **Separation of Concerns**: A browser extension cannot and should not attempt to monitor the entire operating system. The Endpoint Connector executes as a native service on authorized Windows hosts.
- **Authorized AI-Workflow Scope**: Telemetry collection is strictly focused on approved AI agent execution environments (`python.exe`, `node.exe`, virtualenvs, LangChain/MCP workloads, and monitored workspace paths).
- **No Invasive Surveillance**: The connector does not log arbitrary user keystrokes, personal desktop applications, or unrelated files.

---

## 2. Core Capabilities

1. **Cryptographic Device Enrollment**:
   - Authenticated enrollment using a shared `ENROLLMENT_SECRET`.
   - Generates persistent device token `epk_live_<entropy>` stored in SHA-256 hash form at the control plane.
2. **Heartbeat & Telemetry Synchronization**:
   - Submits telemetry batches covering process execution, command-line arguments, parent process relationships, and target resources.
   - Synchronizes workspace security policies from AgentTrust Core.
3. **Controlled Containment with Explicit Safeguards**:
   - In the event of confirmed compromise, supports graceful process suspension (`psutil.Process.suspend()`) and workspace restriction.
   - **Safeguards**: Requires explicit human authorization (`human_approved: true`). Retaliatory "hacking back", arbitrary process termination, and destructive deletions are strictly forbidden. All containment actions are reversible through the control plane.

---

## 3. Installation & Usage (Windows)

### Prerequisites
- Python 3.10+
- Administrative privileges for service installation (optional, user-level supported for development)

### Quickstart CLI

```powershell
cd endpoint-connector

# 1. Enroll the device with your AgentTrust Core instance
python main.py enroll --secret agenttrust-enrollment-secret-key-32chars-minimum --gateway http://localhost:8080/api/v1

# 2. Check connection status
python main.py status

# 3. Test telemetry submission
python main.py test-telemetry

# 4. Run the continuous monitoring daemon
python main.py start
```

---

## 4. Linux Support

Linux endpoint monitoring is detailed in [LINUX_ROADMAP.md](./LINUX_ROADMAP.md).
