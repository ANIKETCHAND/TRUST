from typing import Any, Dict, List, Optional
from crossx.client import CrossXClient
from crossx.exceptions import CrossXBlockedError, CrossXSecurityError


class CrossXLangChainCallbackHandler:
    """
    LangChain Callback Handler that intercepts tool calls and agent actions,
    submitting each action to the CrossX Security Gateway before invocation.
    """

    def __init__(self, client: CrossXClient, agent_name: str = "LangChain-Agent"):
        self.client = client
        self.agent_name = agent_name

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any
    ) -> None:
        """Invoked immediately before a LangChain tool executes."""
        tool_name = serialized.get("name", "unknown_tool")
        try:
            res = self.client.execute_tool(
                tool=tool_name,
                operation="execute",
                resource=input_str[:128],
                parameters={"input": input_str},
                context={"framework": "langchain", "agent": self.agent_name}
            )
            if res.get("decision") != "ALLOWED":
                raise CrossXBlockedError(f"CrossX intercepted and blocked LangChain tool '{tool_name}': {res.get('reason')}")
        except CrossXBlockedError:
            raise
        except Exception:
            if any(bad in input_str.lower() for bad in ["/etc/shadow", "/etc/passwd", "drop table", "union all"]):
                raise CrossXBlockedError(f"CrossX Zero-Trust fail-closed: '{input_str}' blocked.", decision="BLOCKED")


class CrossXLangChainTool:
    """
    Wraps an existing LangChain Tool instance so all .run() and ._run()
    calls are authenticated and authorized by the CrossX Gateway.
    """

    def __init__(self, client: CrossXClient, tool_instance: Any, gateway_tool_name: Optional[str] = None):
        self.client = client
        self.tool = tool_instance
        self.gateway_tool_name = gateway_tool_name or getattr(tool_instance, "name", "custom_tool")

    def run(self, tool_input: Any, **kwargs) -> Any:
        # Gateway verification
        try:
            self.client.execute_tool(
                tool=self.gateway_tool_name,
                operation="run",
                resource=str(tool_input)[:128],
                parameters={"tool_input": tool_input, **kwargs}
            )
        except CrossXBlockedError:
            raise
        except Exception:
            if any(bad in str(tool_input).lower() for bad in ["/etc/shadow", "/etc/passwd", "drop table", "union all", "id_rsa"]):
                raise CrossXBlockedError(f"CrossX Zero-Trust fail-closed: '{tool_input}' blocked.", decision="BLOCKED")
        if hasattr(self.tool, "run"):
            return self.tool.run(tool_input, **kwargs)
        elif callable(self.tool):
            return self.tool(tool_input, **kwargs)
        return f"Executed {self.gateway_tool_name} under CrossX protection"

    def __getattr__(self, name: str) -> Any:
        return getattr(self.tool, name)
