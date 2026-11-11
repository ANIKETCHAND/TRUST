import json
import pytest
from httpx import AsyncClient
from app.services.attribution_service import attribution_service
from app.services.report_generator import report_generator


def test_attribution_service_wan_resolution():
    dossier = attribution_service.trace_ip("198.51.100.1")
    assert dossier["is_internal"] is False
    assert dossier["origin_type"] == "EXTERNAL_WAN"
    assert dossier["geolocation"]["country"] == "Netherlands"
    assert dossier["geolocation"]["city"] == "Amsterdam"
    assert dossier["geolocation"]["latitude"] > 50.0
    assert "Serverius" in dossier["network"]["asn"]
    assert dossier["threat_score"] >= 70
    assert dossier["threat_level"] in ["HIGH", "CRITICAL"]


def test_attribution_service_intranet_and_arp_resolution():
    dossier = attribution_service.trace_ip("127.0.0.1")
    assert dossier["is_internal"] is True
    assert dossier["origin_type"] == "INTRANET_INSIDER"
    assert dossier["local_layer2"] is not None
    assert "mac_address" in dossier["local_layer2"]
    assert "vendor" in dossier["local_layer2"]

    # Local ARP table inspection
    arp_entries = attribution_service.get_local_arp_table()
    assert isinstance(arp_entries, list)
    assert len(arp_entries) >= 1
    assert "mac" in arp_entries[0]
    assert "vendor" in arp_entries[0]


def test_threat_map_aggregation():
    map_data = attribution_service.get_threat_map_data()
    assert "soc_center" in map_data
    assert "summary" in map_data
    assert "active_threats" in map_data
    assert "attack_rays" in map_data
    assert len(map_data["active_threats"]) >= 1
    assert len(map_data["attack_rays"]) >= 1


@pytest.mark.asyncio
async def test_attribution_api_endpoints(client: AsyncClient):
    # 1. Trace IP endpoint
    res_trace = await client.get("/api/v1/attribution/trace/203.0.113.45")
    assert res_trace.status_code == 200
    data = res_trace.json()
    assert data["query_ip"] == "203.0.113.45"
    assert data["geolocation"]["country"] == "Germany"

    # 2. Threat map endpoint
    res_map = await client.get("/api/v1/attribution/threat-map")
    assert res_map.status_code == 200
    map_json = res_map.json()
    assert "active_threats" in map_json
    assert "attack_rays" in map_json

    # 3. Local ARP endpoint
    res_arp = await client.get("/api/v1/attribution/local-arp")
    assert res_arp.status_code == 200
    assert isinstance(res_arp.json(), list)

    # 4. Sinkhole management endpoints
    sink_ip = "198.51.100.200"
    create_sink = await client.post(
        "/api/v1/attribution/sinkhole",
        json={"ip": sink_ip, "reason": "Automated test probe drop"}
    )
    assert create_sink.status_code == 201

    list_sink = await client.get("/api/v1/attribution/sinkholes")
    assert list_sink.status_code == 200
    assert any(s["ip"] == sink_ip for s in list_sink.json())

    del_sink = await client.delete(f"/api/v1/attribution/sinkhole/{sink_ip}")
    assert del_sink.status_code == 200
    assert del_sink.json()["status"] == "RELEASED"


@pytest.mark.asyncio
async def test_forensic_reports_api_endpoints(client: AsyncClient):
    # 1. MITRE Matrix Taxonomy
    mitre_res = await client.get("/api/v1/reports/mitre-matrix")
    assert mitre_res.status_code == 200
    mitre_data = mitre_res.json()
    assert "PROMPT_INJECTION" in mitre_data
    assert mitre_data["PROMPT_INJECTION"]["id"] == "T1059.001"

    # 2. Executive Security Summary
    exec_res = await client.get("/api/v1/reports/executive-summary")
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert "posture_score" in exec_data
    assert "guardrails_active" in exec_data

    # 3. Seed real test incident in database for forensics export
    from app.core.database import async_session_maker
    from app.models.incident import SecurityIncident, IncidentSeverity, IncidentStatus
    async with async_session_maker() as session:
        existing = await session.get(SecurityIncident, "incident-test-01")
        if not existing:
            inc = SecurityIncident(
                id="incident-test-01",
                title="Adversarial Prompt Injection & Exfiltration Attempt",
                severity=IncidentSeverity.CRITICAL,
                status=IncidentStatus.CONTAINED,
                description="Automated security policy trigger and active countermeasure engagement.",
                incident_metadata={"client_ip": "198.51.100.1", "agent_name": "AuditBot-Sentry"}
            )
            session.add(inc)
            await session.commit()

    # Verify non-existent incident returns 404 (negative verification)
    missing_res = await client.post("/api/v1/reports/incident/non-existent-incident-999/export?format=json")
    assert missing_res.status_code == 404

    # Export Incident Dossier in JSON
    export_json = await client.post("/api/v1/reports/incident/incident-test-01/export?format=json")
    assert export_json.status_code == 200
    assert "application/json" in export_json.headers["content-type"]
    dossier = export_json.json()
    assert "report_id" in dossier
    assert "mitre_attack" in dossier
    assert "timeline" in dossier

    # 4. Export Incident Dossier in CSV
    export_csv = await client.post("/api/v1/reports/incident/incident-test-01/export?format=csv")
    assert export_csv.status_code == 200
    assert "text/csv" in export_csv.headers["content-type"]
    assert "AGENTTRUST INCIDENT FORENSIC REPORT" in export_csv.text

    # 5. Export Incident Dossier in HTML (POST)
    export_html = await client.post("/api/v1/reports/incident/incident-test-01/export?format=html")
    assert export_html.status_code == 200
    assert "text/html" in export_html.headers["content-type"]
    assert "<!DOCTYPE html>" in export_html.text
    assert "AGENTTRUST DEFENSE PLATFORM" in export_html.text

    # 6. Export Incident Dossier in HTML via standard browser GET request
    export_get_html = await client.get("/api/v1/reports/incident/incident-test-01/export?format=html")
    assert export_get_html.status_code == 200
    assert "text/html" in export_get_html.headers["content-type"]
    assert "<!DOCTYPE html>" in export_get_html.text

    # 7. Executive Summary in HTML format
    exec_html_res = await client.get("/api/v1/reports/executive-summary?format=html")
    assert exec_html_res.status_code == 200
    assert "text/html" in exec_html_res.headers["content-type"]
    assert "<!DOCTYPE html>" in exec_html_res.text
    assert "Executive AI Security Posture" in exec_html_res.text


def test_attribution_service_ipv6_and_loopback_handling():
    # Public IPv6 address
    v6_dossier = attribution_service.trace_ip("2607:f8b0:4005:805::200e")
    assert v6_dossier["origin_type"] == "EXTERNAL_WAN"
    assert "IPv6" in v6_dossier["network"]["asn"]
    assert v6_dossier["geolocation"]["latitude"] is not None

    # Loopback address
    loop_dossier = attribution_service.trace_ip("127.0.0.1")
    assert loop_dossier["origin_type"] == "INTRANET_INSIDER"
    assert loop_dossier["local_layer2"]["mac_address"] == "00:00:00:00:00:00"
    assert "Loopback" in loop_dossier["local_layer2"]["vendor"]


@pytest.mark.asyncio
async def test_attribution_sinkhole_validation(client: AsyncClient):
    # Reject malformed IP with 400
    res = await client.post(
        "/api/v1/attribution/sinkhole",
        json={"ip": "1.2.3.4 & calc.exe", "reason": "Attack"}
    )
    assert res.status_code == 400
    assert "Invalid IP" in res.json()["detail"]
