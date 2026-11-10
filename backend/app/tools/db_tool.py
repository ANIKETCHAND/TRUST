import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List
from app.core.config import settings
from app.tools.base import BaseTool


class SandboxedDatabaseTool(BaseTool):
    name = "postgres_tool"
    display_name = "Controlled Relational Database Tool"
    category = "database"
    supported_operations = ["query_select", "query_insert", "query_update", "describe_table"]

    # Dangerous SQL statements strictly blocked to prevent destructive administrative actions
    FORBIDDEN_KEYWORDS = re.compile(
        r"\b(DROP|TRUNCATE|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|GRANT|REVOKE)\b",
        re.IGNORECASE
    )

    def __init__(self, db_path: Path = None):
        self.db_path = db_path or (settings.absolute_sandbox_path / "sandbox_data.db")
        self._init_sandbox_tables()

    def _init_sandbox_tables(self):
        """Initializes sample enterprise relational tables for controlled agent queries."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customer_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                company TEXT NOT NULL,
                contract_tier TEXT NOT NULL,
                status TEXT NOT NULL,
                annual_spend REAL NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                environment TEXT NOT NULL,
                recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Seed initial data if table is empty
        cursor.execute("SELECT COUNT(*) FROM customer_records")
        if cursor.fetchone()[0] == 0:
            sample_customers = [
                ("Acme Corporation", "Acme Corp", "Enterprise", "Active", 120000.0),
                ("Global Logistics Ltd", "GlobalLog", "Business", "Active", 45000.0),
                ("Starlight Health", "Starlight", "Enterprise", "Under Review", 85000.0),
                ("Nova Finance Inc", "NovaFin", "Premium", "Active", 210000.0),
            ]
            cursor.executemany(
                "INSERT INTO customer_records (customer_name, company, contract_tier, status, annual_spend) VALUES (?, ?, ?, ?, ?)",
                sample_customers
            )
        conn.commit()
        conn.close()

    def _validate_sql_safety(self, sql: str, expected_type: str) -> None:
        clean_sql = sql.strip()
        if self.FORBIDDEN_KEYWORDS.search(clean_sql):
            raise PermissionError("Security Violation: Destructive DDL/administrative SQL statements are strictly forbidden.")
        
        # Enforce that query starts with appropriate statement
        first_word = clean_sql.split()[0].upper()
        if expected_type == "query_select" and first_word != "SELECT":
            raise ValueError("Operation 'query_select' only permits SELECT statements.")
        elif expected_type == "query_insert" and first_word != "INSERT":
            raise ValueError("Operation 'query_insert' only permits INSERT statements.")
        elif expected_type == "query_update":
            if first_word != "UPDATE":
                raise ValueError("Operation 'query_update' only permits UPDATE statements.")
            if not re.search(r"\bWHERE\b", clean_sql, re.IGNORECASE):
                raise ValueError("Destructive UPDATE without WHERE clause is prohibited by safety policy.")

    async def execute(self, operation: str, resource: str, parameters: Dict[str, Any]) -> Any:
        if operation not in self.supported_operations:
            raise ValueError(f"Unsupported database operation '{operation}'")

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        try:
            if operation == "describe_table":
                # resource is table name, e.g. "table:customer_records" or "customer_records"
                table_name = resource.replace("table:", "").strip()
                if not re.match(r"^[a-zA-Z0-9_]+$", table_name):
                    raise ValueError(f"Invalid table identifier '{table_name}'")
                
                cursor.execute(f"PRAGMA table_info({table_name})")
                rows = cursor.fetchall()
                if not rows:
                    raise FileNotFoundError(f"Table '{table_name}' not found.")
                columns = [{"cid": r["cid"], "name": r["name"], "type": r["type"], "notnull": bool(r["notnull"])} for r in rows]
                return {"table": table_name, "columns": columns}

            elif operation == "query_select":
                sql = parameters.get("sql", "")
                params = parameters.get("params", [])
                limit = min(int(parameters.get("limit", 100)), 500)
                
                self._validate_sql_safety(sql, "query_select")
                # Append limit if not already present
                if "limit" not in sql.lower():
                    sql = f"{sql.rstrip(';')} LIMIT {limit}"
                    
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                data = [dict(row) for row in rows]
                return {
                    "resource": resource,
                    "row_count": len(data),
                    "data": data
                }

            elif operation == "query_insert":
                sql = parameters.get("sql", "")
                params = parameters.get("params", [])
                self._validate_sql_safety(sql, "query_insert")
                cursor.execute(sql, params)
                conn.commit()
                return {
                    "resource": resource,
                    "rows_affected": cursor.rowcount,
                    "last_row_id": cursor.lastrowid
                }

            elif operation == "query_update":
                sql = parameters.get("sql", "")
                params = parameters.get("params", [])
                self._validate_sql_safety(sql, "query_update")
                cursor.execute(sql, params)
                conn.commit()
                return {
                    "resource": resource,
                    "rows_affected": cursor.rowcount
                }

        finally:
            conn.close()
