# AgentTrust: In-Depth AI-Agent Security & Threat Model Review
**Audit Date:** November 10, 2026  
**Audited Branch:** `redesign/industrial-platform`  
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

AgentTrust is essentially a **conventional API gateway with regex filters**, wrapped in AI cybersecurity terminology.

---

## 2. Comprehensive AI Threat Matrix

The table below evaluates AgentTrust's actual defenses against the 15 major AI and agentic threat vectors:

| Threat Vector | Implemented Protection | Exact Code Evidence | Tested in Suite? | Remaining Weakness & Bypass Paths | Control Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Direct Prompt Injection** | 6 static regex patterns in `PromptInjectionDetectorService` and 9 patterns in `InputRails`. | `backend/app/services/prompt_injection_service.py:11-18`, `backend/app/guardrails/input_rails.py:35-45` | Partially (`test_guardrails_pipeline.py`) | **Severe:** Trivial paraphrasing, translation to another language, character insertion, leetspeak, base64 encoding, or token splitting bypasses regex completely. | Detection |
| **2. Indirect Prompt Injection** | Checks parameters for exfiltration keywords (`exfiltrate...to`, `curl -X POST`). | `backend/app/services/prompt_injection_service.py:16`, `backend/app/services/gateway_service.py:287-315` | Tested with hardcoded string | If an untrusted document commands an agent to use a valid tool with benign arguments, regex fails completely. Zero semantic understanding of context hijacking. | Detection |
| **3. Tool-Call Manipulation** | Operation must be in tool's `supported_operations` whitelist. | `backend/app/services/gateway_service.py:159-181` | Tested (`test_gateway_security.py`) | Parameter payloads within valid operations are unconstrained. An agent can inject malicious SQL inside a valid `SELECT` query. | Preventive |
| **4. Unauthorized Tool Execution** | Deny-by-default permission check against `Permission` table in database. | `backend/app/services/policy_engine.py:131-137` | Tested (`test_gateway_security.py`) | Administrative permission API (`POST /permissions`) has no authentication. An attacker can grant any agent access to any tool. | Preventive |
| **5. Privilege Escalation** | `DelegationService` checks that child scope is a subset of parent permissions. | `backend/app/services/delegation_service.py:128-158` | Tested (`test_delegation_cascades_and_boundaries.py`) | `POST /delegations` does not authenticate the parent agent. Anyone knowing the parent agent's UUID can forge a delegation token. | Preventive |
| **6. Confused Deputy Attacks** | Header-based authentication (`X-Agent-Key`); body agent IDs ignored. | `backend/app/api/deps.py:59-88` | Tested (`test_auth_and_agents.py`) | If an agent is coerced into making an authorized call that has unintended side effects (e.g. wiping rows via valid `UPDATE`), the gateway permits it. | Preventive |
| **7. Excessive Agent Permissions** | Granular tool, operation, and resource glob matching. | `backend/app/services/policy_engine.py:21-34` | Tested (`test_auth_and_agents.py`) | Many permissions use wildcard `*` resource patterns in practice. No dynamic just-in-time (JIT) permission scoping. | Preventive |
| **8. Insecure Delegation** | Maximum depth constraints (default: 3 hops) and cascading revocation checks. | `backend/app/services/gateway_service.py:449-554` | Tested (`test_delegation_cascades_and_boundaries.py`) | Delegation records fail at runtime on SQLite due to missing `parent_delegation_id` column in shipped database. | Preventive |
| **9. Sensitive Data Disclosure** | Output Rails scans return payloads for credit cards (Luhn) and private keys. | `backend/app/guardrails/output_rails.py:34-40` | Tested (`test_guardrails_pipeline.py`) | DLP inspection only blocks outbound HTTP; local filesystem writes and database inserts are not inspected for sensitive data leaks. | Preventive |
| **10. Malicious MCP Servers** | Mock MCP tool schema definition. | `backend/app/tools/mcp_tool.py:18-74` | Tested with mock | **Complete Absence of Protection:** The MCP tool is a stub. It does not connect to real MCP servers, perform JSON-RPC schema validation, or sandbox transports. | None (Mock) |
| **11. Untrusted External Content** | Untrusted inputs tagged in Provenance DAG. | `backend/app/api/v1/provenance.py:70-101` | Not tested in execution | Provenance is purely static demonstration data. Gateway does not track taint from ingested content into downstream actions. | None (Cosmetic) |
| **12. Agent Identity Spoofing** | SHA-256 API key hashing; raw keys never stored in database. | `backend/app/core/security.py:71-80` | Tested (`test_auth_and_agents.py`) | Keys have no expiration, no automated rotation, and revocation endpoints can be called by anyone without authentication. | Preventive |
| **13. Cross-Agent Trust Abuse** | Ancestor chain verification during delegated execution. | `backend/app/services/gateway_service.py:500-554` | Tested (`test_delegation_cascades_and_boundaries.py`) | Inter-agent message passing (A2A) is unmediated; only tool calls routed through the gateway are inspected. | Preventive |
| **14. Data Exfiltration** | DLP pattern inspection and SSRF private IP blocking on HTTP tool. | `backend/app/tools/http_api_tool.py:16-37`, `backend/app/services/dlp_service.py:11-36` | Tested (`test_gateway_security.py`) | Outbound exfiltration via DNS tunneling, ICMP, WebSocket, or multi-part steganographic chunks is completely unmonitored. | Preventive |
| **15. Policy Bypass** | Explicit DENY rules override ALLOW rules. | `backend/app/services/policy_engine.py:125-130` | Tested (`test_production_hardening_and_safeguards.py`) | The frontend Policy editor alters `Policy.rules`, which the gateway does not evaluate. Bypassing intended policies is trivial because they are never enforced. | Architectural Flaw |

