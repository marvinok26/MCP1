# Tool catalogue

## Personal mode

| Tool | Purpose | Bounds |
| --- | --- | --- |
| `project_list` | List configured project keys and paths | Fixed registry |
| `project_read_file` | Read source or documentation | Must resolve inside project root; 128 KB maximum; blocks secrets, dependencies, and generated directories |
| `project_search` | Search source and documentation | Fixed-string query; result cap; 5-second timeout; ripgrep arguments are passed without a shell |
| `git_status` | Show branch and changed-file status | Fixed Git subcommand |
| `git_diff` | Review working or staged diff | Fixed Git subcommand; 100 KB output cap; no stage/commit/reset/push operations |
| `marketing_channel_summary` | Summarize GA4 sessions, active users, and key events by channel | Aggregate; 90-day range; requires Google reporting configuration |
| `marketing_landing_pages` | Summarize GA4 sessions, active users, and key events by landing path | Top 25 paths; query strings removed; aggregate; requires Google reporting configuration |
| `marketing_search_performance` | Summarize Search Console clicks, impressions, CTR, position, and top pages | Top 25 pages; search terms and visitor identifiers excluded; requires Google reporting configuration |

Personal project keys: `ulterpos`, `tranquil`, `ulternet`, `social-apps`, and `renegade`. The `ulternet` key maps to the local website repository folder named `devspark`.

Project roots can be overridden with the corresponding `PROJECT_<KEY>_PATH` settings in `.env`. An unavailable root produces an actionable configuration message; search reports a missing ripgrep installation; Git review reports when a configured root is not a Git repository.

## Personal resources

The stdio server exposes one `project-documentation` resource template with URIs in the form `mcp1-doc://<project>/<file>`. Its catalogue includes each configured project's root `README.md` and up to 40 files per project from the `docs/` directory tree, with a 200-resource overall cap. It lists only Markdown, MDX, reStructuredText, and text files, skips hidden directories and excluded paths, and reads files on demand up to 128 KB. Resource reads pass through the same real-path and secret/generated-path exclusions as `project_read_file`; unavailable project roots are omitted.

## Business mode

| Tool | Required scope | Purpose | Data/action |
| --- | --- | --- | --- |
| `business_systems_list` | `mcp:systems:list` and per-system `system:<key>:health:read` | List health integrations the caller may inspect | Configuration metadata only |
| `business_system_health` | `system:<key>:health:read` | Call a configured HTTPS health endpoint | Read-only; returns system key, reachability, and HTTP status |
| `marketing_channel_summary` | `system:<key>:marketing:read` | Summarize GA4 sessions, active users, and key events by acquisition channel | Aggregate only; maximum 25 channels and 90-day range |
| `marketing_landing_pages` | `system:<key>:marketing:read` | Summarize GA4 sessions, active users, and key events by landing-page path | Aggregate only; maximum 25 paths, query strings removed, 90-day range |
| `marketing_search_performance` | `system:<key>:marketing:read` | Summarize Search Console clicks, impressions, CTR, average position, and top page paths | Aggregate only; top 25 pages, no search terms or visitor identifiers, 90-day range |

The `system` input accepts one of the five project keys. A health URL and optional bearer token are configured per system. Redirects are refused, and only HTTPS URLs are accepted.

Google reporting is opt-in per system. Configure `GOOGLE_ANALYTICS_PROPERTY_IDS` as comma-separated `system=numeric-property-id` pairs and `GOOGLE_SEARCH_CONSOLE_SITES` as `system=property` pairs. The GA4 Measurement ID beginning with `G-` is not the numeric Data API property ID. Google authentication uses a dedicated service account with viewer/read access only to the configured properties; the private key stays in protected host environment settings. API scopes are read-only, access tokens are short-lived and cached in memory until near expiry, Google redirects are refused, requests have fixed API endpoints, a 90-day date cap, bounded result counts and timeouts, and provider payloads/errors are not written to business audit logs.

The same three read-only tools are available in personal stdio mode for the owner's local Claude Code connection. In personal mode, possession of the local MCP configuration and Google service-account credentials is the access boundary; keep the local `.env` private and never add it to a project context or send it to the model. The remote business mode additionally requires the exact per-system `marketing:read` MCP scope.

Search query strings are deliberately excluded because arbitrary query text can contain sensitive information. Landing-page query strings are removed before results are returned. Search Console rows are limited to Google's top 25 page results; that row list is not a complete page inventory. No report tool returns names, contact details, message bodies, IP addresses, or user-agent strings.

Downstream health checks are capped per process (20 concurrent by default, configurable from 1 to 100). Five consecutive failures open that system's circuit for 30 seconds; after the delay a single health check may probe recovery. The tool reports only system key, reachability, and HTTP status.

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
