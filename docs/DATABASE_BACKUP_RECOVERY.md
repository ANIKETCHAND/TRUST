# AgentTrust Database Backup & Disaster Recovery Guide

This operational manual documents backup, point-in-time recovery, migration, and secret rotation procedures for the AgentTrust production PostgreSQL deployment.

---

## 1. Production PostgreSQL Backup Strategy

### A. Full Logical Backups (`pg_dump`)
Run scheduled nightly logical backups using `pg_dump` with custom compressed format:

```bash
# Automated nightly backup cron:
pg_dump -U agenttrust -h localhost -p 5432 -F c -b -v -f "/var/backups/agenttrust/agenttrust_$(date +\%Y\%m\%d_\%H\%M\%S).dump" agenttrust
```

### B. Point-In-Time Recovery (PITR)
For enterprise clusters with Write-Ahead Logging (WAL) archiving enabled:
1. Ensure `wal_level = replica` in `postgresql.conf`.
2. Configure WAL shipping to an encrypted S3/GCS bucket:
   ```conf
   archive_mode = on
   archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
   ```

---

## 2. Restoration Procedures

### A. Restoring from Logical Dump (`pg_restore`)
To restore into a clean database:

```bash
# 1. Terminate active backend connections
psql -U agenttrust -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'agenttrust' AND pid <> pg_backend_pid();"

# 2. Drop and recreate the database
psql -U agenttrust -d postgres -c "DROP DATABASE IF EXISTS agenttrust;"
psql -U agenttrust -d postgres -c "CREATE DATABASE agenttrust;"

# 3. Restore schema and data
pg_restore -U agenttrust -d agenttrust -v /var/backups/agenttrust/agenttrust_latest.dump

# 4. Verify Alembic migration status
cd backend
alembic current
```

---

## 3. Database Migration Procedures

All schema modifications must be authored as version-controlled Alembic revisions:

```bash
# Create migration
cd backend
alembic revision --autogenerate -m "describe_changes"

# Review the generated file in alembic/versions/

# Apply migration in staging/production
alembic upgrade head
```

---

## 4. Secret & Key Rotation Runbook

1. **Agent API Keys**:
   - Call `POST /api/v1/agents/{agent_id}/revoke` to immediately revoke the compromised key.
   - Issue a new raw key via agent management console or enrollment API.
2. **Control Plane JWT Signing Key (`SECRET_KEY`)**:
   - Generate a new 32-byte key: `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   - Update `SECRET_KEY` in deployment configuration and restart containers.
   - Active user sessions will be required to re-authenticate.
