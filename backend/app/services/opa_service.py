import logging
from typing import Any, Dict, Optional, Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger("agenttrust.opa")


class OPAService:
    """
    Open Policy Agent (OPA) Integration Service:
    Provides deterministic external policy decision point (PDP) evaluation.
    Strictly enforces FAIL-CLOSED semantics on any network error, timeout, or parsing failure.
    """

    def __init__(self, opa_url: Optional[str] = None, timeout: float = 2.5):
        self.opa_url = opa_url or settings.OPA_URL
        self.timeout = timeout

    async def check_health(self) -> Dict[str, Any]:
        """Checks OPA service availability."""
        if not settings.OPA_ENABLED:
            return {"enabled": False, "status": "DISABLED", "message": "OPA is disabled in settings"}
        try:
            health_url = self.opa_url.split("/v1/data")[0] + "/health"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
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

    async def evaluate_policy(self, input_data: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Submits request context to OPA decision engine.
        Returns:
            (is_allowed: bool, reason: str)
        Fails closed on any error.
        """
        if not settings.OPA_ENABLED:
            return True, "OPA evaluation skipped (disabled in config)"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(self.opa_url, json={"input": input_data})
                if response.status_code != 200:
                    logger.warning(f"OPA returned non-200 code {response.status_code}: {response.text}")
                    return False, f"OPA returned unexpected status code {response.status_code} (fail-closed)"

                body = response.json()
                result = body.get("result", False)

                if isinstance(result, dict):
                    allowed = bool(result.get("allow", False))
                    reason = result.get("reason", "OPA decision evaluated")
                else:
                    allowed = bool(result)
                    reason = "OPA decision evaluated"

                return allowed, reason
        except httpx.TimeoutException:
            logger.error("OPA evaluation timed out: failing closed")
            return False, "OPA evaluation timed out after 2.5s (fail-closed)"
        except Exception as e:
            logger.error(f"OPA connection error: {e}: failing closed")
            return False, f"OPA service unreachable: {str(e)} (fail-closed)"


opa_service = OPAService()
