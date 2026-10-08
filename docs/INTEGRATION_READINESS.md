# Application integration readiness

This inventory records the existing application API and authentication boundaries inspected while planning MCP business adapters. It prevents MCP1 from treating a route as safe just because it is reachable.

## UlterPOS

`routes/api.php` contains public reference/pricing endpoints, payment callbacks, and inter-company integration routes. It explicitly says authenticated business data routes are registered in `routes/web.php`; those routes sit behind session authentication and business resolution. Operational controllers are tenant/business aware.

**MCP path:** add a dedicated, versioned, authenticated read API in UlterPOS for selected reports/diagnostics. It must resolve the caller's business and branch on the server and reuse the existing permission and record scopes. Do not call payment callbacks or inter-company transfer endpoints as MCP read tools. No business-data MCP tool is enabled by this foundation.

## Tranquil Pharmacy

`routes/api.php` has `/api/health` and a `/api/v1` surface. Staff endpoints run through Sanctum and middleware including `staff`, `preview`, `branch`, `access`, `idle.timeout`, and `clinic.open`. Platform operator routes use a separate sign-in and token boundary from clinic staff.

**MCP path:** use staff identity and the existing staff middleware for any future pharmacy tool. Never reuse platform operator credentials for clinic workflows. Avoid patient-level data in summaries unless caller permissions and `FieldAccess` allow every returned field. Start with a sync-health/queue summary that omits patient and sale details.

## UlterNet website

`routes/api.php` defines admin APIs under `/api/v1` with `web`, `admin`, and `throttle:api` middleware. The frontend authenticates with a session cookie; writes also use CSRF protection.

**MCP path:** add a narrow server-to-server authentication mechanism or a supported delegated session bridge in the UlterNet website. Preserve its admin authorization and audit behavior. Draft preparation can happen outside the publishing endpoint; publishing remains a separate confirmed action. Contact-message tools must avoid exposing full sender content unnecessarily.

**Client-reach workflow findings (2026-10-08):** the website stores contact enquiries and newsletter subscriptions. The existing contact-message API is behind the web session, admin, and API-throttle middleware; it is not a service-token API. Its list/detail responses can include direct identifiers and enquiry content, so MCP1 must not call it using a shared admin credential or expose individual messages. The owner has now configured GA4 with consent-gated tracking and verified Search Console ownership for the UlterNet website and Social Apps property. MCP1's new Google reporting adapter reads aggregate acquisition/search metrics directly from those Google APIs; deployment credentials and property IDs are still required before live calls work. The existing contact-message API remains out of scope, and a separate aggregate inquiry endpoint with privacy-reviewed attribution has not been built.

The Google reporting adapter returns only aggregate GA4 channel and landing-page counts and Search Console clicks, impressions, CTR, average position, and top page paths. It omits query strings, search terms, visitor identifiers, and contact records. The first-party inquiry API remains blocked until the site adds an authenticated aggregate endpoint and an approved source-attribution/retention policy. Never return names, email addresses, phone numbers, message text, IP addresses, or user-agent strings in MCP marketing summaries.

## Social apps

`routes/api.php` exposes WhatsApp instance routes with per-instance tokens in URL paths, plus SMS/Telegram/email v1 send routes using channel API tokens. The route comments describe sending as queued and impose queue/hourly caps.

**MCP path:** do not expose message sending, queue clearing, instance control, or group membership changes by default. If later enabled, use a tool-specific send permission, explicit recipient/content preview and confirmation, idempotency where supported, and app-side quota enforcement. Keep credentials out of tool arguments, returned URLs, logs, and model-visible content. Prefer authorization headers over URL-carried tokens for any new integration surface.

## Renegade Tickets & Events

The inspected checkout has organizer routes protected by `auth`, `verified`, and `organizer` middleware, and admin routes protected by `auth` and `admin`. The checkout has no `routes/api.php` file.

**MCP path:** introduce a narrow authenticated API in Renegade before exposing event, ticket, settlement, or finance data. Enforce organizer ownership/event scope and preserve the existing finance/refund boundaries. Start with event status and aggregate ticket-scan counts; do not return attendee data. Refunds and settlement actions require their own permission, preview, confirmation, idempotency, and audit events.

## Social apps visibility and UlterNet website content

Tools that can reach customers or publish content are externally visible actions. Keep draft-generation and draft-review separate from sending or publishing. Require a named operator permission, content/recipient preview, explicit confirmation, duplicate prevention, and an application-owned audit record before enabling any publishing or messaging action.

## Cross-system identity requirement

The business MCP validates an OIDC identity, while the inspected applications currently use differing session, Sanctum, admin, organizer, or per-channel credentials. MCP scopes alone do not authorize application records. The selected target bridge is an app-owned API that validates a short-lived, audience-specific delegated actor token, preferably issued through OAuth Token Exchange (RFC 8693):

1. The original user remains the signed token's `sub`; MCP1 is identified as the actor.
2. Each app verifies the issuer, signature, exact audience, expiry, and allowed scopes, then resolves the verified issuer/subject to a local account through an explicit identity link.
3. The app runs its existing permission, tenant/branch/owner/field, lifecycle, and audit checks for that local user.
4. If the selected provider cannot issue an appropriately constrained downstream token that preserves the actor, block record access until an alternative trust design is reviewed.

Do not implement a plain `X-User-Id` or role header, a shared superuser token, or a database-side bypass. Those approaches sever trustworthy attribution and can widen access.

See [Business identity and client authentication](IDENTITY.md) for the selected pattern and per-app requirements.

## Readiness summary

| System | Existing business API readiness | First safe MCP milestone |
| --- | --- | --- |
| UlterPOS | Operational data currently uses authenticated web routes | Add a tenant/branch scoped read endpoint |
| Tranquil | Versioned Sanctum API with staff and branch middleware | Sync status summary with no patient details |
| UlterNet website | Session and CSRF protected admin API | Authenticated draft listing/review API |
| Social apps | Channel-specific API tokens; several endpoints send or control services | Read-only queue/instance health with token-safe auth |
| Renegade | Organizer/admin web routes; no API route file | Event status and aggregate scan counts API |

Each entry remains pending until the application API and identity bridge are implemented and reviewed in that application's repository.

The cross-system role-to-scope policy and current role-model gaps are documented in [ROLE_SCOPE_MAPPING.md](ROLE_SCOPE_MAPPING.md). It does not issue grants; all record scopes remain unavailable until the app API and verified identity bridge are ready.

The current tool-by-tool authorization findings and mandatory adapter release checks are documented in [AUTHORIZATION_REVIEW.md](AUTHORIZATION_REVIEW.md). No current tool accesses business records; app-side enforcement must be proven with synthetic-data tests before each future record tool ships.
