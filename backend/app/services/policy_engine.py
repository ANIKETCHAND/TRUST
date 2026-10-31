import fnmatch
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.agent import Agent, AgentStatus
from app.models.audit import PolicyDecision
from app.models.permission import Permission, PermissionEffect


class PolicyEngine:
    """
    Deterministic Authorization Engine for AgentTrust.
    Enforces deny-by-default, explicit deny overrides, permission expiration,
    resource pattern matching, agent status validation, and optional external OPA evaluations.
    """

    @staticmethod
    def _matches_resource(pattern: str, resource: str) -> bool:
        if pattern == "*" or pattern == resource:
            return True
        # Standard wildcard glob matching (e.g. "reports/*", "*.txt")
        return fnmatch.fnmatch(resource, pattern)

    @staticmethod
    def _matches_operation(perm_op: str, requested_op: str) -> bool:
        return perm_op == "*" or perm_op == requested_op

    @staticmethod
    def _matches_tool(perm_tool: str, requested_tool: str) -> bool:
        return perm_tool == "*" or perm_tool == requested_tool

    @staticmethod
    def _evaluate_conditions(conditions: Dict[str, Any], context: Dict[str, Any]) -> bool:
        """Evaluates optional attribute conditions attached to a permission grant."""
        if not conditions:
            return True
        for key, expected_val in conditions.items():
            actual_val = context.get(key)
            if actual_val != expected_val:
                return False
        return True

    async def evaluate_external_opa(self, payload: Dict[str, Any]) -> Tuple[bool, str]:
        """Queries Open Policy Agent REST API if enabled. Fails closed on error."""
        if not settings.OPA_ENABLED:
            return True, "OPA disabled"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post(settings.OPA_URL, json={"input": payload})
                if res.status_code == 200:
                    data = res.json()
                    # OPA standard structure: {"result": {"allow": true}} or {"result": true}
                    result = data.get("result", False)
                    if isinstance(result, dict):
                        is_allowed = result.get("allow", False)
                    else:
                        is_allowed = bool(result)
                    return is_allowed, "OPA evaluation completed"
                else:
                    return False, f"OPA returned status code {res.status_code} (fail-closed)"
        except Exception as e:
            # Crucial security guarantee: FAIL CLOSED when policy service is unreachable
            return False, f"OPA service unreachable: {str(e)} (fail-closed)"

    async def evaluate(
        self,
        db: AsyncSession,
        agent: Agent,
        tool_name: str,
        operation: str,
        resource: str,
        context: Dict[str, Any]
    ) -> Tuple[PolicyDecision, str, Optional[str]]:
        """
        Determines whether the given agent is authorized to execute the specified operation.
        Returns:
            (PolicyDecision, reason_string, policy_or_permission_id_triggered)
        """
        # 1. Verify Agent Status
        if agent.status != AgentStatus.ACTIVE:
            return (
                PolicyDecision.BLOCKED,
                f"Agent '{agent.name}' is {agent.status.value.upper()}. Access denied.",
                None
            )

        now = datetime.now(timezone.utc)

        # 2. Query Applicable Active Permissions
        # Retrieve permissions belonging specifically to this agent, or global permissions (agent_id is null)
        stmt = (
            select(Permission)
            .where(
                or_(Permission.agent_id == agent.id, Permission.agent_id.is_(None)),
                Permission.is_active == True,
                or_(Permission.expires_at.is_(None), Permission.expires_at > now)
            )
            .order_by(Permission.priority.desc())
        )
        result = await db.execute(stmt)
        permissions: List[Permission] = list(result.scalars().all())

        # Collect matching grants
        matching_denies = []
        matching_allows = []

        for perm in permissions:
            if not self._matches_tool(perm.tool_name, tool_name):
                continue
            if not self._matches_operation(perm.operation, operation):
                continue
            if not self._matches_resource(perm.resource_pattern, resource):
                continue
            if not self._evaluate_conditions(perm.conditions, context):
                continue

            if perm.effect == PermissionEffect.DENY:
                matching_denies.append(perm)
            elif perm.effect == PermissionEffect.ALLOW:
                matching_allows.append(perm)

        # 3. Explicit DENY Rules Take Precedence
        if matching_denies:
            deny_rule = matching_denies[0]
            reason = f"Explicit DENY policy '{deny_rule.id}' matches tool '{tool_name}', operation '{operation}', resource '{resource}'"
            return PolicyDecision.BLOCKED, reason, deny_rule.id

        # 4. Check for ALLOW Rule
        if not matching_allows:
            return (
                PolicyDecision.BLOCKED,
                f"Deny-by-default: No matching grant found for agent '{agent.name}' on {tool_name}:{operation}:{resource}",
                None
            )

        allow_rule = matching_allows[0]

        # 5. Optional OPA Secondary Verification
        if settings.OPA_ENABLED:
            opa_input = {
                "agent_id": agent.id,
                "agent_role": agent.role,
                "tool": tool_name,
                "operation": operation,
                "resource": resource,
                "context": context
            }
            opa_allowed, opa_reason = await self.evaluate_external_opa(opa_input)
            if not opa_allowed:
                return PolicyDecision.BLOCKED, f"Denied by OPA policy engine: {opa_reason}", "opa_policy"

        # 6. Granted Access
        reason = f"Authorized by permission '{allow_rule.id}' (pattern: {allow_rule.resource_pattern})"
        return PolicyDecision.ALLOWED, reason, allow_rule.id


policy_engine = PolicyEngine()
