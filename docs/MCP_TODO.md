# MCP1 implementation to-do

This is the working delivery checklist for personal and business MCP functionality across UlterPOS, Tranquil Pharmacy, Devspark, Social apps, and Renegade. Update the boxes in the same commit as the work. A checked item means its acceptance evidence exists; planning or documentation alone does not complete an implementation item.

**Status:** local and process-level foundation is implemented. Remaining production work is gated on owner choices, hosting access, or implementation in the owning application repositories.

**Branch policy:** work on `development`, push completed milestones, fast-forward `main`, and push it.

**Authorship:** keep commit messages and all remote-facing metadata free of AI attribution.

## Phase 0 — Repository and agreed scope

- [x] Clone `marvinok26/MCP1` and establish the `development` and `main` branches.
- [x] Record the personal and business modes and all five in-scope systems.
- [x] Choose TypeScript/Node.js and the MCP TypeScript SDK for the protocol layer.
- [x] Define local stdio for personal development and stateless Streamable HTTP for remote business use.
- [x] Document the first cPanel compatibility checklist and fallback hosting path.
- [x] Inspect the application API/auth boundaries and document them in `INTEGRATION_READINESS.md`.
- [x] Check pushed commit metadata and repository source for prohibited AI attribution; none found through commit `332d0b8`.
- [x] Push each completed milestone to `development`, then promote it to `main`.

## Phase 1 — MCP foundation

- [x] Add local project discovery, safe file reading, fixed-string search, Git status, and bounded diff tools.
- [x] Scope personal tools to configured project roots; block common secret, dependency, and generated paths.
- [x] Keep shell execution out of the exposed tool set; call only fixed `rg` and Git subcommands with argument arrays.
- [x] Add a remote MCP endpoint with signed JWT checks for issuer, audience, key, expiry, and allowed algorithms.
- [x] Add per-tool business scopes, host and origin checks, body bounds, and global/IP/user process-local limits.
- [x] Add redacted JSONL business tool audit events with generated request identifiers.
- [x] Add opt-in HTTPS health checks for configured integrations, refusing redirects and returning minimal status.
- [x] Document setup, security, operations, tool catalogue, decisions, integration patterns, and application readiness.
- [x] Create and commit the npm lockfile.
- [x] Install the locked dependencies and run the TypeScript build/typecheck; resolve the compiler errors found on 2026-10-08.
- [x] Confirm and document supported Node/npm pairings for local and cPanel runtimes; Node 24.21.0/npm 11.19.0 is pinned for local work, and Node 22.23.3/npm 10.9.9 is the compatibility lane. cPanel still must offer a compatible runtime.
- [x] Add automated tests for path traversal, secret exclusions, JWT issuer/audience/signature/expiry, scopes, CORS/Host checks, per-IP/user/global limits, audit redaction, and Streamable HTTP MCP transport handling; 3 files and 6 tests pass.
- [x] Exercise personal stdio tools through the MCP SDK client against harmless README files in all five configured project roots; confirm `.env` access is refused.
- [x] Exercise business Streamable HTTP initialization and tool calls with valid, expired, wrong-audience, and insufficient-scope tokens; the integration test serves a local JWKS, rejects expired/wrong-audience initialization with 401, completes a valid MCP session, and denies the health tool without its scope.
- [x] Review current MCP SDK/spec compatibility and record the supported client/protocol matrix in `MCP_CLIENT_MATRIX.md`; named clients remain unselected, and SDK v2 migration needs a scheduled review.
- [x] Add a CI workflow for install, typecheck, unit/security tests, dependency audit, and build across Node 22 and 24.

## Phase 2 — Identity and business authorization

