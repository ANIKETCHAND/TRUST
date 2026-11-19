from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional

COMPLIANCE_KNOWLEDGE_BASE: List[Dict[str, Any]] = [
    # -------------------------------------------------------------
    # 1. INDIAN CYBERLAW & STATUTORY FRAMEWORKS
    # -------------------------------------------------------------
    {
        "id": "IN-ITACT-SEC43",
        "title": "Penalty and Compensation for Damage to Computer System (Section 43)",
        "framework": "Information Technology Act, 2000 (India)",
        "jurisdiction": "India",
        "citation": "Section 43, Information Technology Act, 2000 (Amended 2008)",
        "effective_date": "2000-10-17 (Amended 2008)",
        "summary": "Establishes civil liability and financial compensation for unauthorized access, data download/extraction, introduction of computer contaminants or viruses, and denial of access to authorized users.",
        "relevance_to_ai_agents": "Applicable when an autonomous AI agent is manipulated via prompt injection or unauthorized tool calls to access, download, or exfiltrate private database records or disrupt computer resources.",
        "mandatory_reporting_timeline": "Civil dispute / Adjudicating Officer petition under Section 46.",
        "legal_implication": "Potential civil liability for damages up to statutory limits for unauthorized extraction of data by automated agents.",
        "recommended_remediation": "Apply zero-trust perimeter containment, revoke agent credentials, and generate cryptographic audit logs of all accessed records.",
        "keywords": ["unauthorized access", "data extraction", "virus", "damage", "database", "exfiltration", "it act", "section 43"]
    },
    {
        "id": "IN-ITACT-SEC66",
        "title": "Computer-Related Offences & Hacking (Section 66)",
        "framework": "Information Technology Act, 2000 (India)",
        "jurisdiction": "India",
        "citation": "Section 66 read with Section 43, Information Technology Act, 2000",
        "effective_date": "2008-10-27",
        "summary": "Imposes criminal penalties (imprisonment up to 3 years or fine up to 5 lakh rupees) for dishonestly or fraudulently doing any act referred to in Section 43.",
        "relevance_to_ai_agents": "Pertains to malicious external actors who deliberately craft adversarial jailbreak payloads or command injection strings to hijack AI agent execution flows.",
        "mandatory_reporting_timeline": "Reporting to cyber police or CERT-In as an unauthorized system compromise.",
        "legal_implication": "Cognizable criminal offence under Indian jurisdiction for intentional compromise of automated workloads.",
        "recommended_remediation": "Preserve volatile process logs, memory dumps, and network ingress PCAP/telemetry as forensic evidence.",
        "keywords": ["hacking", "criminal", "fraudulent", "jailbreak", "command injection", "section 66", "it act"]
    },
    {
        "id": "IN-ITACT-SEC66F",
        "title": "Punishment for Cyber Terrorism (Section 66F)",
        "framework": "Information Technology Act, 2000 (India)",
        "jurisdiction": "India",
        "citation": "Section 66F, Information Technology Act, 2000",
        "effective_date": "2008-10-27",
        "summary": "Severe penal provision (imprisonment up to life) for acts threatening the unity, integrity, security or sovereignty of India or causing denial of access to critical infrastructure.",
        "relevance_to_ai_agents": "Engaged if autonomous agents operating in critical information infrastructure (CII) or defense/energy sectors are hijacked for destructive sabotage.",
        "mandatory_reporting_timeline": "Immediate notification to NCIIPC and CERT-In.",
        "legal_implication": "Non-bailable life imprisonment offence under Indian law.",
        "recommended_remediation": "Activate hardware air-gap isolation and automated kill switch on affected agent host clusters.",
        "keywords": ["cyber terrorism", "critical infrastructure", "sovereignty", "section 66f", "kill switch", "nciipc"]
    },
    {
        "id": "IN-CERTIN-DIR2022",
        "title": "CERT-In Directions on Information Security Practices (28 April 2022)",
        "framework": "CERT-In Directives (No. 20(3)/2022-CERT-In)",
        "jurisdiction": "India",
        "citation": "Directions under sub-section (6) of section 70B of the IT Act, 2000",
        "effective_date": "2022-06-28",
        "summary": "Mandates mandatory reporting of 20 specified cybersecurity incidents to CERT-In within 6 hours of noticing, synchronization of system clocks with NTP, and mandatory retention of system logs for 180 days within Indian jurisdiction.",
        "relevance_to_ai_agents": "AI agent platform compromises (e.g. data exfiltration, unauthorized privilege escalation, rogue agent processes) are reportable cybersecurity incidents.",
        "mandatory_reporting_timeline": "STRICT MANDATORY 6 HOURS from detection to incident@cert-in.org.in.",
        "legal_implication": "Non-compliance punishable under Section 70B(7) of IT Act with imprisonment up to 1 year and/or fine.",
        "recommended_remediation": "Export CrossX Incident Dossier, verify NTP synchronization, preserve 180-day audit log retention, and dispatch report to CERT-In within 6 hours.",
        "keywords": ["cert-in", "6 hours", "180 days", "log retention", "ntp", "mandatory reporting", "section 70b"]
    },
    {
        "id": "IN-DPDPA-2023",
        "title": "Digital Personal Data Protection Act, 2023 (DPDPA)",
        "framework": "Digital Personal Data Protection Act, 2023 (India)",
        "jurisdiction": "India",
        "citation": "Act No. 22 of 2023, Sections 4, 8(5), 8(6), and Schedule (Penalties)",
        "effective_date": "2023-08-11",
        "summary": "Governs the processing of digital personal data. Imposes strict obligations on Data Fiduciaries to maintain reasonable security safeguards to prevent personal data breaches, notify the Data Protection Board and affected individuals in the event of a breach, and imposes penalties up to 250 crore rupees.",
        "relevance_to_ai_agents": "Directly triggered when an agent's DLP guardrails detect PII (Aadhaar, PAN, emails, health/financial records) being leaked or exfiltrated through tool calls or LLM output.",
        "mandatory_reporting_timeline": "Prompt notification to the Data Protection Board of India and affected data principals.",
        "legal_implication": "Penalties up to ₹250 Crores for failure to adopt reasonable security safeguards.",
        "recommended_remediation": "Activate automatic DLP redaction, halt affected agent tool calls, compile PII breach scope report, and prepare Board notification.",
        "keywords": ["dpdp", "dpdpa", "personal data", "pii", "data breach", "fiduciary", "250 crore", "privacy"]
    },

    # -------------------------------------------------------------
    # 2. INTERNATIONAL AI SECURITY FRAMEWORKS
    # -------------------------------------------------------------
    {
        "id": "OWASP-LLM-01",
        "title": "OWASP Top 10 for LLMs: Prompt Injection (LLM01)",
        "framework": "OWASP Top 10 for Large Language Model Applications",
        "jurisdiction": "Global / Industry Standard",
        "citation": "OWASP LLM01:2025 - Prompt Injection (Direct & Indirect)",
        "effective_date": "2023-2025",
        "summary": "Manipulating LLMs via crafted inputs causing the model to disregard developer instructions and execute unauthorized actions.",
        "relevance_to_ai_agents": "Primary threat vector against autonomous agents receiving inputs from untrusted web content, user prompts, or external tool results.",
        "mandatory_reporting_timeline": "Internal SOC ticket / Platform audit trail.",
        "legal_implication": "Failure of architectural due diligence under NIST CSF / EU AI Act Article 15.",
        "recommended_remediation": "Enforce multi-layer defense: Delimiter sanitization, semantic classifier screening, and strict tool execution boundaries.",
        "keywords": ["owasp", "llm01", "prompt injection", "indirect prompt injection", "jailbreak", "system prompt"]
    },
    {
        "id": "OWASP-LLM-02",
        "title": "OWASP Top 10 for LLMs: Sensitive Information Disclosure (LLM02)",
        "framework": "OWASP Top 10 for Large Language Model Applications",
        "jurisdiction": "Global / Industry Standard",
        "citation": "OWASP LLM02:2025 - Sensitive Information Disclosure",
        "effective_date": "2023-2025",
        "summary": "Unintended revelation of confidential algorithms, proprietary data, PII, credentials, or system prompts through LLM output.",
        "relevance_to_ai_agents": "Occurs when an agent outputs raw API keys, passwords, or customer data returned by a database tool.",
        "mandatory_reporting_timeline": "Internal incident classification and DPDPA/GDPR breach assessment.",
        "legal_implication": "Breach of confidentiality agreements and data protection regulations.",
        "recommended_remediation": "Deploy output rails with Luhn verification, entropy secret detectors, and regex token scrubbers.",
        "keywords": ["owasp", "llm02", "sensitive information", "pii", "secrets", "api keys", "dlp"]
    },
    {
        "id": "OWASP-LLM-06",
        "title": "OWASP Top 10 for LLMs: Excessive Agency (LLM06)",
        "framework": "OWASP Top 10 for Large Language Model Applications",
        "jurisdiction": "Global / Industry Standard",
        "citation": "OWASP LLM06:2025 - Excessive Agency",
        "effective_date": "2023-2025",
        "summary": "Granting excessive functionality, permissions, or autonomy to an LLM-based agent without adequate human-in-the-loop or least-privilege guardrails.",
        "relevance_to_ai_agents": "Central vulnerability addressed by CrossX zero-trust gateway: agents must not possess unverified write/delete/execute permissions.",
        "mandatory_reporting_timeline": "Continuous authorization review.",
        "legal_implication": "High risk of autonomous liability and regulatory non-compliance.",
        "recommended_remediation": "Enforce fine-grained deterministic permissions, human-in-the-loop approvals for critical actions, and automated quarantine.",
        "keywords": ["owasp", "llm06", "excessive agency", "permissions", "least privilege", "zero trust"]
    },
    {
        "id": "NIST-AI-RMF-10",
        "title": "NIST AI Risk Management Framework (AI RMF 1.0)",
        "framework": "NIST AI RMF 1.0 (NIST SP 1270)",
        "jurisdiction": "United States / International Standard",
        "citation": "NIST AI RMF 1.0 - GOVERN, MAP, MEASURE, MANAGE Functions",
        "effective_date": "2023-01-26",
        "summary": "Comprehensive framework providing guidance to organizations designing, developing, and deploying AI systems to manage risks associated with safety, security, and trustworthiness.",
        "relevance_to_ai_agents": "Establishes baseline criteria for evaluating adversarial robustness, transparent logging, explainable risk scoring, and autonomous kill switches.",
        "mandatory_reporting_timeline": "Periodic AI risk assessment audits.",
        "legal_implication": "Adopted by US federal agencies and referenced in AI procurement standards.",
        "recommended_remediation": "Maintain explainable ML risk scoring, reproducible model evaluation benchmarks, and auditable governance logs.",
        "keywords": ["nist", "ai rmf", "govern", "map", "measure", "manage", "trustworthy ai"]
    },
    {
        "id": "MITRE-ATLAS",
        "title": "MITRE ATLAS (Adversarial Threat Landscape for AI Systems)",
        "framework": "MITRE ATLAS Matrix",
        "jurisdiction": "Global Cybersecurity Standard",
        "citation": "MITRE ATLAS: AML.T0051 (LLM Prompt Injection), AML.T0054 (LLM Jailbreak), AML.T0043 (Exfiltration)",
        "effective_date": "2023-2025",
        "summary": "Knowledge base of adversary tactics, techniques, and case studies targeting machine learning and artificial intelligence systems.",
        "relevance_to_ai_agents": "Maps attack patterns against agents to standardized tactic identifiers for SOC integration.",
        "mandatory_reporting_timeline": "SOC incident taxonomy.",
        "legal_implication": "Defensible standard for threat classification and incident categorization.",
        "recommended_remediation": "Correlate gateway violation events with ATLAS technique identifiers in incident reports.",
        "keywords": ["mitre", "atlas", "aml.t0051", "aml.t0054", "adversarial ml", "tactics", "techniques"]
    }
]


