# MCP client and protocol compatibility

## Implemented protocol boundary

The lockfile resolves `@modelcontextprotocol/sdk` 1.32.1 from the declared v1 dependency line. Its Streamable HTTP and stdio protocol implementation supports the legacy protocol versions `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`. MCP1 currently negotiates through the legacy `initialize` handshake. The separate 2026-07-28 protocol era uses `server/discover` and is not supported by this SDK v1 line.

| Connection | MCP1 mode | Wire behavior | Authentication | Client status |
| --- | --- | --- | --- | --- |
| Local developer client | stdio | Legacy initialize handshake; protocol versions listed above | Local process access; tools are limited to configured project roots | Exercised with the MCP SDK client against harmless project README files; `.env` access was refused. Named desktop clients are not selected. |
| Remote business client | Streamable HTTP at `/mcp` | Legacy initialize handshake; stateless JSON responses | Bearer JWT validation; OAuth resource metadata is opt-in, and login/token issuance are not implemented | Local SDK integration exercised; actual products and OAuth flows remain unselected and unverified. |

MCP1's transport support does not imply every client supports the same features. Before deployment, record each named client's supported transport, protocol version, authentication flow, proxy behavior, and any required streaming/session headers. Keep an integration test for each client and hosting path.

## Upgrade and support policy

Do not infer support for the 2026-07-28 protocol from a client that supports legacy Streamable HTTP. The official TypeScript SDK v2 introduces the newer protocol era and a migration from the current v1 API. The SDK maintainers state that v1 receives security fixes and bug fixes for at least six months after the v2 release on 2026-07-27; schedule a v2 migration review before that maintenance window closes, and test it against selected clients before changing the production protocol.

This matrix describes the locked SDK and current MCP1 implementation, not a guarantee about future client releases. Update it when the lockfile, protocol implementation, or supported clients change.

## References

- [Official TypeScript SDK protocol version guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
- [Official TypeScript SDK roadmap and v1 maintenance window](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/ROADMAP.md)
- [MCP specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
