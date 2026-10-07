# MCP1

MCP1 is a modular Model Context Protocol platform for local development work and authenticated business operations across UlterNet Systems applications.

## Operating modes

- **Personal:** a local stdio server for project discovery, code/document search, safe file reading, and Git review.
- **Business:** a remote Streamable HTTP server with OIDC/JWT bearer-token validation, per-tool scopes, redacted audit events, rate limits, and configured system health checks. OAuth sign-in and discovery are not implemented yet.

The modes share project metadata and integration contracts. They do not share credentials or execution privileges. Business tools call application-owned APIs; they do not connect directly to production databases.

## Projects in scope

| Key | Project | Local development path | Business integration status |
| --- | --- | --- | --- |
| `ulterpos` | UlterPOS | `/home/seint/Dev/Work/pos/ulterpos` | Health endpoint configurable; operational tools require an app API contract |
| `tranquil` | Tranquil Pharmacy | `/home/seint/Dev/Work/tranquil` | Health endpoint configurable; pharmacy tools require an app API contract |
| `devspark` | Devspark website | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Company/UlterNet/website/devspark` | Health endpoint configurable; CMS tools require an app API contract |
| `social-apps` | Social apps | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Social/social-apps` | Health endpoint configurable; product workflows are not yet defined |
| `renegade` | Renegade Tickets & Events | `/home/seint/Dev/Self/Apps/UlterNet-Systems/Tickets&Events/renegade/website/renegade` | Health endpoint configurable; ticketing tools require an app API contract |

Paths can be overridden in local configuration. MCP1 never reads `.env` files and ignores secret/build/vendor paths.

## Quick start

Requirements: Node.js 22 or newer and npm.

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
- [Adding an integration](docs/ADDING_INTEGRATIONS.md)
- [Application integration readiness](docs/INTEGRATION_READINESS.md)
- [Business role-to-scope mapping](docs/ROLE_SCOPE_MAPPING.md)
- [Decision record](docs/DECISIONS.md)

## Current limits

Business mode currently lists configured systems and checks their configured health endpoints. It does not yet read or change business records. Each record workflow must be implemented against the owning application's API and permission model before it is enabled.
