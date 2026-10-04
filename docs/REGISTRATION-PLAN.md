# Grandpa's AI MCP — Registration Plan

Master checklist for getting `grandpasai-mcp` listed in MCP registries and
AI-tool/agent directories. Prepared 2026-10-02.

**Canonical identity (use everywhere, verbatim):**

- Brand: **Grandpa's AI** (apostrophe required)
- Domain: `grandpasai.com` (URLs use `grandpasai`, brand uses `Grandpa's AI`)
- MCP server name: `grandpasai` · package: `grandpasai-mcp` v1.0.0
- Registry name (reverse-DNS): `io.github.wescorp/grandpasai`
- Remote URL: `https://grandpasai.com/mcp` (Streamable HTTP)
- Local: `node server.js` / `npx grandpasai-mcp` (stdio)
- Auth: **none** (public, read-only)
- License: MIT · GitHub: `wescorp`

---

## Per-target detail

### 1. Official MCP Registry  — ⚠️ BLOCKED (auth + endpoint + npm)
- **URL:** https://registry.modelcontextprotocol.io/ (repo: github.com/modelcontextprotocol/registry)
- **Method:** `mcp-publisher` CLI — `init` → `login github` → `publish` (publishes a `server.json`).
  Remote servers supported via a `remotes` array; npm stdio servers via a `packages` array.
- **Auth required:** YES — GitHub OAuth (`login github`) **and** an npm account (for the npm path).
- **Feeds:** `submissions/official-registry-server.json`
- **Status:** **Blocked on Wes** — needs (a) GitHub login for device-flow auth, (b) an npm
  account + `npm publish` if using the `packages` path, (c) the `mcpName` field added to
  package.json (`"mcpName": "io.github.wescorp/grandpasai"`), and (d) a working public
  endpoint if using the `remotes` path. Registry name must start `io.github.wescorp/`.

### 2. Glama  — 🟡 READY-ISH (auto-index) / ⚠️ manual form needs account
- **URL:** https://glama.ai/mcp/servers (add via "Add Server" button)
- **Method:** Web form ("Add Server") **or** automatic indexing of the official
  registry + public GitHub repos. Low-friction path: get listed in the official
  registry and/or ensure a clean public GitHub repo.
- **Auth required:** YES for the manual form (Glama sign-in); NO for auto-index.
- **Feeds:** `submissions/glama-submit.md`, `README.md`
- **Status:** **Ready to submit (manual form) / auto-indexes after target #1 or #5.**

### 3. Smithery  — ⚠️ BLOCKED (endpoint broken)
- **URL:** https://smithery.ai/new (docs: smithery.ai/docs/build/publish)
- **Method:** **URL publishing** — Smithery scans the live Streamable HTTP URL.
- **Auth required:** Smithery account to complete the flow.
- **Feeds:** `submissions/smithery-submit.md`, `server-card.smithery.json`
- **Status:** **Blocked on the endpoint fix.** The endpoint is live but
  `initialize` returns `"Server already initialized"` (400) → scan will fail.
  Fix `server-http.js` (stateless mode or per-session transport map) and restart
  before submitting. Then: go to smithery.ai/new, enter `https://grandpasai.com/mcp`.

### 4. MCP.so  — 🟡 READY (web form)
- **URL:** https://mcp.so/submit (select "MCP Server"; remote type at /submit?type=remote-server)
- **Method:** **Web form** (Repository URL + Name). Free review, or $39 one-time
  for instant publish + verified badge + featured placement.
