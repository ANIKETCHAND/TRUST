import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_api_key
from app.models.agent import Agent, AgentStatus
from app.models.audit import ExecutionStatus, PolicyDecision
from app.models.delegation import Delegation, DelegationStatus
from app.schemas.gateway import GatewayExecuteRequest, GatewayExecuteResponse
from app.services.audit_service import audit_service
from app.services.delegation_service import delegation_service
from app.services.dlp_service import dlp_service
from app.services.policy_engine import policy_engine
from app.services.prompt_injection_service import prompt_injection_service
from app.services.tool_registry import tool_registry

logger = logging.getLogger("agenttrust.gateway")


class GatewayService:
    """
    Central Security Gateway:
    Intercepts every agent action, evaluates deterministic zero-trust policies,
    validates scoped delegation boundaries, performs DLP inspection,
    fails closed on evaluation anomalies, and dispatches only authorized executions.
    """

    async def execute_tool_request(
        self,
        db: AsyncSession,
        agent: Agent,
        req: GatewayExecuteRequest,
        client_ip: Optional[str] = "127.0.0.1",
        correlation_id: Optional[str] = None
    ) -> GatewayExecuteResponse:
        request_id = correlation_id or str(uuid.uuid4())
        tool_name = req.tool
        operation = req.operation
        resource = req.resource
        parameters = req.parameters or {}
        context = dict(req.context or {})
        context["client_ip"] = client_ip
        context["correlation_id"] = request_id

        # 0. Check Agent Status
        if agent.status != AgentStatus.ACTIVE:
            reason = f"Security Violation: Agent '{agent.name}' status is {agent.status.value.upper()}. Access denied."
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
                error="Inactive or revoked agent"
            )

        # 1. Identify Requested Tool Handler
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

        # Defense-in-depth: Prohibit path traversal tokens and null bytes in resource identifiers
        if "\x00" in resource:
            reason = f"Security Violation: Null byte detected in resource identifier '{resource}'."
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
                error="Null byte detected"
            )

        normalized_resource = resource.replace("\\", "/")
        resource_segments = normalized_resource.split("/")
        if ".." in resource_segments or normalized_resource.startswith("/"):
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

        # 3. Delegation Verification & Boundary Enforcement (if delegated execution)
        delegation_id_ref = None
        raw_del_token = context.get("delegation_token")
        if raw_del_token:
            del_hash = hash_api_key(raw_del_token)
            stmt = select(Delegation).where(
                Delegation.token_hash == del_hash,
                Delegation.child_agent_id == agent.id,
                Delegation.status == DelegationStatus.ACTIVE
            )
            del_res = await db.execute(stmt)
            delegation_record = del_res.scalars().first()
            if not delegation_record:
                reason = "Delegation Violation: Invalid, revoked, or non-existent delegation grant."
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
                    error="Delegation grant rejected"
                )

            now_utc = datetime.now(timezone.utc)
            # Check expiration
            expires_at = delegation_record.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            if expires_at <= now_utc:
                delegation_record.status = DelegationStatus.EXPIRED
                await db.commit()
                reason = f"Delegation Violation: Delegation grant '{delegation_record.id}' has expired."
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
                    error="Delegation expired"
                )

            # Check delegator parent status
            parent_agent = await db.get(Agent, delegation_record.parent_agent_id)
            if not parent_agent or parent_agent.status != AgentStatus.ACTIVE:
                reason = "Delegation Violation: Parent delegator agent is revoked or inactive."
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
                    error="Parent agent revoked"
                )

            # Check scope boundaries: does the delegation permit this tool & operation?
            del_scope = delegation_record.scope
            if isinstance(del_scope, dict) and "grants" in del_scope:
                del_scope = del_scope["grants"]

            if not delegation_service.is_scope_allowed(del_scope, tool_name, operation, resource):
                reason = f"Delegation Scope Violation: Delegated permissions do not cover {tool_name}:{operation}:{resource}."
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
                    error="Delegation scope exceeded"
                )

            delegation_id_ref = delegation_record.id

        # 4. Data Leakage Prevention (DLP) Inspection
        has_leak, dlp_findings = dlp_service.inspect_payload(parameters)
        if has_leak and tool_name in ["http_api_tool"]:
            reason = f"Data Leakage Prevention Violation: Blocked outbound transfer containing {dlp_findings[0]['description']}."
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
                error="DLP outbound leak prevention"
            )

        # 5. Deterministic Policy Evaluation (Fail-Closed)
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
            logger.error(fail_closed_reason, exc_info=True)
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

        # 6. Enforce Decision: Denied operations NEVER reach tool handlers
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
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision=decision.value,
                execution_status="BLOCKED",
                reason=reason,
                error="Action denied by security policy"
            )

        # 7. Execute Authorized Request
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
            logger.warning(f"Tool execution failed for {tool_name}:{operation} -> {error_msg}")
        finally:
            duration_ms = (time.perf_counter() - start_time) * 1000.0

        # 8. Audit Execution Outcome
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
