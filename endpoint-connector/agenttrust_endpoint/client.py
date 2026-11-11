import logging
import socket
from typing import Any, Dict, List, Optional
import httpx
from agenttrust_endpoint.config import EndpointConfig

logger = logging.getLogger("agenttrust.endpoint.client")


class EndpointClient:
    def __init__(self, config: EndpointConfig):
        self.config = config

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AgentTrust-EndpointConnector/0.2.0 (Windows)",
        }
        if self.config.device_token:
            headers["X-Device-Token"] = self.config.device_token
        return headers

    async def enroll(self, enrollment_secret: str, os_platform: str = "windows") -> Dict[str, Any]:
        hostname = socket.gethostname()
        payload = {
            "hostname": hostname,
            "os_platform": os_platform,
            "os_version": "Windows 10/11",
            "agent_version": "0.2.0",
            "ip_address": socket.gethostbyname(hostname) if hostname else "127.0.0.1",
            "mac_address": "00:1A:2B:3C:4D:5E",  # Local MAC framing only
            "enrollment_secret": enrollment_secret,
            "device_metadata": {"client": "AgentTrust Windows Connector"},
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.config.gateway_url}/endpoints/enroll",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code != 201:
                raise RuntimeError(f"Enrollment failed ({resp.status_code}): {resp.text}")

            data = resp.json()
            self.config.device_id = data["device_id"]
            self.config.device_token = data["device_token"]
            self.config.hostname = data["hostname"]
            self.config.save()
            return data

    async def send_heartbeat(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{self.config.gateway_url}/endpoints/heartbeat",
                headers=self._headers(),
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Heartbeat rejected ({resp.status_code}): {resp.text}")
            return resp.json()

    async def send_telemetry(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.config.gateway_url}/endpoints/telemetry",
                json={"events": events},
                headers=self._headers(),
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Telemetry submission error ({resp.status_code}): {resp.text}")
            return resp.json()

    async def fetch_policies(self) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{self.config.gateway_url}/endpoints/policies",
                headers=self._headers(),
            )
            if resp.status_code != 200:
                raise RuntimeError(f"Policy fetch error ({resp.status_code}): {resp.text}")
            return resp.json()
