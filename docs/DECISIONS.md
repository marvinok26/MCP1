# Architecture decisions

## ADR 001: Two runtime modes, shared integration contracts

Personal development uses local stdio; business operations use remote Streamable HTTP. The business endpoint must not inherit local filesystem or arbitrary-command capabilities.

## ADR 002: TypeScript and the official MCP SDK

Use TypeScript for the platform service and the official TypeScript SDK for protocol handling. Laravel applications remain in PHP and retain their business rules. SDK transport details stay behind the server entry points.

## ADR 003: App APIs are authoritative

Business data adapters call application APIs rather than production databases. This preserves each system's validation, authorization, scoping, and audit behavior.

## ADR 004: Stateless business requests

Create a request-scoped server and stateless Streamable HTTP transport. This avoids local session state and supports a later move to multiple workers. Shared rate-limit and audit services are required before horizontal scaling.

## ADR 005: Health-only business integration as the first milestone

Business health checks prove remote authentication, scope enforcement, auditing, and deployment connectivity without exposing operational records. Record workflows wait for each app's supported API contract and permissions.

## ADR 006: Vitest for automated checks

Use Vitest with Node's built-in assertions for the automated suite. The supplied Node 22.22.0 runtime crashes in its built-in test runner because an internal `brace-expansion` module is missing; Vitest runs the tests successfully and also supports the actual HTTP/MCP integration checks.
