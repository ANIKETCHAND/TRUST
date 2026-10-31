from fastapi import APIRouter
from app.api.v1 import agents, audit, auth, gateway, health, permissions, tools

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(agents.router, prefix="/agents")
api_router.include_router(tools.router, prefix="/tools")
api_router.include_router(permissions.router, prefix="/permissions")
api_router.include_router(gateway.router, prefix="/gateway")
api_router.include_router(audit.router, prefix="/audit")
