import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.agent import Agent
from app.models.policy import Policy, PolicyEffectDefault, PolicyVersion
from app.services.policy_engine import policy_engine

router = APIRouter()


class PolicyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)
    description: Optional[str] = None
    default_effect: PolicyEffectDefault = PolicyEffectDefault.DENY
    rules: Dict[str, Any] = Field(default_factory=dict)


class PolicyUpdateRequest(BaseModel):
    description: Optional[str] = None
    is_active: Optional[bool] = None
    rules: Optional[Dict[str, Any]] = None
    change_summary: Optional[str] = "Updated policy configuration"


class PolicyTestRequest(BaseModel):
    agent_id: str
    tool_name: str
    operation: str
    resource: str
    context: Dict[str, Any] = Field(default_factory=dict)


@router.post("", status_code=status.HTTP_201_CREATED, tags=["Policies"])
async def create_policy(req: PolicyCreateRequest, db: AsyncSession = Depends(get_db)):
    """Creates a versioned security policy."""
    policy = Policy(
        id=str(uuid.uuid4()),
        name=req.name,
        description=req.description,
        version=1,
        is_active=True,
        default_effect=req.default_effect,
        rules=req.rules
    )
    db.add(policy)
    await db.flush()

    first_version = PolicyVersion(
        id=str(uuid.uuid4()),
        policy_id=policy.id,
        version=1,
        rules=req.rules,
        changed_by="admin",
        change_summary="Initial policy creation"
    )
    db.add(first_version)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.get("", tags=["Policies"])
async def list_policies(db: AsyncSession = Depends(get_db)):
    """Lists all security policies with version history."""
    stmt = select(Policy).order_by(Policy.created_at.desc())
    res = await db.execute(stmt)
    policies = res.scalars().all()
    
    # If empty, seed default enterprise baseline policy
    if not policies:
        baseline_rules = {
            "sandbox_filesystem": {
                "allowed_prefixes": ["reports/", "public/", "temp/"],
                "blocked_extensions": [".pem", ".key", ".env", ".bashrc"]
            },
            "database_access": {
                "max_rows_per_query": 500,
                "forbidden_statements": ["DROP", "TRUNCATE", "ALTER"]
            },
            "http_external": {
                "blocked_private_ips": True,
                "enforce_https": True
            }
        }
        baseline = Policy(
            id=str(uuid.uuid4()),
            name="Enterprise-Baseline-Security-Policy",
            description="Default zero-trust security configuration for all enterprise agents",
            version=1,
            is_active=True,
            default_effect=PolicyEffectDefault.DENY,
            rules=baseline_rules
        )
        db.add(baseline)
        await db.commit()
        policies = [baseline]

    return policies


@router.put("/{policy_id}", tags=["Policies"])
async def update_policy(
    policy_id: str, req: PolicyUpdateRequest, db: AsyncSession = Depends(get_db)
):
    """Updates an existing policy and commits an immutable PolicyVersion record."""
    policy = await db.get(Policy, policy_id)
    if not policy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")

    if req.description is not None:
        policy.description = req.description
    if req.is_active is not None:
        policy.is_active = req.is_active
    if req.rules is not None:
        policy.version += 1
        policy.rules = req.rules
        
        # Add new version entry
        ver = PolicyVersion(
            id=str(uuid.uuid4()),
            policy_id=policy.id,
            version=policy.version,
            rules=req.rules,
            changed_by="admin",
            change_summary=req.change_summary
        )
        db.add(ver)

    await db.commit()
    await db.refresh(policy)
    return policy


@router.post("/test", tags=["Policies"])
async def test_policy_evaluation(req: PolicyTestRequest, db: AsyncSession = Depends(get_db)):
    """
    Simulates a dry-run policy evaluation for a target agent and operation
    without executing the tool or producing side-effects.
    """
    agent = await db.get(Agent, req.agent_id)
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{req.agent_id}' not found")

    decision, reason, policy_or_perm_id = await policy_engine.evaluate(
        db=db,
        agent=agent,
        tool_name=req.tool_name,
        operation=req.operation,
        resource=req.resource,
        context=req.context
    )

    return {
        "agent": {"id": agent.id, "name": agent.name, "role": agent.role, "status": agent.status.value},
        "target": {"tool": req.tool_name, "operation": req.operation, "resource": req.resource},
        "decision": decision.value,
        "reason": reason,
        "matched_rule_id": policy_or_perm_id,
        "is_allowed": (decision.value == "ALLOWED")
    }