- [ ] Select the organization identity provider and record its issuer, JWKS rotation, audience, token lifetime, user lifecycle, and incident revocation process; the owner confirmed no provider is currently used and wants the Auth0 recommendation kept provisional.
- [x] Document the recommended business client authentication modes and current bearer-only implementation boundary in `IDENTITY.md`; final client compatibility remains pending selection of the actual provider and clients.
- [x] Define role-to-scope mapping policy for each business system; document the existing permission source, safe future mapping basis, and roles too broad for automatic grants in `ROLE_SCOPE_MAPPING.md`. Actual provider-side assignments remain pending provider selection and app API bridges.
- [x] Choose the application identity bridge: app-owned APIs validate short-lived audience-specific delegated actor tokens, preferably minted via RFC 8693 token exchange; map trusted issuer/subject to local users and apply app-owned policies. Document provider support as a prerequisite in `IDENTITY.md`.
- [x] Review current tool authorization and confirm no business record tools are exposed; document exact current scope checks and make app policy, ownership, field, lifecycle, and audit tests mandatory for each future adapter in `AUTHORIZATION_REVIEW.md`.
- [x] Define the baseline staff consent/approval model for writes and external publication in `WRITE_APPROVALS.md`: app-owned preview and approval records, separate execution scopes, one-time idempotent execution, and client confirmation as an additional layer. Client-specific behavior remains a deployment acceptance check because the client set is undecided.
- [x] Add opt-in OAuth Protected Resource Metadata and the `WWW-Authenticate` metadata pointer; configuration is canonical and discovery stays disabled pending provider/client selection. Validate OAuth login and authorization-server interoperability after selection.
- [ ] Validate key rotation, user deactivation, scope removal, and token revocation behavior end to end. Current verifier behavior and the staging acceptance sequence are documented in `IDENTITY.md`; actual checks require the still-unselected provider.
- [ ] Approve numeric retention periods, accountable privacy/legal owner, and deletion authority; implement and demonstrate expiry/deletion controls in the production audit sink. Interim data classification and access rules are documented in `DATA_GOVERNANCE.md`, but MCP1 currently does not enforce retention.

## Phase 3 — cPanel business pilot

- [ ] Confirm the actual hosting account supports a persistent Node process and a supported runtime for the locked dependencies.
- [ ] Deploy a non-production MCP endpoint behind HTTPS and configure exact Host and permitted Origin values.
- [ ] Verify the chosen MCP client can initialize and make tool calls through the cPanel proxy; check required headers, POST behavior, and streaming behavior.
- [ ] Confirm Passenger-provided port binding, restart/redeploy, environment secrets, outbound host allowlisting, logs, and process limits.
- [ ] Configure trusted-proxy IP handling only if the proxy overwrites forwarded-address headers.
- [ ] Verify health endpoint credentials, timeout, TLS, redirect rejection, and safe failure behavior.
- [ ] Record capacity limits and a tested move path to a VPS/container host.
- [ ] Do not expose production business data until identity, authorization, audit, and recovery checks pass.

## Phase 4 — Application API readiness

These changes belong in the respective application repositories. No record-level MCP tool should ship before its application endpoint and identity bridge are ready.

### UlterPOS

- [ ] Add documented, versioned, authenticated read endpoints for selected operational summaries.
- [ ] Resolve business/tenant and branch scopes server-side; apply existing permissions and hidden-field rules.
- [ ] Add a low-risk branch-scoped sales/stock summary and verify filters, sorting, pagination, and response limits.
- [ ] Preserve the existing audit and subscription behavior; deny expired or out-of-scope access consistently.

### Tranquil Pharmacy

- [ ] Add/confirm delegated staff identity for the MCP caller through Sanctum or a reviewed token exchange.
- [ ] Add a sync/queue health summary that contains no patient names, medication details, sale lines, or hidden fields.
- [ ] Preserve `staff`, `branch`, `access`, `clinic.open`, record scopes, `FieldAccess`, and audit checks.
- [ ] Verify offline queue status cannot expose or modify unsynced sale payloads.

### Devspark

- [ ] Add a server-to-server or delegated identity path that preserves admin permissions and audit attribution.
- [ ] Add read-only draft identifiers/status and draft preview endpoints with field minimization.
- [ ] Add a separate publishing preview/approval workflow; do not make ordinary content preparation publishable by default.
- [ ] Scope contact-message summaries and replies to authorized staff; minimize personal information in MCP results.

