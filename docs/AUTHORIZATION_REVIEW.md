# Business authorization review

**Review scope:** current MCP1 business tools and the existing authorization boundaries in the five application checkouts. This review does not certify future MCP record endpoints; none are implemented.

## Current MCP1 operations

| Operation | MCP authorization | Downstream behavior | Finding |
| --- | --- | --- | --- |
| `business_systems_list` | Requires `mcp:systems:list`; each listed system must also have its matching `system:<key>:health:read` scope and a configured health URL. | Reads local project/configuration metadata only. | No app records or app API are accessed. |
| `business_system_health` | Requires the selected system's exact `system:<key>:health:read` scope. | Makes a fixed `GET` to an operator-configured HTTPS URL, rejects redirects, applies a 4-second timeout, optionally sends an operator-configured service bearer token, and returns only reachability and HTTP status. | Service-level health probe; it does not forward the signed-in user's identity or return the health response body. No business records are accessed. |
| `/healthz` | No bearer token; Host and Origin boundary middleware still runs. | Returns only `{ status: "ok" }` for process liveness. | Contains no downstream status or business data. |

The current record-access finding is therefore: **no MCP tool currently reads or changes business records, so no app record policy is bypassed by a record tool.** The service's health probes use a narrow operational credential rather than a user identity. Treat health scope grants as infrastructure information access, separate from app business permissions.

## Existing app authorization boundaries

| System | Existing app-side checks observed | Required for an MCP-facing API |
| --- | --- | --- |
| **UlterPOS** | Business routes use authenticated sessions, business resolution, permission middleware, and business/branch-aware controllers. The API file also contains public/reference, payment callback, and inter-company routes, so route reachability alone is not an authorization guarantee. | Put the operation behind a dedicated versioned route; resolve the mapped user, business, and branch server-side; call the same permission and record scopes as the existing app; reject wrong business/branch access and preserve subscription checks. |
| **Tranquil Pharmacy** | Staff API routes use Sanctum plus `staff`, `preview`, `branch`, `access`, `idle.timeout`, `clinic.open`, and endpoint policies. Platform operator auth is a separate guard/boundary. | Resolve the mapped clinic staff user, then run the complete staff middleware and policy/field pipeline. Never use the platform-operator guard for clinic work. |
| **Devspark** | Admin APIs use a session-backed admin middleware that checks `is_admin` and session lifetime; API writes also sit behind web/CSRF middleware. The role is broad. | Add an authenticated API boundary and narrow permissions per content operation. A valid MCP scope must not turn the broad admin flag into unrestricted record access. |
| **Social apps** | User accounts own instances and related records; platform admin is separate. Channel APIs also use per-channel tokens, while some legacy instance routes carry token values in paths. | Authenticate a mapped application user, enforce owner scope on every instance/message query, and keep channel credentials private to the app. Do not pass route-path tokens through MCP. |
| **Renegade** | Organizer routes require authentication, verification, and organizer status; admin routes use a separate `is_admin` check. Event query helpers apply organizer ownership. No API route surface was present in the reviewed checkout. | Add versioned API routes; derive organizer/event access from the mapped user and app-owned query scopes. Admin-wide, financial, attendee, and write operations need distinct permissions. |

These are source-level observations, not proof that a future bridge already works. Source paths and the bridge design are listed in [INTEGRATION_READINESS.md](INTEGRATION_READINESS.md), [ROLE_SCOPE_MAPPING.md](ROLE_SCOPE_MAPPING.md), and [IDENTITY.md](IDENTITY.md).

## Required proof for every future adapter operation

Do not register a business record tool until the owning application has an API endpoint and synthetic-data tests demonstrating all of the following for that operation:

1. A missing, invalid, expired, wrong-issuer, or wrong-audience downstream token is rejected.
2. The verified issuer/subject resolves to the intended active local user; a missing or disabled identity link denies access.
3. The app enforces its existing action permission in the controller/service policy. A valid MCP scope without that app permission still fails.
4. Tenant, vertical, branch, organizer/instance ownership, record visibility, subscription/lifecycle, and preview restrictions stay active where applicable; an out-of-scope record is not disclosed.
5. Field-level rules apply to responses, searches, sorting, exports, and audit data. Hidden fields are omitted even if a tool scope is present.
6. The app records the mapped local actor and business action in its own audit trail; MCP1 separately records the tool, outcome, actor subject, and correlation ID without business payloads.
7. The MCP scope is checked for that specific tool, and a missing scope blocks the call before downstream work.
8. Writes, publication, messaging, financial actions, and exports have separate scope and app permission checks, and the required preview/confirmation/idempotency controls.

Required negative fixtures include two tenants, two branches or owners, an app user missing the operation permission, an inactive linked user, and fields hidden from that user. Run the cases against each adapter using synthetic data before enabling that tool outside development.

## Decision

The current MCP-only authorization check is verified for the small health/list surface. App-side record authorization remains a release gate for every future operation and cannot be marked runtime-verified until the endpoint and tests exist in that application repository.
