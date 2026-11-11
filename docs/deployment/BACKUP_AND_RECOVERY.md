# AgentTrust Database Backup & Disaster Recovery Runbook
**Document Version:** 2.0.0  
**Classification:** Enterprise Disaster Recovery Procedure  

---

## 1. Backup Strategy Overview

AgentTrust maintains critical state across three relational domains:
1. **Control Plane Configuration:** Users, Roles, Organizations, Agents, Permissions, Policies, Delegations.
2. **Operational Telemetry:** Endpoints, Heartbeats, Browser Shield actions.
3. **Immutable Forensic Ledger:** SecurityIncidents, ProvenanceNodes/Edges, and HMAC-chained AuditEvents.

To prevent data loss, the platform implements a dual-tier backup strategy:
- **Tier 1 (Automated Daily Snapshots):** Full physical and logical database dumps retained for 90 days.
- **Tier 2 (Continuous WAL Archiving):** PostgreSQL Write-Ahead Logging (WAL) providing Point-in-Time Recovery (PITR) with a Recovery Point Objective (RPO) of < 5 minutes.

---

## 2. PostgreSQL Production Backup Procedures

### 2.1 Logical Backup via `pg_dump`
Execute a compressed logical backup including all schemas, tables, constraints, and audit tables:

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/agenttrust"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/agenttrust_backup_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting AgentTrust PostgreSQL backup..."
docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-agenttrust}" \
  -d "${POSTGRES_DB:-agenttrust}" \
  -F c -b -v \
  -f "/tmp/backup.dump"

docker cp "$(docker compose ps -q postgres):/tmp/backup.dump" "${FILENAME}"
docker compose exec -T postgres rm /tmp/backup.dump

echo "[$(date)] Backup completed successfully: ${FILENAME}"
# Retain backups for 90 days
find "${BACKUP_DIR}" -type f -name "*.dump" -mtime +90 -delete
```

### 2.2 Point-in-Time Recovery (PITR) Setup
In high-availability enterprise environments, configure PostgreSQL WAL archiving in `postgresql.conf`:

```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
archive_timeout = 300
```

---

## 3. Disaster Recovery & Database Restoration

### 3.1 Restoring from Logical Dump (`pg_restore`)
To restore AgentTrust database state onto a new or recovered database host:

```bash
# 1. Stop backend workers to prevent concurrent writes
docker compose stop backend

# 2. Terminate existing connections and drop target database
docker compose exec -T postgres psql -U agenttrust -c "DROP DATABASE IF EXISTS agenttrust_recovered;"
docker compose exec -T postgres psql -U agenttrust -c "CREATE DATABASE agenttrust_recovered OWNER agenttrust;"

# 3. Restore database schema and data from backup file
docker cp /var/backups/agenttrust/agenttrust_backup_20261110.dump $(docker compose ps -q postgres):/tmp/restore.dump
docker compose exec -T postgres pg_restore \
  -U agenttrust \
  -d agenttrust_recovered \
  -v --clean --if-exists \
  /tmp/restore.dump

# 4. Update backend DATABASE_URL to target restored database
# 5. Start backend workers and run health check
docker compose start backend
curl -f http://localhost:8080/api/v1/health
```

---

## 4. Cryptographic Audit Log Integrity Verification Post-Restore

Following any backup restoration, the integrity of the HMAC-SHA256 audit log chain must be verified immediately:

```bash
# Trigger cryptographic audit chain verification
curl -X GET "http://localhost:8080/api/v1/audit/verify-integrity" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Expected Response:**
```json
{
  "chain_intact": true,
  "total_records_checked": 1420,
  "broken_records": [],
  "message": "Cryptographic HMAC-SHA256 audit log chain is intact and fully verified."
}
```

If `chain_intact` is `false`, the database dump has been tampered with or corrupted during transfer and must not be used in production.
