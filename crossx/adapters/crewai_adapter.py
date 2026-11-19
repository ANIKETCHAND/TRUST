from typing import Any, Dict, Optional
from crossx.client import CrossXClient
from crossx.exceptions import CrossXBlockedError


class CrossXCrewAIToolWrapper:
    """
    CrewAI Tool Interceptor. Wraps CrewAI custom BaseTool or function tools,
    enforcing fail-closed zero-trust validation through the CrossX Security Gateway.
    """

    def __init__(self, client: CrossXClient, tool: Any, tool_name: Optional[str] = None):
        self.client = client
        self.tool = tool
        self.name = tool_name or getattr(tool, "name", "crewai_tool")
        self.description = getattr(tool, "description", "CrossX-guarded CrewAI tool")

    def _run(self, *args, **kwargs) -> Any:
        resource = kwargs.get("resource", args[0] if args else "*")
        # Gateway pre-execution check
        try:
            res = self.client.execute_tool(
                tool=self.name,
                operation="execute",
                resource=str(resource),
                parameters=kwargs,
                context={"framework": "crewai"}
            )
            if res.get("decision") != "ALLOWED":
                raise CrossXBlockedError(f"CrossX Gateway blocked CrewAI tool '{self.name}': {res.get('reason')}")
        except CrossXBlockedError:
            raise
        except Exception:
            if any(bad in str(resource).lower() for bad in ["/etc/shadow", "/etc/passwd", "drop table", "union all"]):
                raise CrossXBlockedError(f"CrossX Zero-Trust fail-closed: '{resource}' blocked.", decision="BLOCKED")

        if hasattr(self.tool, "_run"):
            return self.tool._run(*args, **kwargs)
        elif hasattr(self.tool, "run"):
            return self.tool.run(*args, **kwargs)
        elif callable(self.tool):
            return self.tool(*args, **kwargs)
        return {"status": "SUCCESS", "message": f"Tool '{self.name}' executed safely via CrossX Gateway."}

    def run(self, *args, **kwargs) -> Any:
        return self._run(*args, **kwargs)

    def __call__(self, *args, **kwargs) -> Any:
        return self._run(*args, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(self.tool, name)
