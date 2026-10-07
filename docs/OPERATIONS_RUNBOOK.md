# Operations runbook

This is the host-neutral operating procedure for MCP1. Complete the environment-specific fields and rehearse the steps in staging before production use. Do not place passwords, private keys, tokens, or production environment files in this document or in Git.

## Service state and routine checks

- Start the personal server locally with `npm run start:personal`; it uses stdio and does not bind a network port.
- Start the business service with `npm run start:business` under the host's persistent Node process manager.
- Check `/healthz` for process liveness and `/readyz` for whether MCP1 is accepting work. Readiness does not prove that an identity provider or downstream system is healthy.
- Inspect the host's process logs for startup, shutdown, restart, and failure messages. Never log bearer tokens, health-check credentials, request bodies, tool arguments, or downstream response bodies.
- The first business pilot is status-only and synthetic/non-personal until identity, audit-retention, and app authorization gates pass.

## Deployment and rollback

1. Record the release commit, build result, runtime version, dependency lockfile hash, and operator.
2. Build the release from the committed lockfile using a supported Node/npm pairing in [DEPLOYMENT.md](DEPLOYMENT.md). Keep the prior known-good artifact available outside the repository.
3. Store production environment values in the host secret configuration. Confirm Host and Origin allowlists, the canonical OAuth resource URL if enabled, downstream HTTPS destinations, and private audit storage.
4. Deploy to staging; check `/healthz`, `/readyz`, authenticated MCP initialization, one allowed tool, one denied scope, and downstream failure behavior with synthetic data.
5. Promote only after the deployment owner records approval. Preserve the previous artifact and its configuration reference.
6. If a release fails its acceptance checks, stop the new process, redeploy the prior artifact and matching configuration, verify readiness and authentication, and record the rollback reason and result.

Fill in before launch:

- Host/provider and application/process identifier: **owner to record**
- Release artifact location and retention: **owner to record**
- Deployment and rollback operators: **named roles required**
- Staging URL and production URL: **owner to record**
- Recovery objective and maximum acceptable outage: **owner to approve**

## Graceful restart and shutdown

On SIGTERM or SIGINT, MCP1 marks readiness false, stops accepting new connections, drains current requests for up to 10 seconds, and closes connections left at the deadline. The process manager should allow at least 10 seconds of shutdown grace. Confirm its configured stop timeout exceeds this drain period, and rehearse a restart while a synthetic health request is active.

## Secret and signing-key rotation

### Downstream health credential

1. Create a replacement credential with the same minimum read-only health permission.
2. Update the host secret setting and restart/redeploy the service.
3. Confirm the health check succeeds and no secret appears in process, proxy, or audit logs.
4. Revoke the old credential and record the change owner and completion time.

### Identity-provider signing key

1. Follow the provider's documented overlapping-key rotation procedure; keep old and new public keys available during the transition.
2. Confirm MCP1 can verify tokens signed by the new key using the staging provider and chosen client.
3. Retire the old key only after provider/client behavior and active-token expiry have been measured.
4. If the private signing key is compromised, follow the emergency response section; do not assume changing JWKS immediately invalidates cached or already-issued tokens.

### MCP1 credentials and secrets

Replace the compromised value at its issuer/source, update the host secret store, restart the application, verify the replacement, and revoke the old value. Do not paste the secret into incident tickets, shell history, commits, or chat.

## Incident response

1. **Triage:** identify the affected service, time window, release, actor/tool correlation IDs, and whether production data or credentials could be involved. Keep raw tokens and business payloads out of tickets.
2. **Contain:** disable the affected health integration or stop MCP1 at the host. Remove the affected provider assignment or credential. For a compromised identity signing key, follow the provider's emergency key-revocation procedure and determine the maximum lifetime of existing tokens.
3. **Preserve:** restrict access to relevant host and audit logs. Record evidence locations, custodians, timestamps, and any applicable legal hold. Do not edit audit events.
4. **Assess:** ask each owning application to determine whether its records or controls were accessed or changed. MCP1's current audit event records actor, tool, outcome, timestamp, and request ID only; it does not contain downstream record payloads.
5. **Recover:** rotate credentials, restore the known-good release/configuration, check `/healthz` and `/readyz`, then validate a denied and allowed synthetic request before reopening access.
6. **Notify and learn:** the designated organizational incident/privacy owner determines required notifications and timing. Record cause, impact, actions, owners, and follow-ups without copying restricted data into the report.

Before production, record the organization incident contact, provider emergency contact, application owners, notification decision owner, and escalation channel in the restricted operations system.

## Backup, restore, and deletion

MCP1 does not currently provide an application database. Back up source and release artifacts through the existing Git/CI recovery path; back up the business audit sink only after its retention, encryption, access, and backup-expiry policy is approved. Do not back up `.env` or private keys into the repository or build archive.

Test restoration to an isolated staging environment at a cadence approved by the service owner. Verify the restored artifact and configuration, check the integrity and access controls of retained audit events, and record the outcome. Follow [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) for personal-data retention, deletion authority, legal holds, and backup expiry; those decisions are still pending.

## Monitoring and escalation

The current `/healthz` and `/readyz` endpoints are minimal status checks. Downstream health tools are scoped per system, limited to a configured concurrency bound, and use a per-system circuit breaker. Rate limits and circuit state are process-local; multiple workers require shared rate-limit/concurrency state and a centralized audit/metrics sink before production scaling.

Use host or centralized monitoring for request volume, latency, auth denials, rate limiting, downstream failures, restarts, and disk pressure. Aggregate counts and timings only; do not record tool arguments, tokens, patient/customer/attendee data, or downstream response bodies. Configure alert recipients and thresholds with the service owner before production.
