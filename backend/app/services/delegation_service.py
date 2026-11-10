import fnmatch
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
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
    cascading revocations, and strict privilege escalation prevention.
    """

    @staticmethod
    def _parse_scope_entries(scope: Union[Dict[str, Any], List[Any]]) -> List[Tuple[str, str, str]]:
        """
        Normalizes scope definitions into tuples of (tool_name, operation, resource_pattern).
        Supported formats:
        - Dict: {"tool_name": "filesystem_tool", "operation": "read_file", "resource_pattern": "*"}
        - List of strings: ["filesystem_tool:read_file", "postgres_tool:query_select"]
        - List of dicts
        """
        entries = []
        if isinstance(scope, dict):
            tool = scope.get("tool_name", "*")
            op = scope.get("operation", "*")
            res = scope.get("resource_pattern", "*")
            entries.append((tool, op, res))
        elif isinstance(scope, list):
            for item in scope:
                if isinstance(item, str):
                    parts = item.split(":")
                    if len(parts) == 1:
                        entries.append((parts[0], "*", "*"))
                    elif len(parts) == 2:
                        entries.append((parts[0], parts[1], "*"))
                    else:
                        entries.append((parts[0], parts[1], parts[2]))
                elif isinstance(item, dict):
                    entries.append((
                        item.get("tool_name", "*"),
                        item.get("operation", "*"),
                        item.get("resource_pattern", "*")
                    ))
        return entries

    def is_scope_allowed(
        self, scope: Union[Dict[str, Any], List[Any]], tool_name: str, operation: str, resource: str
    ) -> bool:
        """Checks if the delegated scope allows the requested action."""
        entries = self._parse_scope_entries(scope)
        if not entries:
            return False

        for grant_tool, grant_op, grant_res in entries:
            tool_match = (grant_tool == "*" or grant_tool == tool_name)
            op_match = (grant_op == "*" or grant_op == operation)
            res_match = (grant_res == "*" or fnmatch.fnmatch(resource, grant_res))
            if tool_match and op_match and res_match:
                return True
        return False

    async def create_delegation(
        self,
        db: AsyncSession,
        parent_agent_id: str,
        child_agent_id: str,
        scope: Union[Dict[str, Any], List[Any]],
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
        # Child's delegated permissions must remain within parent's active permissions.
        requested_entries = self._parse_scope_entries(scope)

        parent_perm_stmt = select(Permission).where(
            Permission.agent_id == parent_agent_id,
            Permission.is_active == True,
            Permission.effect == PermissionEffect.ALLOW
        )
        res = await db.execute(parent_perm_stmt)
        parent_perms: List[Permission] = list(res.scalars().all())

        for req_tool, req_op, _ in requested_entries:
            if req_tool == "*" and not any(p.tool_name == "*" for p in parent_perms):
                raise PermissionError(
                    f"Privilege Escalation Blocked: Parent agent '{parent.name}' lacks wildcard access and cannot delegate it."
                )
            has_match = any(
                (p.tool_name == "*" or p.tool_name == req_tool) and
                (p.operation == "*" or p.operation == req_op)
                for p in parent_perms
            )
            if not has_match and req_tool != "*":
                raise PermissionError(
                    f"Privilege Escalation Blocked: Parent agent '{parent.name}' lacks permission for {req_tool}:{req_op} and cannot delegate it."
                )

        # 4. Generate delegation token
        raw_del_token = f"agdel_{secrets.token_urlsafe(32)}"
        token_hash = hash_api_key(raw_del_token)

        # Ensure UTC timezone awareness on expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        delegation = Delegation(
            id=str(uuid.uuid4()),
            parent_agent_id=parent_agent_id,
            child_agent_id=child_agent_id,
            scope=scope if isinstance(scope, dict) else {"grants": scope},
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

        now = datetime.now(timezone.utc)
        delegation.status = DelegationStatus.REVOKED
        delegation.revoked_at = now
        delegation.revocation_reason = reason

        # Cascading revocation: revoke all active downstream child delegations
        child_id = delegation.child_agent_id
        downstream_stmt = select(Delegation).where(
            Delegation.parent_agent_id == child_id,
            Delegation.status == DelegationStatus.ACTIVE
        )
        downstream_res = await db.execute(downstream_stmt)
        for child_del in downstream_res.scalars().all():
            child_del.status = DelegationStatus.REVOKED
            child_del.revoked_at = now
            child_del.revocation_reason = f"Cascaded revocation from parent delegation '{delegation_id}': {reason}"

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
