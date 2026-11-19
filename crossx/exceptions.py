class CrossXSecurityError(Exception):
    """Base exception for all CrossX Security Gateway violations."""
    def __init__(self, message: str, decision: str = "BLOCKED", details: dict = None):
        super().__init__(message)
        self.message = message
        self.decision = decision
        self.details = details or {}


class CrossXBlockedError(CrossXSecurityError):
    """Raised when an agent tool call is explicitly blocked by zero-trust policies."""
    pass


class CrossXQuarantinedError(CrossXSecurityError):
    """Raised when an agent is quarantined due to a high-severity cyber threat."""
    pass


class CrossXAuthError(CrossXSecurityError):
    """Raised when agent credentials fail authentication or are revoked."""
    pass
