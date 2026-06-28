# ChartsBrain

**An AI-assisted kit for studying charts and contributing them to [chartsdb.com](https://chartsdb.com) — the largest charts database in the world.**

The way you learn to trade is by studying thousands of charts until the setups are automatic. ChartsBrain is the tooling that makes that a *process* instead of a pile of screenshots: you point an AI agent at a chart, it reads the chart, classifies the pattern against a shared glossary, and files a clean, described entry into the database — owned by you, and part of a growing shared corpus everyone can study.

> Find a setup that works. Collect and study thousands of charts until you master it — to the point of being the best in the world at that one setup. Studying thousands of charts *is* the work.

ChartsBrain is how you do that work, and how you help build the database while you do it.

---

## What this is

ChartsBrain is a small, cloneable kit — not an app. It's:

- **A Claude Code skill** (`chart-ingest`) — the workflow that reads a chart screenshot, extracts the descriptive facts (ticker, timeframe, date span, what's drawn), proposes a pattern classification, and — after you confirm — files the entry.
- **A chart-pattern glossary** (`knowledge/glossary.md`) — the shared classification vocabulary. What an Episodic Pivot is, what a VCP is, what a cup-with-handle is. The skill classifies *against* this; you extend it as you learn new setups.
- **A hosted MCP connection** — the bridge that writes your entry to chartsdb.com (a database row + hosted image variants), authenticated by *your own* API key. It's hosted at `chartsdb.com/mcp`, so there's nothing to install or run — you just connect to it. (It's a standard remote MCP endpoint, so any MCP-capable client works — these docs use Claude Code, but Codex, Claude Desktop, etc. connect to the same URL with your key.)

**The split that makes it work:** the database stays *dumb* — every entry just *describes* a chart and tags it. The *meaning* of those tags lives in the glossary. The AI does the reading and the busywork; **you** make the classification call and own what you contribute.

---

## What you get out of it

- **Your own studied collection.** Every chart you ingest is yours, searchable by pattern, timeframe, ticker. Build your personal model book.
- **You're part of the big thing.** Your charts contribute to the shared corpus at chartsdb.com — the goal is the largest, best collection of studied charts anywhere. The more people doing the work, the better the database gets for everyone.
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

## The roadmap (for contributors)

ChartsBrain is young and built in the open. Here's where it's going — and where you can help:

- **Now:** ingest charts via the skill; build your collection; the glossary grows as the community finds new setups.
- **Next:** richer classification (multi-timeframe, composite setups), a public glossary anyone can propose additions to, contributor leaderboards / attribution on the shared corpus.
- **Later:** derived outputs from the database — auto-generated model books, a content engine, pattern statistics across the whole corpus.

If you ingest a chart that fits no glossary pattern, the skill flags it — propose a definition and it can be added. **The glossary is the curriculum, and it's collaborative.**

---

## Philosophy

Learning to trade is a daunting, lonely task with no clear curriculum. This is an attempt at one — a shared place to do the work, with tooling that removes the friction and a community doing it alongside you.

**Think setups, not stocks.** Master one setup deeply. Study the charts. Find your pod.

---

## License

The ChartsBrain kit (skill, glossary, docs) is open source — MIT. The chartsdb corpus content is the contributors' own.

*ChartsBrain is the contributor tooling for [chartsdb.com](https://chartsdb.com). Questions? Find the community on [Discord](https://discord.gg/DCbwHWhQhD) or follow [@uponvolume](https://twitter.com/uponvolume) on X.*
