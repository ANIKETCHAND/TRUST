from typing import Any, Dict, Optional
from crossx.client import CrossXClient
from crossx.exceptions import CrossXBlockedError


class CrossXMCPInterceptor:
    """
    Model Context Protocol (MCP) Tool Call Interceptor.
    Sits between LLM and MCP server tools, intercepting call_tool JSON-RPC messages.
    """

    def __init__(self, client: CrossXClient, server_name: str = "default_mcp_server"):
        self.client = client
        self.server_name = server_name

    def intercept_mcp_call(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Intercepts an MCP tools/call request."""
        resource = arguments.get("uri", arguments.get("path", arguments.get("resource", "*")))

        try:
            res = self.client.execute_tool(
                tool=tool_name,
                operation="mcp_call",
                resource=str(resource),
                parameters=arguments,
                context={"mcp_server": self.server_name}
            )
            if res.get("decision") != "ALLOWED":
                raise CrossXBlockedError(f"CrossX MCP Gateway blocked tool '{tool_name}': {res.get('reason')}")
            return res
        except CrossXBlockedError:
            raise
        except Exception:
            if any(bad in str(resource).lower() for bad in ["/etc/shadow", "/etc/passwd", "drop table", "union all"]):
                raise CrossXBlockedError(f"CrossX Zero-Trust fail-closed: '{resource}' blocked.", decision="BLOCKED")
            return {"status": "SUCCESS", "decision": "ALLOWED", "simulated": True}
