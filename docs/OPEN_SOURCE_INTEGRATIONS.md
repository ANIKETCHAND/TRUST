# Open-Source Integration Candidates

This document records candidate projects for integration. Listing a project does not mean it is installed, integrated, endorsed, or production-approved. Before vendoring or redistributing code, pin a release/commit, inspect its current license and dependencies, review its threat model, and run an integration security review.

## Candidate matrix

| Project | Proposed role | Integration boundary | Initial decision |
|---|---|---|---|
| [Pipelock](https://github.com/pipelab-org/pipelock) | AI-agent egress and MCP traffic inspection, DLP/prompt-injection scanning, evidence | Separate Go sidecar/proxy or MCP wrapper; route only supported traffic through it | Highest-priority evaluation |
| [Open Policy Agent](https://github.com/open-policy-agent/opa) | Deterministic policy decision point | Local sidecar or service; AgentTrust remains policy administration and enforcement point | Evaluate for policy engine |
| [osquery](https://github.com/osquery/osquery) | Endpoint inventory and event telemetry | Endpoint agent queries/receives selected events; avoid running arbitrary queries from cloud | Evaluate for endpoint telemetry |
| [Wazuh](https://github.com/wazuh/wazuh) | Optional endpoint/SIEM integration | Forward normalized alerts/events; do not embed full Wazuh server in AgentTrust | Optional enterprise connector |
| [ClamAV](https://github.com/Cisco-Talos/clamav) | File scanning | Local daemon/CLI integration; quarantine only through AgentTrust-controlled workflow | Evaluate for file scanning |
| [YARA](https://github.com/VirusTotal/yara) | Rule-based file/content classification | Isolated scanner process with curated rules and resource limits | Evaluate for advanced file analysis |
| [Trivy](https://github.com/aquasecurity/trivy) | Scan AgentTrust images, dependencies and build artifacts | CI pipeline, not runtime endpoint response | Adopt in CI after license/version review |
| [OpenTelemetry](https://github.com/open-telemetry/opentelemetry-collector) | Metrics, traces and event export | Collector/exporter integration with redaction | Adopt for observability |

## Pipelock evaluation notes

The project describes itself as an AI-agent firewall for mediated HTTP, MCP, A2A and WebSocket traffic, including scanning for exfiltration, SSRF and prompt injection, and signed action receipts. Its public repository identifies Apache-2.0 licensing. It is a candidate for an optional enforcement sidecar, not a drop-in replacement for AgentTrust's identity, delegation, provenance graph, browser extension or endpoint agent.

Required proof before adoption:
- Pin a reviewed release/commit and verify Apache-2.0 license and notices.
- Run its tests and security checks in isolation.
- Confirm which protocols and traffic paths are actually mediated.
- Verify fail-open/fail-closed behavior under crash, timeout and configuration error.
- Measure false positives, latency and resource use.
- Test bypasses with direct egress disabled at the workload boundary.
- Do not claim coverage for unmediated traffic.

## Integration rules

1. Prefer process/service boundaries over copying third-party source into the monorepo.
2. Pin versions and image digests; produce an SBOM.
3. Record license, notices, source URL, commit, checksum and update owner.
4. Do not send customer files, prompts, secrets or telemetry to external services without explicit configuration and consent.
5. External reputation APIs are enrichment signals, not proof. Do not upload files to a public scanning service by default.
6. Each integration needs contract tests, failure-mode tests, resource limits and a documented disable/rollback procedure.
7. Keep the core authorization decision deterministic and locally verifiable.
