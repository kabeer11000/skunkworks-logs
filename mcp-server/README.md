SkunkWorks Logs MCP server. Lets Claude Desktop, Claude Code, or any other MCP-compatible agent read and write your drains directly.

This runs locally on your own machine as a small process the agent starts itself — it is not something you deploy to a server. It just makes HTTP calls to your SkunkWorks Logs deployment using a personal API token, the same way a browser tab would.

Setup:

1. In SkunkWorks Logs, open the key icon in the sidebar and create an API token.
2. In this folder, run `npm install`.
3. Add this server to your MCP client's config. For Claude Desktop, that's `claude_desktop_config.json`; for Claude Code, `.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "skunkworks-logs": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "SKUNKWORKS_API_URL": "https://your-deployment.example.com",
        "SKUNKWORKS_API_TOKEN": "the token you created above"
      }
    }
  }
}
```

4. Restart the client. It will list drains, read and post entries, invite members, and trigger AI summaries on your behalf, with the same access as signing in yourself — except it can only edit or delete entries it (or your own account) originally created.

Regenerate or revoke the token from the same dialog at any time; revoking it immediately cuts the agent off.