### Social apps

- [ ] Define the business use cases and supported channels before adding workflow tools.
- [ ] Design a token-safe authentication surface; never put API tokens in MCP arguments, tool output, or logs.
- [ ] Add read-only instance/queue health tools with no recipient or message content.
- [ ] For later messaging, enforce per-channel permissions, previews, confirmation, queue limits, idempotency, and app-side audit.
- [ ] Keep instance reboot/logout, queue clearing, group membership, and posting tools disabled until separately approved and reviewed.

### Renegade Tickets & Events

- [ ] Add authenticated API routes for organizer/admin business workflows.
- [ ] Enforce organizer ownership, event scope, admin role, and finance permissions at the app endpoint.
- [ ] Add read-only event status and aggregate ticket-scan counts with no attendee details.
- [ ] Add settlement/reconciliation summaries only after verifying finance-specific permissions and output fields.
- [ ] Keep refund, settlement, event publishing, ticket modification, and attendee exports as separate explicit-approval actions.

## Phase 5 — Business MCP adapters

- [ ] Implement one typed adapter per application using fixed route mappings and application-owned APIs.
- [ ] Propagate delegated identity or exchanged short-lived tokens; never trust a caller-supplied user ID/role header.
- [ ] Map app permissions to narrow MCP scopes and keep scopes distinct across systems.
- [ ] Bound every list, search, date range, result size, timeout, and export request.
- [ ] Return minimum necessary fields; preserve tenant, branch, ownership, field-level, and export restrictions.
- [ ] Make write operations separately registered, idempotent, previewable, confirmation-gated, and auditable in the owning app.
- [ ] Add adapter-specific failure mapping, retry rules, rate limits, and correlation IDs.
- [ ] Add integration verification using staging/synthetic data for every tool and permission boundary.
- [ ] Update `TOOLS.md`, `INTEGRATION_READINESS.md`, and the owning application docs with each adapter release.

## Phase 6 — Personal development improvements

- [x] Add a bounded repository documentation resource template without reading secrets or generated artifacts; exercise it with the selected local client before relying on resource support.
- [ ] Add optional browser automation for local/staging UI flows using synthetic data.
- [ ] Add explicit command profiles for safe project tasks; never expose a generic shell tool.
- [x] Add configurable project roots and clear handling for unavailable paths, missing `rg`, and non-Git directories; root overrides are documented in `.env.example` and `TOOLS.md`.
- [ ] Document client connection examples for the actual personal clients in use.
- [ ] Add a user-configurable confirmation policy before any future file-write or command-execution tools.

## Phase 7 — Operations, scale, and governance

- [ ] Move rate limiting from process memory to shared storage before multiple workers/instances.
- [ ] Move JSONL audit output to a durable, access-controlled, append-only sink with retention/rotation and alerting.
- [ ] Add dashboards for request volume, tool latency, downstream failures, rate limiting, and auth denials without logging business payloads.
- [x] Add a weekly dependency update cadence for npm packages and GitHub Actions, plus a scheduled weekly dependency audit in CI; repository security-update settings still need to be enabled by an owner.
- [x] Add graceful shutdown, listener readiness, per-process bounded health-check concurrency, and per-system downstream circuit breaking; shared multi-worker controls remain a scaling task.
- [x] Add host-neutral deployment rollback, secret rotation, backup/recovery, and incident response procedures in `OPERATIONS_RUNBOOK.md`; fill host-specific contacts, recovery objectives, and rehearse in staging before production.
- [ ] Reassess cPanel when usage, availability, worker count, network isolation, or audit retention outgrows shared hosting.
- [x] Document a quarterly review procedure for tool grants and integrations, including removal of unused scopes and credentials; live reviews begin when grants are provisioned.
- [x] Add a new-application onboarding checklist requiring an owner, data classification, identity model, tool catalogue, test gates, and decommission criteria in `NEW_APP_ONBOARDING.md`.

## Awaiting owner decisions and external prerequisites

