# Deployment and operations

## Local personal server

Install the repository-pinned Node.js 24.21.0 from `.nvmrc` for local development. Node.js 24 LTS with its bundled npm 11.19.0 is the recommended pairing; Node.js 22.23.3 with npm 10.9.9 is the compatibility lane. Use a current security patch in either supported major. Do not install npm 12 on Node 22.22.0: npm 12 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`. Configure project paths in `.env` if they differ from the defaults. Connect the intended MCP client to run `npm run start:personal` from the repository root. Keep stdout reserved for MCP messages; diagnostics go to stderr. See [MCP_CLIENT_MATRIX.md](MCP_CLIENT_MATRIX.md) for the locked SDK's protocol boundary and client validation status.

## Business service configuration

Required settings:

- `BUSINESS_ISSUER_URL`: exact expected JWT issuer.
- `BUSINESS_AUDIENCE`: token audience assigned to MCP1.
- `BUSINESS_JWKS_URL`: trusted OIDC signing-key endpoint.
- `BUSINESS_ALLOWED_HOSTS`: comma-separated hostnames accepted by the service.
- `BUSINESS_OAUTH_DISCOVERY_ENABLED=false` by default. Set to `true` only after choosing and configuring the identity provider and confirming target-client compatibility.
- `BUSINESS_RESOURCE_URL`: canonical public MCP URL (for example `https://mcp.example.com/mcp`); required when OAuth discovery is enabled. It must use HTTPS and a hostname in `BUSINESS_ALLOWED_HOSTS`.

When enabled, `GET /.well-known/oauth-protected-resource` returns OAuth Protected Resource Metadata and invalid bearer requests to `/mcp` include its canonical URL in `WWW-Authenticate`. Both URLs come from explicit configuration; request Host headers never determine discovery metadata. This publishes the selected issuer as the authorization server, but does not implement OAuth login, consent, client registration, or token issuance. Keep discovery disabled until the organization selects an identity provider and validates the target clients. See [IDENTITY.md](IDENTITY.md).

Recommended settings:

- `BUSINESS_HOST=127.0.0.1` for local development, or the host-required interface in production.
- `PORT` supplied by Passenger when using a cPanel Node app.
- `BUSINESS_ALLOWED_ORIGINS` for any browser-based MCP client origins.
- `BUSINESS_TRUST_PROXY=true` only when the trusted local reverse proxy sanitizes and sets `X-Forwarded-For`; this allows per-IP limits to use the real client address.
- `BUSINESS_RATE_LIMIT_PER_MINUTE` with a value appropriate to the client population.
- `AUDIT_LOG_PATH` on a private persistent volume.
- Per-system `SYSTEM_<KEY>_HEALTH_URL` and optional `SYSTEM_<KEY>_HEALTH_TOKEN` values.

Start with `npm run start:business`. The endpoint is `/mcp`; `/healthz` is a minimal process liveness endpoint and contains no dependency information.

MCP1 does not currently expire audit records automatically. Keep the business pilot synthetic or non-personal until the organization approves retention periods and deletion authority and the deployment has a tested retention process. See [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).

## cPanel pilot checklist

The hosting provider and plan must enable a persistent Node application and supply the required runtime. Confirm all of the following with the real account before production:

1. The selected Node version and bundled npm match a supported pairing above and support the locked dependencies.
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
