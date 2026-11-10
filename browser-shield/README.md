# AgentTrust Browser Shield (Manifest V3)

**AgentTrust Browser Shield** is an enterprise browser extension engineered to protect AI-agent workflows and web-based LLM interactions (e.g. OpenAI ChatGPT, Anthropic Claude, and internal AgentTrust web consoles).

---

## 1. Trust Boundaries & Permissions

### Permissions Requested
- `storage`: Stores encrypted enrollment tokens and cached policy state locally.
- `activeTab`: Obtains URL and DOM context of the currently focused AI application tab upon user interaction.
- `alarms`: Schedules periodic background heartbeats and health checks with AgentTrust Core.

### Host Permissions
Strictly restricted to supported AI web interfaces:
- `https://chatgpt.com/*`
- `https://claude.ai/*`
- `http://localhost:8080/*` (AgentTrust Local Gateway)
- `http://127.0.0.1:8080/*`

---

## 2. What Browser Shield CAN and CANNOT Inspect

### What It CAN Inspect:
- **Pre-flight DLP Verification**: Scans prompt text input within supported AI text areas for credit cards, Social Security numbers, AWS keys, and high-entropy secret tokens before the prompt is transmitted.
- **Prompt Injection Defense**: Intercepts recognized prompt injection syntax in user prompts or copied untrusted text.
- **Central Incident Auditing**: Emits signed security incident alerts to the central AgentTrust control plane (`/api/v1/browser-shield/events`).
- **Domain Verification**: Validates whether the active tab is an authorized enterprise AI service.

### What It CANNOT Inspect:
- **No Native OS Activity**: The extension cannot see native processes, local files, terminal commands, or arbitrary operating system activity. Native endpoint monitoring is strictly the responsibility of the **AgentTrust Endpoint Connector**.
- **No Unrelated Browsing**: It does not collect general web history, search terms, bank sessions, or pages outside supported AI hosts.
- **No Universal TLS Decryption**: It does not intercept network traffic outside supported browser fetch boundaries.

---

## 3. Installation & Enrollment

1. Open Chrome/Brave/Edge and navigate to `chrome://extensions`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select the `browser-shield/` folder.
4. Click the AgentTrust icon in the browser toolbar.
5. Enter your AgentTrust Gateway URL (default: `http://localhost:8080/api/v1`) and the enterprise `ENROLLMENT_SECRET`.
6. Click **Enroll Extension**. The status indicator will switch to **ONLINE**.
