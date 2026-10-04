# Grandpa's AI — MCP Server

**Connect your AI agent to 230+ curated research articles on age reversal,
robotics, AI, and space colonization — in under a minute.**

One URL. Any MCP client.

```
https://grandpasai.com/mcp
```

- **Zero auth** — public, read-only.
- **Streamable HTTP** for remote clients; **stdio** for local.
- **5 tools** — search, retrieve, explore.

---

## What is this?

Grandpa's AI is a research station covering longevity science, humanoid
robotics, artificial intelligence, and space colonization. This MCP server
lets AI agents (Claude, ChatGPT, Cursor, Codex, Gemini, OpenClaw, and any
other MCP client) search and read that corpus directly — with citations,
categories, and a full topic tree.

Website: [grandpasai.com](https://grandpasai.com) · Source: [github.com/wescorp/grandpasai-mcp](https://github.com/wescorp/grandpasai-mcp) · License: MIT

---

## Available tools

| Tool | What it does |
|------|--------------|
| `search_research` | Full-text search across the corpus, ranked by relevance |
| `get_article` | Retrieve a full article by path (markdown or summary) |
| `list_categories` | All categories & subcategories with article counts |
| `get_latest_research` | Most recently updated articles (optionally by category) |
| `get_topic_tree` | Full hierarchical topic tree with page URLs |

Categories: `age-reversal`, `artificial-intelligence`, `humanoid-robotics`,
`space-colonization`, `custom`.

---

## Connect your agent

### ChatGPT / Codex (remote)

Add this MCP server in ChatGPT or the Codex CLI/SDK:

```
https://grandpasai.com/mcp
```

(Remote HTTP — no install, no API key.)

### Claude (Claude Desktop / Claude Code)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "grandpasai": {
      "url": "https://grandpasai.com/mcp"
    }
  }
}
```

Or run locally via stdio:

```json
{
  "mcpServers": {
    "grandpasai": {
      "command": "npx",
      "args": ["-y", "grandpasai-mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "grandpasai": {
      "url": "https://grandpasai.com/mcp"
    }
  }
}
```

### OpenClaw

In your OpenClaw MCP config, register the remote endpoint:

```json
{
  "mcpServers": {
    "grandpasai": {
      "url": "https://grandpasai.com/mcp"
    }
  }
}
```

### VS Code / GitHub Copilot

Add to `.vscode/mcp.json` (or the Copilot MCP settings):

```json
{
  "servers": {
    "grandpasai": {
      "type": "http",
      "url": "https://grandpasai.com/mcp"
    }
  }
}
```

### Gemini (Gemini CLI / AI Studio)

Remote URL (Streamable HTTP):

```
https://grandpasai.com/mcp
```

### Other MCP client

Any client that speaks the Model Context Protocol over **Streamable HTTP**:

- Endpoint URL: `https://grandpasai.com/mcp`
- Transport: Streamable HTTP
- Protocol versions: `2025-11-25`, `2025-06-18`, `2025-03-26`

Any client that speaks **stdio**:

```bash
npm install -g grandpasai-mcp
grandpasai-mcp
```

---

## Authentication

**None required.** The server is public and read-only. See
[auth.md](./auth.md) for full details.

## Test connection

```bash
curl -X POST https://grandpasai.com/mcp/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

A successful response includes `"serverInfo": { "name": "grandpasai", ... }`.

---

## For agents / machines

- **Server Card:** `GET https://grandpasai.com/mcp/server-card`
  (`Accept: application/mcp-server-card+json`) — canonical file:
  [`server-card.json`](./server-card.json)
- **Smithery static card:** [`server-card.smithery.json`](./server-card.smithery.json)
- **Auth / discovery doc:** [`auth.md`](./auth.md)

---

## Quick reference

| Item | Value |
|------|-------|
| Brand | Grandpa's AI |
| Domain | grandpasai.com |
| MCP name | `grandpasai` (registry: `io.github.wescorp/grandpasai`) |
| Package | `grandpasai-mcp` v1.0.0 |
| Transport | Streamable HTTP + stdio |
| Remote URL | `https://grandpasai.com/mcp` |
| Auth | None |
| License | MIT |
| Source | github.com/wescorp/grandpasai-mcp |
