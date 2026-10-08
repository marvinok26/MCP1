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
- `BUSINESS_MAX_CONCURRENT_HEALTH_CHECKS` between 1 and 100; defaults to 20 per process.
- `AUDIT_LOG_PATH` on a private persistent volume.
- Per-system `SYSTEM_<KEY>_HEALTH_URL` and optional `SYSTEM_<KEY>_HEALTH_TOKEN` values.

Start with `npm run start:business`. The endpoint is `/mcp`; `/healthz` is process liveness and `/readyz` reports whether the listener is accepting work. Readiness does not probe downstream systems. On SIGTERM/SIGINT the service stops accepting connections, drains active requests for up to 10 seconds, and then closes remaining connections. Health-check calls are bounded per process and a system circuit opens after five failures for 30 seconds. These limits are process-local and do not replace shared controls before multi-worker deployment.

MCP1 does not currently expire audit records automatically. Keep the business pilot synthetic or non-personal until the organization approves retention periods and deletion authority and the deployment has a tested retention process. See [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).

See [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for deployment, rollback, rotation, recovery, and incident-response procedures. Complete the host-specific values and rehearse them in staging before production.

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

### Verified staging account

On 2026-10-08, the cPanel account successfully ran the staging service at `https://mcp-staging.ulternetsystems.com` using Node.js 24.21.0 and npm 11.19.0. Passenger served `/healthz` and `/readyz` with 200 responses; `/mcp` returned 401 without a bearer token, and protected-resource metadata returned 404 with OAuth discovery disabled. The repository checkout is at the domain document root by owner choice. A server-local `.htaccess` denies direct requests to `.git`, environment/config files, source, documentation, tests, build output, and dependency folders; probes for representative files returned 403. Re-run these probes after any cPanel app or `.htaccess` change.

After the owner restarted the cPanel app following the latest `development` deployment, the same status and access-control probes returned the expected responses again: `/healthz` and `/readyz` 200, `/mcp` 401, OAuth metadata 404, and `package.json` plus `src/business.ts` 403. This verifies restart recovery and the current static-file deny rules; persistent audit-log behavior, outbound network restrictions, and resource limits remain to be checked.

The cPanel app environment contains the staging host allowlist, disabled OAuth discovery, and a private audit-log path outside the document root. The identity-provider issuer, audience, and JWKS URL remain unset until a provider is selected. Build in the cPanel Node environment with `npm ci --include=dev`, `npm run build`, then `npm prune --omit=dev`. Keep cPanel's Passenger directives when maintaining the local `.htaccess` rules; the cPanel-specific file is excluded locally through `.git/info/exclude` and is not committed.

## Scaling path

The HTTP handlers are stateless per request and do not keep MCP sessions in process. This makes horizontal scaling simpler. Before adding workers, move rate limiting to shared storage, audit events to a durable centralized sink, and secrets to a managed secret store. Add queue-backed jobs for long-running exports or reports; do not hold a tool request open while materializing large datasets.

## Release process

- Work on `development`.
- Keep the lockfile and documentation updated with implementation changes.
- Commit reviewed milestones to `development`; promote with a fast-forward merge to `main` and push both branches.
- Never include AI attribution in commits, comments, release notes, or PR metadata.
- Build archives and production secret files outside the repository.
