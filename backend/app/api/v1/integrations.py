from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.core.config import settings
from app.services.file_scanner_service import file_scanner_service
from app.services.opa_service import opa_service
from app.services.pipelock_service import pipelock_service
from app.services.threat_intel_service import threat_intel_service

router = APIRouter()


class FileScanRequest(BaseModel):
    file_path: str = Field(..., description="Relative or absolute path within sandbox storage")
    auto_quarantine_if_malicious: bool = Field(False, description="Automatically isolate into quarantine vault if threat detected")


class QuarantineRestoreRequest(BaseModel):
    quarantine_id: str
    restored_by: str = Field("admin", description="Authorized administrator identifier")


class ThreatIntelQueryRequest(BaseModel):
    query_type: str = Field(..., description="ip, domain, or hash")
    value: str = Field(..., description="Indicator value to look up")


@router.get("", tags=["Integrations"])
async def get_integrations_status():
    """Returns runtime status and configurations for all open-source integrations."""
    opa_health = await opa_service.check_health()
    pipelock_health = await pipelock_service.check_health()

    return {
        "integrations": [
            {
                "name": "Open Policy Agent (OPA)",
                "category": "Policy Decision Point",
                "enabled": settings.OPA_ENABLED,
                "status": opa_health.get("status", "DISABLED"),
                "endpoint": settings.OPA_URL,
                "fail_closed_mode": True
            },
            {
                "name": "Pipelock AI Proxy",
                "category": "Egress & MCP Inspection Sidecar",
                "enabled": settings.PIPELOCK_ENABLED,
                "status": pipelock_health.get("status", "DISABLED"),
                "endpoint": settings.PIPELOCK_PROXY_URL,
                "fail_closed_mode": pipelock_service.fail_closed
            },
            {
                "name": "ClamAV & YARA Scanner",
                "category": "Malware & File Inspection",
                "enabled": True,
                "status": "ACTIVE",
                "quarantine_vault": str(settings.absolute_quarantine_path),
                "non_destructive": True
            },
            {
                "name": "Threat Intelligence Provider",
                "category": "Indicator Enrichment",
                "enabled": True,
                "status": "ACTIVE",
                "geolocation_note": "Approximate geolocation (does not prove identity)"
            },
            {
                "name": "OpenTelemetry",
                "category": "Observability",
                "enabled": settings.OTEL_ENABLED,
                "status": "ACTIVE" if settings.OTEL_ENABLED else "DISABLED",
                "endpoint": settings.OTEL_EXPORTER_OTLP_ENDPOINT
            }
        ]
    }


@router.post("/scan-file", tags=["Integrations"])
async def scan_file_endpoint(req: FileScanRequest):
    """Scans a file in the sandbox storage using antivirus and heuristic engines."""
    # Resolve safe path inside sandbox
    target_path = Path(req.file_path)
    if not target_path.is_absolute():
        target_path = settings.absolute_sandbox_path / req.file_path

    target_path = target_path.resolve()
    try:
        target_path.relative_to(settings.absolute_sandbox_path)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Cannot scan files outside the configured sandbox boundary."
        )

    if not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{req.file_path}' not found in sandbox storage."
        )

    scan_result = await file_scanner_service.scan_file(target_path)
    quarantine_result = None

    if not scan_result["is_clean"] and req.auto_quarantine_if_malicious:
        quarantine_result = await file_scanner_service.quarantine_file(
            target_path, threat_name=scan_result["threat_name"], initiated_by="scanner_api"
        )

    return {
        "scan_result": scan_result,
        "quarantined": quarantine_result is not None,
        "quarantine_record": quarantine_result
    }


@router.get("/quarantine", tags=["Integrations"])
async def list_quarantine_items():
    """Lists all files currently held in the non-destructive quarantine vault."""
    items = await file_scanner_service.list_quarantine()
    return items


@router.post("/quarantine/restore", tags=["Integrations"])
async def restore_quarantined_item(req: QuarantineRestoreRequest):
    """Safely restores a quarantined file back to its original location."""
    try:
        record = await file_scanner_service.restore_quarantined_file(
            req.quarantine_id, restored_by=req.restored_by
        )
        return {
            "status": "RESTORED",
            "quarantine_id": req.quarantine_id,
            "restored_to": record["original_path"],
            "message": f"File restored successfully by {req.restored_by}."
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/threat-intel", tags=["Integrations"])
async def query_threat_intel(req: ThreatIntelQueryRequest):
    """Queries threat intelligence indicators for IP, domain, or cryptographic hash."""
    q_type = req.query_type.lower()
    val = req.value.strip()

    if q_type == "ip":
        return threat_intel_service.enrich_ip(val)
    elif q_type == "domain":
        return threat_intel_service.enrich_domain(val)
    elif q_type == "hash":
        return threat_intel_service.enrich_hash(val)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported query_type '{req.query_type}'. Must be 'ip', 'domain', or 'hash'."
        )
