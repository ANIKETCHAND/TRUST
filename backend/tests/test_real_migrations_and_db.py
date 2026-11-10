import os
import shutil
import tempfile
import pytest
from pathlib import Path
import sqlite3
from alembic.config import Config
from alembic import command


def test_alembic_full_migration_lifecycle():
    """
    Verifies that Alembic migrations run cleanly from base to head and head to base
    on an actual physical SQLite database, ensuring all tables, foreign keys,
    tenant_id, and HMAC chaining columns are correctly materialized.
    """
    # 1. Create a dedicated temporary directory and database file
    temp_dir = tempfile.mkdtemp()
    temp_db_path = os.path.join(temp_dir, "migration_test.db")
    temp_db_url = f"sqlite+aiosqlite:///{temp_db_path.replace(os.sep, '/')}"

    alembic_ini_path = os.path.abspath("backend/alembic.ini")
    assert os.path.exists(alembic_ini_path), f"alembic.ini not found at {alembic_ini_path}"

    cfg = Config(alembic_ini_path)
    cfg.set_main_option("sqlalchemy.url", temp_db_url)
    cfg.set_main_option("script_location", os.path.abspath("backend/alembic"))

    try:
        # 2. Run Alembic upgrade head
        command.upgrade(cfg, "head")

        # 3. Connect via sqlite3 to inspect table definitions directly
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row[0] for row in cursor.fetchall()}

        required_tables = {
            "agents",
            "agent_credentials",
            "tools",
            "users",
            "permissions",
            "policies",
            "policy_versions",
            "delegations",
            "provenance_nodes",
            "provenance_edges",
            "audit_events",
            "security_incidents",
            "endpoint_devices",
            "browser_shield_extensions",
            "alembic_version",
        }
        missing_tables = required_tables - tables
        assert not missing_tables, f"Missing required tables created by migrations: {missing_tables}"

        # 4. Verify columns in delegations table (parent_delegation_id)
        cursor.execute("PRAGMA table_info(delegations);")
        delegation_cols = {row[1] for row in cursor.fetchall()}
        assert "parent_delegation_id" in delegation_cols, "parent_delegation_id column missing from delegations table"
        assert "tenant_id" in delegation_cols, "tenant_id column missing from delegations table"

        # 5. Verify columns in audit_events table (HMAC chaining)
        cursor.execute("PRAGMA table_info(audit_events);")
        audit_cols = {row[1] for row in cursor.fetchall()}
        assert "previous_hash" in audit_cols, "previous_hash column missing from audit_events table"
        assert "hmac_signature" in audit_cols, "hmac_signature column missing from audit_events table"
        assert "tenant_id" in audit_cols, "tenant_id column missing from audit_events table"

        # 6. Verify foreign key constraints on delegations
        cursor.execute("PRAGMA foreign_key_list(delegations);")
        fk_list = cursor.fetchall()
        # Look for parent_delegation_id fk
        parent_fk = [fk for fk in fk_list if fk[3] == "parent_delegation_id" and fk[2] == "delegations"]
        assert len(parent_fk) > 0, "Foreign key on parent_delegation_id -> delegations.id is missing"

        conn.close()

        # 7. Test downgrade to base
        command.downgrade(cfg, "base")

        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'alembic_version';")
        remaining_tables = [row[0] for row in cursor.fetchall()]
        conn.close()

        assert len(remaining_tables) == 0, f"Tables still exist after downgrade: {remaining_tables}"

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
