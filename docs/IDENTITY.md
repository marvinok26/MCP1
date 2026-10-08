# Business identity and client authentication

## Provider selection status

**Selected provider: Auth0.** The owner chose Auth0 because UlterNet does not use Google Workspace or Microsoft Entra ID. The Auth0 tenant, API, client registrations, and staff assignments still need to be configured and exercised; selection alone does not mean remote sign-in is live. The supported remote client set is still undecided. Configure separate Auth0 environments for staging and production, and use Auth0 as the workforce identity provider rather than creating a second staff directory.

UlterNet Systems is the parent organization for UlterPOS, Tranquil Pharmacy, the UlterNet website, Social apps, and Renegade. Use one workforce identity boundary for UlterNet staff across these products, with a separate development/staging environment from production. Keep product scopes distinct, and let each product's API enforce its own staff permissions, tenant/branch or ownership scope, and audit trail. Auth0 Organizations are primarily useful when modeling separate customer organizations; they are not required just because UlterNet owns several products.

Auth0 is a managed OIDC provider, so the team does not need Workspace or Entra ID to use it. Keep client authentication standards-based so a future issuer change does not alter MCP scopes or application APIs. Before staff rollout, validate account ownership, pricing for the chosen features, client registration behavior, and the actual remote clients. If the team later chooses self-hosted Keycloak, run it on a separately managed VPS/container with a production database, TLS, backups, recovery, monitoring, and a high-availability plan; do not place the identity service on cPanel shared hosting.

### Auth0 staging configuration

Create an Auth0 API for MCP1 in the staging tenant. Use the API Identifier as the exact token audience; a suitable value is `https://mcp-staging.ulternetsystems.com`. Use RS256 signing. Add the MCP scopes listed in `src/business.ts` (including `mcp:systems:list`, the per-system `:health:read` scopes, and the per-system `:marketing:read` scopes). Enable RBAC and adding permissions to access tokens if those options are available in the tenant. Assign only the scopes each test user needs. Do not use the Auth0 Management API as the MCP audience.

Use the tenant's issuer exactly as shown by its OIDC discovery document, normally `https://<tenant-domain>/` with the trailing slash. Its JWKS URL is normally `https://<tenant-domain>/.well-known/jwks.json`. Configure cPanel's protected environment variables as follows, replacing the issuer with the exact value from Auth0:

```dotenv
BUSINESS_ISSUER_URL=https://<tenant-domain>/
BUSINESS_AUDIENCE=https://mcp-staging.ulternetsystems.com
BUSINESS_JWKS_URL=https://<tenant-domain>/.well-known/jwks.json
BUSINESS_RESOURCE_URL=https://mcp-staging.ulternetsystems.com/mcp
BUSINESS_OAUTH_DISCOVERY_ENABLED=true
```

`BUSINESS_ALLOWED_HOSTS` must include `mcp-staging.ulternetsystems.com`. Restart the cPanel app after saving. First check `/.well-known/oauth-protected-resource` and confirm it advertises the exact resource URL and Auth0 issuer; then check that an unauthenticated `/mcp` request returns 401 with the metadata pointer. Configure an actual client only after selecting it, and verify the full Authorization Code + PKCE flow, expected audience, scopes, refresh behavior, and logout/deactivation behavior. Auth0 does not make an arbitrary client compatible automatically; some clients may require a registered application and callback URL rather than dynamic registration.

Provider acceptance requirements:

- OIDC discovery over HTTPS, a stable issuer, and a JWKS endpoint with overlapping keys during rotation.
- Audience-specific access tokens for MCP1; short access-token lifetimes and refresh handled by the client/provider rather than MCP1.
- Authorization Code with PKCE (S256) for staff using an interactive MCP client. No password grant, implicit flow, or credentials collected by tools.
- A separate machine-to-machine client-credentials grant only for named, non-human automation. Its subject and scopes must identify the service and must not impersonate a staff member.
- Central staff onboarding/offboarding and a tested process to remove grants and invalidate active credentials. Signed self-contained JWTs remain valid until expiry unless the provider offers an introspection/revocation mechanism that MCP1 adopts.
- Narrow MCP audience and scopes. Per-application permissions and record access still have to be checked by each owning application.
- If delegated downstream actor tokens are needed, prove the selected provider can issue them with the required user/actor claims, scopes, and MFA policy before choosing it.

**Auth0-specific evaluation item (reviewed 2026-10-08):** Auth0 Custom Token Exchange follows RFC 8693 but is currently documented as Early Access and limited to Professional/Enterprise plan tiers. Auth0 also documents that an exchange using `actor_token` cannot use MFA in that transaction. This may conflict with UlterNet's staff security requirements, so do not assume the preferred downstream-token pattern will be available on a low-cost plan or work with the required MFA policy. MCP1 currently validates bearer JWTs; it does not yet implement interactive OAuth login, client registration, or downstream token exchange.

If another managed provider is preferred, compare its client compatibility, staff lifecycle controls, MFA, audit export, token audience/scope support, data region, pricing, and incident support before selecting it.

## Client behavior

The business MCP endpoint is a protected resource, not an authorization server. A human-facing remote MCP client should obtain an access token through the selected provider's interactive OAuth authorization flow, then send it as `Authorization: Bearer <access-token>` on every MCP HTTP request. MCP1 validates issuer, audience, signature, expiry, and scopes. The bearer token must be issued specifically for MCP1; tokens for another API must be rejected.

For unattended automation, use a dedicated provider client and the OAuth client-credentials grant only if the chosen MCP client and provider support it. Keep its credential in the automation host's secret store, rotate it, and grant only the required tools. Do not paste tokens into tool arguments or project configuration.

## Application identity bridge decision

