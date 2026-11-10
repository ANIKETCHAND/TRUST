from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_agent
from app.core.database import get_db
from app.models.agent import Agent
from app.schemas.gateway import GatewayExecuteRequest, GatewayExecuteResponse
from app.services.gateway_service import gateway_service

router = APIRouter()


@router.post(
    "/execute",
    response_model=GatewayExecuteResponse,
    responses={
        403: {"model": GatewayExecuteResponse, "description": "Operation blocked by security policy"},
        401: {"description": "Missing, invalid, expired, or revoked credentials"}
    },
    tags=["Security Gateway"]
)
async def execute_tool(
    req: GatewayExecuteRequest,
    request: Request,
    agent: Agent = Depends(get_current_agent),
    db: AsyncSession = Depends(get_db)
):
    """
    Central Security Gateway Execution Endpoint.
    Intercepts the tool request, authenticates the agent, deterministically evaluates
    applicable policies, logs the audit trail, and dispatches only authorized executions.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "127.0.0.1")
    response = await gateway_service.execute_tool_request(
        db=db,
        agent=agent,
        req=req,
        client_ip=client_ip
    )

    if response.decision != "ALLOWED":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content=response.model_dump()
        )

    return response
