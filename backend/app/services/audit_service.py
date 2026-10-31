import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditEvent, ExecutionStatus, PolicyDecision
from app.models.incident import IncidentSeverity, IncidentStatus, SecurityIncident


class AuditService:
    @staticmethod
    def _sanitize_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Strip sensitive credentials, keys, passwords, and tokens before logging."""
        sanitized = {}
        sensitive_keys = {"token", "secret", "password", "key", "authorization", "raw_key", "api_key"}
        for k, v in metadata.items():
            if any(s in k.lower() for s in sensitive_keys):
                sanitized[k] = "[REDACTED]"
            elif isinstance(v, dict):
                sanitized[k] = AuditService._sanitize_metadata(v)
            else:
                sanitized[k] = v
        return sanitized

    async def log_event(
        self,
        db: AsyncSession,
        request_id: str,
        agent_id: str,
        agent_name: Optional[str],
        tool_name: str,
        operation: str,
        target_resource: str,
        decision: PolicyDecision,
        decision_reason: str,
        execution_status: ExecutionStatus,
        execution_duration_ms: Optional[float] = None,
        policy_id_triggered: Optional[str] = None,
        delegation_id: Optional[str] = None,
        provenance_id: Optional[str] = None,
        context_metadata: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> AuditEvent:
        clean_context = self._sanitize_metadata(context_metadata or {})
        
        event = AuditEvent(
            id=str(uuid.uuid4()),
            request_id=request_id,
            agent_id=agent_id,
            agent_name=agent_name,
            tool_name=tool_name,
            operation=operation,
            target_resource=target_resource,
            decision=decision,
            decision_reason=decision_reason,
            policy_id_triggered=policy_id_triggered,
            delegation_id=delegation_id,
            provenance_id=provenance_id,
            execution_status=execution_status,
            execution_duration_ms=execution_duration_ms,
            context_metadata=clean_context,
            error_message=error_message
        )
        db.add(event)
        await db.flush()

        # If operation was BLOCKED, record a corresponding security incident for investigation
        if decision == PolicyDecision.BLOCKED:
            severity = IncidentSeverity.HIGH if "explicit deny" in decision_reason.lower() or "revoked" in decision_reason.lower() else IncidentSeverity.MEDIUM
            incident = SecurityIncident(
                id=str(uuid.uuid4()),
                audit_event_id=event.id,
                agent_id=agent_id,
                severity=severity,
                title=f"Blocked {operation} on {tool_name}",
                description=f"Agent '{agent_name or agent_id}' was denied executing '{operation}' on resource '{target_resource}'. Reason: {decision_reason}",
                status=IncidentStatus.OPEN,
                incident_metadata={
                    "request_id": request_id,
                    "tool": tool_name,
                    "resource": target_resource,
                    "reason": decision_reason
                }
            )
            db.add(incident)
            await db.flush()

        return event


audit_service = AuditService()
