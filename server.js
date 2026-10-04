#!/usr/bin/env node

/**
 * Grandpa's AI — MCP Server
 *
 * Exposes the grandpasai.com research corpus to AI agents via Model Context Protocol.
 * Tools: search, get article, list categories, get latest, topic tree.
 *
 * Usage: node server.js
 * Config for Claude Desktop / Cursor / etc:
 *   { "mcpServers": { "grandpasai": { "command": "node", "args": ["/path/to/server.js"] } } }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, "..");

// ── Research source directories ──────────────────────────────────────
const RESEARCH_ROOTS = [
  join(WORKSPACE, "research", "age-reversal"),
  join(WORKSPACE, "research", "artificial-intelligence"),
  join(WORKSPACE, "research", "humanoid-robotics"),
  join(WORKSPACE, "grandpasai", "research", "space-colonization"),
  join(WORKSPACE, "grandpasai", "research", "custom"),
];

const TOPICS_PATH = join(WORKSPACE, "grandpasai", "data", "topics.json");

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Recursively find all .md files under a directory, skipping archive/ and .trash/
 */
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

/**
 * Parse frontmatter-like metadata from the top of a markdown file.
 * Expects lines like: # Title, *Last updated: date*, etc.
 */
function extractMeta(content, filePath) {
  const lines = content.split("\n");
  const meta = { path: filePath, title: "", updated: "", category: "", summary: "" };

  // Title from first H1
  for (const line of lines) {
    if (line.startsWith("# ")) {
      meta.title = line.slice(2).trim();
      break;
    }
  }

  // Metadata lines (first ~15 lines)
  const head = lines.slice(0, 15).join("\n");

  // Try multiple date formats: *Last updated: ...* or **Last updated:** ... or | Last updated: ...
  let updatedMatch = head.match(/\*Last updated:\s*(.+?)\*/i);
  if (!updatedMatch) updatedMatch = head.match(/\*\*Last updated:\*\*\s*(.+)/i);
  if (!updatedMatch) updatedMatch = head.match(/\| Last updated:\s*(.+)/i);
  if (updatedMatch) meta.updated = updatedMatch[1].trim();

  // Try multiple category formats
  let catMatch = head.match(/\*Category:\s*(.+?)\*/i);
  if (!catMatch) catMatch = head.match(/\| Category:\s*(.+)/i);
  if (catMatch) meta.category = catMatch[1].trim().replace(/\*+$/, "").trim();

  // Summary: first substantial paragraph after metadata block
  let inMeta = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (inMeta) {
      if (line.startsWith("## ") || line.startsWith("---")) { inMeta = false; continue; }
      // Skip headers, metadata lines, blockquotes, blank lines
      if (line.startsWith("#") || line.startsWith("*") || line.startsWith(">") || line.startsWith("|") || line === "") continue;
      inMeta = false;
    }
    if (!inMeta && line.length > 20) {
      meta.summary = line.slice(0, 300);
      break;
    }
  }

  return meta;
}

/**
 * Load all research articles into memory.
 * Returns array of { path, title, updated, category, summary, content }
 */
let _articleCache = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

async function loadAllArticles(force = false) {
  if (_articleCache && (Date.now() - _cacheTime) < CACHE_TTL && !force) {
    return _articleCache;
  }

  const articles = [];
  for (const root of RESEARCH_ROOTS) {
    const files = await findMarkdownFiles(root);
    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const meta = extractMeta(content, file);
        articles.push({ ...meta, content });
      } catch { /* skip unreadable */ }
    }
  }

  // Sort by updated date descending (newest first)
  articles.sort((a, b) => {
    const da = Date.parse(a.updated);
    const db = Date.parse(b.updated);
    if (!isNaN(da) && !isNaN(db)) return db - da;
    if (!isNaN(da)) return -1;
    if (!isNaN(db)) return 1;
    return 0;
  });

  _articleCache = articles;
  _cacheTime = Date.now();
  return articles;
}

/**
 * Full-text search across articles.
 */
