# Data classification, audit access, retention, and deletion

## Scope and status

This policy covers data MCP1 receives, returns, or writes to its own audit output. The connected applications remain the authoritative systems for business records and must apply their own privacy, retention, and deletion policies. MCP1 currently has no business record tools and should not be used to copy records out of those systems.

The categories and handling rules below are the interim baseline. Numeric retention periods, the accountable privacy/legal approver, and deletion authority must be recorded by the organization before a production business pilot. No law-specific retention period is inferred here.

## Classification and handling

| Class | Examples in scope | MCP1 handling |
| --- | --- | --- |
| Public | Information explicitly approved for public release | May be returned or logged only when the owning business approves publication. Repository visibility alone does not make data public. |
| Internal | Project keys, service reachability, HTTP status, aggregate service metrics | Return only to authenticated, appropriately scoped users. Avoid exposing internal hostnames, configuration, or diagnostic bodies. |
| Confidential | Staff subject identifiers, tool names, outcomes, request IDs, timestamps, source code and project metadata | Minimize fields, restrict access to approved staff or maintainers, and keep out of general logs and public responses. Treat a stable subject identifier as personal data even when it is not a name. |
| Restricted | Passwords, bearer tokens, signing keys, health-check credentials, patient/health information, payment credentials, customer or attendee contact details, private social messages, and other regulated or highly sensitive records | Do not collect into MCP audit logs, tool arguments, fixtures, or general telemetry. Secrets must not be returned by tools. Future tools that need sensitive records require a documented purpose, app-side authorization, field minimization, and approved retention before release. |

Classify by the most sensitive field in a response or dataset. If classification is uncertain, treat the data as Restricted until its application owner decides otherwise. Synthetic fixtures must contain no real personal or production data.

## Audit record and access

The current business audit event contains `actor` (provider subject), `tool`, `outcome`, `at`, and `requestId`. It excludes tool arguments, bearer tokens, endpoint URLs, and business record payloads. Because `actor` can be linked to a person by the identity provider, the file is Confidential and is subject to the applicable privacy policy.

The JSONL file is created with owner-only file permissions (`0600`) and its containing directory with owner-only permissions (`0700`). The operating-system service account can append to it; host administrators can access it. MCP1 has no audit browsing or deletion UI and no application-level audit-reader role. Production access must be limited to named operations/security custodians, logged by the host or centralized sink, and reviewed when staff change roles. Do not grant general application staff filesystem access to the audit volume.

Audit integrity and operational access controls are different: the current local JSONL implementation is not tamper-proof, centrally monitored, or protected against disk loss. Before relying on it for a regulated workflow or multiple workers, move events to a durable access-controlled append-only sink with retention enforcement, backup handling, and alerts, as required by the operations checklist.

## Retention and deletion

MCP1 currently enforces no audit retention period or automatic deletion. The local JSONL file therefore remains until an operator removes it; this is a production gap, not an approved indefinite-retention policy. Do not deploy the business service with real staff data until the organization records:

1. The business and legal/privacy owner for each data class and connected application.
2. The retention period and trigger for audit events, security logs, backups, and any future tool data, including any legal hold process.
3. Who may authorize deletion and who performs it, with a record of the request, scope, date, and completion.
4. How deletion is applied to active storage, rotated files, replicas, and backups, and when expired backups age out.
5. The process for access, correction, or deletion requests involving a staff subject identifier; requests for business records must be handled by the owning application.

Once approved, the audit sink must expire data automatically at the approved deadline. Deletion should remove expired data from active and rotated storage and apply the documented backup expiry schedule. A legal hold must suspend deletion only for the records and period covered by the hold, with an owner and review date. MCP1 must not silently edit or selectively erase an audit event to hide an action; corrections should use an append-only correction record in the centralized sink.

Until those decisions and controls exist, restrict MCP1 to synthetic or non-personal pilot data and status-only health checks. This interim rule does not replace a privacy impact assessment or the connected application's own retention obligations.

## Required review before production

- Organization owner names the accountable privacy/legal approver and system data owners.
- Owners approve numeric retention periods and deletion/backup procedures for each class.
- Operations implements and demonstrates retention expiry, access review, deletion evidence, and legal hold behavior in the selected audit sink.
- Security confirms no token, secret, record payload, or sensitive downstream response is present in logs or audit events.
- Revisit the classification and schedule whenever an adapter adds a new field, data source, or write action.
