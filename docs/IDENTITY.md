# Business identity and client authentication

## Provider selection status

The owner confirmed that the organization is not currently using an identity provider and instructed that the Auth0 recommendation remain provisional. The remote client set is several clients or not decided. No provider has been selected. When the organization chooses one, MCP1 must use that workforce OIDC provider rather than creating a second staff directory.

**Provisional recommendation:** evaluate Auth0 as the managed OIDC provider for the first business pilot. It avoids operating the identity control plane alongside the MCP service on shared hosting and its documentation covers Authorization Code + PKCE and dynamic client registration. This is a recommendation, not a selected provider: first validate the actual MCP clients, organization domain, account ownership, cost, and provider behavior. Keep client authentication standards-based so a later issuer change does not alter MCP scopes or application APIs. If the team chooses self-hosted Keycloak, run it on a separately managed VPS/container with a production database, TLS, backups, recovery, monitoring, and a high-availability plan; do not place the identity service on cPanel shared hosting.

Provider acceptance requirements:

- OIDC discovery over HTTPS, a stable issuer, and a JWKS endpoint with overlapping keys during rotation.
- Audience-specific access tokens for MCP1; short access-token lifetimes and refresh handled by the client/provider rather than MCP1.
- Authorization Code with PKCE (S256) for staff using an interactive MCP client. No password grant, implicit flow, or credentials collected by tools.
- A separate machine-to-machine client-credentials grant only for named, non-human automation. Its subject and scopes must identify the service and must not impersonate a staff member.
- Central staff onboarding/offboarding and a tested process to remove grants and invalidate active credentials. Signed self-contained JWTs remain valid until expiry unless the provider offers an introspection/revocation mechanism that MCP1 adopts.
- Narrow MCP audience and scopes. Per-application permissions and record access still have to be checked by each owning application.

If another managed provider is preferred, compare its client compatibility, staff lifecycle controls, MFA, audit export, token audience/scope support, data region, pricing, and incident support before selecting it.

## Client behavior

The business MCP endpoint is a protected resource, not an authorization server. A human-facing remote MCP client should obtain an access token through the selected provider's interactive OAuth authorization flow, then send it as `Authorization: Bearer <access-token>` on every MCP HTTP request. MCP1 validates issuer, audience, signature, expiry, and scopes. The bearer token must be issued specifically for MCP1; tokens for another API must be rejected.

For unattended automation, use a dedicated provider client and the OAuth client-credentials grant only if the chosen MCP client and provider support it. Keep its credential in the automation host's secret store, rotate it, and grant only the required tools. Do not paste tokens into tool arguments or project configuration.

## Current implementation boundary

MCP1 currently verifies bearer JWTs but does not implement OAuth authorization, Protected Resource Metadata, or authorization-server discovery. Therefore the implementation is suitable for the signed-token integration tests and controlled pilots where tokens are provisioned out of band; it is not yet a plug-and-play OAuth connection for general remote MCP clients. Before a staff rollout, confirm the target clients, implement and verify the MCP authorization discovery flow they require, and validate issuer/audience/scope behavior with the real provider.

The deployed MCP TypeScript SDK line and protocol/client compatibility are tracked separately in [MCP_TODO.md](MCP_TODO.md). Provider-specific lifecycle and revocation behavior must be added here after the provider is selected.

## Protocol references

- [MCP authorization specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): MCP servers are OAuth resource servers; Protected Resource Metadata is required for authorization-server discovery; clients use OAuth Authorization Code with PKCE.
- [MCP TypeScript SDK documentation](https://ts.sdk.modelcontextprotocol.io/): the installed `@modelcontextprotocol/sdk` v1 line implements the 2025-11-25 specification. Confirm the SDK/spec migration path in the compatibility review before treating this as a long-term client contract.
- [Auth0 Authorization Code + PKCE](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce) and [Auth0 Dynamic Client Registration](https://auth0.com/docs/get-started/applications/dynamic-client-registration): references for the provisional provider candidate, not evidence that the selected MCP clients have been tested.
