import ipaddress
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class ThreatIntelService:
    """
    Threat Intelligence & Enrichment Service:
    Provides context enrichment for IP addresses, domain names, and file hashes.
    
    IMPORTANT ARCHITECTURAL & LEGAL DISCLAIMERS (Section 5):
    - IP geolocation is inherently approximate (city/region/ISP level) and is NOT proof of an individual's identity.
    - MAC addresses are link-layer identifiers observable only on the local network segment.
    - Reputation scores are probabilistic risk indicators, not definitive proof of malicious intent.
    """

    KNOWN_MALICIOUS_HASHES = {
        "44d88612fea8a8f36de82e1278abb02f": "EICAR-Test-File-MD5",
        "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f": "EICAR-Test-File-SHA256"
    }

    KNOWN_SUSPICIOUS_DOMAINS = {
        "malicious-external-exfiltration-sink.org": {"category": "Command & Control / Data Leak", "risk": "CRITICAL"},
        "synthetic-sink.agenttrust.internal": {"category": "Synthetic Test Sink", "risk": "TEST_BENIGN"},
        "pastebin-raw-untrusted.org": {"category": "Paste Site / Exfiltration Risk", "risk": "HIGH"}
    }

    def enrich_ip(self, ip_str: str) -> Dict[str, Any]:
        """Enriches an IP address with network boundary metadata and geolocation disclaimers."""
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
            is_private = ip_obj.is_private
            is_loopback = ip_obj.is_loopback
            is_reserved = ip_obj.is_reserved
        except ValueError:
            return {
                "ip": ip_str,
                "valid": False,
                "error": "Malformed IP address string"
            }

        return {
            "ip": str(ip_obj),
            "version": f"IPv{ip_obj.version}",
            "is_private": is_private,
            "is_loopback": is_loopback,
            "is_reserved": is_reserved,
            "classification": "Private/Internal Workload" if is_private else "Public Routable",
            "geolocation": {
                "country": "Approximate Geo (Private/Internal)" if is_private else "Approximate Region",
                "approximate": True,
                "disclaimer": "IP geolocation is approximate (ASN/ISP level) and does not establish individual identity."
            },
            "mac_address_boundary_note": "MAC addresses are link-layer frames observable strictly on local network segments."
        }

    def enrich_domain(self, domain: str) -> Dict[str, Any]:
        """Enriches a target destination domain with threat indicators."""
        clean_domain = domain.lower().strip()
        threat_info = self.KNOWN_SUSPICIOUS_DOMAINS.get(clean_domain)

        return {
            "domain": clean_domain,
            "is_flagged": threat_info is not None,
            "reputation": threat_info["risk"] if threat_info else "NEUTRAL",
            "category": threat_info["category"] if threat_info else "General Web / Workload",
            "source": "AgentTrust Threat Intel Feed (Local Curated)",
            "queried_at": datetime.now(timezone.utc).isoformat()
        }

    def enrich_hash(self, file_hash: str) -> Dict[str, Any]:
        """Enriches a cryptographic file hash against threat databases."""
        clean_hash = file_hash.lower().strip()
        matched = self.KNOWN_MALICIOUS_HASHES.get(clean_hash)

        return {
            "hash": clean_hash,
            "is_malicious": matched is not None,
            "threat_signature": matched,
            "confidence": "HIGH" if matched else "NONE",
            "source": "AgentTrust Malware Intelligence Database",
            "queried_at": datetime.now(timezone.utc).isoformat()
        }


threat_intel_service = ThreatIntelService()
