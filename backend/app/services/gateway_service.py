import time
import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent
from app.models.audit import ExecutionStatus, PolicyDecision
from app.schemas.gateway import GatewayExecuteRequest, GatewayExecuteResponse
from app.services.audit_service import audit_service
from app.services.policy_engine import policy_engine
from app.services.tool_registry import tool_registry


class GatewayService:
    """
    Central Security Gateway:
    Intercepts every agent action, evaluates policies deterministically,
    fails closed, and dispatches only authorized operations.
    """

    async def execute_tool_request(
        self,
        db: AsyncSession,
        agent: Agent,
        req: GatewayExecuteRequest,
        client_ip: Optional[str] = "127.0.0.1"
    ) -> GatewayExecuteResponse:
        request_id = str(uuid.uuid4())
        tool_name = req.tool
        operation = req.operation
        resource = req.resource
        parameters = req.parameters
        context = dict(req.context or {})
        context["client_ip"] = client_ip

        # 1. Identify Requested Tool
        tool_handler = tool_registry.get_tool_handler(tool_name)
        if not tool_handler:
            reason = f"Security Violation: Requested tool '{tool_name}' is not registered or unavailable."
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=PolicyDecision.BLOCKED,
                decision_reason=reason,
                execution_status=ExecutionStatus.BLOCKED,
                context_metadata=context
            )
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision="BLOCKED",
                execution_status="BLOCKED",
                reason=reason,
                error="Tool not found"
            )

        # 2. Validate Operation & Resource Constraints
        if operation not in tool_handler.supported_operations:
            reason = f"Security Violation: Operation '{operation}' is not supported by tool '{tool_name}'."
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=PolicyDecision.BLOCKED,
                decision_reason=reason,
                execution_status=ExecutionStatus.BLOCKED,
                context_metadata=context
            )
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision="BLOCKED",
                execution_status="BLOCKED",
                reason=reason,
                error="Unsupported operation"
            )

        # Defense-in-depth: Prohibit path traversal tokens in resource identifiers
        normalized_resource = resource.replace("\\", "/")
        if ".." in normalized_resource.split("/") or normalized_resource.startswith("/"):
            reason = f"Security Violation: Directory traversal or unanchored path detected in resource '{resource}'."
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=PolicyDecision.BLOCKED,
                decision_reason=reason,
                execution_status=ExecutionStatus.BLOCKED,
                context_metadata=context
            )
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision="BLOCKED",
                execution_status="BLOCKED",
                reason=reason,
                error="Directory traversal detected"
            )

        # 3. Deterministic Policy Evaluation (Fail-Closed)
        try:
            decision, reason, policy_id = await policy_engine.evaluate(
                db=db,
                agent=agent,
                tool_name=tool_name,
                operation=operation,
                resource=resource,
                context=context
            )
        except Exception as eval_err:
            fail_closed_reason = f"Gateway Fail-Closed: Policy evaluation failed unexpectedly: {str(eval_err)}"
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=PolicyDecision.BLOCKED,
                decision_reason=fail_closed_reason,
                execution_status=ExecutionStatus.BLOCKED,
                context_metadata=context,
                error_message=str(eval_err)
            )
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision="BLOCKED",
                execution_status="BLOCKED",
                reason=fail_closed_reason,
                error="Authorization failure"
            )

        # 4. Enforce Decision
        if decision != PolicyDecision.ALLOWED:
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=decision,
                decision_reason=reason,
                policy_id_triggered=policy_id,
                execution_status=ExecutionStatus.BLOCKED,
                context_metadata=context
            )
            # CRITICAL: Denied operations NEVER reach their tool handlers
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision=decision.value,
                execution_status="BLOCKED",
                reason=reason,
                error="Action denied by security policy"
            )

        # 5. Execute Authorized Request
        start_time = time.perf_counter()
        execution_status = ExecutionStatus.SUCCESS
        result_payload = None
        error_msg = None

        try:
            result_payload = await tool_handler.execute(
                operation=operation,
                resource=resource,
                parameters=parameters
            )
        except Exception as exec_err:
            execution_status = ExecutionStatus.FAILED
            error_msg = str(exec_err)
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000.0

        # 6. Audit Execution Outcome
        audit_evt = await audit_service.log_event(
            db=db,
            request_id=request_id,
            agent_id=agent.id,
            agent_name=agent.name,
            tool_name=tool_name,
            operation=operation,
            target_resource=resource,
            decision=PolicyDecision.ALLOWED,
            decision_reason=reason,
            policy_id_triggered=policy_id,
            execution_status=execution_status,
            execution_duration_ms=duration_ms,
            context_metadata=context,
            error_message=error_msg
        )

        return GatewayExecuteResponse(
            request_id=request_id,
            event_id=audit_evt.id,
            decision="ALLOWED",
            execution_status=execution_status.value,
            result=result_payload,
            error=error_msg,
            reason=reason,
            execution_duration_ms=duration_ms
        )


gateway_service = GatewayService()
