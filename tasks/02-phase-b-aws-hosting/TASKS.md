## Phase B — AWS hosting (hub ADR-0012)

### T204 — S3 + CloudFront deploy pipeline
- **Status:** todo
- **Owner:** agent (implementer)
- **Acceptance:**
  - Production build synced to the private S3 bucket; CloudFront invalidation issued on deploy; site serves at `comolatruchaaltrucho.eu`
  - SPA fallback: CloudFront error responses 403/404 → `/index.html` (200)
  - Production environment config points at `api.comolatruchaaltrucho.eu`
  - CI credentials via GitHub OIDC role (no long-lived AWS keys), if CI deploys are used
  - Rollback documented: re-sync previous build (S3 object versions) + invalidate
- **Refs:** hub ADR-0012
