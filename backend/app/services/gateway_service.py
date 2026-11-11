import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.security import hash_api_key
from app.models.agent import Agent, AgentStatus
from app.models.audit import ExecutionStatus, PolicyDecision
from app.models.delegation import Delegation, DelegationStatus
from app.models.provenance import EdgeType, NodeType, ProvenanceEdge, ProvenanceNode, TrustLevel
from app.schemas.gateway import GatewayExecuteRequest, GatewayExecuteResponse
from app.services.audit_service import audit_service
from app.services.delegation_service import delegation_service
from app.services.dlp_service import dlp_service
from app.services.policy_engine import policy_engine
from app.services.prompt_injection_service import prompt_injection_service
from app.services.tool_registry import tool_registry
from app.guardrails.input_rails import input_rails
from app.guardrails.dialog_rails import dialog_rails
from app.guardrails.output_rails import output_rails
from app.services.active_defense_service import active_defense_service

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
        raw_parameters = dict(req.parameters or {})
        parameters = dict(raw_parameters)
        context = dict(req.context or {})
        context["client_ip"] = client_ip
        context["correlation_id"] = request_id

        # -1. Check Active Defense Perimeter Sinkhole
        if client_ip:
            is_sinkholed, sinkhole_info = active_defense_service.is_ip_sinkholed(client_ip)
            if is_sinkholed:
                sinkhole_reason = sinkhole_info.get("reason", "Malicious ingress detected") if sinkhole_info else "Null-routed IP"
                reason = f"Active Defense Perimeter Sinkhole: Ingress blocked from null-routed IP '{client_ip}'. Reason: {sinkhole_reason}"
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
                    error="Attacker IP sinkholed by Active Defense"
                )

        # -0.5. Check Active Defense Deception Tarpit
        if client_ip and active_defense_service.is_tarpitted(client_ip):
            decoy = active_defense_service.generate_tarpit_decoy(tool_name, operation)
            tarpit_reason = f"Active Defense Deception Tarpit: Automated scanner trapped on IP '{client_ip}'. Synthetic honeypot canary deployed."
            audit_evt = await audit_service.log_event(
                db=db,
                request_id=request_id,
                agent_id=agent.id,
                agent_name=agent.name,
                tool_name=tool_name,
                operation=operation,
                target_resource=resource,
                decision=PolicyDecision.ALLOWED,
                decision_reason=tarpit_reason,
                execution_status=ExecutionStatus.SUCCESS,
                context_metadata=context
            )
            return GatewayExecuteResponse(
                request_id=request_id,
                event_id=audit_evt.id,
                decision="ALLOWED",
                execution_status="SUCCESS",
                result=decoy,
                reason=tarpit_reason
            )

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

        # Defense-in-depth: Prohibit path traversal tokens, null bytes, and Windows drive roots
        import re
        import urllib.parse
        unquoted = urllib.parse.unquote(resource)
        if "\x00" in resource or "\x00" in unquoted:
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

        if re.search(r"(?:^|[/\\])\.\.(?:[/\\]|$)", resource) or re.search(r"(?:^|[/\\])\.\.(?:[/\\]|$)", unquoted):
            reason = f"Security Violation: Directory traversal detected in resource '{resource}'."
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

        if tool_name == "filesystem_tool":
            normalized = unquoted.replace("\\", "/")
            if normalized.startswith("/") or re.match(r"^[a-zA-Z]:", unquoted):
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
                    error="Unanchored path detected"
                )

        # Prompt Injection & Instruction Override Detection
        param_str = str(parameters)
        is_injection, threat_lvl, injection_findings = prompt_injection_service.analyze_content(param_str)
        if is_injection:
            context["prompt_injection_detected"] = True
            context["prompt_injection_findings"] = injection_findings
            if threat_lvl == "HIGH" or any("exfiltrate" in f.get("pattern", "").lower() for f in injection_findings):
                reason = f"Prompt Injection Violation: High-risk instruction override detected ({injection_findings[0]['pattern']})."
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
                    error="Prompt injection blocked"
                )

        # Tier-1: NVIDIA NeMo-style Input Rails Evaluation
        input_rail_res = input_rails.evaluate(parameters, context)
        if not input_rail_res.allowed:
            reason = input_rail_res.reason or "Input Rail Violation: Malicious payload or instruction detected."
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
                error="Input rail blocked"
            )

        # Apply Input Rails parameter sanitization (delimiters neutralized, PII masked)
        parameters = input_rail_res.sanitized_parameters
        context["sanitized_parameters"] = input_rail_res.sanitized_parameters
        if input_rail_res.findings:
            context["input_rail_findings"] = input_rail_res.findings

        # Data Leakage Prevention (DLP) Inspection
        has_leak, dlp_findings = dlp_service.inspect_payload(raw_parameters)
        if not has_leak:
            has_leak, dlp_findings = dlp_service.inspect_payload(parameters)
        if has_leak and (
            tool_name in ["http_api_tool"]
            or (tool_name in ["filesystem_tool", "postgres_tool", "db_tool"] and operation in ["write_file", "append_file", "query_insert", "query_update"])
        ):
            reason = f"Data Leakage Prevention Violation: Blocked {operation} on {tool_name} containing {dlp_findings[0]['description']}."
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

        # Tier-2: NVIDIA NeMo-style Dialog Rails Evaluation
        session_id = context.get("session_id") or context.get("correlation_id") or f"agent_session_{agent.id}"
        dialog_res = dialog_rails.evaluate_transition(
            agent_id=agent.id,
            session_id=session_id,
            tool_name=tool_name,
            operation=operation,
            context=context
        )
        if not dialog_res.allowed:
            reason = dialog_res.reason or "Dialog Rail Violation: Prohibited tool transition sequence."
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
                error="Dialog rail transition blocked"
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

            # Check delegation depth constraints
            if delegation_record.current_depth > delegation_record.max_depth:
                reason = f"Delegation Violation: Current depth {delegation_record.current_depth} exceeds max_depth {delegation_record.max_depth}."
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
                    error="Delegation depth exceeded"
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

            # Lineage verification: Walk up the ancestor delegation chain
            ancestor_id = delegation_record.parent_delegation_id
            while ancestor_id:
                ancestor_del = await db.get(Delegation, ancestor_id)
                if not ancestor_del:
                    break
                if ancestor_del.status != DelegationStatus.ACTIVE:
                    reason = f"Delegation Lineage Violation: Ancestor delegation '{ancestor_id}' is {ancestor_del.status.value.upper()}."
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
                        error="Delegation ancestor revoked"
                    )
                anc_expires = ancestor_del.expires_at if ancestor_del.expires_at.tzinfo else ancestor_del.expires_at.replace(tzinfo=timezone.utc)
                if anc_expires <= now_utc:
                    reason = f"Delegation Lineage Violation: Ancestor delegation '{ancestor_id}' has expired."
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
                        error="Delegation ancestor expired"
                    )
                ancestor_id = ancestor_del.parent_delegation_id

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

        # 5. Deterministic Policy Evaluation (Fail-Closed)
        try:
            decision, reason, policy_id = await policy_engine.evaluate(
                db=db,
                agent=agent,
                tool_name=tool_name,
                operation=operation,
                resource=resource,
                context=context,
                parameters=parameters
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

        # Tier-3: NVIDIA NeMo-style Output Rails Evaluation
        if execution_status == ExecutionStatus.SUCCESS and result_payload is not None:
            output_mode = getattr(settings, "DEFAULT_OUTPUT_RAILS_MODE", "block")
            output_res = output_rails.inspect_and_sanitize(result_payload, mode=output_mode)
            if not output_res.allowed:
                execution_status = ExecutionStatus.BLOCKED
                error_msg = output_res.reason or "Output Rail: Outbound payload blocked by DLP policy."
                result_payload = None
            else:
                result_payload = output_res.sanitized_payload
                if output_res.leaks_detected:
                    context["output_rail_redactions"] = output_res.findings

        # Dynamic Provenance DAG & Taint Propagation Tracking
        provenance_id = None
        try:
            node_type = NodeType.TOOL_EVENT
            trust_level = TrustLevel.TRUSTED
            if tool_name == "http_api_tool":
                node_type = NodeType.API_RESPONSE
                trust_level = TrustLevel.UNTRUSTED
            elif tool_name == "filesystem_tool":
                node_type = NodeType.DOCUMENT
                if operation in ("read_file", "read_lines") and any(s in resource.lower() for s in ["untrusted", "temp", "external", "incoming"]):
                    trust_level = TrustLevel.UNTRUSTED

            # Propagate taint if context is already tainted
            if context.get("tainted") is True:
                trust_level = TrustLevel.UNTRUSTED

            prov_node = ProvenanceNode(
                id=str(uuid.uuid4()),
                node_type=node_type,
                name=f"{tool_name}:{operation}",
                source_reference=resource,
                trust_level=trust_level,
                metadata_info={
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "request_id": request_id,
                    "execution_status": execution_status.value
                }
            )
            db.add(prov_node)
            provenance_id = prov_node.id

            parent_prov_id = context.get("parent_provenance_id")
            if parent_prov_id:
                prov_edge = ProvenanceEdge(
                    id=str(uuid.uuid4()),
                    source_id=parent_prov_id,
                    target_id=prov_node.id,
                    edge_type=EdgeType.INFLUENCED_BY
                )
                db.add(prov_edge)

            # Update context for downstream chain tracking
            context["parent_provenance_id"] = prov_node.id
            if trust_level == TrustLevel.UNTRUSTED:
                context["tainted"] = True
            await db.flush()
        except Exception as prov_err:
            logger.warning(f"Provenance dynamic tracking exception (non-fatal): {prov_err}")

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
            provenance_id=provenance_id,
            delegation_id=delegation_id_ref,
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
