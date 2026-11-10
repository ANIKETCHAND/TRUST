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

    # Blocked private and special networks (SSRF prevention)
    PRIVATE_NETWORKS = [
        ipaddress.ip_network("0.0.0.0/8"),
        ipaddress.ip_network("127.0.0.0/8"),
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
        ipaddress.ip_network("169.254.0.0/16"),  # Link-local & cloud metadata
        ipaddress.ip_network("100.64.0.0/10"),  # Shared address space
        ipaddress.ip_network("::1/128"),
        ipaddress.ip_network("fc00::/7"),        # Unique local IPv6
        ipaddress.ip_network("fe80::/10"),       # Link-local IPv6
    ]

    BLOCKED_HOSTNAMES = {
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0",
        "metadata.google.internal",
        "instance-data",
        "metadata",
    }

    def _validate_ssrf_safety(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            raise ValueError(f"Unsupported URI scheme '{parsed.scheme}'. Only HTTP and HTTPS are permitted.")

        hostname = parsed.hostname
        if not hostname:
            raise ValueError(f"Invalid target URL: missing hostname in '{url}'.")

        hostname_lower = hostname.lower().strip("[]")

        if hostname_lower in self.BLOCKED_HOSTNAMES or hostname_lower.endswith(".internal") or hostname_lower.endswith(".local"):
            raise PermissionError(f"SSRF Protection: Access to restricted destination '{hostname}' is strictly blocked.")

        # If hostname is directly an IP literal
        try:
            direct_ip = ipaddress.ip_address(hostname_lower)
            if direct_ip.is_loopback or direct_ip.is_private or direct_ip.is_link_local or direct_ip.is_reserved or direct_ip.is_multicast:
                raise PermissionError(f"SSRF Protection: Target IP '{direct_ip}' is in a reserved/private range. Access denied.")
            for net in self.PRIVATE_NETWORKS:
                if direct_ip in net:
                    raise PermissionError(f"SSRF Protection: Target IP '{direct_ip}' is in private network '{net}'. Access denied.")
        except ValueError:
            # Hostname is a domain name, proceed to DNS resolution check
            pass

        try:
            addr_info = socket.getaddrinfo(hostname_lower, None)
            for addr in addr_info:
                ip_str = addr[4][0]
                ip_obj = ipaddress.ip_address(ip_str)
                if ip_obj.is_loopback or ip_obj.is_private or ip_obj.is_link_local or ip_obj.is_reserved:
                    raise PermissionError(f"SSRF Protection: Target IP '{ip_str}' resolved from '{hostname}' is private/restricted. Access denied.")
                for net in self.PRIVATE_NETWORKS:
                    if ip_obj in net:
                        raise PermissionError(f"SSRF Protection: Target IP '{ip_str}' is in private network '{net}'. Access denied.")
        except socket.gaierror:
            # If domain cannot be resolved and looks suspicious or is internal
            pass

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported HTTP operation '{operation}'")

        target_url = resource
        self._validate_ssrf_safety(target_url)

        headers = parameters.get("headers", {})
        sanitized_headers = {
            k: v for k, v in headers.items()
            if k.lower() not in ["host", "authorization", "cookie"]
        }
        sanitized_headers["User-Agent"] = "AgentTrust-Secure-Gateway/0.2.0"

        timeout = min(float(parameters.get("timeout", 5.0)), 15.0)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            if operation == "http_get":
                response = await client.get(target_url, headers=sanitized_headers)
                return {
                    "resource": target_url,
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "body": response.text[:10000],
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
