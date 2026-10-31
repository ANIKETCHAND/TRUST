import re
from typing import Any, Dict, List, Tuple


class DLPScannerService:
    """
    Data Leakage Prevention (DLP) Inspection Service:
    Scans outgoing payloads, file contents, and API requests for sensitive data signatures.
    """

    PATTERNS = {
        "CREDIT_CARD": (
            re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),
            "Payment Card Number"
        ),
        "US_SSN": (
            re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            "Social Security Number"
        ),
        "PRIVATE_KEY": (
            re.compile(r"-----BEGIN (?:RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----"),
            "Cryptographic Private Key"
        ),
        "AWS_KEY": (
            re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
            "AWS Access Key ID"
        ),
        "API_SECRET_KEY": (
            re.compile(r"\b(?:sk-[a-zA-Z0-9]{32,}|ghp_[a-zA-Z0-9]{36}|agk_live_[a-zA-Z0-9_-]{32,})\b"),
            "High-Entropy Secret Token"
        ),
        "CONFIDENTIAL_MARKER": (
            re.compile(r"\b(STRICTLY CONFIDENTIAL|TOP SECRET|INTERNAL ONLY|RESTRICTED CONFIDENTIAL)\b", re.IGNORECASE),
            "Confidentiality Classification Marker"
        )
    }

    def scan_text(self, text: str) -> List[Dict[str, Any]]:
        findings = []
        if not text or not isinstance(text, str):
            return findings

        for pattern_name, (regex, desc) in self.PATTERNS.items():
            matches = regex.findall(text)
            if matches:
                findings.append({
                    "pattern": pattern_name,
                    "description": desc,
                    "count": len(matches),
                    "sample": matches[0][:8] + "..." if len(matches[0]) > 8 else "[MATCHED]"
                })
        return findings

    def inspect_payload(self, payload: Any) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        Recursively inspects a request/response structure for sensitive data.
        Returns:
            (has_leakage, list_of_findings)
        """
        findings = []

        def _traverse(val):
            if isinstance(val, str):
                res = self.scan_text(val)
                findings.extend(res)
            elif isinstance(val, dict):
                for v in val.values():
                    _traverse(v)
            elif isinstance(val, (list, tuple)):
                for item in val:
                    _traverse(item)

        _traverse(payload)
        return (len(findings) > 0), findings


dlp_service = DLPScannerService()
