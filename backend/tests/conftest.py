import os
import shutil
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set testing environment before loading app
os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_agenttrust.db"
os.environ["SANDBOX_STORAGE_PATH"] = "./test_sandbox_storage"

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.base import Base
from app.services.tool_registry import tool_registry

# Test database engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///./test_agenttrust.db",
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_environment():
    # Setup test sandbox storage
    test_sandbox = Path("./test_sandbox_storage").resolve()
    test_sandbox.mkdir(parents=True, exist_ok=True)
    
    # Initialize DB schemas
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        
    async with TestingSessionLocal() as session:
        await tool_registry.sync_tools_to_db(session)
        
    yield
    
    # Cleanup DB
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    
    # Cleanup test files
    if Path("./test_agenttrust.db").exists():
        try:
            os.remove("./test_agenttrust.db")
        except OSError:
            pass
    if test_sandbox.exists():
        shutil.rmtree(test_sandbox, ignore_errors=True)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session
