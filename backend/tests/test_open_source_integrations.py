import os
from pathlib import Path
import pytest
from httpx import AsyncClient
from app.core.config import settings
from app.services.file_scanner_service import AGENTTRUST_TEST_SIGNATURE, file_scanner_service
from app.services.opa_service import opa_service
from app.services.pipelock_service import pipelock_service
from app.services.threat_intel_service import threat_intel_service


@pytest.mark.asyncio
async def test_file_scanner_and_quarantine_workflow(client: AsyncClient):
    sandbox_root = settings.absolute_sandbox_path
    test_file_path = sandbox_root / "suspicious_test_payload.txt"

    # 1. Write simulated benign file
    test_file_path.write_text("Normal application log statement for Q3 audit.", encoding="utf-8")
    clean_scan = await file_scanner_service.scan_file(test_file_path)
    assert clean_scan["is_clean"] is True
    assert clean_scan["threat_name"] is None

    # 2. Write synthetic test signature into file
    test_file_path.write_bytes(AGENTTRUST_TEST_SIGNATURE)
    threat_scan = await file_scanner_service.scan_file(test_file_path)
    assert threat_scan["is_clean"] is False
    assert "SyntheticMalwareSample" in threat_scan["threat_name"]
    assert "sha256" in threat_scan["hashes"]

    # 3. Non-destructive Quarantine
    quarantine_record = await file_scanner_service.quarantine_file(
        test_file_path, threat_name=threat_scan["threat_name"], initiated_by="secops_test"
    )
    assert quarantine_record["is_restored"] is False
    assert not test_file_path.exists()  # Moved out of active sandbox
    assert Path(quarantine_record["quarantined_path"]).exists()  # Preserved in quarantine vault

    # 4. List quarantine items via API
    q_res = await client.get("/api/v1/integrations/quarantine")
    assert q_res.status_code == 200
    items = q_res.json()
    assert any(it["quarantine_id"] == quarantine_record["quarantine_id"] for it in items)

    # 5. Administrative Safe Restore
    restore_res = await client.post(
        "/api/v1/integrations/quarantine/restore",
        json={
            "quarantine_id": quarantine_record["quarantine_id"],
            "restored_by": "secops_lead"
        }
    )
    assert restore_res.status_code == 200
    assert restore_res.json()["status"] == "RESTORED"
    assert test_file_path.exists()  # Successfully restored

    # Cleanup test file
    test_file_path.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_threat_intel_enrichment(client: AsyncClient):
    # 1. IP lookup includes approximate geolocation disclaimer
    ip_res = await client.post(
        "/api/v1/integrations/threat-intel",
        json={"query_type": "ip", "value": "192.168.1.100"}
    )
    assert ip_res.status_code == 200
    data = ip_res.json()
    assert data["is_private"] is True
    assert "approximate" in data["geolocation"]["disclaimer"].lower()
    assert "identity" in data["geolocation"]["disclaimer"].lower()

    # 2. Domain lookup flags suspicious destination
    dom_res = await client.post(
        "/api/v1/integrations/threat-intel",
        json={"query_type": "domain", "value": "malicious-external-exfiltration-sink.org"}
    )
    assert dom_res.status_code == 200
    assert dom_res.json()["is_flagged"] is True

    # 3. Cryptographic hash lookup matches known test signature
    hash_res = await client.post(
        "/api/v1/integrations/threat-intel",
        json={"query_type": "hash", "value": "44d88612fea8a8f36de82e1278abb02f"}
    )
    assert hash_res.status_code == 200
    assert hash_res.json()["is_malicious"] is True


@pytest.mark.asyncio
async def test_opa_and_pipelock_adapters(client: AsyncClient):
    # 1. Integrations overview
    int_res = await client.get("/api/v1/integrations")
    assert int_res.status_code == 200
    integrations = int_res.json()["integrations"]
    assert any("Open Policy Agent" in i["name"] for i in integrations)
    assert any("Pipelock" in i["name"] for i in integrations)

    # 2. Pipelock receipt generation
    receipt = pipelock_service.generate_action_receipt(
        agent_id="test_agent",
        tool="http_api_tool",
        operation="http_post",
        resource="https://internal.service/api",
        decision="ALLOWED"
    )
    assert receipt["receipt_id"].startswith("rcpt_")
    assert "digest_sha256" in receipt
    assert receipt["signed_by"] == "agenttrust-pipelock-bridge"
