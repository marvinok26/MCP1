# MCP client and protocol compatibility

## Implemented protocol boundary

The lockfile resolves `@modelcontextprotocol/sdk` 1.32.1 from the declared v1 dependency line. Its Streamable HTTP and stdio protocol implementation supports the legacy protocol versions `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`, and `2024-10-07`. MCP1 currently negotiates through the legacy `initialize` handshake. The separate 2026-07-28 protocol era uses `server/discover` and is not supported by this SDK v1 line.

| Connection | MCP1 mode | Wire behavior | Authentication | Client status |
| --- | --- | --- | --- | --- |
| VS Code / GitHub Copilot | stdio locally; Streamable HTTP remotely | Legacy initialize handshake; protocol versions listed above | Local process access; remote bearer JWT verification; OAuth login/token issuance not implemented | User-level VS Code MCP config was registered on the owner workstation. No GitHub Copilot extension was detected, so client interoperability is not yet validated. Remote use awaits provider/OAuth setup. |
| Claude Code | stdio locally; Streamable HTTP remotely | Legacy initialize handshake; protocol versions listed above | Local process access; remote OAuth supported by client but not yet implemented/configured in MCP1 | User-level stdio server was registered and `claude mcp get ulternet-personal` reported Connected on 2026-10-08. Remote provider/OAuth validation is pending. |
| Claude Desktop / Claude web | local stdio for Desktop where configured; remote Streamable HTTP connector | Legacy initialize handshake; protocol versions listed above | Local process access or remote OAuth; MCP1 remote OAuth not yet implemented/configured | Client tests are pending. Desktop Extension packaging is not included. |
| ChatGPT | Remote Streamable HTTP only | Legacy initialize handshake; protocol versions listed above | Configured app authentication; MCP1 remote OAuth not yet implemented/configured | Requires an eligible plan/workspace and client test. Current staging intentionally rejects unauthenticated MCP requests. |

MCP1's transport support does not imply every client supports the same features. Client setup steps and rollout gates are in [CLIENT_SETUP.md](CLIENT_SETUP.md). Before deployment, record each named client's supported transport, protocol version, authentication flow, resource support, proxy behavior, and any required streaming/session headers. Keep an integration test for each client and hosting path.

## Upgrade and support policy

Do not infer support for the 2026-07-28 protocol from a client that supports legacy Streamable HTTP. The official TypeScript SDK v2 introduces the newer protocol era and a migration from the current v1 API. The SDK maintainers state that v1 receives security fixes and bug fixes for at least six months after the v2 release on 2026-07-27; schedule a v2 migration review before that maintenance window closes, and test it against selected clients before changing the production protocol.

This matrix describes the locked SDK and current MCP1 implementation, not a guarantee about future client releases. Update it when the lockfile, protocol implementation, or supported clients change.

## References

- [Official TypeScript SDK protocol version guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)
- [Official TypeScript SDK roadmap and v1 maintenance window](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/ROADMAP.md)
- [MCP specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
