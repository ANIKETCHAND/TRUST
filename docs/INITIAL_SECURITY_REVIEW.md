# Initial Repository Security Review

Scope: static inspection of selected files on the main branch. This is not a full code audit, penetration test, or verification that the README's test claims are true.

## High-priority findings to verify and fix

### 1. Hardcoded JWT secret in Docker Compose

Observed in `docker-compose.yml`: the environment includes a literal `JWT_SECRET=agenttrust-production-secret-change-in-production-use`.

Risk: deployments that use the compose file as-is share a predictable signing secret. Anyone who obtains it may be able to forge tokens, depending on how the application uses the value.

Required remediation:
- Remove literal secrets from compose files.
- Require a high-entropy secret through an ignored local `.env` or secret manager.
- Fail startup in production if a secret is missing, weak, or a known placeholder.
- Add `.env.example` with placeholders only.
- Rotate any secret that may already have been used in a deployment.
- Add tests proving production startup rejects defaults.

### 2. Hardcoded fallback SECRET_KEY

Observed in `backend/app/core/config.py`: `SECRET_KEY` has a fixed default value.

Risk: environments that omit the variable may silently use a predictable signing key.

Required remediation:
- Use environment-specific settings.
- No production default for signing keys.
- Validate minimum entropy/length and reject known placeholders.
- Keep development secrets separate from production.

### 3. Production deployment uses SQLite

Observed in `docker-compose.yml`: `DATABASE_URL=sqlite+aiosqlite:///./agenttrust.db`.

Risk: SQLite may be acceptable for local development, but is not the intended multi-user production persistence architecture for concurrent enterprise workloads.

Required remediation:
- Add PostgreSQL service or documented external PostgreSQL configuration.
- Use Alembic migrations instead of relying solely on `create_all`.
- Test concurrent writes, transaction isolation, backup and restore.
- Keep SQLite as a local/test option only if supported.

### 4. README claims need evidence

README advertises 23 passing tests and production/enterprise-grade guarantees. These claims must be tied to current CI runs, reproducible commands and a published threat model. Do not present unverified claims as release assurances.

### 5. Agent execution endpoint requires further review

The inspected `backend/app/api/v1/agent_exec.py` includes an endpoint accepting `agent_id` in the request body and runs a multi-step workflow. Verify that the endpoint is protected by an authenticated user/admin dependency, that the caller is authorized for the selected agent, and that no arbitrary user can trigger actions using an agent identifier alone.

The file also includes a prompt-injection demonstration branch with a hardcoded token-shaped string and an external-looking sink. Keep attack demonstrations strictly in isolated tests with synthetic data; never use real secrets or make outbound requests to attacker-controlled destinations.

## Verification still required

- Inspect all authentication and authorization dependencies.
- Review CORS and cookie/token handling.
- Inspect filesystem sandbox and HTTP tool SSRF protections.
- Confirm no user-controlled URLs can reach internal/private networks.
- Review audit-log integrity and tenant isolation.
- Run backend tests and frontend build from a clean checkout.
- Run dependency, secret, container and static analysis scans.
- Review all Docker images, capabilities, mounts and exposed ports.
- Verify endpoint actions are authenticated, authorized, reversible and auditable.

## Status

Initial static findings only. No fixes are claimed in this document. Remediation must be implemented on a dedicated branch and verified with tests before merge.
