from contextlib import asynccontextmanager
import logging
import os
from pathlib import Path
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import async_session_maker, init_db
from app.core.exceptions import AgentTrustException
from app.services.tool_registry import tool_registry
from app.services.test_agent_service import test_agent_service

logger = logging.getLogger("agenttrust")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB tables and register built-in tools
    await init_db()
    async with async_session_maker() as session:
        await tool_registry.sync_tools_to_db(session)
        await test_agent_service.ensure_test_agent_registered(session)
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
    description="CrossX: Production-Oriented AI Agent Security Platform",
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
if settings.API_V1_STR != "/v1":
    app.include_router(api_router, prefix="/v1")


@app.get("/api", tags=["System"])
@app.get("/api/health", tags=["System"])
@app.get("/api/index.py", include_in_schema=False)
@app.get("/api/index", include_in_schema=False)
async def api_health_root():
    return {
        "status": "healthy",
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health"
    }

# Serve compiled frontend if present
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Prevent catching unmatched API or documentation endpoints
        if full_path == "api" or full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            return JSONResponse(status_code=404, content={"detail": f"Path /{full_path} not found"})
        file_path = frontend_dist / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index_file = frontend_dist / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return JSONResponse(status_code=404, content={"detail": "Not found"})
else:
    @app.get("/", tags=["System"])
    async def root():
        return {
            "platform": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "docs": "/docs",
            "health": f"{settings.API_V1_STR}/health"
        }