- Select the workforce identity provider; Auth0 remains a provisional candidate only. Confirm its issuer, staff lifecycle, token/revocation requirements, and support for delegated actor tokens.
- Name the supported remote and personal MCP clients and the first low-risk business workflow; OAuth, client prompts, resource support, and app API work depend on those selections.
- Provide the actual cPanel provider/plan and staging access, or select another hosting target, so the persistent Node runtime, proxy behavior, limits, and recovery path can be exercised.
- Name the organization privacy/legal approver and approve numeric retention periods, deletion authority, legal holds, and backup expiry before real personal data is used.
- Enable repository Dependabot security updates/alerts in GitHub settings; workflow and weekly update configuration are in the repository, but account settings are controlled outside Git.
- Approve the confirmation policy before adding any personal file-write or command-execution tool. No such tool is exposed today.
- Confirm which fixed project command profiles are permitted and whether each may write files or invoke network/deployment actions; no generic shell tool will be added.
- Approve the business roles, thresholds, and separation-of-duties rules for write approvals before any app enables a mutating or externally visible MCP action.
- Select the first application/API owner and authorize changes in that application's repository; MCP1 has no app-owned identity bridge or production record endpoints yet.

## Automated work that remains gated by these decisions

- OAuth provider lifecycle/revocation verification, named-client interoperability, and resource-template client exercise.
- Non-production cPanel deployment and verification of the selected proxy, runtime, logs, and capacity.
- Business API bridges and record tools in each owning application, followed by typed MCP adapters and synthetic-data permission tests.
- Final numeric retention implementation and centralized durable audit storage after retention requirements and operational ownership are approved.
- Browser automation and client-specific connection profiles after target clients, URLs, and synthetic staging data are named.

## Progress log

