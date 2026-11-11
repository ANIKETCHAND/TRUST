# AgentTrust Implementation Roadmap

## Phase 0 — Repository and product baseline
- Inventory routes, models, services, tools, UI tabs and tests.
- Map current code to the product requirements.
- Confirm test claims from a clean checkout.
- Complete threat model, trust boundaries and data classification.
- Create dependency inventory, license register and SBOM process.
- Establish CI gates: tests, lint, type checks, secret scan, dependency scan, container scan.

Exit criteria: reproducible baseline and prioritized findings.

## Phase 1 — Security hardening of existing core
- Remove hardcoded JWT/signing secrets and reject insecure production defaults.
- Replace production SQLite configuration with PostgreSQL.
- Add Alembic migrations.
- Verify admin/user authentication on every sensitive route.
- Verify gateway complete mediation for registered tools.
- Harden SSRF, filesystem sandbox, request limits and audit integrity.
- Add negative tests proving denied operations have no side effects.

Exit criteria: tests demonstrate protected actions cannot bypass policy through supported execution paths.

## Phase 2 — Agent interoperability
- Implement MCP client/server adapters with protocol-version compatibility tests.
- Add LangGraph adapter as a separate package.
- Add signed workload identity and scoped delegation.
- Integrate optional Pipelock sidecar after license, compatibility and failure-mode review.
- Document which transports are actually protected and how bypass is prevented.

Exit criteria: one external agent invokes a real protected tool through AgentTrust and unauthorized calls are blocked.

## Phase 3 — Browser Shield
- Build Manifest V3 extension with minimal permissions.
- Add authenticated enrollment and secure extension-to-local-agent/cloud communication.
- Add browser-visible URL/page indicators and supported AI workflow adapters.
- Make enforcement limitations explicit; browser extension alone cannot inspect arbitrary native processes or all encrypted traffic.
- Add extension signing/build and update integrity.

Exit criteria: supported browser workflow tested end-to-end with real events and policy enforcement.

## Phase 4 — Endpoint telemetry
- Build a separately installed Windows service first.
- Collect selected process, file and network metadata through supported OS APIs.
- Add authenticated device enrollment and policy sync.
- Add Linux agent as a separately tested implementation.
- Use OSQuery/Wazuh as optional integrations, not hidden assumptions.

Exit criteria: endpoint telemetry appears in the dashboard with authenticated device identity and documented event coverage.

## Phase 5 — File and malware response
- Integrate ClamAV and optional YARA scanning in isolated workers.
- Use quarantine rather than irreversible deletion.
- Add file hashes, scan engine/version, signatures/rules version and evidence references.
- Require approval or high-confidence deterministic policy for disruptive actions.
- Provide restore/recovery and audit trail.

Exit criteria: harmless test samples are detected/quarantined in a test environment, restored safely, and fully audited.

## Phase 6 — Threat intelligence and incident response
- Add pluggable IP/domain/hash enrichment providers.
- Treat reputation as a signal with source, timestamp and confidence.
- Preserve network evidence and timestamps.
- Provide approximate IP geolocation with caveats; do not infer personal identity.
- MAC addresses are only available on the local network segment.
- Add report export with timeline, indicators, actions, impact and recovery guidance.

Exit criteria: reproducible incident report from a controlled test incident.

## Phase 7 — Enterprise control plane
- Tenant isolation, RBAC, SSO, audit retention and key rotation.
- Signed policy bundles and staged rollout/rollback.
- Fleet health, observability, backup/restore and incident workflows.
- Independent application security assessment and endpoint review.

Exit criteria: documented deployment profile, security test report, SBOM and release process.

## Release gates
No component may be described as production-ready solely because it compiles or has a dashboard. Each release needs a defined threat model, tested enforcement boundary, failure-mode tests, performance results, known limitations, signed artifacts and rollback instructions.
