import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger("agenttrust.pipelock")


class PipelockService:
    """
    Pipelock AI Security Proxy Sidecar Integration Adapter:
    Evaluates AI agent tool-call payloads, MCP traffic, and outbound HTTP egress
    for prompt injection patterns, secret leakage, and generates cryptographic receipts.
    """

    def __init__(self, proxy_url: Optional[str] = None, fail_closed: bool = True):
        self.proxy_url = proxy_url or settings.PIPELOCK_PROXY_URL
        self.fail_closed = fail_closed

    async def check_health(self) -> Dict[str, Any]:
        """Checks Pipelock sidecar proxy health."""
        if not settings.PIPELOCK_ENABLED:
            return {
                "enabled": False,
                "status": "DISABLED",
                "message": "Pipelock sidecar is disabled in configuration"
            }
        try:
            health_url = self.proxy_url.rsplit("/", 2)[0] + "/health"
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(health_url)
                return {
                    "enabled": True,
                    "status": "HEALTHY" if res.status_code == 200 else "DEGRADED",
                    "status_code": res.status_code
                }
        except Exception as e:
            return {
                "enabled": True,
                "status": "UNREACHABLE",
                "error": str(e)
            }

    def generate_action_receipt(
        self, agent_id: str, tool: str, operation: str, resource: str, decision: str
    ) -> Dict[str, Any]:
        """
        Generates a tamper-evident cryptographic action receipt for audit trails.
        """
        payload = {
            "agent_id": agent_id,
            "tool": tool,
            "operation": operation,
            "resource": resource,
            "decision": decision,
            "timestamp": time.time()
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
        return {
            "receipt_id": f"rcpt_{digest[:16]}",
            "digest_sha256": digest,
            "signed_by": "agenttrust-pipelock-bridge",
            "payload": payload
        }

    async def inspect_egress(
        self, agent_id: str, destination_url: str, payload: Any
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """
        Mediates outbound egress requests through Pipelock inspection.
        Returns:
            (is_allowed: bool, reason: str, receipt: dict)
        """
        if not settings.PIPELOCK_ENABLED:
            receipt = self.generate_action_receipt(agent_id, "http_api_tool", "egress", destination_url, "ALLOWED")
            return True, "Pipelock sidecar bypass (disabled in config)", receipt

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    self.proxy_url,
                    json={
                        "agent_id": agent_id,
                        "destination": destination_url,
                        "payload": payload
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    allowed = data.get("allow", False)
                    reason = data.get("reason", "Pipelock inspection complete")
                    receipt = self.generate_action_receipt(
                        agent_id, "http_api_tool", "egress", destination_url, "ALLOWED" if allowed else "BLOCKED"
                    )
                    return allowed, reason, receipt
                else:
                    if self.fail_closed:
                        return False, f"Pipelock sidecar returned error {resp.status_code} (fail-closed)", None
                    return True, "Pipelock error (fail-open mode)", None
        except Exception as e:
            logger.error(f"Pipelock proxy unreachable: {e}")
            if self.fail_closed:
                return False, f"Pipelock proxy failure: {str(e)} (fail-closed)", None
            return True, "Pipelock unreachable (fail-open mode)", None


pipelock_service = PipelockService()
