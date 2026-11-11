# AgentTrust: In-Depth AI-Agent Security & Threat Model Review
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform` (Commit `06bf0fc`)  
**Reviewer:** AI Security and LLM Specialist Panel  

---

## 1. Executive Summary: AI Security Positioning vs. Code Reality

The central question posed to this review board is:
> **Does AgentTrust provide meaningful AI-agent security, or is its AI security positioning stronger than its actual implementation?**

### Definitive Finding:
**AgentTrust's AI security positioning is substantially stronger than its implementation.**

AgentTrust describes itself in documentation as implementing *"NVIDIA NeMo-Style Input, Dialog, and Output Rails"*, *"Indirect Prompt Injection Exfiltration Blocks"*, *"Cryptographic Multi-Agent Delegation Chains"*, and a *"Provenance & Taint Tracking Engine"*.

In the actual codebase:
1. **Zero Machine Learning or AI Models**: There is not a single ML model, neural network, embedding model, or classifier in the repository. The project has no dependency on PyTorch, TensorFlow, Hugging Face `transformers`, ONNX, `nemoguardrails`, or semantic analysis libraries.
2. **AI Terminology Applied to Conventional Regexes**:
   - "Input Rails" is a Python class containing 9 regular expressions and a Shannon entropy calculator.
   - "Prompt Injection Detection" consists of 6 regular expressions in a 42-line file.
   - "Output Rails" is a Python class matching regex patterns for credit cards and private keys, backed by the standard Luhn algorithm.
   - "Dialog Rails" is an in-memory dictionary tracking the last-invoked tool per session.
3. **The Autonomous Agent Runner is 100% Hardcoded**: The `/api/v1/agent-exec/run` endpoint does not execute an AI agent or LLM. It executes a completely hardcoded Python script containing a hardcoded SQL query, a hardcoded summary write, and a hardcoded HTTP POST to a synthetic destination.
4. **Provenance Taint Tracking Does Not Exist in Runtime**: The provenance graph is a static database table with 4 dummy demonstration records. Tool calls passing through the gateway do not update the DAG, do not propagate taint, and do not alter policy evaluations based on data origin.
5. **Output Rails Bypass via Client Context**: In `gateway_service.py:696`, setting `context: {"output_rails_mode": "raw"}` allows agents to bypass secret redaction and exfiltrate private keys in cleartext with `allowed: true`.
6. **Dialog Rails State Machine Evasion**: An agent can bypass disallowed tool chains by randomizing `session_id` in `req.context` on each call.

AgentTrust is essentially a **conventional API gateway with regex filters**, wrapped in AI cybersecurity terminology.

---

## 2. Comprehensive AI Threat Matrix

The table below evaluates AgentTrust's actual defenses against the 15 major AI and agentic threat vectors:

| Threat Vector | Implemented Protection | Exact Code Evidence | Tested in Suite? | Remaining Weakness & Bypass Paths | Control Type |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **1. Direct Prompt Injection** | 6 static regex patterns in `PromptInjectionDetectorService` and 9 patterns in `InputRails`. | [`prompt_injection_service.py:11-18`](file:///e:/OS%20PROJECT/backend/app/services/prompt_injection_service.py#L11-L18), [`input_rails.py:35-45`](file:///e:/OS%20PROJECT/backend/app/guardrails/input_rails.py#L35-L45) | Partially (`test_guardrails_pipeline.py`) | **Severe:** Trivial paraphrasing, translation to another language, character insertion, leetspeak, base64 encoding, or token splitting bypasses regex completely. | Detection |
| **2. Indirect Prompt Injection** | Checks parameters for exfiltration keywords (`exfiltrate...to`, `curl -X POST`). | [`prompt_injection_service.py:16`](file:///e:/OS%20PROJECT/backend/app/services/prompt_injection_service.py#L16), [`gateway_service.py:287-315`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L287-L315) | Tested with hardcoded string | If an untrusted document commands an agent to use a valid tool with benign arguments, regex fails completely. Zero semantic understanding of context hijacking. | Detection |
| **3. Tool-Call Manipulation** | Operation must be in tool's `supported_operations` whitelist. | [`gateway_service.py:159-181`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L159-L181) | Tested (`test_gateway_security.py`) | Parameter payloads within valid operations are unconstrained. An agent can inject destructive SQL inside an `UPDATE` without a `WHERE` clause. | Preventive |
| **4. Unauthorized Tool Execution** | Deny-by-default permission check against `Permission` table in database. | [`policy_engine.py:131-137`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L131-L137) | Tested (`test_gateway_security.py`) | Administrative permission API (`POST /permissions`) has no authentication. An attacker can grant any agent access to any tool. | Preventive |
| **5. Privilege Escalation** | `DelegationService` checks that child scope is a subset of parent permissions. | [`delegation_service.py:128-158`](file:///e:/OS%20PROJECT/backend/app/services/delegation_service.py#L128-L158) | Tested (`test_delegation_cascades_and_boundaries.py`) | `POST /delegations` does not authenticate the parent agent. Anyone knowing the parent agent's UUID can forge a delegation token. | Preventive |
| **6. Confused Deputy Attacks** | Header-based authentication (`X-Agent-Key`); body agent IDs ignored. | [`deps.py:59-88`](file:///e:/OS%20PROJECT/backend/app/api/deps.py#L59-L88) | Tested (`test_auth_and_agents.py`) | If an agent is coerced into making an authorized call that has unintended side effects (e.g. wiping rows via valid `UPDATE`), the gateway permits it. | Preventive |
| **7. Excessive Agent Permissions** | Granular tool, operation, and resource glob matching. | [`policy_engine.py:21-34`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L21-L34) | Tested (`test_auth_and_agents.py`) | Many permissions use wildcard `*` resource patterns in practice. No dynamic just-in-time (JIT) permission scoping. | Preventive |
| **8. Insecure Delegation** | Maximum depth constraints (default: 3 hops) and cascading revocation checks. | [`gateway_service.py:449-554`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L449-L554) | Tested (`test_delegation_cascades_and_boundaries.py`) | Delegation records fail at runtime on SQLite due to missing `parent_delegation_id` column in shipped database. | Preventive |
| **9. Sensitive Data Disclosure** | Output Rails scans return payloads for credit cards (Luhn) and private keys. | [`output_rails.py:34-40`](file:///e:/OS%20PROJECT/backend/app/guardrails/output_rails.py#L34-L40) | Tested (`test_guardrails_pipeline.py`) | **Severe:** Setting `context: {"output_rails_mode": "raw"}` completely disables redaction and returns cleartext private keys. Local filesystem writes and DB inserts are never inspected. | Preventive |
| **10. Malicious MCP Servers** | Mock MCP tool schema definition. | [`mcp_tool.py:18-74`](file:///e:/OS%20PROJECT/backend/app/tools/mcp_tool.py#L18-L74) | Tested with mock | **Complete Absence of Protection:** The MCP tool is a stub. It does not connect to real MCP servers, perform JSON-RPC schema validation, or sandbox transports. | None (Mock) |
| **11. Untrusted External Content** | Untrusted inputs tagged in Provenance DAG. | [`provenance.py:70-101`](file:///e:/OS%20PROJECT/backend/app/api/v1/provenance.py#L70-L101) | Not tested in execution | Provenance is purely static demonstration data. Gateway does not track taint from ingested content into downstream actions. | None (Cosmetic) |
| **12. Agent Identity Spoofing** | SHA-256 API key hashing; raw keys never stored in database. | [`security.py:71-80`](file:///e:/OS%20PROJECT/backend/app/core/security.py#L71-L80) | Tested (`test_auth_and_agents.py`) | Keys have no expiration, no automated rotation, and revocation endpoints can be called by anyone without authentication. | Preventive |
| **13. Cross-Agent Trust Abuse** | Ancestor chain verification during delegated execution. | [`gateway_service.py:500-554`](file:///e:/OS%20PROJECT/backend/app/services/gateway_service.py#L500-L554) | Tested (`test_delegation_cascades_and_boundaries.py`) | Inter-agent message passing (A2A) is unmediated; only tool calls routed through the gateway are inspected. | Preventive |
| **14. Data Exfiltration** | DLP pattern inspection and SSRF private IP blocking on HTTP tool. | [`http_api_tool.py:16-37`](file:///e:/OS%20PROJECT/backend/app/tools/http_api_tool.py#L16-L37), [`dlp_service.py:11-36`](file:///e:/OS%20PROJECT/backend/app/services/dlp_service.py#L11-L36) | Tested (`test_gateway_security.py`) | Outbound exfiltration via DNS tunneling, ICMP, WebSocket, or multi-part steganographic chunks is completely unmonitored. | Preventive |
| **15. Policy Bypass** | Explicit DENY rules override ALLOW rules. | [`policy_engine.py:125-130`](file:///e:/OS%20PROJECT/backend/app/services/policy_engine.py#L125-L130) | Tested (`test_production_hardening_and_safeguards.py`) | The frontend Policy editor alters `Policy.rules`, which the gateway does not evaluate. Bypassing intended policies is trivial because they are never enforced. | Architectural Flaw |
