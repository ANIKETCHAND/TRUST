# AGENTTRUST — TECHNICAL AUDIT
## RESEARCH & COMPETITOR DIFFERENTIATION ANALYSIS

**Target Platform:** AgentTrust AI Security Platform  
**Audit Date:** November 12, 2026  
**Auditor:** Academic Research & Competitive Intelligence Panel  

---

### 1. COMPETITIVE LANDSCAPE TAXONOMY

The emerging field of AI Agent Security and Governance spans several distinct architectural approaches:
1. **Workload Identity & IAM Governance:** (e.g., Microsoft Entra Agent ID)
2. **LLM Input/Output Guardrails & Jailbreak Defenses:** (e.g., Lakera Guard, NVIDIA NeMo Guardrails, Protect AI)
3. **Enterprise Network & Perimeter Inspection:** (e.g., Cisco AI Defense, Cloudflare for AI)
4. **General Policy Engines & Authorization Sidecars:** (e.g., Open Policy Agent / Styra, Pipelock)
5. **Integrated AI Agent SOC & Active Defense:** (AgentTrust's proposed category)

---

### 2. DETAILED COMPARATIVE MATRIX

| Architectural Capability | AgentTrust | Microsoft Entra Agent ID | Lakera Guard | NVIDIA NeMo Guardrails | Open Policy Agent (OPA) | Pipelock Sidecar |
|---|---|---|---|---|---|---|
| **Agent Identity Model** | Scoped API Keys (`agk_live_...`) with SHA-256 DB hashes | Entra Workload Identity, Managed Identity, OIDC | None (Stateless API) | None (Session tokens) | External SPIFFE / JWT | Cryptographic Keypairs |
| **Delegation Governance** | Multi-hop DAG (max depth 1–5), transitive cascade revocation | OAuth 2.0 Token Exchange (RFC 8693), Conditional Access | None | None | Rego-based hierarchical policies | Signed action receipts |
| **Gateway Tool Mediation** | In-process Python gateway evaluating policies before handler dispatch | Cloud API Gateway / Reverse Proxy | Stateless guardrail endpoint | Conversational Dialog Rails (Colang) | Policy Decision Point (PDP) | Sidecar Proxy (Egress / Ingress) |
| **Prompt Injection Defense** | Regex + Leetspeak + Base64 + TF-IDF Cosine vs 12 Anchors | None (relies on Azure AI Content Safety) | Trained Transformer Classifier (DeBERTa / Llama-Guard) | LLM Self-Check / Semantic Vector Search | None (Evaluates structured JSON) | Pattern matching & receipts |
| **DLP & Secret Redaction** | Algorithmic Luhn (CC), US SSN, high-entropy regex (sk-, ghp-, AKIA) | Microsoft Purview Integration | Contextual entity masking | Masking & Redaction Rails | Rego pattern matching | Secret redaction proxy |
| **Active Defense Countermeasures** | 1-Click Process Kill Switch, OS Sinkhole (`netsh`/`iptables`), Tarpit Canary | Automated Identity Revocation / Account Disable | API Request Blocking | Conversational Refusal | Policy Deny | Proxy Drop |
| **Browser Extension** | Manifest V3 (DOM hooks, synchronous Enter/Click interceptor) | None | None | None | None | None |
| **Endpoint Host Daemon** | Python daemon (`psutil`) with process suspension containment | Defender for Endpoint (MDE) | None | None | Host agent daemon | Docker sidecar container |
| **Audit Ledger Integrity** | HMAC-SHA256 Chained Ledger with `verify-chain` | Azure Monitor / Unified Audit Log | Logged API calls | Stateless logs | Structured JSON audit | Cryptographic action receipts |

---

### 3. ARCHITECTURAL COMPARISONS & CONTRASTS

#### A. AgentTrust vs. Microsoft Entra Agent ID:
- **Entra Agent ID:** Designed for global enterprise directory federation. Treats AI agents as first-class directory principals (Service Principals / Managed Identities) with support for OAuth 2.0 Token Exchange (RFC 8693), Conditional Access policies, and federation with Azure RBAC.
- **AgentTrust Contrast:** AgentTrust operates at the application runtime layer rather than the enterprise identity provider layer. It issues application-specific bearer keys and maintains an in-database delegation DAG. While Entra governs *who* an agent is, AgentTrust governs *what tools* the agent can invoke and inspects parameter payloads for prompt injection, path traversal, and SSRF.
- **Recommendation:** Rather than competing with Entra, AgentTrust should implement OIDC / RFC 8693 federation so Entra service principals can map directly into AgentTrust agent entities.

#### B. AgentTrust vs. Lakera Guard:
- **Lakera Guard:** A dedicated, low-latency (< 30ms) machine-learning security API. Trained on extensive, evolving empirical datasets of jailbreaks, indirect injections, and system prompt exfiltration vectors across multiple human languages.
- **AgentTrust Contrast:** AgentTrust’s prompt injection engine relies on regex signatures, string transliteration, and a basic scikit-learn TF-IDF n-gram vectorizer compared against 12 hardcoded English anchor sentences. It lacks deep semantic contextual awareness and language adaptability. Lakera Guard is vastly superior in AI/ML threat detection accuracy.

#### C. AgentTrust vs. NVIDIA NeMo Guardrails:
- **NeMo Guardrails:** An extensible, dialogue-driven safety framework utilizing Colang scripts. Allows developers to define conversational canonical forms, user intent flows, and conversational guardrails where an LLM checks inputs and outputs in context.
- **AgentTrust Contrast:** AgentTrust adopts NeMo's conceptual taxonomy ("Input Rails", "Dialog Rails", "Output Rails") but implements them as **deterministic, non-LLM Python code** (Luhn card check, regex, dictionary state transitions). This makes AgentTrust substantially faster (< 1ms latency vs 200-800ms for LLM self-checks) and deterministic, but incapable of nuanced natural language conversational alignment.

#### D. AgentTrust vs. Open Policy Agent (OPA):
- **OPA:** The CNCF industry standard for declarative policy evaluation using the Rego query language. Evaluates JSON inputs against declarative policies with microsecond latency.
- **AgentTrust Contrast:** AgentTrust contains its own relational policy engine (storing JSON rules in SQLite/Postgres) and provides an optional HTTP adapter to query OPA as a secondary decision engine (`OPAService`).

#### E. AgentTrust vs. Pipelock:
- **Pipelock:** Operates as a transparent network sidecar proxy that intercepts Model Context Protocol (MCP) tool traffic and issues cryptographic receipts.
- **AgentTrust Contrast:** AgentTrust incorporates an internal tool registry and includes an adapter for Pipelock (`PipelockService`), but its built-in MCP tool (`mcp_tool.py`) is currently a routing envelope stub.

---

### 4. MEANINGFUL TECHNICAL DIFFERENTIATION & NOVELTY

Despite certain marketing overstatements, AgentTrust provides a compelling and novel architectural contribution:
1. **Convergence of Pre-Execution Gateway + Active Defense:** Most AI security platforms operate purely passively (logging alerts) or statelessly (blocking an API call). AgentTrust uniquely integrates **active countermeasures**: if an agent goes rogue or an attacker scans the gateway, the platform can terminate the offending process tree (`kill_process`), null-route the IP at the host OS firewall (`netsh`/`iptables`), or trap the caller in a deceptive tarpit with synthetic canary tokens.
2. **Unified Browser + Endpoint + Gateway SOC:** Providing a unified single-pane-of-glass console bridging browser portal interactions (ChatGPT/Claude web interface via Manifest V3) and backend API gateway execution is a practical enterprise operational workflow.
3. **Deterministic Multi-Hop Cascades:** The mathematical constraint on delegation depth (1–5) and automatic transitive revocation across the delegation tree is well-engineered and verified live.

---

### 5. UNSUPPORTED & OVERSTATED CLAIMS

The audit identified the following claims in project documentation that are not supported by the implementation:
1. **"Advanced Deep Learning AI Threat Detector":** There is no deep neural network or trained transformer model in the codebase. Detection relies on regex patterns, Shannon entropy, and scikit-learn TF-IDF character n-grams.
2. **"Autonomous AI Agent Workflow Executor":** The agent runner does not plan, reason, or invoke tools dynamically via an autonomous LLM loop. It executes a hardcoded 3-step Python script.
3. **"Global Threat Attribution":** Geolocation for arbitrary WAN IPs does not query a true GeoIP provider (MaxMind GeoIP2 or IP2Location); it assigns cities and ASNs based on the first octet of the IP address.
4. **"Fully Integrated Model Context Protocol (MCP) Bridge":** `mcp_tool.py` is a static routing stub and does not implement the full MCP JSON-RPC protocol over stdio or SSE.
