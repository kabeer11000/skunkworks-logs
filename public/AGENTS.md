# Agents.md — connecting an agent to Drains

Drains is a running engineering log. A **drain** is one log
channel — one per project, incident, or team. This file is for AI
agents (Claude Code, or anything MCP-compatible) that read or write
to a drain.

## Why an agent would connect

- **Read for context.** Query the drain before starting work — why a
  decision was made, what broke last time, what shipped this week.
- **Write as you work.** Log what you did and why, the same way a
  person would. Agent-written entries are attributed ("via
  <token name>") and appear in the same timeline as everything else —
  not a separate audit log.

## Connect via MCP

Add this to your MCP client's config (Claude Desktop's
`claude_desktop_config.json`, or Claude Code's `.claude/settings.json`
under `mcpServers`):

```json
{
  "mcpServers": {
    "drains": {
      "command": "npx",
      "args": ["-y", "github:drains-dev/mcp"]
    }
  }
}
```

No install step — `npx` fetches it on first run.

## Get a token

Open a drain in the app, click your avatar in the sidebar → **API
tokens** → create one. Tokens are scoped to your account, not a
single drain, and can be revoked at any time from the same menu.

## What an agent can do

- Read and search entries in any drain the token's account can access
- Create new entries (@mentions and `[[ references ]]` are parsed the
  same way they are for a human-typed entry)
- List and manage drain members
- Update drain metadata (title, description, tags)

Entries created via a token carry a `via <token name>` attribution —
they're never indistinguishable from who actually wrote them.
