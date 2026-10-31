import ipaddress
import socket
from urllib.parse import urlparse
from typing import Any, Dict
import httpx
from app.tools.base import BaseTool


class SandboxedHttpApiTool(BaseTool):
    name = "http_api_tool"
    display_name = "Controlled Outbound HTTP API Tool"
    category = "http_api"
    supported_operations = ["http_get", "http_post"]

    # Blocked private networks (SSRF prevention)
    PRIVATE_NETWORKS = [
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("169.254.0.0/16"),
        ipaddress.ip_network("::1/128"),
        ipaddress.ip_network("fc00::/7"),
        ipaddress.ip_network("fe80::/10"),
    ]

    def _validate_ssrf_safety(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            raise ValueError(f"Unsupported URI scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.")

        hostname = parsed.hostname
        if not hostname:
            raise ValueError(f"Invalid target URL: missing hostname in '{url}'.")

        if hostname.lower() in ["localhost", "127.0.0.1", "::1", "metadata.google.internal"]:
            raise PermissionError(f"SSRF Protection: Access to localhost or loopback address '{hostname}' is strictly blocked.")

        try:
            # Resolve DNS
            addr_info = socket.getaddrinfo(hostname, None)
            for addr in addr_info:
                ip_str = addr[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                for net in self.PRIVATE_NETWORKS:
                    if ip_obj in net:
                        raise PermissionError(f"SSRF Protection: Target IP '{ip_str}' is in private network '{net}'. Access denied.")
        except socket.gaierror:
            # Domain cannot be resolved, let httpx fail cleanly
            pass

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported HTTP operation '{operation}'")

        target_url = resource
        self._validate_ssrf_safety(target_url)

        headers = parameters.get("headers", {})
        # Strip forbidden headers
        sanitized_headers = {
            k: v for k, v in headers.items() 
            if k.lower() not in ["host", "authorization", "cookie"]
        }
        sanitized_headers["User-Agent"] = "AgentTrust-Secure-Gateway/0.1.0"

        timeout = min(float(parameters.get("timeout", 5.0)), 15.0)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            if operation == "http_get":
                response = await client.get(target_url, headers=sanitized_headers)
                return {
                    "resource": target_url,
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text[:10000],  # Bound response payload size
                    "truncated": len(response.text) > 10000
                }
            elif operation == "http_post":
                json_payload = parameters.get("json", None)
                data_payload = parameters.get("data", None)
                response = await client.post(
                    target_url,
                    headers=sanitized_headers,
                    json=json_payload,
                    data=data_payload
                )
                return {
                    "resource": target_url,
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text[:10000],
                    "truncated": len(response.text) > 10000
                }
