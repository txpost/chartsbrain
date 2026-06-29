# ChartsBrain

**A starter kit for a trading second brain — and a way to help build [chartsdb.com](https://chartsdb.com), the largest charts database in the world.**

The way you learn to trade is by studying thousands of charts until the setups are automatic. ChartsBrain is a jump-off point for building your own trading knowledge base around that work: clone it, and you get an AI-assisted chart-study workflow plus a glossary of setups — both **yours to grow in whatever direction you please.** You point an AI agent at a chart, it reads the chart, proposes a classification against *your* glossary, and files a clean, described entry into chartsdb — owned by you, and (if you want) part of the growing shared corpus everyone can study.

> Find a setup that works. Collect and study thousands of charts until you master it — to the point of being the best in the world at that one setup. Studying thousands of charts *is* the work.

ChartsBrain is how you do that work, build your own second brain around it, and help build the database while you do.

---

## What this is

ChartsBrain is a small, cloneable kit — not an app — meant to be the **seed of your own trading second brain.** It's:

- **A Claude Code skill** (`chart-ingest`) — the workflow that reads a chart screenshot, extracts the descriptive facts (ticker, timeframe, date span, what's drawn), proposes a pattern classification, and — after you confirm — files the entry.
- **A starter glossary** (`knowledge/glossary.md`) — a seed vocabulary of setups (Episodic Pivot, VCP, cup-with-handle, …) drawn from the greats. **This is yours.** Use it as-is, extend it, rewrite it, or ignore it and build your own from scratch — it's a starting point, not an authority. The skill classifies against *whatever glossary you've got*, and flags new patterns for *you* to add as you learn them.
- **A hosted MCP connection** — the bridge that writes your entry to chartsdb.com (a database row + hosted image variants), authenticated by *your own* API key. It's hosted at `chartsdb.com/mcp`, so there's nothing to install or run — you just connect to it. (It's a standard remote MCP endpoint, so any MCP-capable client works — these docs use Claude Code, but Codex, Claude Desktop, etc. connect to the same URL with your key.)

**The split that makes it work:** the database stays *dumb* — every entry just *describes* a chart and tags it. The *meaning* of those tags lives in **your** glossary. The AI does the reading and the busywork; **you** make the classification call, grow your own vocabulary, and own what you contribute.

---

## What you get out of it

- **A second brain you own.** The skill and glossary are a starting point — grow them however you trade. Already running your own notes/knowledge setup? Drop ChartsBrain in alongside it (see [Using it in an existing project](#using-it-in-an-existing-project)).
- **Your own studied collection.** Every chart you ingest is yours, searchable by pattern, timeframe, ticker. Build your personal model book.
- **Part of the big thing (if you want).** Your charts can contribute to the shared corpus at chartsdb.com — the goal is the largest, best collection of studied charts anywhere. The more people doing the work, the better the database gets for everyone.
- **A repeatable process.** The loop: *collect charts → AI ingests them → study them → apply what you learn to your own charts → ingest those for feedback → repeat.* ChartsBrain is the engine; what you do with the database (model books, breakdowns, conviction) comes out the other side.

---

## Getting started

> **Prerequisites:** [Claude Code](https://claude.com/claude-code) installed, and a [chartsdb.com](https://chartsdb.com) account.

### 1. Clone this repo

```bash
git clone https://github.com/txpost/chartsbrain.git
cd chartsbrain
```

### 2. Get your personal API key

1. Sign in at [chartsdb.com](https://chartsdb.com).
2. Go to **Settings → API keys** (`/settings/keys`).
3. **Create key**, give it a label (e.g. "ChartsBrain"), and copy it — it's shown once.

This key authenticates your contributions, so the charts you add are owned and attributed to you.

### 3. Connect (nothing to install)

ChartsBrain writes to chartsdb via a **hosted** MCP endpoint — no local server to install or run. Just export your key:

```bash
export CHARTSDB_API_KEY="cdb_your_key_here"
```

A `.mcp.json` ships with this repo pointing at `https://chartsdb.com/mcp`. Open Claude Code in this directory and accept the trust prompt — your key (read from the environment) authenticates you, and the chart tools become available to the skill. See `SETUP.md` for details.

### 4. Ingest your first chart

Open Claude Code in this directory and:

```
/chart-ingest ~/Downloads/my-chart.png
```

The skill will:
1. **Read** the chart and pull out the facts.
2. **Propose** a pattern classification, citing the glossary — with a one-line reason for each tag.
3. **Wait for you to confirm / edit / add** the classification. *(This is the point — you make the call, the AI proposes.)*
4. **File it** to chartsdb.com and hand you the live URL.

That's the loop. Do it a thousand times.

---

## Using it in an existing project

Already have your own trading notes / knowledge base (a tbrain-style "second brain")? You don't need to clone ChartsBrain as a separate repo — just drop the pieces into your existing project:

1. Copy the skill into your project: `.claude/skills/chart-ingest/`.
2. Copy `knowledge/glossary.md` somewhere in your project (or point the skill at a glossary you already keep). The skill reads whatever glossary you give it — your existing pattern notes work fine.
3. Add the `chartsdb` MCP server to your project's `.mcp.json` (copy the block from this repo's `.mcp.json`) and export your `CHARTSDB_API_KEY`.

Because the MCP endpoint is hosted, there's nothing else to install. Now `/chart-ingest` works inside *your* brain, classifying against *your* glossary, contributing to chartsdb.

---

## The roadmap

ChartsBrain is young and built in the open. Where it's going:

- **Now:** ingest charts via the skill; build your collection and your own glossary; contribute to the shared corpus.
- **Next:** richer classification (multi-timeframe, composite setups); optional tag-normalization so personal vocabularies still query coherently against the shared corpus.
- **Later:** derived outputs from the database — auto-generated model books, a content engine, pattern statistics across the whole corpus.

If you ingest a chart that fits no glossary pattern, the skill flags it — and you add the definition to **your** glossary. Your glossary is your curriculum; grow it as you learn.

---

## Philosophy

Learning to trade is a daunting, lonely task with no clear curriculum. This is an attempt at one — a shared place to do the work, with tooling that removes the friction and a community doing it alongside you.

**Think setups, not stocks.** Master one setup deeply. Study the charts. Find your pod.

---

## License

The ChartsBrain kit (skill, glossary, docs) is open source — MIT. The chartsdb corpus content is the contributors' own.

*ChartsBrain is the contributor tooling for [chartsdb.com](https://chartsdb.com). Questions? Find the community on [Discord](https://discord.gg/DCbwHWhQhD) or follow [@uponvolume](https://twitter.com/uponvolume) on X.*
