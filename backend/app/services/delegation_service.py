import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import hash_api_key
from app.models.agent import Agent, AgentStatus
from app.models.delegation import Delegation, DelegationStatus
from app.models.incident import RevocationRecord
from app.models.permission import Permission, PermissionEffect


class DelegationService:
    """
    Manages multi-agent delegation tokens, depth constraints,
    and privilege escalation prevention.
    """

    async def create_delegation(
        self,
        db: AsyncSession,
        parent_agent_id: str,
        child_agent_id: str,
        scope: Dict[str, Any],
        expires_at: datetime,
        max_depth: int = 1
    ) -> Tuple[Delegation, str]:
        # 1. Verify parent agent exists and is active
        parent = await db.get(Agent, parent_agent_id)
        if not parent or parent.status != AgentStatus.ACTIVE:
            raise PermissionError("Parent agent is inactive, revoked, or not found.")

        # 2. Verify child agent exists and is active
        child = await db.get(Agent, child_agent_id)
        if not child or child.status != AgentStatus.ACTIVE:
            raise PermissionError("Child agent is inactive, revoked, or not found.")

        if parent_agent_id == child_agent_id:
            raise ValueError("An agent cannot delegate permissions to itself.")

        # 3. Privilege Escalation Prevention:
        # Verify requested scope is a subset of parent agent's active permissions
        requested_tool = scope.get("tool_name", "*")
        requested_op = scope.get("operation", "*")

        # Query parent permissions
        parent_perm_stmt = select(Permission).where(
            Permission.agent_id == parent_agent_id,
            Permission.is_active == True,
            Permission.effect == PermissionEffect.ALLOW
        )
        res = await db.execute(parent_perm_stmt)
        parent_perms: List[Permission] = list(res.scalars().all())

        # Check if parent is authorized for the tool & operation
        has_authorized_grant = any(
            (p.tool_name == "*" or p.tool_name == requested_tool) and
            (p.operation == "*" or p.operation == requested_op)
            for p in parent_perms
        )

        if not has_authorized_grant and requested_tool != "*":
            raise PermissionError(
                f"Privilege Escalation Blocked: Parent agent '{parent.name}' lacks permission for {requested_tool}:{requested_op} and cannot delegate it."
            )

        # 4. Generate delegation token
        raw_del_token = f"agdel_{secrets.token_urlsafe(32)}"
        token_hash = hash_api_key(raw_del_token)

        delegation = Delegation(
            id=str(uuid.uuid4()),
            parent_agent_id=parent_agent_id,
            child_agent_id=child_agent_id,
            scope=scope,
            max_depth=max_depth,
            current_depth=1,
            status=DelegationStatus.ACTIVE,
            token_hash=token_hash,
            expires_at=expires_at
        )
        db.add(delegation)
        await db.commit()
        await db.refresh(delegation)

        return delegation, raw_del_token

    async def revoke_delegation(
        self, db: AsyncSession, delegation_id: str, reason: str, revoked_by: str = "admin"
    ) -> bool:
        delegation = await db.get(Delegation, delegation_id)
        if not delegation:
            return False

        delegation.status = DelegationStatus.REVOKED
        delegation.revoked_at = datetime.now(timezone.utc)
        delegation.revocation_reason = reason

        rev_record = RevocationRecord(
            id=str(uuid.uuid4()),
            target_type="DELEGATION",
            target_id=delegation_id,
            revoked_by=revoked_by,
            reason=reason
        )
        db.add(rev_record)
        await db.commit()
        return True


delegation_service = DelegationService()
