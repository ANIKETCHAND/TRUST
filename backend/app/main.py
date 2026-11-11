from contextlib import asynccontextmanager
import logging
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import async_session_maker, init_db
from app.core.exceptions import AgentTrustException
from app.services.tool_registry import tool_registry

logger = logging.getLogger("agenttrust")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB tables and register built-in tools
    await init_db()
    async with async_session_maker() as session:
        await tool_registry.sync_tools_to_db(session)
        # Seed default development admin if not present
        if settings.ENVIRONMENT.lower() != "production":
            import uuid
            from sqlalchemy import select
            from app.models.user import User, UserRole
            from app.core.security import get_password_hash
            stmt = select(User).where(User.username == "admin")
            res = await session.execute(stmt)
            if not res.scalars().first():
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
    yield
    # Shutdown logic (if any)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AgentTrust: Production-Oriented AI Agent Security Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AgentTrustException)
async def agenttrust_exception_handler(request: Request, exc: AgentTrustException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "path": request.url.path
            }
        }
    )


app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve compiled frontend if present
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/", tags=["System"])
    async def root():
        return {
            "platform": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health"
        }