- **2026-10-08:** Initial personal/business foundation, five project registry entries, security/deployment documentation, and route/auth readiness inventory committed and pushed. Current implementation commit: `332d0b8`.
- **2026-10-08:** Installed dependencies and passed `npm run build`; fixed the project-list export and host typing, and kept strict optional-property checking with a narrow SDK transport type bridge. npm emitted a Node/npm compatibility warning; no runtime or protocol tests were run.
- **2026-10-08:** Added Vitest security and protocol coverage; `npm run build` passed and all 6 tests across 3 files passed, including a live Streamable HTTP MCP client exchange. The Node built-in test runner in this runtime was unusable, so Vitest is the test runner. Personal stdio client exercise remains pending.
- **2026-10-08:** Exercised personal stdio with an MCP client against README files in all five configured project roots; all reads succeeded and `.env` access was refused. `npm run build` passed and the full suite passed with 7 tests across 4 files.
- **2026-10-08:** Exercised business Streamable HTTP with real RS256 tokens and a local JWKS endpoint. Expired and wrong-audience tokens were refused during initialization; a valid signed token initialized and listed tools, while a call lacking its tool scope was denied. `npm run build` passed and the full suite passed with 8 tests across 4 files. JWKS clients now refresh when the configured JWKS URL changes, which keeps configuration changes and isolated test issuers from reusing a stale key source.
- **2026-10-08:** Documented the recommended staff OAuth Authorization Code + PKCE flow, separate machine-to-machine client-credentials use, identity-provider acceptance criteria, and the current bearer-only limitation. The owner confirmed no known identity provider and several/not-yet-decided business clients. Auth0 is recorded as a provisional managed-provider candidate; final selection and real client compatibility remain open.
- **2026-10-08:** Owner confirmed the organization is not currently using an identity provider and asked to keep Auth0 provisional. No provider has been selected or configured.
- **2026-10-08:** Reviewed the authorization models in all five application checkouts and documented exact role/permission mapping rules and unsafe broad-role cases. No record scopes are granted or implemented; the mapping policy is ready to apply once an identity provider and app APIs are selected.
- **2026-10-08:** Selected the app-owned API plus audience-specific delegated actor-token pattern for future integrations. RFC 8693 token exchange is the preferred issuance path; if the eventual provider cannot preserve a constrained actor identity, record tools stay disabled pending review. No provider or app bridge is configured yet.
- **2026-10-08:** Reviewed every current business MCP tool and the five apps' existing auth boundaries. Current tools are limited to scoped system listing, minimal status-only health checks, and process liveness; none accesses business records. Added per-operation synthetic authorization tests as a hard release gate for future adapters. App-side runtime authorization remains unverified until those endpoints exist.
- **2026-10-08:** Defined a risk-based write approval contract: app-generated immutable previews, app-owned approvals bound to actor/action/payload/expiry, narrow execution scopes, atomic one-time idempotent execution, and client confirmation as supplemental UX. Mapped special considerations for all five apps. No write tools are enabled; client-specific approval behavior remains to be tested when the client set is chosen.
- **2026-10-08:** Added opt-in OAuth Protected Resource Metadata and an explicit `WWW-Authenticate` metadata pointer. The metadata uses configured canonical HTTPS resource and issuer URLs, advertises only the current MCP scopes, and is disabled by default while provider and client selection remain open. Authorization server login and client interoperability are still rollout prerequisites.
- **2026-10-08:** Recorded the current token lifecycle boundary and a provider staging acceptance sequence. The verifier checks expiry and token scopes per request, but self-contained tokens are not immediately revoked when provider assignments change; end-to-end key rotation and revocation checks remain open until a provider is selected.
- **2026-10-08:** Drafted the interim classification, audit access, retention, and deletion policy in `DATA_GOVERNANCE.md` and linked it from security and deployment guidance. The exact retention schedule and accountable privacy/legal decision-maker are still organization decisions, and no automated expiry exists; the checklist remains open and real personal data must stay out of the pilot.
- **2026-10-08:** Set Node.js 24.21.0/npm 11.19.0 as the local baseline and Node.js 22.23.3/npm 10.9.9 as the compatibility lane; cPanel availability still requires confirmation against the actual hosting account. Recorded the locked SDK's legacy protocol versions, the unsupported 2026 protocol era, and current client verification limits. Added GitHub Actions CI for Node 22/24 install, build, tests, and high-severity dependency audit, with actions pinned to immutable commit SHAs. Added weekly Dependabot updates for npm and workflow actions and a scheduled CI dependency audit. The workflow will provide its first run result after push; no local tests were run during this work.
- **2026-10-08:** Added the personal `project-documentation` resource template. It lists only bounded documentation files, uses project-relative URIs, skips hidden paths and unavailable roots, and revalidates every read against the existing root and sensitive-path rules. Named-client resource interoperability remains pending.
- **2026-10-08:** Improved personal tool errors for missing project paths, missing ripgrep, and non-Git project directories. Documented the existing environment-based root overrides. No tests were run locally; CI will build and exercise the existing suite on the next push.
- **2026-10-08:** Added `/readyz`, graceful SIGTERM/SIGINT draining with a 10-second force-close deadline, a configurable per-process cap for concurrent health checks, and a per-system circuit breaker that opens after five downstream failures and permits one recovery probe after 30 seconds. These are single-process safeguards; shared rate limiting and concurrency control are still required before multi-worker deployment.
- **2026-10-08:** Added the new-application onboarding template, documented quarterly access/integration review, and added host-neutral deployment, rollback, secret-rotation, recovery, and incident procedures. Environment-specific approvals and staging rehearsal remain outstanding.
- **2026-10-08:** The first CI run failed because `personal-stdio.test.ts` assumed local project directories existed on hosted runners. Reworked it to create temporary fixtures for all five projects and verify documentation resource listing/read plus secret and hidden-path exclusion. Added readiness and circuit-breaker integration coverage. `npm run build` and all 10 tests pass locally; CI passed on both branches for `0c7472b` across Node 22/24, including the high-severity dependency audit.
- **2026-10-08:** Added a host-neutral runbook for deployment/rollback, secret and signing-key rotation, incident response, backup/recovery, and monitoring. Host contacts, recovery objectives, privacy decisions, and staging rehearsal remain deployment prerequisites.
