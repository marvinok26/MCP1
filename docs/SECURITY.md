# Security model

## Trust boundaries

- Personal stdio is a local developer capability limited to configured project roots.
- Business Streamable HTTP is a remote capability for authenticated users and must use HTTPS at the edge.
- Each application remains authoritative for its users, permissions, tenancy, record scopes, business validation, and audit trail.
- MCP1 has no production database credentials and does not read project `.env` files.

## Authentication and authorization

Business requests require an OIDC/JWT bearer token. MCP1 checks the configured issuer, audience, expiry, signature through the configured JWKS endpoint, and an explicit scope on each tool call. Configure an identity provider to mint narrow audience-bound tokens and map user roles to MCP scopes. Never accept a user ID or role passed in tool arguments as identity.

The provider and business MCP client are not yet selected. The recommended staff flow is OAuth Authorization Code with PKCE through the organization's workforce OIDC provider; use client credentials only for named unattended automation. MCP1 validates provisioned bearer tokens and exposes OAuth Protected Resource Metadata only when explicitly enabled; it does not provide login, consent, client registration, or token issuance. See [Business identity and client authentication](IDENTITY.md) for rollout requirements and this boundary.

Current business scopes:

- `mcp:systems:list`
- `system:ulterpos:health:read`
- `system:tranquil:health:read`
- `system:ulternet:health:read`
- `system:social-apps:health:read`
- `system:renegade:health:read`

The app-specific role-to-scope mapping policy and known gaps are in [ROLE_SCOPE_MAPPING.md](ROLE_SCOPE_MAPPING.md). Health scopes are explicitly assigned to approved operations users; app roles do not grant health or record access by name alone.

The current authorization audit and future per-operation release gates are documented in [AUTHORIZATION_REVIEW.md](AUTHORIZATION_REVIEW.md). No business record tool is enabled; app-side policies must be verified for every future adapter operation. Data categories, audit access, and pending retention/deletion decisions are in [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).

The preview, human approval, and execute requirements for any future write or external action are in [WRITE_APPROVALS.md](WRITE_APPROVALS.md). Client prompts and tool annotations supplement, but never replace, app-side approval records and authorization.

Application record tools must additionally call application APIs using a delegated user identity or an equivalent verified authorization context. A shared service credential must not silently elevate a caller.

## Input and network safety

- Schemas validate tool arguments before handlers run.
- Input body size is limited to 1 MB and the SDK tool-argument element count is bounded.
- Health endpoint URLs are operator configuration, require HTTPS, reject embedded credentials and fragments, and refuse redirects.
- Personal paths are resolved through `realpath`, checked against the configured project root, and filtered for sensitive/generated paths.
- External commands use `execFile` with fixed executable names and argument arrays. User text is never evaluated by a shell.
- The HTTP service enforces configured Host names, optional browser Origin allowlisting, no-store responses, and per-process global, per-IP, and per-user rate limits. Downstream health calls have a bounded concurrency gate and per-system circuit breaker.
- Reverse-proxy IP forwarding is disabled by default. Enable trust only for the documented local proxy case where forwarded client addresses are overwritten by that proxy.

## Audit and privacy

Business tool calls write JSONL audit events containing actor subject, tool name, outcome, timestamp, and request identifier. Tool arguments, bearer tokens, endpoint URLs, and business records are not written to that audit file. The configured path should be on a private, access-controlled volume with rotation and retention policy. MCP1 currently enforces no retention period; see [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) before any production use with personal data.

The starter rate limiter and audit file are process-local. Use a shared rate-limit store and centralized append-only audit sink before running multiple workers or relying on the service for regulated workflows. Make audit-write failure visible and fail closed for any future mutating tool.

## Operations

- Keep secrets in the host's protected environment configuration, not source control.
- Use a service identity with read-only health-check access for the pilot.
- Rotate and revoke keys; monitor authentication failures and unusual tool volume.
- Keep dependency updates reviewed and lockfile changes committed.
- Do not include personal or health data in logs, examples, or synthetic fixtures.
- Keep production network access allowlisted to required application endpoints.

## Known limits

MCP1 currently validates signed JWTs but does not implement an OAuth authorization server, user enrollment, consent screen, or role-to-scope provisioning. These belong to the organization identity provider. Business record integrations remain disabled until each application provides a suitable authorization-preserving API.
