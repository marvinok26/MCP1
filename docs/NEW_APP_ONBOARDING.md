# New application onboarding

Use this checklist before adding another application to MCP1. An application is not ready for an MCP record tool until its owner, data, identity, API, and release controls are documented and the acceptance gates pass with synthetic data.

## 1. Ownership and purpose

- [ ] Name a business owner accountable for the integration and an application/API owner who can approve endpoint changes.
- [ ] State the specific user problem and expected outcome; identify which MCP clients will use it.
- [ ] Define a small initial tool catalogue and classify each action as read-only, data export, write, or externally visible.
- [ ] Identify supported environments and provide a non-production endpoint with synthetic fixtures.
- [ ] Record an operational contact, support hours, and escalation path.

## 2. Data and privacy

- [ ] Classify every input and output field using [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).
- [ ] Identify personal, health, payment, financial, attendee, message, and secret fields; exclude fields that are not required for the purpose.
- [ ] Record data source, purpose, users, retention, deletion, legal hold, and backup behavior with the application data owner.
- [ ] Decide whether an impact assessment or additional legal/security review is required before staging.
- [ ] Confirm examples, logs, telemetry, and fixtures contain no production data or credentials.

## 3. Identity and authorization

- [ ] Use the selected workforce identity provider and preserve the verified user's subject through a short-lived application-audience actor token.
- [ ] Map an exact app permission to each MCP scope; do not infer access from a role label or caller-supplied identifier.
- [ ] Implement an explicit issuer/subject identity link and fail closed for missing, disabled, duplicate, or stale links.
- [ ] Enforce tenant, branch, record ownership, field visibility, lifecycle, subscription, and export checks in the application API.
- [ ] Define how permission changes, user deactivation, token expiry, and revocation take effect.

## 4. API and tool contract

- [ ] Add a versioned, authenticated API route owned by the application; MCP1 must not connect directly to its database.
- [ ] Document request/response schemas, status codes, pagination, sorting, filtering, maximum response size, and rate limits.
- [ ] Keep route mappings fixed in the adapter. Bound input length, result count, date range, timeout, concurrency, and retries.
- [ ] Return only fields the verified actor is permitted to see. Deny access to records the actor cannot see without revealing their existence.
- [ ] Define correlation IDs, safe error mapping, circuit behavior, and source-application audit fields.
- [ ] For writes, implement app-owned preview and approval records, exact-payload binding, separate execution scope, idempotency, expiry, and an application audit event.

## 5. Verification and release

- [ ] Add synthetic-data tests for each tool's success path and permission, tenant, branch, ownership, field, lifecycle, expiry, and failure boundaries.
- [ ] Verify secrets and business payloads do not appear in MCP audit events, application logs, error output, or dashboards.
- [ ] Exercise the adapter with each selected client and each hosting proxy; record protocol, OAuth, streaming, and confirmation behavior.
- [ ] Obtain application owner and security approval for the exact scopes and fields before enabling the tool.
- [ ] Update `TOOLS.md`, `INTEGRATION_READINESS.md`, `ROLE_SCOPE_MAPPING.md`, deployment configuration, and the owning application's documentation in the same release.
- [ ] Define rollback, credential rotation, incident response, data deletion, and decommissioning steps.

## 6. Operations and periodic review

- [ ] Add the application to health, latency, error, and authorization-denial monitoring without recording business payloads.
- [ ] Review owner, API, data classification, scope grants, and credentials quarterly and after material ownership, identity, or security changes.
- [ ] Remove unused scopes and credentials when the integration is suspended or retired; retain or delete audit records according to the approved schedule.
- [ ] Record the review date, reviewer, decisions, and follow-up work.

Do not enable a business record tool while a required item is incomplete. Any exception needs a named approver, reason, expiry date, and compensating control.
