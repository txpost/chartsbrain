# Setup

Connecting ChartsBrain to chartsdb.com. It's short — the MCP server is **hosted**, so there's nothing to install or run locally.

## 1. Get your personal API key

1. Sign in at [chartsdb.com](https://chartsdb.com).
2. **Settings → API keys** (`/settings/keys`).
3. **Create key** → label it (e.g. "ChartsBrain") → copy it. It's shown **once** — store it like a password.

## 2. Export your key

Put this in your shell profile (`~/.zshrc` / `~/.bashrc`) so Claude Code can read it:

```sh
export CHARTSDB_API_KEY="cdb_your_key_here"
```

Reload (`source ~/.zshrc`) or open a new terminal.

## 3. Connect

A `.mcp.json` ships with this repo, pointing at the hosted endpoint:

```json
{
  "mcpServers": {
    "chartsdb": {
      "type": "http",
      "url": "https://chartsdb.com/mcp",
      "headers": { "Authorization": "Bearer ${CHARTSDB_API_KEY}" }
    }
  }
}
```

Open Claude Code in this directory — it'll prompt to trust the project's MCP server. Accept it. Your key is read from the environment, so it never lives in the repo.

That's it. No `npm install`, no local server process — chartsdb.com hosts the MCP endpoint; you just connect to it with your key.

## 4. Verify

Start a Claude Code session here and run:

```
/chart-ingest ~/Downloads/some-chart.png
```

If the skill says the MCP server isn't connected, check: (a) `CHARTSDB_API_KEY` is exported in the same environment Claude Code runs in, (b) you accepted the trust prompt, (c) you're online. Restart the session after fixing — MCP servers connect at session start.

## Notes

- **The key is per-user.** Charts you ingest are owned by *you* and attributed to you in the shared corpus.
- **Treat the key like a password.** Anyone with it can write to your collection. Revoke + recreate at `/settings/keys` if it leaks.
- **Per-machine:** repeat steps 2–3 (export the key, accept the trust prompt) on each computer you use.