function searchArticles(articles, query, category) {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 0);

  const scored = articles
    .map(a => {
      if (category && !a.path.toLowerCase().includes(category.toLowerCase())) return null;
      const title = a.title.toLowerCase();
      const content = a.content.toLowerCase();
      const summary = a.summary.toLowerCase();

      let score = 0;
      for (const term of terms) {
        // Title matches are weighted highest
        if (title.includes(term)) score += 10;
        // Exact phrase in content
        const contentHits = (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        score += contentHits * 2;
        // Summary match bonus
        if (summary.includes(term)) score += 3;
      }
      if (score > 0) return { ...a, score };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored;
}

/**
 * Format a human-readable relative path.
 */
function readablePath(filePath) {
  const rel = relative(WORKSPACE, filePath);
  return rel.replace(/^research\//, "").replace(/^grandpasai\/research\//, "");
}

// ── MCP Server ───────────────────────────────────────────────────────

const server = new McpServer({
  name: "grandpasai",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
  instructions: `Grandpa's AI Research Station — access curated research on age reversal, robotics, AI, space colonization, and more.`,
});

// ── Tool: search_research ────────────────────────────────────────────

server.registerTool("search_research", {
  title: "Search Research",
  description: "Full-text search across Grandpa's AI research corpus. Returns ranked results with titles, summaries, and article paths. Use this to find research on any topic.",
  inputSchema: {
    query: z.string().describe("Search query — words or phrases to find in the research"),
    category: z.string().optional().describe("Optional filter: 'age-reversal', 'artificial-intelligence', 'humanoid-robotics', 'space-colonization', or 'custom'"),
    maxResults: z.number().optional().default(10).describe("Maximum number of results to return (default 10, max 25)"),
  },
}, async ({ query, category, maxResults }) => {
  const articles = await loadAllArticles();
  const results = searchArticles(articles, query, category || null);
  const limit = Math.min(maxResults || 10, 25);
  const top = results.slice(0, limit);

  if (top.length === 0) {
    return {
      content: [{ type: "text", text: `No results found for "${query}"${category ? ` in ${category}` : ""}. Try different keywords.` }],
    };
  }

  const lines = [
    `Found ${results.length} result(s) for "${query}"${category ? ` in ${category}` : ""}. Showing top ${top.length}:\n`,
  ];

  for (const a of top) {
    lines.push(`### ${a.title}`);
    lines.push(`- **Path:** \`${readablePath(a.path)}\``);
    lines.push(`- **Category:** ${a.category || "Uncategorized"}`);
    if (a.updated) lines.push(`- **Updated:** ${a.updated}`);
    if (a.summary) lines.push(`- **Summary:** ${a.summary.slice(0, 200)}`);
    lines.push(`- **Relevance:** ${a.score}`);
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
});

// ── Tool: get_article ────────────────────────────────────────────────

server.registerTool("get_article", {
  title: "Get Article",
  description: "Retrieve a full research article by its path. Use the path from search results, or provide a relative path like 'age-reversal/categories/01-epigenetic-reprogramming.md'.",
  inputSchema: {
    path: z.string().describe("Article path — as returned by search_research, e.g. 'age-reversal/categories/01-epigenetic-reprogramming.md'"),
    format: z.enum(["markdown", "summary"]).optional().default("markdown").describe("Output format: 'markdown' for full article, 'summary' for metadata + first 500 words"),
  },
}, async ({ path: articlePath, format }) => {
  // Resolve the path — try multiple roots
  const clean = articlePath.replace(/^research\//, "").replace(/^\.\.?\//, "");
  const candidates = [
    join(WORKSPACE, "research", clean),
    join(WORKSPACE, "grandpasai", "research", clean),
    join(WORKSPACE, "grandpasai", "research", "custom", clean),
  ];

  let content = null;
  let foundPath = null;
  for (const c of candidates) {
    try {
      content = await readFile(c, "utf-8");
      foundPath = c;
      break;
    } catch { /* try next */ }
  }

  if (!content) {
    return {
      content: [{ type: "text", text: `Article not found: "${articlePath}". Use search_research to find available articles.` }],
    };
  }

  const meta = extractMeta(content, foundPath);

  if (format === "summary") {
    const summaryText = [
      `# ${meta.title}`,
      `**Category:** ${meta.category || "N/A"}`,
      `**Updated:** ${meta.updated || "N/A"}`,
      `**Path:** \`${readablePath(foundPath)}\``,
      "",
      meta.summary,
    ].join("\n");
    return { content: [{ type: "text", text: summaryText }] };
  }

  // Full markdown — truncate at a reasonable size for context windows
  const maxLen = 50_000;
  const truncated = content.length > maxLen
    ? content.slice(0, maxLen) + `\n\n... [truncated at ${maxLen} chars, full article is ${content.length} chars]`
    : content;

  return { content: [{ type: "text", text: truncated }] };
});

// ── Tool: list_categories ────────────────────────────────────────────

server.registerTool("list_categories", {
  title: "List Categories",
  description: "List all research categories and subcategories with article counts. Use this to understand what's available before searching.",
  inputSchema: {},
}, async () => {
  const articles = await loadAllArticles();

  // Group by top-level category
  const groups = {};
  for (const a of articles) {
    const parts = readablePath(a.path).split("/");
    const top = parts[0] || "uncategorized";
    if (!groups[top]) groups[top] = { count: 0, subcategories: {} };
    groups[top].count++;

    if (parts[1] && parts[1] !== parts[parts.length - 1]) {
      const sub = parts[1];
      if (!groups[top].subcategories[sub]) groups[top].subcategories[sub] = 0;
      groups[top].subcategories[sub]++;
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

// ── Tool: get_latest_research ────────────────────────────────────────

server.registerTool("get_latest_research", {
  title: "Get Latest Research",
  description: "Get the most recently updated research articles across all categories.",
  inputSchema: {
    count: z.number().optional().default(5).describe("Number of articles to return (default 5, max 20)"),
    category: z.string().optional().describe("Optional filter by top-level category"),
  },
}, async ({ count, category }) => {
  let articles = await loadAllArticles();

  if (category) {
    articles = articles.filter(a => a.path.includes(`/${category}/`) || a.path.includes(`/${category}.`));
  }

  const limit = Math.min(count || 5, 20);
  const latest = articles.slice(0, limit);

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

// ── Tool: get_topic_tree ─────────────────────────────────────────────

server.registerTool("get_topic_tree", {
  title: "Get Topic Tree",
  description: "Get the full hierarchical topic tree from grandpasai.com, including all categories, subcategories, and their page URLs. Use this to understand the site structure.",
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

    const text = `### Grandpa's AI Topic Tree\n_Updated: ${topics.updated || "unknown"}_\n\n${tree.map(n => formatNode(n)).join("\n")}`;
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Could not load topic tree: ${err.message}` }],
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Grandpa's AI MCP server running on stdio");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
