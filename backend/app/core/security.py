import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple
import bcrypt
import jwt
from app.core.config import settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8")[:72], salt).decode("utf-8")


def create_access_token(
    subject: str,
    claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "agenttrust-auth"
    }
    if claims:
        to_encode.update(claims)
        
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            issuer="agenttrust-auth"
        )
        return payload
    except jwt.PyJWTError:
        return None


def generate_agent_api_key() -> Tuple[str, str, str]:
    """
    Generates a secure API key for an agent.
    Returns:
        (raw_key, key_hash, key_prefix)
    - raw_key: Returned once to caller, NEVER stored.
    - key_hash: SHA-256 digest stored in DB for verification.
    - key_prefix: Short preview (e.g. agk_live_abc12...) for display in UI.
    """
    token_entropy = secrets.token_urlsafe(32)
    raw_key = f"agk_live_{token_entropy}"
    key_hash = hash_api_key(raw_key)
    key_prefix = f"agk_live_{token_entropy[:6]}..."
    return raw_key, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """Computes SHA-256 hash of an API key."""
    return hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()
