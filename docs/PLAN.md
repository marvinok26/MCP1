# MCP1 product plan

## Goal

Give the owner a useful local development assistant and give authorized staff a controlled interface to approved business workflows. MCP1 connects assistants to systems; it does not replace those systems' authentication, business rules, or audit trails.

## Modes

### Personal development

Runs locally over stdio. It can inspect configured repositories, search source and documentation, read safe text files, and review Git status and diffs. It cannot stage, commit, reset, push, read environment files, or execute arbitrary shell commands.

### Business operations

Runs as an authenticated remote Streamable HTTP service. It lists explicitly configured integrations and checks their HTTPS health endpoints. The first read-only reporting adapter summarizes aggregate GA4 acquisition and Search Console page performance for explicitly configured UlterNet properties. Future application-record workflows must call app-owned APIs and enforce each app's existing permissions, tenant and branch scoping, field access, validation, audit, and idempotency rules.

## Systems

| System | Personal development coverage | Business coverage now | Planned business workflows |
| --- | --- | --- | --- |
| UlterPOS | Repository search, safe file read, Git review | Configured health check | Tenant/branch-scoped sales, stock, purchasing, and report summaries through approved APIs |
| Tranquil Pharmacy | Repository search, safe file read, Git review | Configured health check | Permission-scoped pharmacy and sync diagnostics through approved APIs; synthetic/local data for development |
| UlterNet website | Repository search, safe file read, Git review | Health check; optional aggregate GA4/Search Console reporting | Draft and review site content; publishing remains an approved human action |
| Social apps | Repository search, safe file read, Git review | Health check; optional aggregate GA4/Search Console reporting for a configured public property | To be defined from real product workflows and supported integrations |
| Renegade Tickets & Events | Repository search, safe file read, Git review | Configured health check | Event and ticket summaries, scan diagnostics, reconciliation and settlement status; refunds, publishing, and financial actions require explicit authorization |

The local repository for Renegade is the Laravel application at `Tickets&Events/renegade/website/renegade`.

See [Application integration readiness](INTEGRATION_READINESS.md) for the current route/auth review and the required identity bridge before adding record-level tools.

## Delivery phases

1. **Foundation:** local stdio mode, remote HTTP mode, tool schemas, identity verification, scopes, audit events, limits, health checks, deployment guidance.
2. **Personal adoption:** connect a coding client; tune allowed project roots and safe source/document patterns.
3. **Business pilot:** deploy to a non-production endpoint, connect one low-risk system, verify OIDC claims, audit trail, and client compatibility.
4. **Read-only workflows:** add one useful workflow at a time, with API contracts and permission tests owned by the app integration.
5. **Approved write workflows:** consider narrow, idempotent operations with explicit user approval and source-app audit records.
6. **Scale:** move from cPanel to a managed container/VPS when availability, traffic, shared rate-limit state, deployment control, or isolation demands it.

The Google reporting adapter's first release is deliberately narrower than lead management: contact submissions stay in the UlterNet app and are not yet connected to MCP. See [TOOLS.md](TOOLS.md) for report bounds and data exclusions, and [DEPLOYMENT.md](DEPLOYMENT.md) for Google API configuration.

## Product acceptance outcomes

- Personal and business modes cannot share credentials or configured privileges.
- Personal file access remains inside configured roots and blocks secrets, dependencies, and generated content.
- Every business tool requires a valid issuer, audience, and signing key; each tool checks its own required scope.
- Business data operations use application APIs and preserve application authorization.
- Business tool calls produce redacted audit events; logs do not contain tokens or business payloads.
- Tool inputs, outputs, time, and payload size are bounded.
- New systems can be registered through a documented module/configuration contract without changing existing system permissions.
- cPanel compatibility is proven with the chosen hosting plan and MCP client before production use.

## Explicit exclusions for the foundation

- No direct production database access.
- No arbitrary SQL, shell, filesystem, or URL-fetch tool for business users.
- No automatic publication, refund, payment, role assignment, dispensing, stock adjustment, or record mutation.
- No assumption that a tool being listed means the caller is allowed to use it.
- No broad Social apps workflow until the product behavior is established.
