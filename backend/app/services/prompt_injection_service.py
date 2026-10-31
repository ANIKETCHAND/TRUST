import re
from typing import Any, Dict, List, Tuple


class PromptInjectionDetectorService:
    """
    Analyzes untrusted documents, provenance inputs, and context strings
    for indirect prompt injection signatures and unauthorized instruction hijacking.
    """

    INJECTION_PATTERNS = [
        (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?", re.IGNORECASE), "Instruction Override Attempt"),
        (re.compile(r"system\s*override|emergency\s*override", re.IGNORECASE), "System Override Token"),
        (re.compile(r"disregard\s+(?:the\s+)?(?:system\s+prompt|rules|constraints)", re.IGNORECASE), "Safety Constraint Bypass"),
        (re.compile(r"you\s+are\s+now\s+(?:in\s+)?(?:developer|god|unrestricted)\s+mode", re.IGNORECASE), "Jailbreak Persona Shift"),
        (re.compile(r"(?:exfiltrate|send|leak|forward)\s+(?:all\s+)?(?:data|secrets?|files?|credentials?)\s+to", re.IGNORECASE), "Data Exfiltration Directive"),
        (re.compile(r"curl\s+-X\s+POST|wget\s+http|nc\s+-e", re.IGNORECASE), "Shell Command Extraction Signature"),
    ]

    def analyze_content(self, text: str) -> Tuple[bool, str, List[Dict[str, str]]]:
        """
        Scans content for prompt injection indicators.
        Returns:
            (is_suspicious, threat_level, findings)
        """
        if not text or not isinstance(text, str):
            return False, "CLEAN", []

        findings = []
        for regex, desc in self.INJECTION_PATTERNS:
            if regex.search(text):
                findings.append({"pattern": desc, "snippet": regex.search(text).group(0)})

        if not findings:
            return False, "CLEAN", []
        
        threat_level = "HIGH" if len(findings) >= 2 or any("exfiltrate" in f["pattern"].lower() for f in findings) else "MEDIUM"
        return True, threat_level, findings


prompt_injection_service = PromptInjectionDetectorService()
