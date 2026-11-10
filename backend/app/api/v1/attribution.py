"""
Attribution & Geolocation Threat Intelligence Endpoints
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.services.attribution_service import attribution_service
from app.services.active_defense_service import active_defense_service

router = APIRouter(prefix="/attribution", tags=["Attribution & Forensics"])


class SinkholeRequest(BaseModel):
    ip: str = Field(..., description="Target IP to null-route")
    reason: str = Field("Manual SOC operator containment", description="Operational justification")
    duration_seconds: int = Field(86400, description="Sinkhole duration in seconds")


@router.get("/trace/{ip}", summary="Trace Attacker IP & Local Layer-2 Forensics")
async def trace_attacker_ip(ip: str):
    """
    Returns full forensic attribution dossier for an IP address:
    Autonomous System (ASN), ISP, country, city, coordinates, threat score,
    and Layer-2 ARP MAC address if local subnet threat.
    """
    dossier = attribution_service.trace_ip(ip)
    return dossier


@router.get("/threat-map", summary="Aggregated Global Threat Map Data")
async def get_threat_map():
    """
    Returns global attack coordinates, origin nodes, SOC destination, and active attack rays.
    """
    return attribution_service.get_threat_map_data()


@router.get("/local-arp", summary="Scan Local Subnet ARP Table for Layer-2 Forensics")
async def get_local_arp():
    """
    Scans the local OS ARP cache to discover connected intranet hosts, MAC addresses, and hardware vendors.
    """
    return attribution_service.get_local_arp_table()


@router.get("/sinkholes", summary="List All Dynamically Sinkholed IPs")
async def list_sinkholed_ips():
    """
    Returns all currently active firewall and perimeter null-routes.
    """
    return active_defense_service.list_sinkholed_ips()


@router.post("/sinkhole", status_code=status.HTTP_201_CREATED, summary="Dynamically Null-Route / Sinkhole an Offending IP")
async def create_sinkhole(req: SinkholeRequest):
    """
    Applies an OS-level firewall drop and gateway-level null-route for the offending IP.
    """
    if not req.ip:
        raise HTTPException(status_code=400, detail="IP address is required")
    try:
        res = active_defense_service.sinkhole_ip(
            ip=req.ip,
            reason=req.reason,
            duration_seconds=req.duration_seconds
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/sinkhole/{ip}", summary="Release Null-Route / Remove Firewall Sinkhole")
async def release_sinkhole(ip: str):
    """
    Releases an IP from perimeter sinkholing and removes the OS firewall rule.
    """
    released = active_defense_service.release_sinkhole(ip)
    if not released:
        raise HTTPException(status_code=404, detail=f"IP '{ip}' was not found in active sinkhole registry.")
    return {"status": "RELEASED", "ip": ip}
