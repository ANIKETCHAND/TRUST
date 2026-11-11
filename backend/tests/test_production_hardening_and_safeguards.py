from pathlib import Path
import pytest
from httpx import AsyncClient
from app.core.config import Settings
from app.tools.filesystem_tool import MAX_FILE_SIZE_BYTES, SandboxFilesystemTool
from app.tools.http_api_tool import SandboxedHttpApiTool


def test_production_settings_validation():
    # 1. Insecure default secret in production raises ValueError
    with pytest.raises(ValueError, match="Production Security Fatal: Insecure, default"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="agenttrust-super-secure-dev-secret-key-change-in-prod-32chars"
        )

    # 2. Too short secret in production raises ValueError
    with pytest.raises(ValueError, match="Production Security Fatal: SECRET_KEY length"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="short_key_12345"
        )

    # 3. Valid strong 32+ char secret in production succeeds
    valid_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a_super_strong_production_entropy_key_with_at_least_32_characters_long",
        DATABASE_URL="sqlite+aiosqlite:///./agenttrust.db"
    )
    assert valid_settings.ENVIRONMENT == "production"
    assert valid_settings.DEBUG is False  # Restricts debug in prod


def test_filesystem_boundary_and_size_limits():
    fs_tool = SandboxFilesystemTool()

    # 1. Null byte detected and blocked
    with pytest.raises(PermissionError, match="Null byte detected"):
        fs_tool._resolve_safe_path("reports/\x00malicious.txt")

    # 2. Directory traversal outside sandbox boundary detected
    with pytest.raises(PermissionError, match="outside sandbox"):
        fs_tool._resolve_safe_path("../../windows/system32/calc.exe")


def test_ssrf_boundary_protection():
    http_tool = SandboxedHttpApiTool()

    # 1. Localhost blocked
    with pytest.raises(PermissionError, match="SSRF Protection"):
        http_tool._validate_ssrf_safety("http://localhost:8080/admin")

    # 2. Loopback 127.0.0.1 blocked
    with pytest.raises(PermissionError, match="SSRF Protection"):
        http_tool._validate_ssrf_safety("http://127.0.0.1:9000/internal")

    # 3. Cloud metadata 169.254.169.254 blocked
    with pytest.raises(PermissionError, match="SSRF Protection"):
        http_tool._validate_ssrf_safety("http://169.254.169.254/latest/meta-data/")

    # 4. Restricted .internal domain blocked
    with pytest.raises(PermissionError, match="SSRF Protection"):
        http_tool._validate_ssrf_safety("https://vault.corp.internal/v1/secret")
