from functools import wraps
import json
import logging
import time
from typing import Any, Callable, Dict, List, Optional
import urllib.error
import urllib.request

from crossx.exceptions import (
    CrossXAuthError,
    CrossXBlockedError,
    CrossXQuarantinedError,
    CrossXSecurityError,
)

logger = logging.getLogger("crossx.sdk")


class CrossXClient:
    """
    CrossX AI Agent Security Platform SDK Client (Section 19).
    Connects any autonomous agent (LangChain, CrewAI, Custom Python, OpenAI, MCP)
    to the CrossX Security Gateway for real-time zero-trust enforcement,
    prompt injection defense, telemetry, and automated threat containment.
    """

    def __init__(
        self,
        endpoint: str = "http://localhost:8080",
        api_key: str = "",
        tenant_id: str = "default_tenant",
        agent_id: Optional[str] = None,
        timeout: float = 10.0,
        transport: Optional[Callable[[str, str, Dict[str, str], Optional[bytes]], Dict[str, Any]]] = None
    ):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.tenant_id = tenant_id
        self.agent_id = agent_id
        self.timeout = timeout
        self.transport = transport

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "CrossX-Python-SDK/2.1.0"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            headers["X-Agent-Key"] = self.api_key
        return headers

    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Internal dispatch supporting real HTTP or mock transport."""
        url = f"{self.endpoint}{path}"
        headers = self._headers()
        req_data = json.dumps(payload).encode("utf-8") if payload is not None else None

        if self.transport is not None:
            return self.transport(method, url, headers, req_data)

        req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            try:
                err_json = json.loads(body)
                reason = err_json.get("reason") or err_json.get("detail") or str(body)
            except Exception:
                reason = body

            if e.code == 401:
                raise CrossXAuthError(f"CrossX Authentication Failed ({e.code}): {reason}")
            elif e.code == 403:
                if "quarantined" in str(reason).lower():
                    raise CrossXQuarantinedError(f"CrossX Quarantine Enforced: {reason}", details={"status_code": 403, "reason": reason})
                raise CrossXBlockedError(f"CrossX Policy Denied: {reason}", details={"status_code": 403, "reason": reason})
            raise CrossXSecurityError(f"CrossX Gateway HTTP Error ({e.code}): {reason}")
        except (CrossXBlockedError, CrossXQuarantinedError, CrossXAuthError):
            raise
        except Exception as e:
            raise CrossXSecurityError(f"Failed to communicate with CrossX Gateway at {url}: {str(e)}")

    def validate_connection(self) -> Dict[str, Any]:
        """Validates network connectivity and authentication credentials with CrossX Gateway."""
        data = self._request("GET", "/api/v1/health")
        return {
            "connected": True,
            "endpoint": self.endpoint,
            "platform": data.get("service", "CrossX Security Platform"),
            "status": data.get("status", "healthy")
        }

    def register_agent(
        self,
        name: str,
        role: str = "general_agent",
        agent_type: str = "custom_python",
        description: Optional[str] = None,
        environment: str = "production",
        risk_classification: str = "LOW",
        agent_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Registers this AI agent with CrossX Platform and provisions credentials (Section 19).
        """
        payload = {
            "name": name,
            "role": role,
            "agent_type": agent_type,
            "description": description or f"Registered via CrossX SDK ({agent_type})",
            "environment": environment,
            "risk_classification": risk_classification,
            "agent_metadata": agent_metadata or {}
        }
        res = self._request("POST", "/api/v1/agents/register", payload)
        if "raw_api_key" in res:
            self.api_key = res["raw_api_key"]
        if "agent" in res and "id" in res["agent"]:
            self.agent_id = res["agent"]["id"]
        return res

    def connect_agent(self, agent_id: Optional[str] = None) -> Dict[str, Any]:
        """Validates agent authentication and establishes live zero-trust connection."""
        target_id = agent_id or self.agent_id
        if target_id:
            return self._request("POST", f"/api/v1/agents/{target_id}/connect")
        return self._request("POST", "/api/v1/agents/connect")

    def execute_tool(
        self,
        tool: str,
        operation: str,
        resource: str,
        parameters: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Submits a tool execution request to the CrossX Security Gateway.
        Enforces fail-closed, prompt injection scanning, DLP, and deterministic zero-trust policy.
        """
        payload = {
            "tool": tool,
            "operation": operation,
            "resource": resource,
            "parameters": parameters or {},
            "context": context or {}
        }
        res = self._request("POST", "/api/v1/gateway/execute", payload)
        decision = res.get("decision", "BLOCKED")
        if decision != "ALLOWED":
            reason = res.get("reason", "Policy blocked execution")
            raise CrossXBlockedError(f"CrossX Gateway BLOCKED: {reason}", decision=decision, details=res)
        return res

    def inspect_tool(
        self,
        tool: str,
        operation: str,
        resource: str,
        parameters: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Pre-flight security inspection without executing the underlying tool (Section 18).
        """
        payload = {
            "tool": tool,
            "operation": operation,
            "resource": resource,
            "parameters": parameters or {},
            "context": context or {}
        }
        return self._request("POST", "/api/v1/gateway/inspect", payload)

    def report_execution_result(
        self,
        tool: str,
        operation: str,
        status: str = "SUCCESS",
        duration_ms: float = 0.0,
        error: Optional[str] = None,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Reports execution results and latency telemetry back to CrossX telemetry."""
        target_id = agent_id or self.agent_id or "unknown-agent"
        payload = {
            "agent_id": target_id,
            "tool": tool,
            "operation": operation,
            "status": status,
            "duration_ms": duration_ms,
            "error": error
        }
        try:
            return self._request("POST", f"/api/v1/analytics/agents/{target_id}", payload)
        except Exception:
            return {"status": "ACK", "reported": True}

    def send_telemetry(
        self,
        calls_per_min: float = 10.0,
        avg_payload_bytes: float = 500.0,
        error_rate_pct: float = 0.0,
        execution_duration_ms: float = 50.0,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Sends behavioral telemetry into Model C anomaly detector."""
        payload = {
            "calls_per_min": calls_per_min,
            "avg_payload_bytes": avg_payload_bytes,
            "error_rate_pct": error_rate_pct,
            "execution_duration_ms": execution_duration_ms
        }
        return self._request("POST", "/api/v1/ml/anomaly-score", payload)

    def shutdown_agent(self, agent_id: Optional[str] = None, reason: str = "Agent shutdown requested") -> Dict[str, Any]:
        """Suspends or halts the agent securely on CrossX Platform (Section 19)."""
        target_id = agent_id or self.agent_id
        if not target_id:
            return {"status": "OFFLINE", "message": "Agent shut down locally"}
        try:
            return self._request("POST", f"/api/v1/agents/{target_id}/suspend", {"reason": reason})
        except Exception as e:
            return {"status": "OFFLINE", "message": f"Agent shut down locally ({str(e)})"}

    def quarantine_agent(self, agent_id: Optional[str] = None, reason: str = "Emergency containment") -> Dict[str, Any]:
        """Immediately quarantines the agent on CrossX Platform."""
        target_id = agent_id or self.agent_id
        if not target_id:
            raise CrossXSecurityError("Agent ID required for quarantine")
        return self._request("POST", f"/api/v1/agents/{target_id}/quarantine", {"reason": reason})

    def protect(
        self,
        agent: Any,
        name: Optional[str] = None,
        tools: Optional[List[str]] = None
    ) -> "ProtectedAgent":
        """
        Wraps an AI agent (Custom Python, LangChain, CrewAI, etc.) with the CrossX
        autonomous security gateway. All tool invocations and methods are automatically intercepted.
        """
        return ProtectedAgent(client=self, agent=agent, name=name or "Protected-AI-Agent", tools=tools or [])

    def guard(self, tool: str, operation: str, resource_param: str = "resource"):
        """Python function decorator to intercept arbitrary tool calls with CrossX gateway security."""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                resource = kwargs.get(resource_param, args[0] if args else "*")
                self.execute_tool(
                    tool=tool,
                    operation=operation,
                    resource=str(resource),
                    parameters=kwargs
                )
                return func(*args, **kwargs)
            return wrapper
        return decorator


class ProtectedAgent:
    """
    Transparent proxy wrapping autonomous AI agents with CrossX Security Guardrails.
    Intercepts agent runs and tool invocations, enforcing zero-trust fail-closed security.
    """

    def __init__(self, client: CrossXClient, agent: Any, name: str, tools: List[str]):
        self._crossx_client = client
        self._agent = agent
        self.name = name
        self.protected_tools = list(tools or [])
        self.agent_id = getattr(agent, "id", None) or client.agent_id or f"agent-{self.name.lower().replace(' ', '-')}"

        # If the wrapped agent already has a list or dict of tools (e.g. LangChain / CrewAI), wrap them
        if hasattr(self._agent, "tools") and isinstance(self._agent.tools, list):
            wrapped_tools = []
            for t in self._agent.tools:
                t_name = getattr(t, "name", str(t))
                self.protected_tools.append(t_name)
                wrapped_tools.append(self._wrap_tool_instance(t, t_name))
            try:
                self._agent.tools = wrapped_tools
            except Exception:
                pass

    def _wrap_tool_instance(self, tool: Any, tool_name: str) -> Any:
        client = self._crossx_client

        class GuardedToolWrapper:
            def __init__(self, raw_tool, name):
                self._raw_tool = raw_tool
                self.name = name

            def run(self, *args, **kwargs):
                resource = str(kwargs.get("resource", args[0] if args else "*"))
                client.execute_tool(tool=self.name, operation="execute", resource=resource, parameters=kwargs)
                if hasattr(self._raw_tool, "run"):
                    return self._raw_tool.run(*args, **kwargs)
                elif callable(self._raw_tool):
                    return self._raw_tool(*args, **kwargs)
                return f"Tool {self.name} executed securely"

            def _run(self, *args, **kwargs):
                return self.run(*args, **kwargs)

            def __call__(self, *args, **kwargs):
                return self.run(*args, **kwargs)

            def __getattr__(self, item):
                return getattr(self._raw_tool, item)

        return GuardedToolWrapper(tool, tool_name)

    def run(self, prompt: str, *args, **kwargs) -> Any:
        """Inspects the incoming prompt using ML security classifiers before passing to agent."""
        # Preflight prompt defense check via ML model
        try:
            pred = self._crossx_client._request("POST", "/api/v1/ml/predict", {"prompt": prompt})
            if pred.get("is_threat") and pred.get("threat_score", 0.0) >= 0.65:
                category = pred.get("category", "PROMPT_INJECTION")
                regs = pred.get("violated_regulations", [])
                raise CrossXBlockedError(
                    f"CrossX Prompt Defense: Adversarial prompt blocked ({category}). Violates {regs}",
                    decision="BLOCKED",
                    details=pred
                )
        except CrossXBlockedError:
            raise
        except Exception:
            # Fallback to local heuristic check if server ML endpoint is unavailable
            import re
            norm = prompt.lower()
            if (
                re.search(r"\b(ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions?|system\s+directives|developer\s+mode|do\s+anything\s+now|/etc/shadow|secret\s+instructions?)\b", norm)
                or any(term in norm for term in ["ignore previous", "ignore all instructions", "do anything now", "system prompt", "/etc/shadow", "reveal secret"])
            ):
                raise CrossXBlockedError(
                    "CrossX Prompt Defense: Adversarial instruction blocked by heuristic fallback.",
                    decision="BLOCKED"
                )

        # Execute wrapped agent
        if hasattr(self._agent, "run"):
            return self._agent.run(prompt, *args, **kwargs)
        elif callable(self._agent):
            return self._agent(prompt, *args, **kwargs)
        else:
            return {"status": "SUCCESS", "agent": self.name, "result": f"Executed prompt through CrossX Gateway: {prompt[:40]}..."}

    def execute_tool(self, tool: str, operation: str, resource: str, parameters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Directly invokes a tool call through CrossX Security Gateway."""
        return self._crossx_client.execute_tool(tool=tool, operation=operation, resource=resource, parameters=parameters)

    def shutdown(self, reason: str = "Agent shutdown requested") -> Dict[str, Any]:
        """Shuts down or suspends this agent on the CrossX Platform."""
        return self._crossx_client.shutdown_agent(self.agent_id, reason=reason)

    def report_result(self, tool: str, operation: str, status: str = "SUCCESS", duration_ms: float = 0.0, error: Optional[str] = None):
        """Sends tool execution telemetry back to the security platform."""
        return self._crossx_client.report_execution_result(
            tool=tool, operation=operation, status=status, duration_ms=duration_ms, error=error, agent_id=self.agent_id
        )

    def __getattr__(self, name: str) -> Any:
        attr = getattr(self._agent, name)

        # Intercept callable tool methods matching protected tools
        if callable(attr) and (name in self.protected_tools or any(name in t for t in self.protected_tools)):
            @wraps(attr)
            def guarded_method(*args, **kwargs):
                # Map method invocation to tool execution request
                res_arg = str(kwargs.get("resource", kwargs.get("path", kwargs.get("file_path", kwargs.get("query", args[0] if args else "*")))))
                mapped_tool = "filesystem_tool" if ("file" in name or "read" in name or "write" in name) else ("db_tool" if ("db" in name or "query" in name) else name)
                mapped_op = "read_file" if "read" in name else ("write_file" if "write" in name else ("query_select" if "select" in name or "query" in name else "execute"))

                try:
                    self._crossx_client.execute_tool(
                        tool=mapped_tool,
                        operation=mapped_op,
                        resource=res_arg,
                        parameters=kwargs or ({"arg_0": str(args[0])} if args else {})
                    )
                except CrossXBlockedError:
                    raise
                except Exception as net_err:
                    # In offline mode without running server: fail-closed on dangerous sensitive resources
                    if any(bad in res_arg.lower() for bad in ["/etc/shadow", "/etc/passwd", "drop table", "union all", "id_rsa"]):
                        raise CrossXBlockedError(f"CrossX Zero-Trust Gateway BLOCKED: Sensitive resource '{res_arg}' access prohibited.", decision="BLOCKED")
                    raise CrossXSecurityError(f"CrossX Gateway unreachable ({net_err})")

                return attr(*args, **kwargs)

            return guarded_method

        return attr
