import hashlib
import hmac
import uuid
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
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

    @staticmethod
    def compute_event_signature(
        previous_hash: str,
        event_id: str,
        request_id: str,
        agent_id: str,
        tool_name: str,
        operation: str,
        target_resource: str,
        decision: str,
        execution_status: str,
    ) -> str:
        canonical = f"{previous_hash}|{event_id}|{request_id}|{agent_id}|{tool_name}|{operation}|{target_resource}|{decision}|{execution_status}"
        return hmac.new(settings.SECRET_KEY.encode(), canonical.encode(), hashlib.sha256).hexdigest()

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
        error_message: Optional[str] = None,
        tenant_id: str = "default_tenant"
    ) -> AuditEvent:
        clean_context = self._sanitize_metadata(context_metadata or {})
        event_id = str(uuid.uuid4())

        # Retrieve hash of the most recent audit event for chaining
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(1)
        res = await db.execute(stmt)
        last_event = res.scalars().first()
        prev_hash = last_event.hmac_signature if (last_event and last_event.hmac_signature) else ("0" * 64)

        signature = self.compute_event_signature(
            previous_hash=prev_hash,
            event_id=event_id,
            request_id=request_id,
            agent_id=agent_id,
            tool_name=tool_name,
            operation=operation,
            target_resource=target_resource,
            decision=decision.value,
            execution_status=execution_status.value
        )

        event = AuditEvent(
            id=event_id,
            tenant_id=tenant_id,
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
            error_message=error_message,
            previous_hash=prev_hash,
            hmac_signature=signature
        )
        db.add(event)
        await db.flush()

        # If operation was BLOCKED, record a corresponding security incident for investigation
        if decision == PolicyDecision.BLOCKED:
            severity = IncidentSeverity.HIGH if "explicit deny" in decision_reason.lower() or "revoked" in decision_reason.lower() else IncidentSeverity.MEDIUM
            incident = SecurityIncident(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
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
                    "reason": decision_reason,
                    "agent_name": agent_name or agent_id,
                    "client_ip": clean_context.get("client_ip", "127.0.0.1"),
                    "correlation_id": clean_context.get("correlation_id", request_id)
                }
            )
            db.add(incident)
            await db.flush()

        return event

    async def verify_chain(self, db: AsyncSession) -> Dict[str, Any]:
        """Cryptographically verifies the HMAC hash chain across all audit events."""
        stmt = select(AuditEvent).order_by(AuditEvent.created_at.asc())
        res = await db.execute(stmt)
        events = list(res.scalars().all())

        if not events:
            return {"valid": True, "total_events": 0, "message": "Audit log ledger is empty."}

        # Topological chain map: previous_hash -> event to walk chain in exact cryptographic sequence
        by_prev_hash: Dict[str, AuditEvent] = {}
        for ev in events:
            prev = ev.previous_hash or ("0" * 64)
            by_prev_hash[prev] = ev

        expected_prev_hash = "0" * 64
        verified_count = 0

        while expected_prev_hash in by_prev_hash:
            evt = by_prev_hash[expected_prev_hash]
            expected_sig = self.compute_event_signature(
                previous_hash=evt.previous_hash or ("0" * 64),
                event_id=evt.id,
                request_id=evt.request_id,
                agent_id=evt.agent_id,
                tool_name=evt.tool_name,
                operation=evt.operation,
                target_resource=evt.target_resource,
                decision=evt.decision.value,
                execution_status=evt.execution_status.value
            )
            if evt.hmac_signature != expected_sig:
                return {
                    "valid": False,
                    "tampered_event_id": evt.id,
                    "error": f"Signature mismatch at event ({evt.id}): audit record has been modified after signing."
                }
            expected_prev_hash = evt.hmac_signature
            verified_count += 1

        if verified_count != len(events):
            # Chain is fractured or branched
            return {
                "valid": False,
                "tampered_event_id": events[verified_count].id if verified_count < len(events) else "unknown",
                "error": f"Audit chain link broken: verified {verified_count} of {len(events)} events before link broken."
            }

        return {
            "valid": True,
            "total_events": len(events),
            "latest_hash": events[-1].hmac_signature,
            "status": "All cryptographic signatures and chain links successfully validated."
        }


audit_service = AuditService()
