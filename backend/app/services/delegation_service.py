import fnmatch
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import or_, select
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
        max_depth: int = 1,
        parent_delegation_id: Optional[str] = None
    ) -> Tuple[Delegation, str]:
        # 1. Verify parent agent exists and is active
        parent = await db.get(Agent, parent_agent_id)
        if not parent or parent.status != AgentStatus.ACTIVE:
            raise PermissionError("Parent agent is inactive, revoked, or not found.")

        # 2. Verify child agent exists and is active
        child = await db.get(Agent, child_agent_id)
        if not child or child.status != AgentStatus.ACTIVE:
            raise PermissionError("Child agent is inactive, revoked, or not found.")

        # Multi-Tenant Isolation: Cross-tenant delegation is strictly prohibited
        if parent.tenant_id != child.tenant_id:
            raise PermissionError("Tenant Isolation Violation: Cross-tenant delegation is prohibited. Both agents must belong to the same tenant.")

        if parent_agent_id == child_agent_id:
            raise ValueError("An agent cannot delegate permissions to itself.")

        if max_depth < 1 or max_depth > 5:
            raise ValueError("Delegation max_depth must be between 1 and 5.")

        requested_entries = self._parse_scope_entries(scope)

        # 3. Handle Sub-delegation Lineage & Depth Constraints
        current_depth = 1
        effective_max_depth = max_depth

        if parent_delegation_id:
            parent_del = await db.get(Delegation, parent_delegation_id)
            if not parent_del:
                raise ValueError(f"Parent delegation '{parent_delegation_id}' not found.")
            if parent_del.status != DelegationStatus.ACTIVE:
                raise PermissionError(f"Cannot delegate from inactive or revoked parent delegation grant '{parent_delegation_id}'.")
            if parent_del.child_agent_id != parent_agent_id:
                raise PermissionError("Privilege Violation: Delegating agent is not the grantee of the parent delegation.")

            now_utc = datetime.now(timezone.utc)
            p_expires = parent_del.expires_at if parent_del.expires_at.tzinfo else parent_del.expires_at.replace(tzinfo=timezone.utc)
            if p_expires <= now_utc:
                raise PermissionError("Parent delegation grant has expired.")

            # Ensure child delegation expiration does not exceed parent delegation expiration
            req_expires = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
            if req_expires > p_expires:
                raise PermissionError("Child delegation expiry cannot exceed parent delegation expiry.")

            current_depth = parent_del.current_depth + 1
            if current_depth > parent_del.max_depth:
                raise PermissionError(
                    f"Delegation depth limit exceeded: chain depth {current_depth} exceeds permitted max_depth {parent_del.max_depth}."
                )
            effective_max_depth = min(max_depth, parent_del.max_depth)

            # Validate that requested scope is a subset of parent delegation scope
            parent_scope = parent_del.scope.get("grants", parent_del.scope) if isinstance(parent_del.scope, dict) else parent_del.scope
            for req_tool, req_op, req_res in requested_entries:
                if not self.is_scope_allowed(parent_scope, req_tool, req_op, req_res):
                    raise PermissionError(
                        f"Privilege Escalation Blocked: Requested scope '{req_tool}:{req_op}' exceeds parent delegation grant."
                    )
        else:
            # Root delegation: child's delegated permissions must remain within parent agent's active permissions.
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
            parent_delegation_id=parent_delegation_id,
            scope=scope if isinstance(scope, dict) else {"grants": scope},
            max_depth=effective_max_depth,
            current_depth=current_depth,
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

        # Transitive Cascading Revocation:
        # Traverse the entire downstream subtree and revoke all active descendants.
        queue = [delegation_id]
        visited = set()

        while queue:
            curr_id = queue.pop(0)
            if curr_id in visited:
                continue
            visited.add(curr_id)

            curr_del = await db.get(Delegation, curr_id)
            if not curr_del:
                continue

            if curr_del.status == DelegationStatus.ACTIVE:
                curr_del.status = DelegationStatus.REVOKED
                curr_del.revoked_at = now
                curr_del.revocation_reason = (
                    reason if curr_id == delegation_id
                    else f"Cascaded revocation from root delegation '{delegation_id}': {reason}"
                )

            # Discover all child delegations in the cascade:
            # 1) Linked explicitly via parent_delegation_id == curr_id
            # 2) Or issued by this delegation's child_agent
            downstream_stmt = select(Delegation).where(
                or_(
                    Delegation.parent_delegation_id == curr_id,
                    Delegation.parent_agent_id == curr_del.child_agent_id
                ),
                Delegation.status == DelegationStatus.ACTIVE
            )
            downstream_res = await db.execute(downstream_stmt)
            for child_del in downstream_res.scalars().all():
                if child_del.id not in visited:
                    queue.append(child_del.id)

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
