# Grandpa's AI MCP — Authentication & Machine Discovery

This document describes how clients and machines authenticate to, and discover,
the Grandpa's AI MCP server.

## TL;DR

- **No authentication is required.** The server is public and read-only.
- Remote clients connect to: `https://grandpasai.com/mcp`
- Local clients run: `node server.js` (stdio)
- Machine discovery is provided by the MCP **Server Card** and an **AI Catalog**.

---

## 1. Authentication

| Aspect | Value |
|--------|-------|
| Auth required | **No** |
| Scheme | None (public, read-only) |
| API keys / tokens | Not used |
| OAuth | Not used |
| Rate limiting | None (reverse proxy / Caddy layer optional) |

The server exposes a read-only research corpus. It never writes, never
mutates state, and never reads private data, so there are no secrets to
protect at the protocol layer. The HTTP transport returns
`Access-Control-Allow-Origin: *` and does not validate `Authorization`.

If authenticated features (e.g., private custom research, per-user rate
limits, usage analytics) are added later, this document should be updated to
specify the OAuth 2.1 flow per the
[MCP Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization).
For now, registries and scanners should treat this server as **"no auth"**.

## 2. Connection

### Remote (Streamable HTTP)

```
https://grandpasai.com/mcp
```

- Transport: **Streamable HTTP** (stateful-capable; clients should follow the
  standard MCP initialize handshake).
- The path `/mcp` 307-redirects to `/mcp/`.
- Proxied by Caddy to the Node service on `127.0.0.1:8895`
  (see `grandpasai-mcp.service`).

### Local (stdio)

```json
{
  "mcpServers": {
    "grandpasai": {
      "command": "node",
      "args": ["/path/to/grandpasai-mcp/server.js"]
    }
  }
}
```

## 3. Machine Discovery

Machines (agents, crawlers, registries) discover this server through:

### 3.1 MCP Server Card (recommended)

Per the experimental MCP Server Card extension
([modelcontextprotocol/ext-server-card](https://github.com/modelcontextprotocol/ext-server-card)),
the card is hosted at the reserved location:

```
GET https://grandpasai.com/mcp/server-card
Accept: application/mcp-server-card+json
```

The canonical card document is committed in this bundle as `server-card.json`.
It declares the reverse-DNS name `io.github.wescorp/grandpasai`, the
Streamable HTTP remote URL, supported protocol versions, and repository
metadata.

> **Note on `.well-known`:** The older convention
> `/.well-known/mcp/server-card.json` is used by **Smithery** for manual
> metadata when live scanning fails. A Smithery-shaped static card is provided
> as `server-card.smithery.json`. The current MCP Server Card spec instead
> reserves `GET <streamable-http-url>/server-card` and uses
> `/.well-known/ai-catalog.json` for domain-level discovery.

### 3.2 AI Catalog

For automated domain-level discovery, serve:

```
GET https://grandpasai.com/.well-known/ai-catalog.json
Accept: application/ai-catalog+json
```

with an entry of type `application/mcp-server-card+json` pointing at the
Server Card URL (or inlining the card as `data`).

## 4. Protocol versions

The server is built on `@modelcontextprotocol/sdk` v1.30.0 and supports:

- `2025-11-25` (latest)
- `2025-06-18`
- `2025-03-26`
- `2024-11-05`
- `2024-10-07`

## 5. Ownership / verification

- GitHub account: **wescorp**
- Registry namespace (GitHub-authenticated): `io.github.wescorp/grandpasai`
- Repository: `https://github.com/wescorp/grandpasai-mcp` (to be created —
  code currently lives in `grandpasai-mcp/` of the `wescorp/openclaw-workspace`
  monorepo).