class ComplianceKnowledgeService:
    """
    Search and Advisory Service for Indian Cyberlaw & Global AI Cybersecurity Standards.
    """

    def search(
        self,
        query: str,
        framework: Optional[str] = None,
        jurisdiction: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieval-based search across legal articles, statutory citations, and security frameworks.
        """
        q_tokens = set(re.findall(r"\w+", query.lower()))
        results = []

        for item in COMPLIANCE_KNOWLEDGE_BASE:
            if framework and framework.lower() not in item["framework"].lower():
                continue
            if jurisdiction and jurisdiction.lower() not in item["jurisdiction"].lower():
                continue

            # Calculate match score based on keyword and text overlap
            haystack = (
                item["title"] + " " +
                item["summary"] + " " +
                item["citation"] + " " +
                " ".join(item["keywords"])
            ).lower()

            score = sum(1 for tok in q_tokens if tok in haystack)
            if score > 0 or not query.strip():
                results.append((score, item))

        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results]

    def get_article(self, article_id: str) -> Optional[Dict[str, Any]]:
        for item in COMPLIANCE_KNOWLEDGE_BASE:
            if item["id"].lower() == article_id.lower():
                return item
        return None

    def get_frameworks(self) -> List[Dict[str, Any]]:
        framework_names = set(item["framework"] for item in COMPLIANCE_KNOWLEDGE_BASE)
        return [
            {
                "framework": fw,
                "articles_count": sum(1 for item in COMPLIANCE_KNOWLEDGE_BASE if item["framework"] == fw),
                "jurisdiction": next(item["jurisdiction"] for item in COMPLIANCE_KNOWLEDGE_BASE if item["framework"] == fw)
            }
            for fw in framework_names
        ]

    def assess_incident(self, category: str, details: str) -> Dict[str, Any]:
        """
        Assesses a security incident against Indian law and international standards.
        Returns potential legal implications, statutory reporting obligations, and verified citations.
        """
        cat_lower = category.lower()
        det_lower = details.lower()

        applicable_citations = []
        reporting_deadlines = []
        implications = []
        remediations = []

        # 1. Check for CERT-In applicability (any severe cyber compromise)
        if any(term in cat_lower or term in det_lower for term in ["injection", "exfiltration", "ssrf", "rce", "compromise", "kill", "quarantine"]):
            applicable_citations.append("CERT-In Directions (No. 20(3)/2022-CERT-In) under Section 70B(6) IT Act")
            reporting_deadlines.append("Mandatory 6-hour incident report to incident@cert-in.org.in")
            implications.append("Statutory compliance requirement to report within 6 hours. Logs must be preserved for 180 days.")
            remediations.append("Export incident dossier from CrossX and report to CERT-In within 6 hours.")

        # 2. Check for DPDP Act (PII / data leakage)
        if any(term in cat_lower or term in det_lower for term in ["dlp", "pii", "exfiltration", "data_leak", "personal_data", "ssn", "aadhaar", "pan"]):
            applicable_citations.append("Section 8(6) & Schedule, Digital Personal Data Protection Act, 2023 (DPDPA)")
            reporting_deadlines.append("Prompt notification to Data Protection Board of India and affected data principals")
            implications.append("Potential regulatory penalty under DPDPA for failure to implement reasonable security safeguards.")
            remediations.append("Enforce automated DLP masking on all outbound agent interfaces.")

        # 3. Check for IT Act Section 43/66 (unauthorized access / hacking)
        if any(term in cat_lower or term in det_lower for term in ["unauthorized", "jailbreak", "injection", "privilege_escalation", "sqli"]):
            applicable_citations.append("Section 66 read with Section 43, Information Technology Act, 2000")
            implications.append("Potential criminal hacking offence for external perpetrator under Indian IT Act.")
            remediations.append("Null-route external attacker IP and archive tamper-evident audit chain for law enforcement forensics.")

        # 4. Check OWASP & MITRE
        if "injection" in cat_lower or "prompt" in det_lower:
            applicable_citations.append("OWASP Top 10 for LLMs: LLM01 Prompt Injection")
            applicable_citations.append("MITRE ATLAS: AML.T0051 (Adversarial Prompt Injection)")
        if "exfiltration" in cat_lower or "leak" in det_lower:
            applicable_citations.append("OWASP Top 10 for LLMs: LLM02 Sensitive Information Disclosure")
            applicable_citations.append("MITRE ATLAS: AML.T0043 (Exfiltration via Agent)")

        return {
            "assessment_timestamp": datetime.now(timezone.utc).isoformat(),
            "incident_category": category,
            "applicable_statutory_citations": list(dict.fromkeys(applicable_citations)),
            "mandatory_reporting_obligations": list(dict.fromkeys(reporting_deadlines)),
            "potential_legal_implications": list(dict.fromkeys(implications)),
            "recommended_remediations": list(dict.fromkeys(remediations)),
            "disclaimer": "This analysis provides automated cybersecurity compliance guidance and does not constitute formal legal representation."
        }


compliance_knowledge_service = ComplianceKnowledgeService()
