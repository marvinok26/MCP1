# Tool catalogue

## Personal mode

| Tool | Purpose | Bounds |
| --- | --- | --- |
| `project_list` | List configured project keys and paths | Fixed registry |
| `project_read_file` | Read source or documentation | Must resolve inside project root; 128 KB maximum; blocks secrets, dependencies, and generated directories |
| `project_search` | Search source and documentation | Fixed-string query; result cap; 5-second timeout; ripgrep arguments are passed without a shell |
| `git_status` | Show branch and changed-file status | Fixed Git subcommand |
| `git_diff` | Review working or staged diff | Fixed Git subcommand; 100 KB output cap; no stage/commit/reset/push operations |

Personal project keys: `ulterpos`, `tranquil`, `devspark`, `social-apps`, and `renegade`.

## Business mode

| Tool | Required scope | Purpose | Data/action |
| --- | --- | --- | --- |
| `business_systems_list` | `mcp:systems:list` and per-system `system:<key>:health:read` | List health integrations the caller may inspect | Configuration metadata only |
| `business_system_health` | `system:<key>:health:read` | Call a configured HTTPS health endpoint | Read-only; returns system key, reachability, and HTTP status |

The `system` input accepts one of the five project keys. A health URL and optional bearer token are configured per system. Redirects are refused, and only HTTPS URLs are accepted.

## Adding a business tool

Every new tool needs:

1. A named business purpose and owning application.
2. A strict Zod input schema with length, range, enum, and pagination bounds.
3. A dedicated least-privilege scope.
4. An app-owned API endpoint that performs authorization, validation, scoping, and audit.
5. Output minimization and field-level authorization.
6. Audit metadata that excludes secrets and record payloads.
7. Idempotency for state changes and the app-owned preview/approval/execute flow in [WRITE_APPROVALS.md](WRITE_APPROVALS.md) for consequential operations.
8. A documented failure contract and an integration verification plan.

Never register a generic arbitrary URL, SQL, shell, or database query tool.

Business writes and externally visible effects are disabled by default. MCP client confirmation and tool annotations are not substitutes for the owning application's approval record and authorization checks.
