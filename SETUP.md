# Setup

Full setup for connecting ChartsBrain to chartsdb.com. The short version is in the [README](README.md); this is the exact steps.

## 1. Install the MCP server's dependencies

```sh
cd mcp && npm install && cd ..
```

## 2. Get your personal API key

1. Sign in at [chartsdb.com](https://chartsdb.com).
2. **Settings → API keys** (`/settings/keys`).
3. **Create key** → label it (e.g. "ChartsBrain") → copy it. It's shown **once** — store it like a password.

## 3. Export your key

Put these in your shell profile (`~/.zshrc` / `~/.bashrc`) so the MCP server picks them up:

```sh
export CHARTSDB_API_KEY="cdb_your_key_here"
export CHARTSDB_API_URL="https://chartsdb.com"
```

Reload (`source ~/.zshrc`) or open a new terminal.

## 4. Register the MCP server in Claude Code

A `.mcp.json` ships with this repo (committed config, preferred — it travels with the clone):

```json
{
  "mcpServers": {
    "chartsdb": {
      "command": "node",
      "args": ["./mcp/server.mjs"],
      "env": {
        "CHARTSDB_API_URL": "https://chartsdb.com",
        "CHARTSDB_API_KEY": "${CHARTSDB_API_KEY}"
      }
    }
  }
}
```

When you open Claude Code in this directory, it'll prompt to trust the project's MCP server — accept it. (The `${CHARTSDB_API_KEY}` is read from your environment, so your key never lives in the repo.)

If the committed config doesn't pick up, register it per-machine instead:

```sh
claude mcp add chartsdb -- node ./mcp/server.mjs
```

## 5. Verify

Start a Claude Code session in this directory. The `add_chart` tool loads at session start. To confirm it's connected:

```
/chart-ingest ~/Downloads/some-chart.png
```

If the skill says the MCP server isn't connected, check: (a) `npm install` ran in `mcp/`, (b) `CHARTSDB_API_KEY` is exported in the *same* environment Claude Code runs in, (c) you accepted the trust prompt. Restart the session after fixing — the MCP server reads its env at session start.

## Notes

- **The key is per-user.** Charts you ingest are owned by *you* and attributed to you in the shared corpus.
- **Treat the key like a password.** Anyone with it can write to your collection. Revoke + recreate at `/settings/keys` if it leaks.
- **Per-machine setup repeats steps 1, 3, 4** (install, export key, trust prompt) on each computer you use.
