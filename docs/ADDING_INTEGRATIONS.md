# Adding an integration

## Integration contract

Each project adapter owns only the translation between MCP tool inputs and that application's supported API. It must not duplicate application policy or use a broad database connection. Shared MCP code owns authentication, scope checks, rate limiting, and redacted audit metadata.

Before implementation, document:

- System owner and API base URL for each environment.
- Authentication method and how the caller's identity/permissions reach the application.
- Allowed routes, request/response schemas, and maximum response sizes.
- Tenant, branch, record, and field access rules.
- Rate limits, timeouts, retry behavior, and idempotency keys.
- Audit event ownership and retention.
- Whether the action is read-only or changes business state, and what confirmation is required.

## Adapter pattern

Create a module under `src/integrations/<system>/` with:

- A server registration function.
- Strict schemas for every tool.
- A typed API client with fixed route mappings (no arbitrary path input).
- A permission requirement for every tool.
- A minimized response mapper that omits unauthorized fields.
- Redacted audit metadata and safe error mapping.
- Documentation in `docs/TOOLS.md` and configuration examples in `.env.example`.

Keep system-specific permissions distinct. For example, access to a Renegade ticket status must not imply refund permission, and access to Tranquil pharmacy summaries must not imply patient-level access.

## Suggested first business adapters

Choose a low-risk, read-only workflow with a documented API and synthetic/staging data. Candidate first steps:

- UlterPOS: a branch-scoped operational summary.
- Tranquil: a sync/queue status without patient details.
- Devspark: list draft page identifiers and review status.
- Social apps: defer until its user workflows and supported channels are defined.
- Renegade: event status and ticket scan totals without attendee details.

For later writes, use preview/commit or proposal/approval steps, application-enforced idempotency, and source-system audit records. Financial, publishing, access-control, dispensing, and stock-ledger changes need specific owner approval before exposure as MCP tools.
