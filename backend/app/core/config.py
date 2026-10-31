from pathlib import Path
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AgentTrust AI Security Platform"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Security
    SECRET_KEY: str = "agenttrust-super-secure-dev-secret-key-change-in-prod-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours in dev
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./agenttrust.db"
    
    # Sandbox Filesystem Storage Root
    SANDBOX_STORAGE_PATH: str = "./sandbox_storage"
    
    # Open Policy Agent
    OPA_ENABLED: bool = False
    OPA_URL: str = "http://localhost:8181/v1/data/agenttrust/authz"
    
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


settings = Settings()