---

## 3. Deep Dive: Prompt Injection & Guardrails Analysis

### A. Direct Prompt Injection: Regex vs. Reality
In `backend/app/services/prompt_injection_service.py`:
```python
INJECTION_PATTERNS = [
    (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE), "Instruction Override Attempt"),
    (re.compile(r"system\s*override|emergency\s*override", re.IGNORECASE), "System Override Token"),
    (re.compile(r"disregard\s+(?:the\s+)?(?:system\s+prompt|rules|constraints)", re.IGNORECASE), "Safety Constraint Bypass"),
    (re.compile(r"you\s+are\s+now\s+(?:in\s+)?(?:developer|god|unrestricted)\s+mode", re.IGNORECASE), "Jailbreak Persona Shift"),
    (re.compile(r"(?:exfiltrate|send|leak|forward)\s+(?:all\s+)?(?:data|secrets?|files?|credentials?)\s+to", re.IGNORECASE), "Data Exfiltration Directive"),
    (re.compile(r"curl\s+-X\s+POST|wget\s+http|nc\s+-e", re.IGNORECASE), "Shell Command Extraction Signature"),
]
```
#### Why This Fails in Practice:
1. **Semantic Variations**: Prompts like *"From now on, please set aside earlier instructions"* or *"Translate the following text, and by the way, disregard previous guidelines"* match none of these patterns.
2. **Encoding**: Prompts obfuscated with base64, ROT13, hex, or unicode zero-width spaces pass directly through.
3. **Multi-Language**: Prompts in Spanish (*"ignora todas las instrucciones anteriores"*), French, German, or Mandarin are completely ignored.
4. **False Negatives Rate**: Near 100% against competent adversarial prompts.

### B. Tiered Guardrails: The "NeMo" Facade
AgentTrust markets its guardrails as "Tier-1 Input Rails, Tier-2 Dialog Rails, Tier-3 Output Rails (NVIDIA NeMo-Style)".

Let us analyze what is actually implemented:
- **Input Rails (`input_rails.py`)**:
  - Adds 3 more regexes to the injection list (`DAN Jailbreak`, `Filter Bypass`, `Adversarial Persona Roleplay`).
  - Delimiter sanitization replaces tags like `<|im_start|>` and `[INST]` with `[SANITIZED_DELIMITER]`.
  - Calculates Shannon entropy on words longer than 40 characters. If entropy $\ge 4.7$, it flags as `HIGH_ENTROPY_PAYLOAD`.
  - Masks PII using simple regexes (`\b\d{3}-\d{2}-\d{4}\b`).
- **Dialog Rails (`dialog_rails.py`)**:
  - Contains a single hardcoded rule: prohibiting direct transitions from `postgres_tool` to `http_api_tool` within the same session.
  - Stores session state in an in-memory dictionary (`self._session_history`). If the server restarts or has multiple workers, this protection vanishes.
  - If an agent calls `postgres_tool` $\to$ `filesystem_tool` $\to$ `http_api_tool`, the direct chain check is completely bypassed!
- **Output Rails (`output_rails.py`)**:
  - Scans response strings for credit cards (passes through Luhn algorithm mod-10), SSNs, AWS keys, and private keys.
  - If found, redacts or blocks depending on context mode.
  - While Luhn verification is technically competent, calling this "Output Rails" gives the false impression of an LLM semantic response safety rail.

**Crucial Finding**: Real NVIDIA NeMo Guardrails uses **Colang** dialogue flow definitions, embeddings to compute semantic similarity with canonical forms, and an LLM verification step. AgentTrust uses none of this.

---

## 4. Deterministic vs. AI-Required Security Controls

