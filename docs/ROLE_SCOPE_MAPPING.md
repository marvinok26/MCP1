# Business role-to-scope mapping

## Status and rule

This is the authorization mapping policy for business MCP tools. The organization has not selected an identity provider. MCP1 exposes system listing and health checks, plus opt-in aggregate Google marketing reports for explicitly configured properties. No application record scopes are issued. The mappings below define what a future grant must mean; they do not create staff accounts or grant anyone access.

An MCP scope is an additional tool-level gate, never a replacement for an application's permission policy, tenant/branch/owner scope, field security, subscription gate, or audit log. The app must authorize every request as the verified actor. A role name, user ID, branch ID, or permission list supplied by a client is never trusted as proof of identity or access.

## Scope vocabulary

Current MCP scope names:

| Scope | Meaning | Grant policy |
| --- | --- | --- |
| `mcp:systems:list` | List systems for which the actor has health access | Grant only to named business users approved to discover integrations |
| `system:<system>:health:read` | Call that system's configured, minimal health endpoint | Grant per system to approved operations/support staff; health access is not inherited from an app role |
| `system:<system>:marketing:read` | Read aggregate GA4 and Search Console summaries for the system's explicitly configured public-site properties | Grant only to named marketing/management users approved to view those site's acquisition metrics; service-account property access is read-only and separately limited to configured properties |

Future record tools use a stable namespace: `system:<system>:<domain>:<action>`, for example `system:ulterpos:reports:read` or `system:renegade:events:summary:read`. Use the narrowest resource/action pair. Do not add `*:admin`, `*:write`, or one all-systems scope. Write and export scopes require separate review and tool registration.

An effective call requires all three checks:

1. The verified identity has the exact MCP tool scope.
2. The app endpoint verifies the identity bridge and its current app permissions.
3. The requested record and returned fields are within the actor's business, branch, owner, field, and lifecycle access.

## Application mappings

| System | Existing authorization source inspected | Future MCP read-scope grant basis | Do not infer |
| --- | --- | --- | --- |
| **UlterPOS** | Spatie permission catalogue and role-permission seeder; permissions include `view sale`, `view report`, `view branch report`, `view profit`, `view branch profit`, and `view stats cards`. Role permissions are business/vertical scoped. | For each endpoint, map a narrowly corresponding existing permission to that endpoint's scope. A branch report scope requires the app to retain business and branch filtering. Review sensitive fields such as profit separately. | Do not grant just because a person is named `admin`, `manager`, or `supervisor`; these sets can be broad and vertical/team context matters. Do not let MCP-supplied branch or business IDs widen access. |
| **Tranquil Pharmacy** | `PermissionCatalogue` defines named permissions and prerequisites; examples include `sales.view`, `items.view`, `reports.view`, `audit.view`, and sensitive-field permissions such as `fields.cost`, `fields.customer_contact`, and `fields.patient_identity`. Clinic permission sets are editable; position/branch/record access is separate. | Map a tool to the exact catalogue permission(s) it needs, then apply staff, branch, access, `clinic.open`, record scope, and `FieldAccess` in the app. A queue-health summary without patient or sale details can use a dedicated app permission when added. | Do not treat portal membership, `pharmacy-manager`, or a user-selected permission claim as sufficient authorization. Do not return hidden fields just because the MCP scope is present. |
| **UlterNet website** | Admin APIs use session-backed `admin` middleware; the observed gate checks `is_admin` and session lifetime. There is no granular API permission catalogue on this path. | No record scope may be granted until the UlterNet website adds a narrow authenticated API permission for the exact read operation and preserves actor attribution. Separate content read, draft preparation, publication, and contact-message access. | Do not translate `is_admin` directly into every MCP scope; the current gate is too broad to express least privilege for MCP. |
| **Social apps** | Authenticated application accounts own their instances and related records; platform administration uses `is_admin`. Some legacy WhatsApp routes carry instance tokens in URL paths; v1 channel endpoints use per-channel API tokens. | A new app endpoint must resolve the verified app user and enforce instance ownership. Add distinct health/read scopes before any message or instance action. Send scopes must be separate per channel and recipient/action, with preview, confirmation, quotas, idempotency, and app audit. | Do not use per-channel integration tokens as staff identity or place them in MCP arguments. Do not map `is_admin` to user-owned instance access or message sending. |
| **Renegade** | Organizer routes require authenticated, verified users and organizer status; admin routes use `is_admin`. Event models expose organizer ownership scoping. No API route surface was present in the inspected checkout. | After adding a versioned API, map `events:summary:read` to authenticated organizers and apply event ownership in the query. Admin-wide access needs its own app-side permission and audit path. | Do not infer event ownership from a caller-supplied organizer/event ID. Do not grant settlement, attendee, refund, or event-write scopes from organizer/admin status alone. |

## Grant and provisioning rules

- Grant scopes from reviewed provider-side groups or approved assignments only after an identity provider is selected. The current environment has no identity provider; do not implement role/group provisioning based on an assumed vendor.
- Start with the existing health-only scopes. Require an application permission and verified actor bridge before adding any record scope.
- Keep the provider's identity-group-to-MCP-scope mapping version controlled and reviewed. Use explicit group identifiers, not display names that administrators can rename.
- Role or permission changes must take effect at the app authorization layer on the next request. Token scope changes should use short access-token lifetimes and the selected provider's tested revocation/introspection behavior.
- Remove mappings when a role or app permission is retired. Unrecognized roles, permissions, missing actor links, and unavailable app checks deny access.
- Log the verified actor, requested tool, outcome, and correlation ID in MCP1; keep the app's own audit event as the record of business authorization and activity.

## Periodic grant review

Review each application's owner, active identity links, provider groups, MCP scopes, app permissions, and integration credentials at least quarterly and after an owner, identity, or security change. Confirm each grant still supports a named use case, remove unused grants and credentials, and record the reviewer, date, evidence, and follow-up actions. Future applications must enter this review through [NEW_APP_ONBOARDING.md](NEW_APP_ONBOARDING.md). No provider-side grants exist in the current implementation, so this procedure becomes operational when the identity provider and first business client are selected.

## Source locations reviewed

- UlterPOS: `database/seeders/PermissionSeeder.php`, `database/seeders/RolePermissionSeeder.php`, and permission-protected route groups.
- Tranquil: `app/Support/PermissionCatalogue.php`, `docs/ACCESS-MODEL.md`, and staff API middleware in `routes/api.php`.
- UlterNet website (local repository folder `devspark`): `app/Http/Middleware/EnsureAdmin.php`, `routes/web.php`, and session-protected `routes/api.php`.
- Social apps: account ownership in models/controllers, `is_admin`, and the route auth boundaries in `routes/web.php` and `routes/api.php`.
- Renegade: `OrganizerMiddleware`, `AdminMiddleware`, event ownership scopes, and organizer/admin web routes under `website/renegade/`.
