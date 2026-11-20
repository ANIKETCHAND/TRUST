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


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def _ensure_agent_columns(sync_conn):
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
