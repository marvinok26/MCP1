# MCP client setup

This guide covers the three approved client families for MCP1: VS Code with GitHub Copilot, Claude (Claude Code/Desktop/web), and ChatGPT. One MCP1 service can serve multiple clients. Keep local developer access and remote business access separate.

## Current readiness

| Client | Personal/local connection | Business/remote connection | Current status |
| --- | --- | --- | --- |
| VS Code / GitHub Copilot | stdio | Streamable HTTP with OAuth or configured bearer authentication | Local profile can be configured now. Remote sign-in awaits a provider and client validation. |
| Claude Code / Claude Desktop / Claude web | stdio for Code/Desktop; remote connector for web | Streamable HTTP with OAuth | Local Code/Desktop can be configured now. Remote sign-in awaits a provider and client validation. |
| ChatGPT | Not directly; ChatGPT connects to remote MCP services | Remote MCP app; OAuth or another supported configured method | Requires an eligible ChatGPT plan/workspace and a completed MCP1 remote authentication flow. |

The deployed MCP1 staging endpoint is `https://mcp-staging.ulternetsystems.com/mcp`. It currently rejects unauthenticated MCP requests. It does not issue login tokens or host an authorization server. Do not configure a tokenless connection or copy a long-lived token into client configuration. Auth0 remains a provisional provider candidate, not a selected dependency.

## Local developer access

Local mode runs on the developer's computer over stdio and is suitable for VS Code and Claude Code/Desktop. It exposes only the bounded project tools and documentation resources. It has no network listener and no generic shell tool.

Build MCP1 once from its repository:

```sh
cd /home/seint/Dev/Self/MCPs
npm ci --include=dev
npm run build
```

### VS Code / GitHub Copilot

Open the command palette (`Ctrl+Shift+P`), select **MCP: Open User Configuration**, and add a server entry under `servers` (merge it into the existing JSON):

```json
{
  "servers": {
    "ulterNetPersonal": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/seint/Dev/Self/MCPs/dist/personal.js"]
    }
  }
}
```

Then run **MCP: List Servers**, start/restart `ulterNetPersonal`, and confirm its tools appear in the chat tools picker. Test `project_list` and `project_documentation`; verify that reading `.env` is refused. VS Code can also use a remote HTTP endpoint, but MCP1's remote OAuth flow is not ready yet.

### Claude Code

After building, register MCP1 in the user scope so it is available from each project directory:

```sh
claude mcp add --scope user --transport stdio ulternet-personal -- node /home/seint/Dev/Self/MCPs/dist/personal.js
```

Run `claude mcp list`, open Claude Code in one of the configured project directories, and use `/mcp` to verify the connection and available tools. Test project listing, documentation reading, and refusal to read `.env`.

### Claude Desktop

Build MCP1 as above. In Claude Desktop, open **Settings → Extensions** and use the local MCP/server configuration supported by the installed release. If that release requires a raw server configuration, add the equivalent stdio command and absolute script path shown below to its MCP server settings:

```json
{
  "mcpServers": {
    "ulterNetPersonal": {
      "command": "node",
      "args": ["/home/seint/Dev/Self/MCPs/dist/personal.js"]
    }
  }
}
```

Restart Claude Desktop and verify the listed tools. Anthropic's current Desktop releases also offer managed local extensions; packaging MCP1 as a Desktop Extension is a separate distribution task and is not required for a personal stdio connection.

Local configuration grants the client the same file access the MCP1 process has, constrained by MCP1's configured roots and path checks. Keep the client account and local machine access controlled.

## Remote business access

The remote URL is the same for each client: `https://mcp-staging.ulternetsystems.com/mcp`. Remote use must be per-user and authenticated. The selected identity provider must issue a short-lived access token specifically for MCP1, and MCP1 must validate issuer, audience, signature, expiry, and scopes. Each product API must still enforce its own permissions and data boundaries.

Do not use a shared bearer token as workforce sign-in. Before enabling remote access, complete these steps:

1. Select the first remote client(s) and confirm the required plan/workspace controls.
2. Select an identity provider (Auth0 is only provisional) and provision a separate development tenant/application.
3. Implement and configure MCP's OAuth protected-resource discovery and authorization flow for that provider/client combination; ensure refresh/revocation behavior is documented and tested.
4. Set `BUSINESS_ISSUER_URL`, `BUSINESS_AUDIENCE`, `BUSINESS_JWKS_URL`, and canonical `BUSINESS_RESOURCE_URL`; enable `BUSINESS_OAUTH_DISCOVERY_ENABLED=true` only after these values are verified.
5. Test tool discovery, denied and allowed scopes, token expiry/refresh, user deactivation, and key rotation using synthetic data.
6. Keep the exposed business tool set limited to reviewed tools. Do not publish to a workspace until its admins approve the exact tool list.

### VS Code / GitHub Copilot remote

Configure an HTTP MCP server using `https://mcp-staging.ulternetsystems.com/mcp`. Once MCP1's OAuth authorization flow and the chosen provider registration have been validated, configure the provider's public client ID using VS Code's `oauth.clientId` field. VS Code can launch a browser for sign-in. It supports DCR or registered-client flows depending on the provider and server implementation; validate this before rollout.

### Claude remote

In Claude or Claude Desktop, go to **Settings → Connectors → Add custom connector**, enter the MCP endpoint, then complete its OAuth prompt after the provider is configured. For Claude Team/Enterprise, an organization owner configures the connector and staff connect with their own accounts. Confirm refresh-token and revocation behavior; never share one staff member's token.

### ChatGPT remote

An authorized workspace admin creates a custom MCP app in the ChatGPT workspace, enters the MCP endpoint, selects the configured authentication mechanism, scans tools, and tests it as a draft before publishing. OAuth must support refresh tokens for stable connectivity. Check current plan availability: full MCP tool support is available on eligible Business/Enterprise/Edu workspaces, while personal plans may have narrower read/fetch capability. Published tool definitions may need an admin refresh after MCP1 changes.

## Acceptance checklist per client

- [ ] Local stdio handshake completes for VS Code/Copilot.
- [ ] Local stdio handshake completes for Claude Code.
- [ ] Local stdio handshake completes for Claude Desktop or the chosen Desktop distribution path.
- [ ] Remote client authenticates through the selected provider; no static/shared staff bearer token is used.
- [ ] Client can initialize through cPanel and list only the reviewed tools.
- [ ] Required Streamable HTTP headers and response behavior work through Passenger.
- [ ] Per-user identity and scopes are enforced; negative-scope and expired-token calls fail.
- [ ] Revocation, refresh, and key rotation are tested.
- [ ] Tool updates are reviewed in each client before business rollout.

Client UI, plan availability, and authentication features change. Recheck the linked vendor documentation when performing an actual rollout.

## Vendor references

- [VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
- [VS Code MCP authorization support](https://code.visualstudio.com/api/extension-guides/ai/mcp)
- [Anthropic remote MCP connectors](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers)
- [Anthropic Claude Code MCP setup](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [OpenAI ChatGPT MCP apps and developer mode](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
