# AgentTrust Product Redesign

## Product definition

AgentTrust is a unified AI-agent runtime security and security-operations platform. Its first product boundary is protected AI-agent activity; endpoint and browser capabilities are additional enforcement surfaces, not a claim that a browser extension can inspect the entire operating system.

### Product surfaces

1. **AgentTrust Core** — authenticated gateway, policy decision/enforcement, agent identity, scoped delegation, provenance, data-flow controls and signed audit evidence.
2. **AgentTrust Browser Shield** — browser extension for supported browser workflows and supported AI web applications. It reports browser-visible events and enforces only controls available through browser APIs or a cooperating local gateway.
3. **AgentTrust Endpoint** — separately installed Windows/Linux service using native OS telemetry and response interfaces. It is not implemented inside the browser extension.
4. **AgentTrust Control Plane** — tenant-aware API, policy distribution, device/agent inventory, incident management and dashboard.
5. **AgentTrust Integrations** — MCP, LangGraph/LangChain adapters, OPA, endpoint telemetry, malware scanning and threat-intelligence connectors.

## Trust boundaries

- Browser extension permissions are limited to the minimum required. It cannot claim visibility into arbitrary native applications, encrypted traffic outside its control, or every AI agent.
- Endpoint monitoring requires an installed, authenticated endpoint service and OS-specific permissions.
- AI tool enforcement only covers calls routed through AgentTrust or protected by a cooperating enforcement point. Direct bypass must be prevented with least-privilege credentials and network/resource controls.
- The cloud control plane is not trusted merely because an event comes from an installed client. Devices authenticate, events are schema-validated, and tenant authorization is checked.
- Detection is evidence-based. AI may summarize or prioritize findings but cannot independently authorize destructive actions.

## Core request lifecycle

1. Authenticate workload/device and resolve identity from credentials, not caller-supplied body fields.
2. Validate tool, operation, resource, schema and request size.
3. Resolve active policy and delegation grant.
4. Evaluate deterministic authorization and explicit deny rules.
5. Apply provenance and data-flow policy when the integration provides reliable provenance.
6. Return deny/hold/allow. Human approval is required for configured high-impact operations.
7. Execute through a server-owned handler only after allow.
8. Record decision, evidence references, policy version, execution outcome and latency.
9. Emit a signed or tamper-evident event to the control plane.

## Incident response

Supported defensive actions include deny protected tool calls, revoke AgentTrust credentials, quarantine a file through supported endpoint controls, block a verified destination on a managed endpoint, suspend an integration, and isolate an enrolled endpoint with an administrator-approved recovery path.

No unauthorized access, exploitation, malware deployment, destructive retaliation or remote tampering with an attacker's system is part of AgentTrust. Attribution is probabilistic: IP enrichment can identify an ISP/ASN or approximate region, not prove a person's identity. MAC addresses are generally only observable on the same local network segment.

## Product stages

- Stage 0: repository audit, threat model, competitive and license review.
- Stage 1: harden current gateway and secrets/configuration; prove real enforcement with integration tests.
- Stage 2: add MCP/agent adapters and external policy engine integration.
- Stage 3: browser extension MVP with explicit supported-platform matrix.
- Stage 4: endpoint telemetry MVP using supported native interfaces.
- Stage 5: safe containment, quarantine and incident evidence.
- Stage 6: tenant-aware control plane, deployment hardening and independent security assessment.

## Non-goals for initial release

- Replacing a mature enterprise EDR/antivirus suite.
- Universal inspection of all browser, OS, or encrypted traffic.
- Attribution of an individual attacker from an IP address alone.
- Automatic destructive actions based solely on model-generated confidence.
- Claims of compliance or industrial readiness without independent evidence.
