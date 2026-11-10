import logging
from pathlib import Path
from typing import List, Set, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("agenttrust.config")

KNOWN_INSECURE_SECRETS: Set[str] = {
    "agenttrust-super-secure-dev-secret-key-change-in-prod-32chars",
    "agenttrust-production-secret-change-in-production-use",
    "secret",
    "changeme",
    "default",
    "password",
    "admin",
}


class Settings(BaseSettings):
    PROJECT_NAME: str = "AgentTrust AI Security Platform"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api/v1"

    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Cryptography
    SECRET_KEY: str = "agenttrust-super-secure-dev-secret-key-change-in-prod-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours in dev, should be shorter in prod

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./agenttrust.db"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Storage Paths
    SANDBOX_STORAGE_PATH: str = "./sandbox_storage"
    QUARANTINE_STORAGE_PATH: str = "./sandbox_storage/quarantine"

    # Open Policy Agent (OPA) Integration
    OPA_ENABLED: bool = False
    OPA_URL: str = "http://localhost:8181/v1/data/agenttrust/authz"

    # Pipelock Sidecar / Proxy Integration
    PIPELOCK_ENABLED: bool = False
    PIPELOCK_PROXY_URL: str = "http://localhost:8090/v1/inspect"

    # File Scanning Engine (ClamAV / YARA)
    CLAMAV_ENABLED: bool = False
    CLAMAV_HOST: str = "localhost"
    CLAMAV_PORT: int = 3310
    YARA_ENABLED: bool = False
    YARA_RULES_PATH: str = "./yara_rules"

    # OpenTelemetry Observability
    OTEL_ENABLED: bool = False
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "agenttrust-core"

    # Browser Shield & Endpoint Configuration
    BROWSER_SHIELD_ENABLED: bool = True
    ENDPOINT_CONNECTOR_ENABLED: bool = True
    ENROLLMENT_SECRET: str = "agenttrust-enrollment-secret-key-32chars-minimum"

    # CORS
    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        env = self.ENVIRONMENT.strip().lower()
        if env == "production":
            # 1. Enforce strong production SECRET_KEY
            if self.SECRET_KEY in KNOWN_INSECURE_SECRETS:
                raise ValueError(
                    "Production Security Fatal: Insecure, default, or placeholder SECRET_KEY detected in production environment. "
                    "A high-entropy secret of at least 32 characters must be provided via the SECRET_KEY environment variable."
                )
            if len(self.SECRET_KEY) < 32:
                raise ValueError(
                    f"Production Security Fatal: SECRET_KEY length ({len(self.SECRET_KEY)}) is insufficient for production. "
                    "Must be at least 32 characters."
                )
            # 2. Database validation warning or enforcement
            if self.DATABASE_URL.startswith("sqlite"):
                logger.warning(
                    "PRODUCTION WARNING: Running SQLite in production is not recommended for concurrent multi-tenant workloads. "
                    "Configure PostgreSQL via DATABASE_URL."
                )
            # 3. Restrict debug mode in production
            if self.DEBUG:
                logger.warning("PRODUCTION NOTICE: DEBUG is enabled in production environment; disabling DEBUG.")
                object.__setattr__(self, "DEBUG", False)
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

    @property
    def absolute_sandbox_path(self) -> Path:
        p = Path(self.SANDBOX_STORAGE_PATH).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def absolute_quarantine_path(self) -> Path:
        p = Path(self.QUARANTINE_STORAGE_PATH).resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
