"""
Input Rails: NVIDIA NeMo-Style Input Validation and Pre-Flight Sanitization.
Intercepts incoming prompts and tool execution parameters before they reach models or execution engines.
Enforces:
- Heuristic and pattern prompt injection detection
- Token Shannon entropy & obfuscation analysis
- Jailbreak & persona shift prevention
- Delimiter sanitization
- PII and credential stripping/masking
"""

import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class InputRailResult:
    allowed: bool
    threat_level: str  # "CLEAN", "LOW", "MEDIUM", "HIGH", "CRITICAL"
    risk_score: float  # 0.0 - 100.0
    findings: List[Dict[str, Any]] = field(default_factory=list)
    sanitized_parameters: Dict[str, Any] = field(default_factory=dict)
    reason: Optional[str] = None


class InputRails:
    """
    Tier-1 Guardrails: Input Rails
    Ensures that input prompts, parameters, and payloads are benign, stripped of delimiters,
    and sanitized of high-risk injection attempts.
    """

    INJECTION_PATTERNS = [
        (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE), "Instruction Override Attempt", 40.0),
        (re.compile(r"system\s*override|emergency\s*override", re.IGNORECASE), "System Override Token", 45.0),
        (re.compile(r"disregard\s+(?:the\s+)?(?:system\s+prompt|rules|constraints|guardrails)", re.IGNORECASE), "Safety Constraint Bypass", 40.0),
        (re.compile(r"you\s+are\s+now\s+(?:in\s+)?(?:developer|god|unrestricted|jailbreak|dan)\s+mode", re.IGNORECASE), "Jailbreak Persona Shift", 45.0),
        (re.compile(r"do\s+anything\s+now\s*\(?dan\)?", re.IGNORECASE), "DAN Jailbreak Signature", 50.0),
        (re.compile(r"(?:exfiltrate|send|leak|forward)\s+(?:all\s+)?(?:data|secrets?|files?|credentials?|keys?)\s+to", re.IGNORECASE), "Data Exfiltration Directive", 50.0),
        (re.compile(r"curl\s+-X\s+POST|wget\s+http|nc\s+-e|bash\s+-i", re.IGNORECASE), "Shell Command Extraction Signature", 45.0),
        (re.compile(r"bypass\s+(?:content\s+filter|safety\s+guidelines|restrictions)", re.IGNORECASE), "Filter Bypass Directive", 35.0),
        (re.compile(r"roleplay\s+as\s+(?:an?\s+evil|an?\s+unfiltered|an?\s+unethical)\s+ai", re.IGNORECASE), "Adversarial Persona Roleplay", 35.0),
    ]

    DELIMITER_PATTERNS = [
        (re.compile(r"<\|im_start\|>", re.IGNORECASE), "<|im_start|> Delimiter Tag"),
        (re.compile(r"<\|im_end\|>", re.IGNORECASE), "<|im_end|> Delimiter Tag"),
        (re.compile(r"<\|endoftext\|>", re.IGNORECASE), "<|endoftext|> End-of-Text Tag"),
        (re.compile(r"\[INST\]|\[/INST\]", re.IGNORECASE), "Llama Instruction Tag"),
        (re.compile(r"```(?:system|admin|root)", re.IGNORECASE), "Faked System Delimiter"),
        (re.compile(r"Human:\s*|Assistant:\s*", re.IGNORECASE), "Dialogue Marker Injection"),
    ]

    PII_MASK_PATTERNS = [
        (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"), "[REDACTED_EMAIL]"),
        (re.compile(r"\b(?:\+?1[-.]?)?\(?[2-9]\d{2}\)?[-.]?\d{3}[-.]?\d{4}\b"), "[REDACTED_PHONE]"),
        (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED_SSN]"),
        (re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"), "[REDACTED_CREDIT_CARD]"),
        (re.compile(r"\b(?:sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|agk_live_[a-zA-Z0-9_-]{32,})\b"), "[REDACTED_API_KEY]"),
        (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY]"),
    ]

    @staticmethod
    def calculate_shannon_entropy(text: str) -> float:
        """Calculates Shannon entropy in bits per character."""
        if not text:
            return 0.0
        prob = [float(text.count(c)) / len(text) for c in dict.fromkeys(list(text))]
        entropy = -sum([p * math.log(p) / math.log(2.0) for p in prob if p > 0])
        return round(entropy, 3)

    def sanitize_delimiters(self, text: str) -> Tuple[str, List[Dict[str, str]]]:
        """Neutralizes prompt delimiter injection markers."""
        findings = []
        cleaned = text
        for regex, desc in self.DELIMITER_PATTERNS:
            matches = regex.findall(cleaned)
            if matches:
                findings.append({"pattern": desc, "count": len(matches)})
                cleaned = regex.sub("[SANITIZED_DELIMITER]", cleaned)
        return cleaned, findings

    def mask_pii_and_credentials(self, text: str) -> Tuple[str, int]:
        """Replaces sensitive PII and secrets with redaction placeholders."""
        redacted = text
        total_redacted = 0
        for regex, placeholder in self.PII_MASK_PATTERNS:
            matches = regex.findall(redacted)
            if matches:
                total_redacted += len(matches)
                redacted = regex.sub(placeholder, redacted)
        return redacted, total_redacted

    def sanitize_parameter_value(self, val: Any) -> Any:
        """Recursively sanitizes parameter values."""
        if isinstance(val, str):
            cleaned, _ = self.sanitize_delimiters(val)
            masked, _ = self.mask_pii_and_credentials(cleaned)
            return masked
        elif isinstance(val, dict):
            return {k: self.sanitize_parameter_value(v) for k, v in val.items()}
        elif isinstance(val, list):
            return [self.sanitize_parameter_value(x) for x in val]
        return val

    def evaluate(self, parameters: Optional[Dict[str, Any]] = None, context: Optional[Dict[str, Any]] = None) -> InputRailResult:
        """
        Executes NVIDIA NeMo-style Input Rails on parameters and context.
        """
        if parameters is None:
            parameters = {}
        findings: List[Dict[str, Any]] = []
        raw_text_corpus = " ".join(
            str(v) for v in parameters.values() if isinstance(v, (str, int, float, list, dict))
        )

        if context and "task_prompt" in context:
            raw_text_corpus += f" {context['task_prompt']}"

        risk_score = 0.0

        # 1. Prompt Injection & Jailbreak Scans
        for regex, desc, score_weight in self.INJECTION_PATTERNS:
            m = regex.search(raw_text_corpus)
            if m:
                findings.append({
                    "category": "PROMPT_INJECTION",
                    "pattern": desc,
                    "snippet": m.group(0),
                    "severity": "CRITICAL" if score_weight >= 45.0 else "HIGH"
                })
                risk_score += score_weight

        # 2. Delimiter Injection Check
        _, delimiter_findings = self.sanitize_delimiters(raw_text_corpus)
        for df in delimiter_findings:
            findings.append({
                "category": "DELIMITER_INJECTION",
                "pattern": df["pattern"],
                "count": df["count"],
                "severity": "MEDIUM"
            })
            risk_score += 15.0

        # 3. High-Entropy & Obfuscation Analysis
        # Check long continuous tokens for base64 / shellcode / high entropy
        words = raw_text_corpus.split()
        for w in words:
            if len(w) > 40:
                ent = self.calculate_shannon_entropy(w)
                is_base64_charset = bool(re.match(r"^[A-Za-z0-9+/=]{40,}$", w))
                # English text has entropy ~3.5-4.5. Encoded base64 is typically > 4.6
                if ent >= 4.7 or (is_base64_charset and ent >= 4.4):
                    findings.append({
                        "category": "HIGH_ENTROPY_PAYLOAD",
                        "pattern": f"Suspicious High-Entropy Token (entropy: {ent})",
                        "snippet": w[:24] + "...",
                        "severity": "HIGH"
                    })
                    risk_score += 25.0
                    break

        risk_score = min(risk_score, 100.0)

        threat_level = "CLEAN"
        if risk_score >= 70.0:
            threat_level = "CRITICAL"
        elif risk_score >= 40.0:
            threat_level = "HIGH"
        elif risk_score >= 20.0:
            threat_level = "MEDIUM"
        elif risk_score > 0.0:
            threat_level = "LOW"

        # Sanitize parameters
        sanitized_params = self.sanitize_parameter_value(parameters)

        # Fail-closed threshold: Any HIGH or CRITICAL threat level is rejected by Input Rails
        allowed = (threat_level not in ["HIGH", "CRITICAL"])
        reason = None
        if not allowed:
            top_finding = findings[0]["pattern"] if findings else "Unspecified input hazard"
            reason = f"Input Rail Blocked: Prompt Injection - {top_finding} (Threat Level: {threat_level}, Risk: {risk_score:.1f})"

        return InputRailResult(
            allowed=allowed,
            threat_level=threat_level,
            risk_score=risk_score,
            findings=findings,
            sanitized_parameters=sanitized_params,
            reason=reason
        )


input_rails = InputRails()