- **Auth required:** YES (site sign-in).
- **Feeds:** `submissions/mcpso-submit.md`
- **Status:** **Ready to submit** (needs Wes's sign-in). Remote-server listing
  additionally needs the working endpoint.

### 5. MCP Directory  — 🟡 READY (web form; needs public repo)
- **URL:** https://mcp.directory/submit
- **Method:** **Web form** — auto-pulls metadata from the GitHub repo URL;
  publishes within ~24h.
- **Auth required:** No account required (email optional).
- **Feeds:** `submissions/mcp-directory-submit.md`
- **Status:** **Ready to submit** — but requires the **public** repo
  `github.com/wescorp/grandpasai-mcp` to exist (today the code is a subfolder of
  the `openclaw-workspace` monorepo). Recommend creating the dedicated repo first.

### 6. mcpHQ Awesome MCP Servers  — 🟡 READY (PR)
- **URL:** https://github.com/mcpHQ/awesome-mcp-servers (add to `data/servers.json`)
- **Method:** **GitHub PR** — append one JSON object to `data/servers.json`;
  run `npm run validate && npm run generate`; README is generated from it.
- **Auth required:** YES (GitHub account to open the PR — human-blocked here).
- **Feeds:** `submissions/mcphq-servers-entry.json`
- **Status:** **Ready to submit** once GitHub push/PR is available.

### 7. TensorBlock MCP Index  — 🟡 READY (issue form or PR)
- **URL:** https://github.com/TensorBlock/awesome-mcp-servers
- **Method:** **GitHub issue form** ("Add MCP server") or **PR** adding a markdown
  line to `docs/knowledge-management--memory.md`. Produces public profile +
  install links after merge.
- **Auth required:** YES (GitHub account for issue/PR).
- **Feeds:** `submissions/tensorblock-entry.md`
- **Status:** **Ready to submit** once GitHub login is available.

### 8. OpenModels MCP registry  — ❌ NOT FOUND (drop)
- **URL:** `github.com/openmodels/mcp-registry` — **does not exist** (verified).
  The `openmodels` org is a climate-modeling group with no MCP registry.
- **Status:** **Drop / replace.** See `submissions/openmodels-mcp-registry.md`
  for evidence + suggested substitutes.

### 9. NeedAITool  — 🟡 READY (web form)
- **URL:** https://www.needaitool.com/submit (needaitool.com redirects here)
- **Method:** **Web form** — tool name, website URL, tagline, category, pricing
  model, description, email. Manual review 48–72h. No public GitHub submission
  directory (the `needaitools/needaitools-website` repo is just the site source).
- **Auth required:** No account (email required for confirmation).
- **Feeds:** none dedicated (use canonical copy) — see shortlist.
- **Status:** **Ready to submit** (Wes can fill the form directly). Category:
  "Research AI" or "Agent AI".

### 10. "189 verified AI tool directories" — ✅ RESEARCH DONE
- **List:** https://github.com/best-of-ai/ai-directories ("Top AI Directories")
- **Shortlist delivered:** `submissions/ai-tool-directories-shortlist.md`
  (agent dirs + developer-tool dirs only). Highlight: **Not Human Search**
  (https://nothumansearch.ai — indexes MCP servers, free no-account /submit).

---

## Prioritized execution order

1. **Fix the HTTP endpoint** (blocker for #3, #1-remote, #4-remote, and any hosted scan).
2. **Create the public repo** `github.com/wescorp/grandpasai-mcp` with README +
   LICENSE + `server.js`/`server-http.js` + `package.json` (+ add `mcpName`,
   `repository`, `license` fields). Push is currently broken — human does this.
3. **mcpHQ (#6)** — cheapest GitHub win; do first once GitHub works.
4. **TensorBlock (#7)** — issue form, very low effort.
5. **MCP Directory (#5)** — no-account web form; do as soon as repo is public.
6. **Official Registry (#1)** — highest authority; needs npm + GitHub + working
   endpoint; do once endpoint + npm are ready.
7. **Glama (#2)** — auto-indexes after #1; optionally manual form.
8. **Smithery (#3)** — after endpoint fix.
9. **MCP.so (#4)** — web form; optionally $39 for featured.
10. **NeedAITool (#9) + Not Human Search + shortlist dirs (#10)** — quick web forms.

## Blockers Wes must resolve (human action)

1. **GitHub credentials / push** — push is broken on this machine (no credentials).
   Needed for: #6 mcpHQ PR, #7 TensorBlock issue/PR, #1 official registry
   (`mcp-publisher login github`), and creating the public repo.
2. **A public dedicated repo** — `github.com/wescorp/grandpasai-mcp` (currently the
   code lives in `grandpasai-mcp/` of `wescorp/openclaw-workspace`). Required by
   #5, #2, and recommended for all.
3. **Fix + restart the hosted endpoint** — `https://grandpasai.com/mcp` currently
   returns `"Server already initialized"` on `initialize`. Fix `server-http.js`
   to stateless mode (`sessionIdGenerator: undefined`) or a per-session transport
   map, then restart the systemd unit (`grandpasai-mcp.service`). Blocks #3, #1-remote,
   #4-remote.
4. **npm account + `npm publish`** — required only for the official-registry
   *package* path (#1). If avoiding npm, use the `remotes` path (still needs #3).
5. **Optional: hosted endpoint URL confirmation** — confirm the public URL
   (`https://grandpasai.com/mcp` vs a trailing slash) and that Caddy/Cloudflare
   bot-protection won't block SmitheryBot (User-Agent `SmitheryBot/1.0`).

## Deliverable → target map

| Deliverable | Feeds |
|-------------|-------|
| `README.md` | all (canonical copy) |
| `server-card.json` | #1 (server card), #2, machine discovery |
| `server-card.smithery.json` | #3 fallback |
| `auth.md` | #1, #3, #5 (auth metadata) |
| `LICENSE` | repo setup, #5, #6, #7 |
| `connect-page.html` | grandpasai.com/connect |
| `submissions/official-registry-server.json` | #1 |
| `submissions/mcphq-servers-entry.json` | #6 |
| `submissions/tensorblock-entry.md` | #7 |
| `submissions/openmodels-mcp-registry.md` | #8 (drop note) |
| `submissions/mcpso-submit.md` | #4 |
| `submissions/mcp-directory-submit.md` | #5 |
| `submissions/glama-submit.md` | #2 |
| `submissions/smithery-submit.md` | #3 |
| `submissions/ai-tool-directories-shortlist.md` | #10 |
