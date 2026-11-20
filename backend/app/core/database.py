import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings
from app.models.base import Base

is_sqlite = "sqlite" in settings.DATABASE_URL

engine_kwargs = {
    "echo": False,
    "future": True,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Production PostgreSQL connection pooling parameters
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
    engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

_db_bootstrapped = False
_db_bootstrap_lock = asyncio.Lock()


def _ensure_agent_columns(sync_conn):
    try:
        from sqlalchemy import text
        res = sync_conn.execute(text("PRAGMA table_info(agents)"))
        cols = {row[1] for row in res.fetchall()}
        if cols and "agent_type" not in cols:
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN agent_type VARCHAR(64) DEFAULT 'custom_python' NOT NULL"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN owner VARCHAR(128) DEFAULT 'security_admin'"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN environment VARCHAR(64) DEFAULT 'production' NOT NULL"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN risk_classification VARCHAR(32) DEFAULT 'LOW' NOT NULL"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN security_score FLOAT DEFAULT 100.0 NOT NULL"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN agent_version VARCHAR(32) DEFAULT '1.0.0' NOT NULL"))
            sync_conn.execute(text("ALTER TABLE agents ADD COLUMN last_activity_at DATETIME"))
    except Exception:
        pass


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if is_sqlite:
            await conn.run_sync(_ensure_agent_columns)


async def ensure_db_bootstrapped() -> None:
    """
    Guarantees that every execution context (including ephemeral serverless containers)
    has tables created, tools synced, test agent registered, and baseline telemetry
    populated, eliminating empty-database race conditions across serverless instances.
    """
    global _db_bootstrapped
    if _db_bootstrapped:
        return
    async with _db_bootstrap_lock:
        if _db_bootstrapped:
            return
        await init_db()
        async with async_session_maker() as session:
            try:
                import uuid
                from sqlalchemy import select, func
                from app.services.tool_registry import tool_registry
                from app.services.test_agent_service import test_agent_service
                from app.services.simulation_engine import simulation_engine
                from app.models.audit import AuditEvent
                from app.models.user import User, UserRole
                from app.core.security import get_password_hash

                await tool_registry.sync_tools_to_db(session)
                await test_agent_service.ensure_test_agent_registered(session)

                # Ensure admin user exists
                admin_stmt = select(User).where(User.username == "admin")
                admin_res = await session.execute(admin_stmt)
                if not admin_res.scalars().first():
                    admin_user = User(
                        id=str(uuid.uuid4()),
                        username="admin",
                        email="admin@agenttrust.corp",
                        hashed_password=get_password_hash("admin123"),
                        role=UserRole.ADMIN,
                        is_active=True
                    )
                    session.add(admin_user)
                    await session.commit()

                # Ensure baseline telemetry exists
                event_count = await session.scalar(select(func.count(AuditEvent.id))) or 0
                if event_count == 0:
                    await simulation_engine.run_all_simulations(session)
            except Exception as e:
                import logging
                logging.getLogger("agenttrust.database").warning(f"Database bootstrap warning: {e}")
            finally:
                _db_bootstrapped = True


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if not _db_bootstrapped:
        await ensure_db_bootstrapped()
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

