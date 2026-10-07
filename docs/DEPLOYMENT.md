# Deployment and operations

## Local personal server

Install Node.js 22+, install dependencies, and configure project paths in `.env` if they differ from the defaults. Connect the intended MCP client to run `npm run start:personal` from the repository root. Keep stdout reserved for MCP messages; diagnostics go to stderr.

## Business service configuration

Required settings:

- `BUSINESS_ISSUER_URL`: exact expected JWT issuer.
- `BUSINESS_AUDIENCE`: token audience assigned to MCP1.
- `BUSINESS_JWKS_URL`: trusted OIDC signing-key endpoint.
- `BUSINESS_ALLOWED_HOSTS`: comma-separated hostnames accepted by the service.

The identity provider and remote MCP clients are still awaiting organization confirmation. Do not treat the current bearer-token verifier as a complete interactive OAuth deployment: authorization discovery and provider/client flow validation are rollout prerequisites. See [IDENTITY.md](IDENTITY.md).

Recommended settings:

- `BUSINESS_HOST=127.0.0.1` for local development, or the host-required interface in production.
- `PORT` supplied by Passenger when using a cPanel Node app.
- `BUSINESS_ALLOWED_ORIGINS` for any browser-based MCP client origins.
- `BUSINESS_TRUST_PROXY=true` only when the trusted local reverse proxy sanitizes and sets `X-Forwarded-For`; this allows per-IP limits to use the real client address.
- `BUSINESS_RATE_LIMIT_PER_MINUTE` with a value appropriate to the client population.
- `AUDIT_LOG_PATH` on a private persistent volume.
- Per-system `SYSTEM_<KEY>_HEALTH_URL` and optional `SYSTEM_<KEY>_HEALTH_TOKEN` values.

Start with `npm run start:business`. The endpoint is `/mcp`; `/healthz` is a minimal process liveness endpoint and contains no dependency information.

## cPanel pilot checklist

The hosting provider and plan must enable a persistent Node application and supply the required runtime. Confirm all of the following with the real account before production:

1. The selected Node version supports the locked dependencies.
2. Passenger/Web Apps passes requests to the running process and supplies its runtime port.
3. The `/mcp` route supports the POST request/response behavior required by the target MCP client. Verify streaming behavior too if that client needs it.
4. HTTPS terminates correctly and the configured host reaches the app.
5. Protected environment variables, restart/redeploy controls, useful logs, and sufficient process/memory limits are available.
6. The app can reach only the required health/API hosts; no public database ports are exposed.
7. Logs and audit output persist through restarts and have rotation/retention configured.
8. A failed app restart and revoked OIDC key are exercised before launch.

cPanel capabilities vary by provider. A working Node website is not sufficient proof of compatible MCP behavior. Use a VPS or managed container when the shared plan cannot meet these conditions or when multiple workers, shared rate limiting, stronger isolation, controlled network egress, or reliable deployment pipelines are required.

## Scaling path

The HTTP handlers are stateless per request and do not keep MCP sessions in process. This makes horizontal scaling simpler. Before adding workers, move rate limiting to shared storage, audit events to a durable centralized sink, and secrets to a managed secret store. Add queue-backed jobs for long-running exports or reports; do not hold a tool request open while materializing large datasets.

## Release process

- Work on `development`.
- Keep the lockfile and documentation updated with implementation changes.
- Commit reviewed milestones to `development`; promote with a fast-forward merge to `main` and push both branches.
- Never include AI attribution in commits, comments, release notes, or PR metadata.
- Build archives and production secret files outside the repository.
