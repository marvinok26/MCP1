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

## ADR 007: App-owned APIs with audience-specific delegated actor tokens

Each business application owns its MCP-facing API and remains responsible for authorizing the verified user against its existing permissions and record scopes. MCP1 should use a short-lived token with the application's audience, preserving the user as subject and MCP1 as actor; use OAuth Token Exchange (RFC 8693) when supported by the eventual identity provider. The app resolves the verified issuer/subject through an explicit identity link and audits the local actor. If provider exchange cannot preserve a constrained actor identity, record tools remain disabled until an alternative is reviewed. This matches the apps' different authentication stacks without allowing caller-supplied user headers or shared administrator credentials.
