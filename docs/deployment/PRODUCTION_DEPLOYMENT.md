# AgentTrust Production Deployment & DevSecOps Guide
**Document Version:** 2.0.0  
**Classification:** Enterprise Infrastructure & Operations Guide  

---

## 1. Production Deployment Architecture

In enterprise production environments, AgentTrust is deployed using a multi-container architecture orchestrated via Docker Compose or Kubernetes:

```
                                  [ Internet / Corporate WAN ]
                                                |
                                                v
                               +---------------------------------+
                               |    Enterprise TLS / HTTPS LB    |
                               |    Port 443 (Let's Encrypt / CA)|
                               +---------------------------------+
                                                |
                               +----------------+----------------+
                               |                                 |
                               v                                 v
                 +---------------------------+     +---------------------------+
                 |  agenttrust-frontend      |     |  agenttrust-backend       |
                 |  (NGINX Reverse Proxy)    |     |  (FastAPI / Uvicorn)      |
                 |  Container Port: 80       |     |  Container Port: 8080     |
                 +---------------------------+     +---------------------------+
                               |                                 |
                               +----------------+----------------+
                                                |
                                                v
                               +---------------------------------+
                               |  agenttrust-postgres            |
                               |  (PostgreSQL 16 Alpine)         |
                               |  Container Port: 5432           |
                               +---------------------------------+
                                                |
                                                v
                               +---------------------------------+
                               |   Persistent Docker Volume      |
                               |   (postgres-data)               |
                               +---------------------------------+
```

---

## 2. Docker Compose Configuration & Multi-Stage Builds

The platform is packaged via [`docker-compose.yml`](file:///e:/OS%20PROJECT/docker-compose.yml) comprising three managed services:

1. **`postgres` Service:**
   - Image: `postgres:16-alpine`
   - Persistent Storage: `postgres-data` volume mounted at `/var/lib/postgresql/data`
   - Healthcheck: `pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}` every 5s

2. **`backend` Service:**
   - Multi-stage Dockerfile ([`Dockerfile.backend`](file:///e:/OS%20PROJECT/Dockerfile.backend)) built on `python:3.12-slim`
   - Runs stateless ASGI workers (`uvicorn app.main:app --host 0.0.0.0 --port 8080`)
   - Dependent on `postgres` service reaching `service_healthy` state
   - Volume: `agenttrust-data` mounted at `/app/sandbox_storage`

3. **`frontend` Service:**
   - Multi-stage Dockerfile ([`Dockerfile.frontend`](file:///e:/OS%20PROJECT/Dockerfile.frontend))
   - Stage 1: Compiles TypeScript and builds production assets via `node:20-alpine` (`npm ci && npm run build`)
   - Stage 2: Serves static assets via `nginx:alpine` and reverse-proxies `/api/` traffic to the backend container

---

## 3. Environment Variable Security & Hardening

Production deployments must populate `.env` using secure values. **Never use development defaults.**

```bash
# Production Environment Configuration Template
ENVIRONMENT=production
DEBUG=false
API_PORT=8080
FRONTEND_PORT=80

# Generate with: openssl rand -hex 32
SECRET_KEY=9f83a42c1b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f
ENROLLMENT_SECRET=8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d

# Database Configuration
POSTGRES_USER=agenttrust_prod
POSTGRES_PASSWORD=YourStrongDatabasePasswordHere123!
POSTGRES_DB=agenttrust_prod
DATABASE_URL=postgresql+asyncpg://agenttrust_prod:YourStrongDatabasePasswordHere123!@postgres:5432/agenttrust_prod

# CORS Security (Restricted to company domains)
ALLOWED_ORIGINS=https://agenttrust.yourdomain.com,https://api.agenttrust.yourdomain.com

# Guardrail & Subsystem Defaults
BROWSER_SHIELD_ENABLED=true
ENDPOINT_CONNECTOR_ENABLED=true
DEFAULT_OUTPUT_RAILS_MODE=block
```

---

## 4. Production Launch & Verification Procedure

```bash
# 1. Clone repository on production host
git clone https://github.com/ANIKETCHAND/TRUST.git
cd TRUST
git checkout redesign/industrial-platform

# 2. Configure production environment
cp .env.example .env
nano .env   # Populate production secrets

# 3. Build and launch multi-container stack
docker compose up -d --build

# 4. Verify service health
docker compose ps
curl -f http://localhost:8080/api/v1/health

# 5. Run database migrations inside backend container
docker compose exec backend python -m alembic upgrade head
```

---

## 5. Security Checklist Prior to Production Go-Live

- [x] High-entropy `SECRET_KEY` and `ENROLLMENT_SECRET` configured (>= 32 characters).
- [x] `DEBUG` set to `false`.
- [x] Database upgraded to PostgreSQL 16.
- [x] Alembic migration chain executed to `head`.
- [x] TLS certificate installed on load balancer / reverse proxy.
- [x] Non-administrative user roles verified; default admin credentials rotated.
- [x] Automated database backup scheduled (`cron` job).
- [x] Healthcheck endpoint `/api/v1/health` integrated with monitoring system.
