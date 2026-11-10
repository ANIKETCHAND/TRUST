from fastapi import APIRouter
from app.api.v1 import (
    agent_exec,
    agents,
    audit,
    auth,
    browser_shield,
    delegations,
    endpoints,
    gateway,
    health,
    integrations,
    overview,
    permissions,
    policies,
    provenance,
    tools,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(overview.router, prefix="/overview")
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(agents.router, prefix="/agents")
api_router.include_router(tools.router, prefix="/tools")
api_router.include_router(permissions.router, prefix="/permissions")
api_router.include_router(delegations.router, prefix="/delegations")
api_router.include_router(provenance.router, prefix="/provenance")
api_router.include_router(policies.router, prefix="/policies")
api_router.include_router(gateway.router, prefix="/gateway")
api_router.include_router(audit.router, prefix="/audit")
api_router.include_router(agent_exec.router, prefix="/agent-exec")
api_router.include_router(endpoints.router, prefix="/endpoints")
api_router.include_router(browser_shield.router, prefix="/browser-shield")
api_router.include_router(integrations.router, prefix="/integrations")
