# AGENTTRUST — TECHNICAL AUDIT
## BROWSER SHIELD & ENDPOINT CONNECTOR AUDIT

**Target Platform:** AgentTrust AI Security Platform  
**Audit Date:** November 12, 2026  
**Auditor:** Browser & Endpoint Security Specialist Panel  

---

### 1. BROWSER SHIELD EXTENSION AUDIT

The Browser Shield is located in the `browser-shield/` directory. It is designed to extend zero-trust DLP and prompt injection defense to browser-mediated AI portals.

#### A. Extension Architecture (Manifest V3):
- **Manifest:** [browser-shield/manifest.json](file:///E:/OS%20PROJECT/browser-shield/manifest.json) conforms strictly to Chromium **Manifest V3** standards.
- **Service Worker:** [background.js](file:///E:/OS%20PROJECT/browser-shield/background.js) functions as the central event broker.
- **Content Script:** [content.js](file:///E:/OS%20PROJECT/browser-shield/content.js) injects into target AI portal pages.
- **Permissions:** Scoped to `storage`, `activeTab`, `alarms`, `declarativeNetRequest`, and `notifications`.
- **Host Permissions:** Explicitly restricted to recognized AI agent workflows (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `perplexity.ai`, `deepseek.com`, and localhost gateway ports `8080` and `5173`).

#### B. Content Script Interception Mechanics:
1. **Target Identification:** Listens for `input`, `keydown`, and `click` events across:
   - `TEXTAREA` elements
   - `[contenteditable="true"]` DIVs (used by Claude and modern rich editors)
   - `[role="textbox"]` elements
   - `.ProseMirror` and `.ql-editor` classes
2. **Debounced Pre-Flight Scan:** Upon user typing, a 250ms debounced event sends `CHECK_ACTION` via `chrome.runtime.sendMessage` to `background.js`, which queries `POST /api/v1/browser-shield/check-action`.
3. **Synchronous Enter Key & Send Button Hooks:**
   - When a user presses `Enter` or clicks a submit/send button (detected via `data-testid="send"`, `aria-label="Send"`, or SVG send icons), the content script executes synchronous regex checks (`SENSITIVE_SYNC_PATTERNS`) covering private keys (`-----BEGIN PRIVATE KEY-----`), AWS keys (`AKIA...`), JWT tokens, and direct prompt override directives.
   - If a violation is detected, `e.preventDefault()`, `e.stopPropagation()`, and `e.stopImmediatePropagation()` are invoked synchronously to block prompt transmission before the web application can send it.
4. **User Feedback UI:**
   - Injects a floating, non-intrusive status pill (`#agenttrust-status-pill`) showing real-time shield status (`CLEAN` vs `SHIELD ALERT`).
   - Injects a red modal banner (`#agenttrust-security-banner`) upon detection, explaining the exact reason and blocked token.

#### C. Fail-Closed Offline Mode:
In `background.js` lines 112-145, if the AgentTrust backend server is unreachable or offline, the extension executes local DLP heuristics (credit cards, SSNs, API secrets, override directives). If a match is found, it returns `BLOCKED`. If no specific pattern is found while disconnected, it holds the submission under fail-closed mode (`"Offline Fail-Closed Policy Active"`).

#### D. Boundary Realities & Limitations:
- **Web Portal Scoping:** Can only inspect browser tabs matching `host_permissions`.
- **Encrypted OS Traffic:** Cannot inspect native desktop applications (e.g., Slack desktop, IDE copilots, terminal commands) outside browser tabs.
- **DOM Obfuscation:** Complex custom canvas or WebAssembly text rendering engines that bypass standard DOM text fields cannot be inspected by DOM content scripts.

---

### 2. ENDPOINT CONNECTOR AUDIT

The Endpoint Connector is located in `endpoint-connector/`. It operates as a local host daemon providing agent runtime telemetry and controlled containment.

#### A. Component Architecture:
```
endpoint-connector/
├── main.py                     # CLI entry point (enroll, status, test-telemetry, start)
├── connector.py                # Standalone connection runner
└── agenttrust_endpoint/
    ├── client.py               # HTTP client communicating with backend
    ├── collector.py            # psutil process scanner & telemetry generator
    ├── config.py               # Local configuration and credential storage
    ├── containment.py          # Process suspension & resumption manager
    └── service.py              # Background daemon service
```

#### B. Enrollment & Authentication:
1. **Enrollment Secret:** The daemon enrolls with the backend via `POST /api/v1/endpoints/enroll` using `settings.ENROLLMENT_SECRET`.
2. **Device Token:** The backend issues a high-entropy device token (`epk_live_...`). The SHA-256 hash is stored in `endpoint_devices.device_token_hash`.
3. **Subsequent Calls:** Heartbeats (`POST /endpoints/heartbeat`) and telemetry submissions (`POST /endpoints/telemetry`) require the `X-Device-Token` header, cryptographically authenticated in [endpoints.py](file:///E:/OS%20PROJECT/backend/app/api/v1/endpoints.py#L82-L109).

#### C. Telemetry Collection (`collector.py`):
- Uses `psutil.process_iter` to scan running processes.
- Scoped strictly to recognized AI agent runtimes: `{"python.exe", "python3.exe", "node.exe", "uv.exe"}`.
- Inspects command-line strings for agent-specific markers (`"agent"`, `"tool"`, `"runner"`, `"langchain"`, `"mcp"`).
- Flags suspicious execution patterns (`"powershell -enc"`, `"downloadstring"`, `"certutil"`, `"/bin/sh"`).
- **Privacy Boundary:** Does not conduct general user surveillance; ignores unrelated user applications (browsers, office suites, personal apps).

#### D. Controlled Process Containment (`containment.py`):
- **Reversible Action:** When the SOC issues a containment action (`POST /endpoints/{device_id}/contain`), the daemon executes `psutil.Process(pid).suspend()`.
- **Non-Destructive:** Does not terminate or kill the process memory space. Preserves volatile RAM for forensic dump and analysis.
- **Reversal:** Upon SOC operator approval (`POST /endpoints/{device_id}/release`), executes `p.resume()`.
- **Safeguard:** Requires `human_approved: True` in the API payload, enforcing human-in-the-loop control for destructive or disruptive actions.

#### E. Active Defense OS Firewall Integration:
In [active_defense_service.py](file:///E:/OS%20PROJECT/backend/app/services/active_defense_service.py#L172-L192), perimeter sinkholing directly interacts with the host operating system:
- **Windows:** Invokes `netsh advfirewall firewall add rule name=... dir=in action=block remoteip=...` (and outbound block rule).
- **Linux:** Invokes `iptables -I INPUT -s ... -j DROP`.
- **Elevation Requirement:** Note that modifying OS firewall rules requires administrative/root privileges on the host system; if the backend process runs without elevation, it logs a notice and relies on the internal gateway-level null-route.