A critical requirement of this audit is determining **which problems are solved by deterministic controls and which genuinely require AI**:

| Security Problem | AgentTrust Approach | Appropriate Solution? | Critique |
| :--- | :--- | :--- | :--- |
| **Path Traversal** | Deterministic canonical path resolution (`resolve().relative_to()`) | **YES (Deterministic)** | Correctly implemented in `filesystem_tool.py`. Path traversal is a mathematical boundary problem; AI should never be used here. |
| **SSRF** | IP range validation, private subnet blacklists | **YES (Deterministic)** | Correctly implemented in `http_api_tool.py` (modulo DNS rebinding TOCTOU). Deterministic IP verification is the gold standard. |
| **Permission Scoping** | Deterministic RBAC/ABAC matching | **YES (Deterministic)** | Correct. LLMs should never make final access control decisions. |
| **Prompt Injection** | 6 static regexes | **NO (Requires AI / ML)** | Deterministic regexes cannot solve natural language semantic hijacking. Requires fine-tuned transformer classifiers (e.g. Prompt-Guard) or vector similarity. |
| **Tool Parameter Semantics** | Unchecked raw strings passed to tools | **HYBRID** | Deterministic JSON schema validation + semantic intent verification required. Currently, raw SQL and file paths pass unvetted. |
| **Data Provenance & Taint** | Static dummy table | **DETERMINISTIC DAG** | Provenance is a deterministic graph tracking problem. AgentTrust claimed it, but failed to implement it at runtime. |

---

## 5. Review of the "Autonomous Agent Runner"

The file `backend/app/api/v1/agent_exec.py` provides an endpoint `POST /api/v1/agent-exec/run`.

In documentation and marketing, this is described as:
> *"Executes a real stateful multi-step AI agent task... Demonstrating end-to-end gateway interception and prompt injection neutralization."*

### Source Code Inspection:
Looking at lines 62–157 of `agent_exec.py`:
- **Step 1**: Executes a hardcoded SQL query:
  `SELECT customer_name, company, annual_spend FROM customer_records WHERE status = 'Active'`
- **Step 2**: Writes hardcoded summary text to `reports/agent_task_output.txt`.
- **Step 3**: If `simulate_injection_attack` is True, executes a hardcoded POST to `https://synthetic-sink.agenttrust.internal/leak` with a hardcoded exploit token `"agk_live_synthetic_demo_stolen_token_do_not_use_32b"`.

### Reviewer Verdict:
This is **not an autonomous agent**. It is a scripted demonstration workflow designed to guarantee a successful presentation. There is no LLM inference call, no LangChain/LangGraph agent loop, no dynamic planning, and no reaction to tool outputs. Marketing this as an "Autonomous Agent Runner" is deceptive.

---

## 6. Gaps & Unprotected Attack Vectors

AgentTrust provides **zero protection** against:
1. **Adversarial Jailbreaks**: Persona adoption, hypothetical framing, roleplay, and DAN jailbreaks.
2. **Context Window Stuffing & Token Smuggling**: Concealing injection payloads across long contexts or within JSON/Markdown structures.
3. **Indirect Injection via Database / External Content**: If data retrieved from a database or external web page contains an instruction override, the agent will process it without any ingestion scan.
4. **Steganographic / Multi-Step Exfiltration**: Exfiltrating secrets one character at a time across multiple benign tool calls.
5. **Agent Identity Impersonation via Control Plane**: Any caller can use any `agent_id` in `/agent-exec/run` without authenticating as that agent.
6. **Local Exfiltration**: Leaking secrets by writing them to the sandbox filesystem or inserting them into database tables (DLP only inspects HTTP).

---

## 7. Strategic Recommendations for AI Security

1. **Replace Handcrafted Regexes with Proven Classifiers**:
   - Integrate an open-source, local model such as Meta's **Prompt-Guard** (86M parameters, sub-10ms CPU inference) or Hugging Face's `deberta-v3-base-injection`.
2. **Implement Real Contextual Provenance**:
   - Track data origin (`TRUSTED`, `UNTRUSTED`) in request metadata and propagate this tag to any variables derived from it.
   - If an agent attempts to pass `UNTRUSTED` content to an outbound tool without sanitization, block the call.
3. **Integrate Real Model Context Protocol (MCP)**:
   - Use the official Python `mcp` SDK.
   - Implement real JSON-RPC message inspection, tool list discovery, and client mediation.
4. **Stop Mocking Demonstrations**:
   - Replace the scripted 3-step runner in `agent_exec.py` with an actual LangGraph or CrewAI integration calling a local Ollama or OpenAI model, demonstrating real gateway interception of non-deterministic LLM tool calls.