**Selected architecture:** each business application owns a narrow API surface and performs its own authorization. The actor reaches that API in a short-lived, application-audience token that preserves the signed-in user as `sub` and identifies MCP1 as the acting client. Prefer OAuth 2.0 Token Exchange (RFC 8693) for this downstream token. Each app verifies issuer, signature, exact audience, expiry, and allowed scopes; maps the trusted `(iss, sub)` pair to a local account through an explicit identity link; then runs its normal permissions, tenant/branch/owner/field checks and audit path.

This deliberately combines the app-owned API boundary with an audience-specific delegated token. The application owns the API and policy decision; the exchanged token carries a verifiable user and actor chain. MCP1 scopes remain an additional tool gate and are not copied as a replacement for the app's own permissions.

Token-exchange support depends on Auth0 plan/features and remains unvalidated. If Auth0 cannot issue constrained downstream tokens that preserve the actor, stop before enabling record tools and review an alternative trust design. Do not send the MCP-audience token to an app, forward a service token plus an unsigned user header, match identities by email, or use a shared administrator credential.

The bridge must fail closed when the identity link is missing, disabled, ambiguous, or out of sync. Provision and deactivate identity links through an audited app-owned path. Never accept local account IDs, tenant IDs, branch IDs, organizer IDs, or role claims from MCP tool arguments as authorization evidence.

### Per-application path

| Application | Bridge behavior required before a record tool ships |
| --- | --- |
| **UlterPOS** | Add versioned API endpoints behind an actor-token verifier. Resolve the local user and business context from the identity link; retain existing permissions, active vertical/team scope, branch scope, subscription behavior, field restrictions, and audit trail. |
| **Tranquil Pharmacy** | Add an actor-token verifier for the selected versioned staff API and resolve a local clinic staff user. Run existing staff, preview, branch, access, idle-timeout, clinic-open, record, and `FieldAccess` checks. Never resolve the platform-admin guard for staff work. |
| **UlterNet website** | Add an actor-token verifier and identity link, plus narrow content read/draft permissions. The existing binary `is_admin` middleware is not a sufficient record-scope grant. |
| **Social apps** | Add an actor-token verifier and map to the authenticated application user. Apply instance ownership for every read or write; keep channel API credentials behind the app. |
| **Renegade** | Add a versioned API and actor-token verifier. Apply event organizer ownership for organizer tools; keep platform administration and finance actions separately permissioned and audited. |

Auth0 selection does not implement the provider configuration, API actor-token verifier, identity link, or record tools. The bridge can be prototyped with synthetic identities after the Auth0 tenant and first application are configured.

## Current implementation boundary

MCP1 verifies bearer JWTs and now has opt-in OAuth Protected Resource Metadata at `/.well-known/oauth-protected-resource`. Enable it with `BUSINESS_OAUTH_DISCOVERY_ENABLED=true` and configure the canonical HTTPS `BUSINESS_RESOURCE_URL`; the issuer comes from `BUSINESS_ISSUER_URL`. Unauthorized MCP requests then include the canonical metadata URL in `WWW-Authenticate`. Metadata is static configuration and never reflects an incoming Host header. Discovery remains disabled by default until Auth0 staging and a target client are configured and validated.

This makes the resource discoverable; it does not implement OAuth authorization, interactive login, consent, client registration, or token issuance. Auth0 is selected, but its tenant and actual remote clients must still be configured and validated for Authorization Code with PKCE, issuer/audience/scope behavior, and token lifecycle before staff rollout. Until then, the existing provisioned-bearer pilot boundary applies.

The deployed MCP TypeScript SDK line and protocol/client compatibility are tracked separately in [MCP_TODO.md](MCP_TODO.md). Auth0 lifecycle and revocation behavior must be added here after staging validation.

## Token lifecycle behavior and rollout gate

The current verifier checks the JWT signature, exact configured issuer and audience, expiration, subject, and scopes on every MCP request. It accepts RS256 and ES256 keys from the configured JWKS endpoint. The JWKS client can refresh keys as keys rotate, but the real provider's overlapping-key publication and cache behavior have not been exercised.

Access tokens are self-contained. Removing a user's provider assignment or a scope does not change a token already issued; that token can continue to work until its expiry. MCP1 has no token introspection, revocation list, or provider event hook today. Immediate deactivation/revocation therefore cannot be promised. Keep access-token lifetimes short and make the provider/client selection gate include a measured revocation delay. If the business requires immediate revocation, add and operate an online revocation/introspection mechanism before staff access is enabled.

In the Auth0 staging tenant, verify: publish an overlapping signing key and rotate to it; retire the old key; remove one user's MCP assignment; remove one granted scope; deactivate the user; revoke an issued token; and record how long each already-issued token remains accepted. Repeat with each supported client and document the observed cache and refresh behavior. Do not treat the current JWT unit coverage as provider lifecycle validation.

## Protocol references

- [MCP authorization specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization): MCP servers are OAuth resource servers; Protected Resource Metadata is required for authorization-server discovery; clients use OAuth Authorization Code with PKCE.
- [MCP TypeScript SDK documentation](https://ts.sdk.modelcontextprotocol.io/): the installed `@modelcontextprotocol/sdk` v1 line implements the 2025-11-25 specification. Confirm the SDK/spec migration path in the compatibility review before treating this as a long-term client contract.
- [RFC 8693: OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html): defines token exchange and the distinction between delegation and impersonation. MCP1's downstream design keeps the user as subject and MCP1 as actor.
- [Auth0 Authorization Code + PKCE](https://auth0.com/docs/api/authentication/authorization-code-flow-with-pkce/authorize-with-pkce) and [Auth0 Dynamic Client Registration](https://auth0.com/docs/get-started/applications/dynamic-client-registration): setup references; they do not establish that the selected MCP clients have been tested.
