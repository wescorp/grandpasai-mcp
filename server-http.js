#!/usr/bin/env node

/**
 * Grandpa's AI — MCP Server (HTTP transport)
 *
 * Exposes the MCP server over HTTP so any MCP client can connect remotely.
 * Proxied through Caddy at https://grandpasai.com/mcp
 *
 * Usage: node server-http.js
 * Config for remote clients:
 *   { "mcpServers": { "grandpasai": { "url": "https://grandpasai.com/mcp" } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, "..");
const PORT = parseInt(process.env.MCP_PORT || "8895", 10);
const HOST = process.env.MCP_HOST || "127.0.0.1";

// ── Research source directories ──────────────────────────────────────
const RESEARCH_ROOTS = [
  join(WORKSPACE, "research", "age-reversal"),
  join(WORKSPACE, "research", "artificial-intelligence"),
  join(WORKSPACE, "research", "humanoid-robotics"),
  join(WORKSPACE, "grandpasai", "research", "space-colonization"),
  join(WORKSPACE, "grandpasai", "research", "custom"),
];

const TOPICS_PATH = join(WORKSPACE, "grandpasai", "data", "topics.json");

// ── Helpers (same as server.js) ──────────────────────────────────────

async function findMarkdownFiles(dir) {
  const results = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "archive" || entry.name === ".trash") continue;
        results.push(...(await findMarkdownFiles(full)));
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        results.push(full);
      }
    }
  } catch { /* dir missing */ }
  return results;
}

function extractMeta(content, filePath) {
  const lines = content.split("\n");
  const meta = { path: filePath, title: "", updated: "", category: "", summary: "" };
  for (const line of lines) {
    if (line.startsWith("# ")) { meta.title = line.slice(2).trim(); break; }
  }
  const head = lines.slice(0, 15).join("\n");
  let updatedMatch = head.match(/\*Last updated:\s*(.+?)\*/i);
  if (!updatedMatch) updatedMatch = head.match(/\*\*Last updated:\*\*\s*(.+)/i);
  if (!updatedMatch) updatedMatch = head.match(/\| Last updated:\s*(.+)/i);
  if (updatedMatch) meta.updated = updatedMatch[1].trim();
  let catMatch = head.match(/\*Category:\s*(.+?)\*/i);
  if (!catMatch) catMatch = head.match(/\| Category:\s*(.+)/i);
  if (catMatch) meta.category = catMatch[1].trim().replace(/\*+$/, "").trim();
  let inMeta = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inMeta) {
      if (line.startsWith("## ") || line.startsWith("---")) { inMeta = false; continue; }
      if (line.startsWith("#") || line.startsWith("*") || line.startsWith(">") || line.startsWith("|") || line === "") continue;
      inMeta = false;
    }
    if (!inMeta && line.length > 20) { meta.summary = line.slice(0, 300); break; }
  }
  return meta;
}

let _articleCache = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000;

async function loadAllArticles(force = false) {
  if (_articleCache && (Date.now() - _cacheTime) < CACHE_TTL && !force) return _articleCache;
  const articles = [];
  for (const root of RESEARCH_ROOTS) {
    const files = await findMarkdownFiles(root);
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        articles.push({ ...extractMeta(content, file), content });
      } catch { /* skip */ }
    }
  }
  articles.sort((a, b) => {
    const da = Date.parse(a.updated), db = Date.parse(b.updated);
    if (!isNaN(da) && !isNaN(db)) return db - da;
    if (!isNaN(da)) return -1;
    if (!isNaN(db)) return 1;
    return 0;
  });
  _articleCache = articles;
  _cacheTime = Date.now();
  return articles;
}

