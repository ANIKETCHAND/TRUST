from typing import Any, Dict, Optional


class AgentTrustException(Exception):
    """Base exception class for all AgentTrust domain errors."""
    def __init__(
        self,
        message: str,
        code: str = "AGENTTRUST_ERROR",
        status_code: int = 400,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class AuthenticationException(AgentTrustException):
    """Raised when an agent or user fails authentication checks."""
    def __init__(self, message: str = "Invalid, expired, or revoked credentials", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="AUTHENTICATION_FAILED", status_code=401, details=details)


class AuthorizationException(AgentTrustException):
    """Raised when an agent is denied access by deterministic security policies."""
    def __init__(self, message: str = "Access denied by security policy", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="ACCESS_DENIED", status_code=403, details=details)


class SecurityViolationException(AgentTrustException):
    """Raised when an agent attempts a malicious or restricted action (SSRF, path traversal, injection)."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="SECURITY_VIOLATION", status_code=403, details=details)


class ResourceNotFoundException(AgentTrustException):
    """Raised when a requested resource (agent, tool, policy, grant) is not found."""
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            message=f"{resource_type} '{resource_id}' was not found.",
            code="RESOURCE_NOT_FOUND",
            status_code=404,
            details={"resource_type": resource_type, "resource_id": resource_id}
        )


class DelegationException(AgentTrustException):
    """Raised when multi-agent delegation constraints are violated."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="DELEGATION_VIOLATION", status_code=400, details=details)
