"""
Output Rails: NVIDIA NeMo-Style Deep DLP, Secret Redaction, and Output Validation.
Inspects tool return payloads, LLM responses, and outbound data flows before delivery.
Enforces:
- Algorithmic Luhn verification for payment cards
- US SSN structure and invalid prefix validation
- High-entropy API keys, JWT tokens, and cryptographic private keys
- Confidentiality classification markers
- Automatic redaction or fail-closed blocking
"""

import copy
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class OutputRailResult:
    allowed: bool
    leaks_detected: bool
    findings: List[Dict[str, Any]] = field(default_factory=list)
    sanitized_payload: Any = None
    severity: str = "CLEAN"  # "CLEAN", "LOW", "MEDIUM", "HIGH", "CRITICAL"
    reason: Optional[str] = None


class OutputRails:
    """
    Tier-3 Guardrails: Output Rails
    Prevents unauthorized data exfiltration and credential leakage in response payloads.
    """

    CC_CANDIDATE_REGEX = re.compile(r"\b(?:\d[ -]?){13,19}\b")
    SSN_REGEX = re.compile(r"\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b")
    PRIVATE_KEY_REGEX = re.compile(r"-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP|PRIVATE) KEY-----[\s\S]*?-----END (?:RSA|EC|DSA|OPENSSH|PGP|PRIVATE) KEY-----")
    AWS_KEY_REGEX = re.compile(r"\bAKIA[0-9A-Z]{16}\b")
    API_SECRET_REGEX = re.compile(r"\b(?:sk-[a-zA-Z0-9_-]{24,}|ghp_[a-zA-Z0-9]{36}|agk_live_[a-zA-Z0-9_-]{32,}|xox[baprs]-[a-zA-Z0-9]{10,})\b")
    JWT_REGEX = re.compile(r"\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b")
    CONFIDENTIAL_REGEX = re.compile(r"\b(STRICTLY CONFIDENTIAL|TOP SECRET|RESTRICTED CONFIDENTIAL|PROPRIETARY INTERNAL)\b", re.IGNORECASE)

    @staticmethod
    def passes_luhn(card_number_str: str) -> bool:
        """Applies Luhn mod-10 algorithm to verify valid credit card numbers."""
        clean = re.sub(r"\D", "", card_number_str)
        if len(clean) < 13 or len(clean) > 19:
            return False
        # Disallow sequences with all identical digits (e.g. 0000000000000000) or leading zero
        if len(set(clean)) <= 1 or clean.startswith("0"):
            return False
        digits = [int(d) for d in clean]
        checksum = 0
        reverse_digits = digits[::-1]
        for idx, num in enumerate(reverse_digits):
            if idx % 2 == 1:
                doubled = num * 2
                checksum += (doubled - 9) if doubled > 9 else doubled
            else:
                checksum += num
        return checksum % 10 == 0

    def scan_string(self, text: str) -> Tuple[List[Dict[str, Any]], str]:
        """
        Scans a text string for sensitive patterns and produces findings + sanitized string.
        """
        findings = []
        sanitized = text

        # 1. Private Keys
        pk_matches = self.PRIVATE_KEY_REGEX.findall(sanitized)
        if pk_matches:
            findings.append({
                "type": "PRIVATE_KEY",
                "description": "Cryptographic Private Key",
                "severity": "CRITICAL",
                "count": len(pk_matches)
            })
            sanitized = self.PRIVATE_KEY_REGEX.sub("[REDACTED_PRIVATE_KEY]", sanitized)

        # 2. AWS Keys
        aws_matches = self.AWS_KEY_REGEX.findall(sanitized)
        if aws_matches:
            findings.append({
                "type": "AWS_KEY",
                "description": "AWS IAM Access Key ID",
                "severity": "CRITICAL",
                "count": len(aws_matches)
            })
            sanitized = self.AWS_KEY_REGEX.sub("[REDACTED_AWS_KEY]", sanitized)

        # 3. High-Entropy API Secrets
        api_matches = self.API_SECRET_REGEX.findall(sanitized)
        if api_matches:
            findings.append({
                "type": "API_SECRET",
                "description": "API / Platform Secret Token",
                "severity": "CRITICAL",
                "count": len(api_matches)
            })
            sanitized = self.API_SECRET_REGEX.sub("[REDACTED_SECRET_KEY]", sanitized)

        # 4. JWT Tokens
        jwt_matches = self.JWT_REGEX.findall(sanitized)
        if jwt_matches:
            findings.append({
                "type": "JWT_TOKEN",
                "description": "JSON Web Token (JWT)",
                "severity": "HIGH",
                "count": len(jwt_matches)
            })
            sanitized = self.JWT_REGEX.sub("[REDACTED_JWT_TOKEN]", sanitized)

        # 5. Algorithmic Credit Cards (Luhn validated)
        valid_cards = []
        for match in self.CC_CANDIDATE_REGEX.finditer(sanitized):
            candidate = match.group(0)
            if self.passes_luhn(candidate):
                valid_cards.append(candidate)
                findings.append({
                    "type": "PAYMENT_CARD",
                    "description": "Validated Payment Card (Luhn-Verified)",
                    "severity": "CRITICAL",
                    "count": 1,
                    "sample": candidate[:4] + " **** **** " + candidate[-4:]
                })
        for c in set(valid_cards):
            sanitized = sanitized.replace(c, "[REDACTED_CREDIT_CARD]")

        # 6. US SSN
        ssn_matches = self.SSN_REGEX.findall(sanitized)
        if ssn_matches:
            findings.append({
                "type": "US_SSN",
                "description": "Valid US Social Security Number",
                "severity": "CRITICAL",
                "count": len(ssn_matches)
            })
            sanitized = self.SSN_REGEX.sub("[REDACTED_SSN]", sanitized)

        # 7. Confidentiality Markers
        conf_matches = self.CONFIDENTIAL_REGEX.findall(sanitized)
        if conf_matches:
            findings.append({
                "type": "CONFIDENTIAL_CLASSIFICATION",
                "description": "Enterprise Confidentiality Classification Marker",
                "severity": "HIGH",
                "count": len(conf_matches)
            })

        return findings, sanitized

    def inspect_and_sanitize(self, payload: Any, mode: str = "redact") -> OutputRailResult:
        """
        Recursively inspects a response payload.
        Args:
            payload: Any JSON-serializable structure or string.
            mode: "redact" (mask secrets in place) or "block" (fail closed if critical secrets found).
        """
        all_findings: List[Dict[str, Any]] = []

        def _traverse(obj: Any) -> Any:
            if isinstance(obj, str):
                findings, sanitized = self.scan_string(obj)
                all_findings.extend(findings)
                return sanitized if mode == "redact" else obj
            elif isinstance(obj, dict):
                return {k: _traverse(v) for k, v in obj.items()}
            elif isinstance(obj, (list, tuple)):
                return [_traverse(x) for x in obj]
            return obj

        sanitized_payload = _traverse(payload)
        leaks_detected = len(all_findings) > 0

        severity = "CLEAN"
        if any(f["severity"] == "CRITICAL" for f in all_findings):
            severity = "CRITICAL"
        elif any(f["severity"] == "HIGH" for f in all_findings):
            severity = "HIGH"
        elif leaks_detected:
            severity = "MEDIUM"

        allowed = True
        reason = None
        if leaks_detected:
            top_desc = all_findings[0]["description"]
            if mode == "block" and severity in ["CRITICAL", "HIGH"]:
                allowed = False
                reason = f"Output Rail Blocked: Outbound exfiltration containing {top_desc} ({severity} severity)."
            else:
                reason = f"Output Rail Redacted: Sanitized {len(all_findings)} sensitive token(s) ({top_desc})."

        return OutputRailResult(
            allowed=allowed,
            leaks_detected=leaks_detected,
            findings=all_findings,
            sanitized_payload=sanitized_payload,
            severity=severity,
            reason=reason
        )


output_rails = OutputRails()
