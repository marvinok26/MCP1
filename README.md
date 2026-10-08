# MCP1

MCP1 is a modular Model Context Protocol platform for local development work and authenticated business operations across UlterNet Systems applications.

## Operating modes

- **Personal:** a local stdio server for project discovery, code/document search, bounded documentation resources, safe file reading, Git review, and optional aggregate GA4/Search Console reporting.
- **Business:** a remote Streamable HTTP server with OIDC/JWT bearer-token validation, per-tool scopes, redacted audit events, process limits, readiness, graceful shutdown, configured system health checks, and optional aggregate GA4/Search Console reporting. Protected-resource OAuth metadata is opt-in; sign-in and token issuance are not implemented.

The modes share project metadata and integration contracts. They do not share credentials or execution privileges. Business tools call application-owned APIs; they do not connect directly to production databases.

## Projects in scope

| Key | Project | Local development path | Business integration status |
| --- | --- | --- | --- |
| `ulterpos` | UlterPOS | `/home/seint/Dev/Work/pos/ulterpos` | Health endpoint configurable; operational tools require an app API contract |
| `tranquil` | Tranquil Pharmacy | `/home/seint/Dev/Work/tranquil` | Health endpoint configurable; pharmacy tools require an app API contract |
| `ulternet` | UlterNet website | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Company/UlterNet/website/devspark` | Health endpoint configurable; aggregate GA4/Search Console reports are opt-in; CMS tools require an app API contract |
| `social-apps` | Social apps | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Social/social-apps` | Health endpoint configurable; aggregate GA4/Search Console reports are opt-in; product workflows are not yet defined |
| `renegade` | Renegade Tickets & Events | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Tickets&Events/renegade/website/renegade` | Health endpoint configurable; ticketing tools require an app API contract |

Project paths can be overridden in MCP1's own local `.env`. Personal project tools never read `.env` files inside the configured projects and continue to ignore secret/build/vendor paths. Google reporting credentials, when configured, are only read by the dedicated reporting client.

All listed products belong to UlterNet Systems. They can share a workforce identity provider while each product continues to enforce its own permissions, tenant boundaries, and audit rules.

## Quick start

Requirements: Node.js 24.21.0 and its bundled npm 11.19.0 for local development. Node.js 22.23.3/npm 10.9.9 is the compatibility lane. See [supported runtimes](docs/DEPLOYMENT.md).

```sh
npm install
cp .env.example .env
npm run dev:personal
```

Configure the personal MCP client to launch `npm run start:personal` from this repository. The server communicates over stdio; stdout is reserved for MCP protocol messages.

For business mode, configure an OIDC issuer and audience, then run:

```sh
npm run start:business
```

The remote endpoint is `/mcp`. See [deployment](docs/DEPLOYMENT.md) and [security](docs/SECURITY.md) before exposing it to a business network. Health checks are registered only for systems with explicit HTTPS URLs in the environment.

## Commands

```sh
npm run build
npm test
npm run start:personal
npm run start:business
```

## Documentation

- [Product and delivery plan](docs/PLAN.md)
- [Comprehensive implementation to-do](docs/MCP_TODO.md)
- [Tool catalogue](docs/TOOLS.md)
- [Security model](docs/SECURITY.md)
- [Business identity and client authentication](docs/IDENTITY.md)
- [Deployment and operations](docs/DEPLOYMENT.md)
- [MCP client and protocol compatibility](docs/MCP_CLIENT_MATRIX.md)
- [Setup for VS Code, Claude, and ChatGPT clients](docs/CLIENT_SETUP.md)
- [Data governance](docs/DATA_GOVERNANCE.md)
- [Operations runbook](docs/OPERATIONS_RUNBOOK.md)
- [New application onboarding](docs/NEW_APP_ONBOARDING.md)
- [Adding an integration](docs/ADDING_INTEGRATIONS.md)
- [Application integration readiness](docs/INTEGRATION_READINESS.md)
- [Business role-to-scope mapping](docs/ROLE_SCOPE_MAPPING.md)
- [Business authorization review](docs/AUTHORIZATION_REVIEW.md)
- [Write and external-action approval policy](docs/WRITE_APPROVALS.md)
- [Decision record](docs/DECISIONS.md)

## Current limits

Business mode does not read or change application business records. If Google reporting is configured, its marketing tools read only aggregate Analytics and Search Console reports for allowlisted properties. Each future application-record workflow must be implemented against the owning application's API and permission model before it is enabled.
