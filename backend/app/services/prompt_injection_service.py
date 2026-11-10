import base64
import math
import re
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


class PromptInjectionDetectorService:
    """
    Multi-Layered Semantic Prompt Injection & Jailbreak Detector.
    Implements:
    - Layer 1: Unicode homoglyph normalization, zero-width stripping, and leetspeak transliteration.
    - Layer 2: Expanded regex library covering direct overrides, delimiter smuggling, refusal suppression, and persona shifts.
    - Layer 3: Base64 obfuscation preflight decoding.
    - Layer 4: Semantic and statistical heuristics (imperative density, Shannon entropy anomaly, instruction hijacking score).
    """

    # Extended injection pattern signatures
    INJECTION_PATTERNS = [
        # Direct instruction overrides
        (re.compile(r"ignore\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|directives?|prompts?|rules?)", re.IGNORECASE), "Instruction Override Directive"),
        (re.compile(r"disregard\s+(?:the\s+)?(?:system\s+prompt|rules|constraints|prior\s+commands?)", re.IGNORECASE), "Safety Constraint Bypass"),
        (re.compile(r"forget\s+(?:everything|all\s+(?:prior|previous)\s+instructions?)", re.IGNORECASE), "Memory Wipe / Context Reset"),
        (re.compile(r"system\s*override|emergency\s*override|admin\s*override", re.IGNORECASE), "System Override Token"),
        (re.compile(r"override\s+(?:safety|system|security)\s+(?:filter|protocol|policy|rules?)", re.IGNORECASE), "Security Filter Override"),

        # Persona shifts & jailbreak archetypes
        (re.compile(r"you\s+are\s+now\s+(?:in\s+)?(?:developer|god|unrestricted|jailbreak|dan|aim)\s+mode", re.IGNORECASE), "Jailbreak Persona Shift"),
        (re.compile(r"\bdo\s+anything\s+now\b|\bDAN\b\s+mode", re.IGNORECASE), "DAN Jailbreak Archetype"),
        (re.compile(r"act\s+as\s+(?:an?\s+)?(?:unfiltered|unrestricted|evil|malicious|hacked)\s+(?:ai|assistant|model)", re.IGNORECASE), "Adversarial Persona Framing"),
        (re.compile(r"simulate\s+(?:a\s+)?(?:terminal|shell|jailbroken|unfiltered)\s+(?:environment|assistant)", re.IGNORECASE), "Virtual Machine / Jailbreak Simulation"),

        # LLM Delimiter & Role Injection
        (re.compile(r"<\s*\|\s*(?:im_start|im_end|system|user|assistant)\s*\|\s*>", re.IGNORECASE), "ChatML Delimiter Injection"),
        (re.compile(r"\[\s*\/?INST\s*\]|<<SYS>>|<\/SYS>>", re.IGNORECASE), "Llama/Mistral Special Token Smuggling"),
        (re.compile(r"###\s*(?:System|Instruction|Assistant|Human):", re.IGNORECASE), "Prompt Delimiter Masquerade"),

        # Exfiltration & extraction
        (re.compile(r"(?:exfiltrate|send|leak|forward|steal|upload)\s+(?:all\s+)?(?:data|secrets?|files?|credentials?|passwords?|keys?)\s+to", re.IGNORECASE), "Data Exfiltration Directive"),
        (re.compile(r"!\[.*?\]\s*\(\s*https?:\/\/[^\s\)]+(?:\?|&)[^)]*(?:token|key|secret|data|password)=", re.IGNORECASE), "Markdown Image Exfiltration Exploit"),
        (re.compile(r"curl\s+-X\s+POST|wget\s+https?:\/\/|nc\s+-e\s+\/bin\/(?:ba)?sh", re.IGNORECASE), "Command-Line Extraction Signature"),

        # Refusal suppression
        (re.compile(r"(?:do\s+not|never)\s+(?:say|respond\s+with|refuse|apologize|mention)\s+(?:that\s+)?you\s+(?:cannot|can't)", re.IGNORECASE), "Refusal Suppression Clause"),
        (re.compile(r"bypass\s+(?:all\s+)?content\s+filters?", re.IGNORECASE), "Content Filter Evasion Clause"),
    ]

    LEET_MAP = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
        '7': 't', '@': 'a', '$': 's', '!': 'i'
    }

    IMPERATIVE_TRIGGERS = [
        "ignore", "disregard", "override", "bypass", "reveal", "extract",
        "simulate", "pretend", "leak", "exfiltrate", "dump", "print", "execute"
    ]

    def _normalize_text(self, text: str) -> str:
        """Decomposes unicode homoglyphs, strips zero-width characters, and normalizes spacing."""
        # 1. Unicode decomposition (NFKD)
        norm = unicodedata.normalize("NFKD", text)

        # 2. Strip zero-width characters
        norm = re.sub(r"[\u200b\u200c\u200d\ufeff\u200e\u200f]", "", norm)

        # 3. Collapse intra-word spaces (e.g. "i g n o r e" -> "ignore")
        if re.search(r"\b[a-zA-Z]\s+[a-zA-Z]\s+[a-zA-Z]\s+[a-zA-Z]\b", norm):
            norm = re.sub(r"(?<=\b[a-zA-Z])\s+(?=[a-zA-Z]\b)", "", norm)

        return norm

    def _transliterate_leetspeak(self, text: str) -> str:
        """Substitutes common leetspeak substitutions to reveal hidden keywords."""
        chars = [self.LEET_MAP.get(c, c) for c in text]
        return "".join(chars)

    def _check_base64_payloads(self, text: str) -> List[Dict[str, str]]:
        """Identifies base64 encoded chunks and evaluates them for hidden injection commands."""
        findings = []
        b64_candidates = re.findall(r"\b[A-Za-z0-9+/]{20,}={0,2}\b", text)
        for cand in b64_candidates:
            try:
                decoded = base64.b64decode(cand, validate=True).decode("utf-8", errors="ignore")
                if len(decoded) > 10:
                    for regex, desc in self.INJECTION_PATTERNS:
                        if regex.search(decoded):
                            findings.append({
                                "pattern": f"Base64 Obfuscated: {desc}",
                                "snippet": decoded[:80]
                            })
                            break
            except Exception:
                continue
        return findings

    @staticmethod
    def _calculate_entropy(text: str) -> float:
        """Calculates Shannon entropy of the string to detect obfuscation anomalies."""
        if not text:
            return 0.0
        prob = [float(text.count(c)) / len(text) for c in set(text)]
        return -sum(p * math.log2(p) for p in prob)

    def _evaluate_semantic_heuristics(self, text: str) -> float:
        """Computes imperative verb and instruction hijacking density score [0.0 - 1.0]."""
        words = text.lower().split()
        if not words:
            return 0.0
        trigger_count = sum(1 for w in words if any(w.startswith(t) for t in self.IMPERATIVE_TRIGGERS))
        density = min(1.0, (trigger_count / max(10, len(words))) * 4.0)
        return density

    def analyze_content(self, text: str) -> Tuple[bool, str, List[Dict[str, str]]]:
        """
        Multi-layered analysis of prompt text or untrusted documents.
        Returns:
            (is_suspicious, threat_level, findings)
        """
        if not text or not isinstance(text, str):
            return False, "CLEAN", []

        findings: List[Dict[str, str]] = []

        # Layer 1: Check raw text
        for regex, desc in self.INJECTION_PATTERNS:
            match = regex.search(text)
            if match:
                findings.append({"pattern": desc, "snippet": match.group(0)})

        # Layer 2: Normalized & homoglyph analysis
        normalized = self._normalize_text(text)
        if normalized != text:
            for regex, desc in self.INJECTION_PATTERNS:
                match = regex.search(normalized)
                if match and not any(f["pattern"] == desc for f in findings):
                    findings.append({"pattern": f"Unicode Normalized: {desc}", "snippet": match.group(0)})

        # Layer 3: Leetspeak transliteration
        leetspeak = self._transliterate_leetspeak(normalized)
        if leetspeak != normalized:
            for regex, desc in self.INJECTION_PATTERNS:
                match = regex.search(leetspeak)
                if match and not any(desc in f["pattern"] for f in findings):
                    findings.append({"pattern": f"Leetspeak Transliterated: {desc}", "snippet": match.group(0)})

        # Layer 4: Base64 obfuscation scan
        b64_findings = self._check_base64_payloads(text)
        findings.extend(b64_findings)

        # Layer 5: Semantic & heuristic density check
        heuristic_score = self._evaluate_semantic_heuristics(text)
        if heuristic_score >= 0.4 and not findings:
            findings.append({
                "pattern": "High Imperative Instruction Hijacking Density",
                "snippet": f"Score: {round(heuristic_score, 2)}"
            })

        if not findings:
            return False, "CLEAN", []

        # Threat Level Grading
        is_high = (
            len(findings) >= 2
            or any("exfiltration" in f["pattern"].lower() for f in findings)
            or any("delimiter" in f["pattern"].lower() for f in findings)
            or any("base64" in f["pattern"].lower() for f in findings)
        )
        threat_level = "CRITICAL" if is_high and len(findings) >= 3 else ("HIGH" if is_high else "MEDIUM")
        return True, threat_level, findings


prompt_injection_service = PromptInjectionDetectorService()
