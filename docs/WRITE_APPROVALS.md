# Consent and approval policy for future writes

## Current status

Business mode currently exposes read-only system discovery and health checks. No record-changing, message-sending, publishing, financial, ticketing, or export tool is enabled. Keep writes disabled until the owning app API, identity bridge, target MCP clients, and approval experience are verified.

The MCP specification leaves the user interaction model to the host and recommends that a human can deny tool calls. Its tool annotations describe behavior but are untrusted hints; they do not enforce approval. See the [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Required approval model

Use the owning application's approval record as the authority for whether a consequential operation may execute. A client confirmation prompt is useful and expected as user experience, but MCP1 cannot infer from a tool call that a human actually saw or approved that prompt. A `confirmed: true` argument, a second model-generated tool call, an annotation, or a user message in the chat is not an app approval record.

For each future action, use this workflow:

1. **Preview:** a read-only app operation validates the exact proposed change and returns a human-readable summary: system, target record/account/event, before/after or final content, amount, recipients/channel, and external effects. Do not perform the side effect.
2. **Create approval intent:** the owning app records the requester, verified local actor, exact action and payload hash, target, policy checks, idempotency key, creation time, expiry, and `pending` state. The approval reference is opaque, short-lived, bound to the user and owning app, and usable once.
3. **Human approval:** an authorized person reviews the same immutable preview in an authenticated application approval screen or another verified approval mechanism. The app records approver, decision, time, and any required reason. Apply the app's separation-of-duties rules; require a second person where law, regulation, or existing app policy requires it.
4. **Execute:** a separate narrowly scoped MCP tool submits the opaque approval reference. The app reauthenticates the actor, rechecks current permissions and record access, verifies the action hash and expiry, consumes approval atomically, enforces idempotency, performs the operation, and writes its audit event. A stale or changed preview requires a new approval.
5. **Report:** return the app operation/reference and final status. Do not claim success until the app confirms it. Repeated requests with the same idempotency key return the original outcome without repeating the side effect.

The exact preview and approval must come from the owning application, so UI, policy, audit, and business state cannot drift apart. A cancelled, expired, rejected, already-used, wrong-actor, wrong-app, or changed-payload approval is refused.

## Risk and client rules

- Grant separate scopes for preview and execution. Never use a broad `write` scope to cover unrelated actions.
- Require the configured MCP client to show a human-readable confirmation for write and external-effect tools, and test that behavior on every supported client. Client confirmation supplements the app approval; it does not replace it.
- Mark tools accurately with MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). Clients may ignore or misinterpret them, so server and app checks remain mandatory.
- External publication and messaging require an exact final-content and recipient preview, the app's approval record, an explicit execution permission, duplicate prevention, quotas, and app-side audit. Keep draft creation separate from publication or sending.
- Financial, regulated, destructive, high-volume, or sensitive-data actions follow the owning app's approval and separation-of-duties policies. Do not weaken an existing second-person approval (for example, controlled-substance witnessing) to accommodate an MCP client.
- Exports are data leaving the app: require a distinct export permission, approved fields and filters, bounded/streamed output, audit, and an approved delivery path. Do not let approval bypass field or record scope.
- Never send a queued write automatically after reauthentication or reconnection. Expired approvals must be previewed and approved again.
- If a client cannot show a clear target/action preview or does not support the required approval interaction, do not expose that write tool through that client.

## Application-specific policy

| System | Approval requirements before enabling writes |
| --- | --- |
| **UlterPOS** | Reuse app permissions and its existing validation/audit for pricing, stock, voids, and financial operations. Keep offline writes limited to existing safe sync operations; online-only approvals remain online-only. Distinguish price changes, stock movements, refunds, and exports. |
| **Tranquil Pharmacy** | Preserve app permission and clinic/branch/record checks. A controlled medicine operation retains the named prescriber, patient, and distinct witness checks. Stock take count and adjustment stay separate. No patient-facing or medication action may be approved solely by a generic MCP scope. |
| **Devspark** | Draft preparation and preview remain separate from publication. The app must add narrow content permissions and an approval record containing the final rendered content and publication target. Contact replies require the authorized staff identity and a reviewable message preview. |
| **Social apps** | Sending requires a preview of channel, exact recipients, content, attachments, and scheduled time; use app quotas and idempotency. Do not expose instance reboot/logout, queue clearing, group membership, or send tools until each receives a separate approval and review. |
| **Renegade** | Event publishing, ticket changes, refunds, settlements, and attendee exports are separate operations. Show event/organizer and financial or attendee impact in the preview; verify event ownership and finance-specific approval in the app. |

## Client-specific rollout record

The business MCP client set is still undecided. Before each client is approved for writes, record its human-confirmation behavior, what exact details its prompt displays, whether users can deny the call, how authentication/approval identity is bound, and the synthetic-data results. The first rollout should be read-only until this record and the application-side approval endpoints are complete.
