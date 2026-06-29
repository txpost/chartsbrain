---
name: chart-ingest
version: 2.1.0
description: |
  Ingest a chart you found into the chartsdb collection (the live app — Neon DB
  + R2 images). Reads the chart image, extracts the descriptive facts (ticker,
  timeframe, date range, what's drawn on it), proposes a pattern classification
  by reading the chart-pattern glossary (knowledge/glossary.md), then — after you
  confirm — calls the `add_chart` MCP tool, which lands the entry live on
  chartsdb.com (no git file, no local PNG) owned by you (via your personal API
  key). The collection stays "dumb" (descriptive frontmatter + free tags); the
  pattern *meaning* it classifies against lives in the glossary. Use when you
  paste or point at a chart screenshot you want kept as a corpus entry and may
  want help writing up.
triggers:
  - "ingest this chart"
  - "add this chart to the corpus"
  - "add this to chartsdb"
  - "I found a chart"
  - "write up this chart"
  - "make a chartsdb entry"
  - "classify this chart"
  - "chart for the model book"
tools:
  - Read
  - Write
  - Bash
mutating: true
---

# chart-ingest

Ingest a chart screenshot into the **chartsdb** collection (chartsdb.com) — a model-book of chart-pattern instances. This is the contributor workflow for "I found a chart and want it in the database, help me classify and write it up." Charts you add are **owned by you** (authenticated by your personal API key) and contribute to the shared corpus.

**The split this skill embodies:** chartsdb is a *dumb corpus* — each entry describes a chart (ticker, timeframe, date, what's drawn) and tags it freely, but does not interpret it. The *meaning* of the pattern tags — what a Wedge Pop is, what an Episodic Pivot is — lives in the **glossary** (`knowledge/glossary.md`). This skill is the bridge: it reads the glossary to classify, and writes the thin descriptive entry into chartsdb. The classification craft is yours; the pattern *vocabulary* lives in your glossary; the artifact lands in chartsdb.

This skill writes into the chartsdb **app** via the `add_chart` MCP tool. It conforms to chartsdb's thin v2 schema. **The DB is the sole source of truth** — there is no local file to write; the MCP call *is* the persist.

## Contract

This skill guarantees:
- A new chart entry **live in the chartsdb collection** (chartsdb.com), persisted via the `add_chart` MCP tool: a Neon DB row plus R2-hosted WebP image variants. **No git file, no local PNG, no LFS.** The tool returns the live URL.
- The entry conforms to chartsdb **SCHEMA.md v2** (the thin/dumb-corpus spec). Fields passed to `add_chart`: required `slug`, `date`, `title`; plus `ticker`, `timeframe`, `tags`, `indicators`, `contributor`, `source_type`, `source_url`, `license`, `date_range`, `added`, the markdown `body`, and the image. **No interpretive fields** (`pattern`, `pattern_status`, `signals`, `outcome`, `trade`, `stage`, etc. — removed in v2; pattern labels are free tags).
- The slug is `YYYY-MM-DD-<TICKER>-<TIMEFRAME>-<label>[-<source>]`, matching the corpus convention. `<TICKER>` uppercase, `<TIMEFRAME>` from the timeframe enum, `<label>` the headline pattern (kebab-case), `<source>` an optional contributor/source suffix (e.g. `-traderlion`, `-breakoutdb`).
- **Descriptive facts are extracted from the image** (ticker, timeframe, price range, date span, indicators drawn, annotations present) by reading it visually — not invented. If a fact can't be read off the chart, the skill asks rather than guesses.
- **Pattern classification is proposed, not imposed.** The skill reads the glossary, proposes the matching pattern tag(s) with a one-line reason each, and the user confirms/edits/adds before anything is written. The skill never silently applies a classification.
- **Tags use existing corpus vocabulary** where it fits. Before proposing tags, the skill scans the glossary's defined terms so suggestions align (no `head-shoulders` when the corpus says `head-and-shoulders`).
- The user's original image (Downloads/wherever) is **left intact** — the skill hands `add_chart` a path or base64 copy; it never moves or mutates the source. The app generates R2 WebP variants from whatever it's given (JPEG/PNG both fine — the app converts), so no manual PNG conversion is needed on this path.
- `add_chart` is **idempotent on slug** — re-calling with the same slug updates the existing entry rather than duplicating. The skill still surfaces a likely-collision to the user before overwriting an existing entry's content.
- The chart image is sent only to the chartsdb app (your own backend) — never to web tools, pastebins, PR descriptions, or other external services.
- The skill does **not** require any git commit — the write is the MCP call; there is no file to commit. (Reporting the live URL is the close.)
- **Removal is `delete_chart`, the inverse of `add_chart`** (MCP server v0.5.0+). To undo a mistaken / duplicate / merged-away entry, call `delete_chart({ slug })` — it removes the Neon row + R2 image variants via `DELETE /api/charts` (token-auth, owner-scoped). Destructive and not undoable; confirm the slug before calling. There is no native *merge* (a chart carries one image): combining two timeframes into one entry means stitching them into a single side-by-side image, updating one slug with that image, and `delete_chart`-ing the other.

## Inputs

- **chart** (required): the chart to ingest. Either a local image path (e.g. `~/Downloads/image-17.png`), a path the user pastes, or an image dragged into the conversation. The skill reads it visually.
- **source_url** (optional): where the chart came from (a TraderLion article, a tweet, breakoutdb). Sets `source_type` + `source_url`. If absent and the chart is your own observation, `source_type: own-observation` with empty `source_url`.
- **contributor** (optional): who captured/curated it. Defaults to `trevor` for own observations; set to the source name (e.g. `traderlion`, `breakoutdb`) for external material.
- **pattern / label** (optional): if the user already knows the pattern, they can name it; the skill still validates against the glossary and confirms.

If invoked bare (`/chart-ingest` with no chart), ask: *"Which chart? Paste the image or give me the path (e.g. ~/Downloads/foo.png)."*

## Phases

1. **Load the glossary + confirm the MCP tool is available.** Read `knowledge/glossary.md` into context — it's the classification vocabulary. Confirm the `add_chart` MCP tool is available (it's a deferred tool — load it via ToolSearch `select:mcp__chartsdb__add_chart`). If the tool isn't registered, stop and tell the user the chartsdb MCP server isn't connected (it loads at session start; see `../chartsdb/mcp/README.md`) — there is no file-write fallback anymore.

2. **Read the chart image.** Use the `Read` tool on the image. Extract, by looking at it:
   - **Ticker** — usually in the top-left chart title (e.g. "Super Micro Computer, Inc. · 1D · SMCI" → `SMCI`).
   - **Timeframe** — from the title (`1D` → `D`, `1W` → `W`, `1H` → `1H`, `65` → `65m`, etc.). Map to chartsdb's timeframe enum (`M`/`W`/`D`/`4H`/`1H`/`65m`/`5m`/`1m`, or a composite like `W+D`).
   - **Date span** — read the x-axis to get the approximate start and end (e.g. "2023 … 2024-06"). This becomes `date_range` for a multi-period/case-study chart.
   - **Indicators drawn** — what's literally on the chart: candlesticks, volume bars, moving averages, RSI, trendlines, annotation arrows/labels, drawn boxes. These become the `indicators` list (descriptive, not interpretive). `volume` is almost always present.
   - **Annotations** — any drawn pattern markup (neckline, shoulders arcs, triangle lines, "EP"/"Low Risk Entry" labels). These are clues to the pattern but are themselves descriptive (note them in `indicators` and the body).
   If the ticker or timeframe can't be read, **ask the user** — don't guess a ticker.

3. **Resolve the capture date + date_range.**
   - `date`: by convention this is the **capture date** (today, from the environment) OR the pattern's resolution date if the user wants it keyed to the chart's content (match what the recent corpus entries do — TraderLion case studies key `date` to the pattern's resolution month and add `date_range` for the span). Confirm with the user which they want; default to the pattern-resolution date for case-study charts and today's date for live own-observations.
   - `date_range`: the visible span read off the x-axis, formatted `"YYYY-MM / YYYY-MM"`. Optional — omit for a single-setup live chart, include for a case study spanning months/years.

4. **Propose a classification (against the glossary).** Match what's on the chart to the glossary's patterns/signals. Propose:
   - The **headline pattern** (the `<label>` in the slug) — one pattern, the dominant one.
   - **Pattern/setup tags** — the pattern slug plus its classification (`bullish`/`bearish`, `reversal`/`continuation`), any base shape, signals present.
   - For each proposed tag, give a **one-line reason grounded in what's drawn** (e.g. "`inverse-head-and-shoulders` — three troughs with a lower middle low and a neckline drawn across the two peaks; matches the glossary definition"). Cite the glossary entry.
   - If the chart matches **no** glossary pattern, say so and propose a new tag + a one-line definition to add to the glossary later (don't silently invent corpus vocabulary). Surface this as a flagged follow-up.
   **Present the proposed classification and stop for the user to confirm, edit, add, or trim.** This is the load-bearing human step — the skill proposes, the user decides.

5. **Build the slug.** Slug = `YYYY-MM-DD-<TICKER>-<TIMEFRAME>-<label>[-<source>]` (e.g. `2024-01-19-SMCI-D-episodic-pivot-traderlion`). `add_chart` is **idempotent on slug** (same slug updates in place rather than duplicating), so there's no local file to collide with. If you have reason to think this slug already exists and you do *not* intend to overwrite it (e.g. a genuinely different setup of the same ticker on the same day), pick a distinguishing `<label>` or add a `-2` suffix. Same ticker as an existing entry is **fine** — only re-using the exact slug overwrites.

6. **Assemble the final tag set.** Combine the confirmed pattern tags with the standard corpus base tags: `chart-pattern`, `daily` (or the timeframe word), the source tag (`traderlion`/`breakoutdb`/etc.), `case-study` if it's a historical teaching example, and any cohort/sentiment tags the user wants. Dedupe and sort. **Only the user-approved set** — don't pad with speculative tags.

7. **Assemble the entry, then call `add_chart`.** Build the same v2 fields the corpus has always used — they're now *arguments to the MCP tool*, not YAML in a file. Assemble:
   - **Frontmatter fields** (passed as `add_chart` args): `slug`, `date` (the chart's CONTENT date — when the setup formed), `added` (today, drives the default sort), `date_range` (omit if single-period), `ticker`, `timeframe`, `title` (`"<TICKER> — <Pattern> (<year>) — <source/context>"`), `contributor`, `source_type` (`own-observation` | `external-blog` | `external-video` | `external-social` | …), `source_url` (empty for own observations), `license` (always `proprietary` — the corpus is closed), `indicators` (string list — `volume` plus what's drawn), `tags` (the approved set, sorted). **No interpretive fields.**
   - **The markdown `body`** (passed as the `body` arg). Follow the canonical entry structure. Required, in order:
     1. `# <TICKER> — <Pattern> — <year or range>` (H1 title).
     2. `## Summary` — a one-sentence "what am I looking at?" as plain prose. The single most important line — how a reader instantly orients (e.g. "Textbook inverse head-and-shoulders bottom in DOCU, 2023."). **Don't** put the source here — provenance lives in `source_url`.
     3. The image embed `![<alt>](<slug>.png)` — reference the slug-named image; the app wires it to the R2 variant.
     4. `## Pattern` — the glossary's definition of the pattern (general; makes the entry self-describing).
     5. `## On this chart` — what's literally drawn/annotated on *this* image (the neckline, the gap-up day, the volume spike, the date span).
     - **Environment-context sections** — `## Catalyst` (the concrete event(s) that drove the move — earnings beat, product launch, recall, guidance cut; dated and attributed), `## Market` (what the general market / sector was doing during the span — trend, a major bottom/top, the stock's relative strength-or-weakness vs. the index; approximate levels/percentages), `## Fundamentals` (revenue, earnings/EPS, subscriber/unit growth, the profit-or-loss arc — specific numbers by year/quarter, attributed). All three sit **after `## On this chart` and before `## Analysis`**, in that order. They give the reader the overall environment the chart formed in. **All optional** under the never-empty-heading rule — but optional ≠ "skip if the chart is silent." If the *image itself* doesn't surface a fact, **the agent's job is to go find it**: run a web search / deep-dive on the ticker + date range and fill the section from verifiable public sources. (This is the dumb-corpus / smart-agent split — the section is descriptive *corpus* content; the *research* to populate it is the agent's intelligence.) Discipline: state every researched fact as **observable, attributed, date-bounded** ("Q4 2009 revenue $444.5M, +24% YoY, per the 8-K"), never spun into a thesis or prediction — same rule as `## Outcome`. Mark anything you couldn't verify `[unverified]` rather than guessing. **Only the ticker + date range go to web tools — never the chart image** (the image goes only to chartsdb). Omit a section only if research genuinely turns up nothing.
     - Optional sections, **only if there's real content, in this order** (after the environment sections): `## Analysis` (the applied interpretive read through a named lens — stage analysis, VCP, a method — lens named in the first line, header kept generic `## Analysis`; **self-contained conversational prose that stands on its own, no wikilink dependence** — assume trader vocabulary, since public readers won't have the glossary and the entry must be legible alone), `## Outcome` (prose narration of *observed* price action, estimate-flagged if read off the chart), `## Notes` (your editorial commentary — you write it, the agent doesn't ghost-write), `## Related` (`[[wikilinks]]` to siblings). **Never leave an empty heading** — omit the section.
     - Do **not** ghost-write a trade thesis or fabricate an outcome — those are interpretive and don't belong in the dumb corpus. `## Outcome` is for *observed* price action only; if unknown, omit it. The `## Catalyst` / `## Market` / `## Fundamentals` sections are *factual* environment context, not thesis — keep them descriptive.
   - **The image** (one of two arg forms): `image_path` (absolute path to the user's local file — preferred; the app reads JPEG or PNG and generates R2 WebP variants itself, so no manual conversion is needed) OR `image_base64` + `image_filename` (`<slug>.png`). Leave the user's original file intact.
   - **Call `add_chart`** with all of the above. It POSTs to `chartsdb.com` (`POST /api/charts`, token-authed), writes the Neon row + R2 image variants, and returns the **live URL**. Idempotent on slug.

8. **Verify the write landed.** The tool's success response returns the live URL — that's the primary confirmation. Optionally confirm the entry is queryable / the R2 image serves (the app generates `thumb`/`reading`/`full` WebP variants; a quick `curl -sI <reading-url>` → `HTTP 200 image/webp` confirms the image pipeline ran). Do **not** look for a local file — there isn't one on this path. If `add_chart` returns an error (auth/token mismatch, app down), report it and stop; don't fall back to writing a file (the flat-file corpus is retired).

9. **Report.** One line:
   ```
   Ingested <slug> → <live URL> — <ticker> <timeframe>, <pattern>, <N> tags. Live on chartsdb.com.
   ```
   Then note any flagged follow-up (a new pattern that needs a glossary definition). No commit step — the MCP write *is* the persist; there's nothing to commit. If a new pattern was flagged, offer to add its definition to the glossary as a separate step.

## Output Format

A single `add_chart` MCP call that lands the entry live on chartsdb.com (Neon row + R2 image variants). **No files are written.** The call's arguments mirror the v2 schema; sample:

```js
add_chart({
  slug: "2024-01-19-SMCI-D-episodic-pivot-traderlion",
  date: "2024-01-19",                 // content date (when the setup formed)
  added: "2026-06-08",                // date added — drives default sort
  date_range: "2023-06 / 2024-03",    // omit if single-period
  ticker: "SMCI",
  timeframe: "D",
  title: "SMCI — Episodic Pivot (2024) — TraderLion / Bonde",
  contributor: "traderlion",
  source_type: "external-blog",
  source_url: "https://traderlion.com/podcast/pradeep-bonde-episodic-pivots/",
  license: "proprietary",
  indicators: ["volume", "annotation-arrow"],
  tags: ["bullish","case-study","catalyst-earnings","chart-pattern","daily",
         "episodic-pivot","gap-up","traderlion","volume-surge"],
  image_path: "~/Downloads/<source>.jpeg",   // app converts → R2 WebP
  body: `# SMCI — Episodic Pivot — 2024

## Summary

Classic earnings-catalyst Episodic Pivot in SMCI, 2024 — a high-volume gap-up out of a long base that kicked off a ~154% run.

![SMCI Episodic Pivot](2024-01-19-SMCI-D-episodic-pivot-traderlion.png)

## Pattern

<glossary definition of episodic-pivot>

## On this chart

<what is literally drawn on this image: the gap-up day, the annotation arrow marking the breakout, the volume spike out of the prior consolidation, the ~2023-06 to 2024-03 span>

## Catalyst

<the concrete event(s) that drove the move — dated, attributed. Researched from public sources if the chart is silent. Facts, not thesis.>

## Market

<what the general market/sector was doing during the span; the stock's relative strength/weakness vs. the index. Approximate levels/percentages, attributed.>

## Fundamentals

<revenue, EPS, unit/subscriber growth, the profit-or-loss arc — specific numbers by year/quarter, attributed. [unverified] anything unconfirmed.>

## Outcome

<optional — observed price action only, estimate-flagged. Omit if unknown.>

## Related

<optional — [[wikilinks]] to sibling entries>
`,
})
// → returns the live URL, e.g. https://chartsdb.com/c/2024-01-19-SMCI-D-episodic-pivot-traderlion
```

(`## Notes` omitted here — include it only when you add your own editorial commentary.)

## Anti-Patterns

- **Auto-classifying without confirmation.** The pattern call is the user's. Propose with reasons grounded in what's drawn; let the user confirm/edit. Never call `add_chart` before the classification is approved.
- **Inventing facts not on the chart.** Ticker, timeframe, date span, indicators must be *read off the image*. If a ticker isn't legible, ask — never guess a symbol.
- **Writing interpretive fields into the corpus.** chartsdb is dumb (v2). No `pattern`/`pattern_status`/`outcome`/`trade`/`stage` fields — pattern labels are *tags*. No trade thesis or "what happened next" prediction in the body. Description, not interpretation.
- **Leaving the environment sections empty because the chart is silent.** `## Catalyst` / `## Market` / `## Fundamentals` are optional but *not* skip-by-default — when the image doesn't surface the fact, research it (web search on ticker + date range) and fill it from attributed public sources. Omit only if research genuinely turns up nothing. Conversely, don't let the research *drift into thesis* — state observable, date-bounded facts, `[unverified]` what you can't confirm, and never send the chart image to a web tool (only the ticker + dates).
- **Silently coining new pattern vocabulary.** If the chart fits no glossary pattern, flag it and propose a definition for the user to add to the glossary — don't slip an undefined tag into the corpus as if it were established.
- **Tag drift.** Reuse the corpus's existing tag spelling (`head-and-shoulders`, not `h-and-s`; `episodic-pivot`, not `ep`). Scan the glossary before proposing.
- **Writing a local file.** The flat-file corpus is retired (2026-06-17) — the DB is the sole source of truth. Never `cp`/`sips`/`Write` a `.md` or `.png` into `../chartsdb/charts/` (the directory is gone). The only write path is `add_chart`.
- **Falling back to a file when `add_chart` fails.** If the MCP tool errors (token mismatch, app down), report it and stop — there is no file fallback. Fix the connection and retry.
- **Manually converting the image.** The app generates R2 WebP variants from whatever it's handed (JPEG or PNG) — don't `sips` it to PNG first; just pass `image_path` to the original.
- **Writing a local file instead of calling `add_chart`.** Chart entries live in the chartsdb app (Neon + R2), not on disk. The only local file this skill touches is the glossary — and only to *read* it (or, as a flagged follow-up, to add a new pattern definition).
- **Sending the chart anywhere external.** The image goes only to your own chartsdb backend. No other web tools, PR descriptions, or pastebins.
