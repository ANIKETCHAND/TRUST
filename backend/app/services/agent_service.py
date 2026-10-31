import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import generate_agent_api_key, hash_api_key
from app.models.agent import Agent, AgentCredential, AgentStatus
from app.models.incident import RevocationRecord
from app.schemas.agent import AgentCreate, AgentRegistrationResponse, AgentResponse


class AgentService:
    async def register_agent(
        self, db: AsyncSession, create_data: AgentCreate
    ) -> AgentRegistrationResponse:
        agent_id = str(uuid.uuid4())
        agent = Agent(
            id=agent_id,
            name=create_data.name,
            description=create_data.description,
            role=create_data.role,
            status=AgentStatus.ACTIVE,
            agent_metadata=create_data.agent_metadata or {}
        )
        db.add(agent)
        await db.flush()

        raw_key, key_hash, key_prefix = generate_agent_api_key()
        credential = AgentCredential(
            id=str(uuid.uuid4()),
            agent_id=agent.id,
            token_hash=key_hash,
            token_prefix=key_prefix,
            is_revoked=False
        )
        db.add(credential)
        await db.commit()
        await db.refresh(agent)

        return AgentRegistrationResponse(
            agent=AgentResponse.model_validate(agent),
            raw_api_key=raw_key,
            token_prefix=key_prefix
        )

    async def authenticate_agent(
        self, db: AsyncSession, raw_api_key: str
    ) -> Optional[Agent]:
        """
        Derives agent identity strictly from the authenticated credential hash.
        Never trusts request-body identifiers.
        """
        if not raw_api_key:
            return None

        # Support Bearer prefix if passed in Authorization header
        if raw_api_key.lower().startswith("bearer "):
            raw_api_key = raw_api_key[7:].strip()

        token_hash = hash_api_key(raw_api_key)
        
        stmt = (
            select(AgentCredential)
            .where(
                AgentCredential.token_hash == token_hash,
                AgentCredential.is_revoked == False
            )
        )
        result = await db.execute(stmt)
        credential = result.scalars().first()
        if not credential:
            return None

        # Check expiration if set
        if credential.expires_at and credential.expires_at < datetime.now(timezone.utc):
            return None

        # Fetch corresponding Agent
        agent_stmt = select(Agent).where(Agent.id == credential.agent_id)
        agent_res = await db.execute(agent_stmt)
        agent = agent_res.scalars().first()
        return agent

    async def revoke_agent(
        self, db: AsyncSession, agent_id: str, reason: str, revoked_by: str = "admin"
    ) -> bool:
        stmt = select(Agent).where(Agent.id == agent_id)
        result = await db.execute(stmt)
        agent = result.scalars().first()
        if not agent:
            return False

        agent.status = AgentStatus.REVOKED
        now = datetime.now(timezone.utc)

        # Invalidate all credentials for this agent
        cred_stmt = select(AgentCredential).where(
            AgentCredential.agent_id == agent_id,
            AgentCredential.is_revoked == False
        )
        cred_res = await db.execute(cred_stmt)
        credentials = cred_res.scalars().all()
        for cred in credentials:
            cred.is_revoked = True
            cred.revoked_at = now

        # Add revocation record
        rev_record = RevocationRecord(
            id=str(uuid.uuid4()),
            target_type="AGENT",
            target_id=agent_id,
            revoked_by=revoked_by,
            reason=reason
        )
        db.add(rev_record)
        await db.commit()
        return True


agent_service = AgentService()