function searchArticles(articles, query, category) {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 0);
  const scored = articles.map(a => {
    if (category && !a.path.toLowerCase().includes(category.toLowerCase())) return null;
    const title = a.title.toLowerCase(), content = a.content.toLowerCase(), summary = a.summary.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      score += (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length * 2;
      if (summary.includes(term)) score += 3;
    }
    if (score > 0) return { ...a, score };
    return null;
  }).filter(Boolean);
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function readablePath(filePath) {
  return relative(WORKSPACE, filePath).replace(/^research\//, "").replace(/^grandpasai\/research\//, "");
}

// ── Build MCP Server ─────────────────────────────────────────────────

function createMcpServer() {
const mcpServer = new McpServer({
  name: "grandpasai",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
  instructions: "Grandpa's AI Research Station — access curated research on age reversal, robotics, AI, space colonization, and more. Public MCP endpoint.",
});

mcpServer.registerTool("search_research", {
  title: "Search Research",
  description: "Full-text search across Grandpa's AI research corpus. Returns ranked results with titles, summaries, and article paths.",
  inputSchema: {
    query: z.string().describe("Search query — words or phrases to find in the research"),
    category: z.string().optional().describe("Optional filter: 'age-reversal', 'artificial-intelligence', 'humanoid-robotics', 'space-colonization', or 'custom'"),
    maxResults: z.number().optional().default(10).describe("Maximum number of results (default 10, max 25)"),
  },
}, async ({ query, category, maxResults }) => {
  const articles = await loadAllArticles();
  const results = searchArticles(articles, query, category || null);
  const limit = Math.min(maxResults || 10, 25);
  const top = results.slice(0, limit);
  if (top.length === 0) {
    return { content: [{ type: "text", text: `No results found for "${query}"${category ? ` in ${category}` : ""}.` }] };
  }
  const lines = [`Found ${results.length} result(s) for "${query}"${category ? ` in ${category}` : ""}. Top ${top.length}:\n`];
  for (const a of top) {
    lines.push(`### ${a.title}`);
    lines.push(`- **Path:** \`${readablePath(a.path)}\``);
    lines.push(`- **Category:** ${a.category || "Uncategorized"}`);
    if (a.updated) lines.push(`- **Updated:** ${a.updated}`);
    if (a.summary) lines.push(`- **Summary:** ${a.summary.slice(0, 200)}`);
    lines.push(`- **Relevance:** ${a.score}\n`);
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

mcpServer.registerTool("get_article", {
  title: "Get Article",
  description: "Retrieve a full research article by its path. Use paths from search results.",
  inputSchema: {
    path: z.string().describe("Article path, e.g. 'age-reversal/categories/01-epigenetic-reprogramming.md'"),
    format: z.enum(["markdown", "summary"]).optional().default("markdown").describe("'markdown' for full article, 'summary' for metadata + first paragraph"),
  },
}, async ({ path: articlePath, format }) => {
  const clean = articlePath.replace(/^research\//, "").replace(/^\.\.?\//, "");
  const candidates = [
    join(WORKSPACE, "research", clean),
    join(WORKSPACE, "grandpasai", "research", clean),
    join(WORKSPACE, "grandpasai", "research", "custom", clean),
  ];
  let content = null, foundPath = null;
  for (const c of candidates) {
    try { content = await readFile(c, "utf-8"); foundPath = c; break; } catch { /* try next */ }
  }
  if (!content) {
    return { content: [{ type: "text", text: `Article not found: "${articlePath}". Use search_research to find available articles.` }] };
  }
  const meta = extractMeta(content, foundPath);
  if (format === "summary") {
    return { content: [{ type: "text", text: [
      `# ${meta.title}`,
      `**Category:** ${meta.category || "N/A"}`,
      `**Updated:** ${meta.updated || "N/A"}`,
      `**Path:** \`${readablePath(foundPath)}\``,
      "", meta.summary,
    ].join("\n") }] };
  }
  const maxLen = 50_000;
  const truncated = content.length > maxLen
    ? content.slice(0, maxLen) + `\n\n... [truncated at ${maxLen} chars, full article is ${content.length} chars]`
    : content;
  return { content: [{ type: "text", text: truncated }] };
});

mcpServer.registerTool("list_categories", {
  title: "List Categories",
  description: "List all research categories and subcategories with article counts.",
  inputSchema: {},
}, async () => {
  const articles = await loadAllArticles();
  const groups = {};
  for (const a of articles) {
    const parts = readablePath(a.path).split("/");
    const top = parts[0] || "uncategorized";
    if (!groups[top]) groups[top] = { count: 0, subcategories: {} };
    groups[top].count++;
    if (parts[1] && parts[1] !== parts[parts.length - 1]) {
      if (!groups[top].subcategories[parts[1]]) groups[top].subcategories[parts[1]] = 0;
      groups[top].subcategories[parts[1]]++;
    }
  }
  const lines = [`### Grandpa's AI Research Categories\n`];
  for (const [cat, info] of Object.entries(groups).sort()) {
    lines.push(`- **${cat}** (${info.count} articles)`);
    for (const [sub, count] of Object.entries(info.subcategories).sort()) {
      lines.push(`  - ${sub} (${count})`);
    }
  }
  lines.push(`\n**Total:** ${articles.length} articles`);
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

mcpServer.registerTool("get_latest_research", {
  title: "Get Latest Research",
  description: "Get the most recently updated research articles.",
  inputSchema: {
    count: z.number().optional().default(5).describe("Number of articles (default 5, max 20)"),
    category: z.string().optional().describe("Optional filter by top-level category"),
  },
}, async ({ count, category }) => {
  let articles = await loadAllArticles();
  if (category) articles = articles.filter(a => a.path.includes(`/${category}/`) || a.path.includes(`/${category}.`));
  const latest = articles.slice(0, Math.min(count || 5, 20));
  const lines = [`### Latest Research${category ? ` — ${category}` : ""}\n`];
  for (const a of latest) {
    lines.push(`- **${a.title}**`);
    lines.push(`  Path: \`${readablePath(a.path)}\``);
    lines.push(`  Updated: ${a.updated || "Unknown"}`);
    lines.push(`  Category: ${a.category || "Uncategorized"}`);
    if (a.summary) lines.push(`  Summary: ${a.summary.slice(0, 160)}`);
    lines.push("");
  }
  return { content: [{ type: "text", text: lines.join("\n") }] };
});

mcpServer.registerTool("get_topic_tree", {
  title: "Get Topic Tree",
  description: "Get the full hierarchical topic tree from grandpasai.com with page URLs.",
  inputSchema: {},
}, async () => {
  try {
    const raw = await readFile(TOPICS_PATH, "utf-8");
    const topics = JSON.parse(raw);
    const tree = topics.tree || [];
    const formatNode = (node, depth = 0) => {
      const indent = "  ".repeat(depth);
      const line = `${indent}- ${node.emoji || ""} **${node.name}**${node.page ? ` → [${node.page}](https://grandpasai.com/${node.page})` : ""}`;
      const children = (node.children || []).map(c => formatNode(c, depth + 1)).join("\n");
      return depth === 0 ? `${line}\n${children}` : `${line}\n${children}`;
    };
    return { content: [{ type: "text", text: `### Grandpa's AI Topic Tree\n_Updated: ${topics.updated || "unknown"}_\n\n${tree.map(n => formatNode(n)).join("\n")}` }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Could not load topic tree: ${err.message}` }] };
  }
});

  return mcpServer;
}

// ── HTTP Server ──────────────────────────────────────────────────────

async function main() {
  // Per-session transports: sessionId -> StreamableHTTPServerTransport.
  // A single McpServer can only connect to one transport, and reusing one
  // stateful transport across clients caused "Server already initialized"
  // on any second initialize. So each session gets a fresh server+transport pair.
  const sessions = new Map();
  const lastActivity = new Map();
  const idleTimeoutMs = 30 * 60 * 1000; // drop sessions idle > 30 min

  const httpServer = createServer(async (req, res) => {
    // CORS headers for browser-based MCP clients
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Collect body for POST requests
    let parsedBody = undefined;
    if (req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      try { parsedBody = JSON.parse(raw); } catch { /* not JSON */ }
    }

    const sessionId = req.headers["mcp-session-id"];
    let transport;
    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId);
      lastActivity.set(sessionId, Date.now());
    } else {
      // New session: fresh McpServer + transport pair.
      const server = createMcpServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        onsessioninitialized: (sid) => {
          sessions.set(sid, transport);
          lastActivity.set(sid, Date.now());
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
        if (transport.sessionId) lastActivity.delete(transport.sessionId);
      };
      await server.connect(transport);
    }

    try {
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      console.error("Request error:", err.message);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`Grandpa's AI MCP HTTP server listening on http://${HOST}:${PORT}`);
    console.error(`Proxy via: https://grandpasai.com/mcp`);
  });

  // Sweep idle sessions so a public endpoint doesn't grow unboundedly.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [sid, ts] of lastActivity) {
      if (now - ts > idleTimeoutMs) {
        const t = sessions.get(sid);
        if (t) t.close().catch(() => {});
        sessions.delete(sid);
        lastActivity.delete(sid);
      }
    }
  }, 5 * 60 * 1000);
  sweep.unref?.();

  // Graceful shutdown
  const shutdown = async () => {
    console.error("Shutting down...");
    clearInterval(sweep);
    await Promise.allSettled([...sessions.values()].map((t) => t.close()));
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
