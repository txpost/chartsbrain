#!/usr/bin/env node
// chartsdb MCP server (stdio).
//
// Tools:
//   add_chart    — the /chart-ingest write path: POST an already-classified entry
//                  to the app's write spine (POST /api/charts), landing it live in
//                  the collection — no git, no local file.
//   delete_chart — the inverse: DELETE /api/charts { slug }, removing the Neon row
//                  + R2 image variants. For mistaken / duplicate / merged entries.
//   query_charts — the content-engine read path: GET illustrative charts matching
//                  tag/pattern/timeframe/ticker filters (GET /api/charts/query).
//                  The /draft-article skill's chart-select stage rides on this.
//   get_chart_bodies — step two of the read: deep-read the full markdown bodies
//                  (the ## Analysis prose) of chosen charts (GET /api/charts/bodies),
//                  for the draft stage to synthesize from. Pick light, then read deep.
//   add_article  — the content-engine WRITE path: publish an approved draft to the
//                  /blog (POST /api/articles). status=published makes it live (≥3
//                  cited charts required). The opposite direction from the reads.
//
// Config (env, set in the Claude Code MCP server config):
//   CHARTSDB_API_URL    base URL of the running app (e.g. http://localhost:3000)
//   CHARTSDB_API_KEY    your PERSONAL API key (cdb_…), created at /settings/keys.
//                       Resolves to your user, so charts you ingest are owned by
//                       you. (Legacy CHARTSDB_API_TOKEN still accepted as a
//                       fallback during migration.)
//
// Register in Claude Code (see README.md).
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const API_URL = process.env.CHARTSDB_API_URL || 'http://localhost:3000'
// Prefer the personal API key; fall back to the legacy shared token.
const API_TOKEN = process.env.CHARTSDB_API_KEY || process.env.CHARTSDB_API_TOKEN || ''

const ADD_CHART_TOOL = {
  name: 'add_chart',
  description:
    "Add a chart to the chartsdb collection. Call this at the end of a chart-ingest: " +
    "you have already classified the chart against the glossary and built the v2 entry. " +
    "Provide the frontmatter fields, the markdown body, and the image (either an image_path " +
    "to a local PNG/JPG, or image_base64 + image_filename). The chart lands live in the " +
    "collection on the site — no local file, no git.",
  inputSchema: {
    type: 'object',
    required: ['slug', 'date', 'title'],
    properties: {
      slug: { type: 'string', description: 'YYYY-MM-DD-TICKER-TF-label[-source] (the corpus slug)' },
      date: { type: 'string', description: "content date YYYY-MM-DD (when the setup formed)" },
      added: { type: 'string', description: 'date added YYYY-MM-DD (defaults to today on the chart)' },
      date_range: { type: 'string', description: 'e.g. "2025-08 / 2026-06" for case studies' },
      ticker: { type: 'string' },
      timeframe: { type: 'string', description: 'D, W, M, 1H, D+5m, …' },
      title: { type: 'string' },
      contributor: { type: 'string', description: 'e.g. trevor, traderlion, stockcharts' },
      source_type: { type: 'string', description: 'own-observation | external-blog | …' },
      source_url: { type: 'string' },
      license: { type: 'string', description: "defaults to 'proprietary'" },
      indicators: { type: 'array', items: { type: 'string' } },
      tags: { type: 'array', items: { type: 'string' } },
      body: { type: 'string', description: 'the full markdown body (## Summary, ## Pattern, …)' },
      image_path: { type: 'string', description: 'absolute path to the local image file (PNG/JPG)' },
      image_base64: { type: 'string', description: 'base64 image bytes (alternative to image_path)' },
      image_filename: { type: 'string', description: 'image filename, e.g. <slug>.png (required with image_base64)' },
    },
  },
}

const DELETE_CHART_TOOL = {
  name: 'delete_chart',
  description:
    'Delete a chart from the chartsdb collection by slug. Removes the Neon row and its ' +
    'R2 image variants (the inverse of add_chart). Use to remove a mistaken, duplicate, or ' +
    'merged-away entry. Idempotent-ish: returns 404 if no owned chart has that slug. ' +
    'Destructive and not undoable — confirm the slug before calling.',
  inputSchema: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string', description: 'the corpus slug to delete (e.g. 2026-06-25-OUST-D-...)' },
    },
  },
}

const QUERY_CHARTS_TOOL = {
  name: 'query_charts',
  description:
    'Query the chartsdb collection for charts matching tag / pattern / timeframe / ticker ' +
    'filters. The content-engine read path — use it to pull illustrative charts for an ' +
    'article (the chart-select stage of /draft-article). Tags AND-match: a chart must carry ' +
    'EVERY tag listed. Returns slug, ticker, timeframe, title, summary, tags, and a ready-to-' +
    'embed image URL for each hit.',
  inputSchema: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'chart must carry ALL of these tags (AND-match), e.g. ["high-tight-flag","confirmed"]',
      },
      pattern: { type: 'string', description: 'a single pattern tag, folded into the tag AND-set' },
      timeframe: { type: 'string', description: 'exact match: D, W, M, 1H, …' },
      ticker: { type: 'string', description: 'exact match, e.g. AAPL' },
      limit: { type: 'number', description: '1–50 (default 8)' },
    },
  },
}

const GET_CHART_BODIES_TOOL = {
  name: 'get_chart_bodies',
  description:
    "Deep-read the full markdown bodies (the operator's ## Analysis / ## Pattern prose) of a " +
    'chosen set of charts, by slug. Step two of the content-engine read: use query_charts to ' +
    'PICK charts by metadata, then this to READ the bodies of just the ones you selected (the ' +
    "draft stage synthesizes from this prose). Returns slug, title, summary, and full body for " +
    'each, in the slug order you pass. Up to 50 slugs.',
  inputSchema: {
    type: 'object',
    required: ['slugs'],
    properties: {
      slugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'the chart slugs to deep-read, in presentation order',
      },
    },
  },
}

const ADD_ARTICLE_TOOL = {
  name: 'add_article',
  description:
    'Publish (or update) a blog article to the chartsdb /blog. Call this at the end of a ' +
    'draft-article flow AFTER Trevor has approved the draft. Provide the slug, title, the full ' +
    'markdown body, and the ORDERED chart_slugs the article cites (its evidence set). The body ' +
    'already embeds live chart image URLs. status="published" makes it live on /blog. ' +
    'TWO TYPES: type="pattern-breakdown" (default) requires ≥3 cited chart_slugs to publish ' +
    '(the anti-slop rule); type="essay" (psychology/process/meta) is exempt and may publish ' +
    'chartless. status="draft"/"ready" stages without publishing. Idempotent on slug — re-call ' +
    "to update. Never auto-publishes without Trevor's approval upstream.",
  inputSchema: {
    type: 'object',
    required: ['slug', 'title'],
    properties: {
      slug: { type: 'string', description: 'the article slug (URL: /blog/<slug>)' },
      title: { type: 'string', description: 'the headline' },
      body: { type: 'string', description: 'the full markdown article body (embeds chart image URLs)' },
      chart_slugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'the ORDERED cited chart slugs (the evidence set); ≥3 required to publish a pattern-breakdown',
      },
      type: {
        type: 'string',
        description: 'pattern-breakdown (default — needs ≥3 charts to publish) | essay (charts optional, may be chartless)',
      },
      target_pattern: { type: 'string', description: 'the pattern/concept, e.g. high-tight-flag' },
      tags: { type: 'array', items: { type: 'string' } },
      status: { type: 'string', description: 'draft | ready | published (default draft)' },
      meta_description: { type: 'string', description: 'SEO meta description (falls back to summary)' },
      og_image: { type: 'string', description: 'OG image URL (falls back to first cited chart)' },
    },
  },
}

const server = new Server(
  { name: 'chartsdb', version: '0.5.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [ADD_CHART_TOOL, DELETE_CHART_TOOL, QUERY_CHARTS_TOOL, GET_CHART_BODIES_TOOL, ADD_ARTICLE_TOOL],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'delete_chart') return deleteChart(req.params.arguments ?? {})
  if (req.params.name === 'query_charts') return queryCharts(req.params.arguments ?? {})
  if (req.params.name === 'get_chart_bodies') return getChartBodies(req.params.arguments ?? {})
  if (req.params.name === 'add_article') return addArticle(req.params.arguments ?? {})
  if (req.params.name !== 'add_chart') {
    return { content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }], isError: true }
  }
  const a = req.params.arguments ?? {}

  // Resolve the image → { filename, base64 }.
  let filename, base64
  if (a.image_path) {
    const bytes = await readFile(a.image_path)
    base64 = bytes.toString('base64')
    filename = a.image_filename || `${a.slug}${ext(a.image_path)}`
  } else if (a.image_base64) {
    base64 = a.image_base64
    filename = a.image_filename
  }
  if (!base64 || !filename) {
    return { content: [{ type: 'text', text: 'provide image_path, or image_base64 + image_filename' }], isError: true }
  }

  const payload = {
    slug: a.slug, date: a.date, added: a.added, date_range: a.date_range,
    ticker: a.ticker, timeframe: a.timeframe, title: a.title,
    contributor: a.contributor, source_type: a.source_type, source_url: a.source_url,
    license: a.license, indicators: a.indicators, tags: a.tags, body: a.body,
    image: { filename, base64 },
  }

  const res = await fetch(`${API_URL}/api/charts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_TOKEN}` },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { content: [{ type: 'text', text: `add_chart failed (${res.status}): ${json.error ?? 'unknown'}` }], isError: true }
  }
  return { content: [{ type: 'text', text: `Added ${json.slug} → ${API_URL}${json.url}` }] }
})

// delete_chart → DELETE /api/charts with { slug }. Removes the Neon row + R2
// variants (the inverse of add_chart).
async function deleteChart(a) {
  if (!a.slug) {
    return { content: [{ type: 'text', text: 'provide slug: the corpus slug to delete' }], isError: true }
  }
  const res = await fetch(`${API_URL}/api/charts`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_TOKEN}` },
    body: JSON.stringify({ slug: a.slug }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { content: [{ type: 'text', text: `delete_chart failed (${res.status}): ${json.error ?? 'unknown'}` }], isError: true }
  }
  return { content: [{ type: 'text', text: `Deleted ${json.slug}` }] }
}

// query_charts → GET /api/charts/query with the filters as query params. Returns
// the hit list as JSON text (the skill reads it to pick charts to embed).
async function queryCharts(a) {
  const params = new URLSearchParams()
  if (Array.isArray(a.tags) && a.tags.length) params.set('tags', a.tags.join(','))
  if (a.pattern) params.set('pattern', a.pattern)
  if (a.timeframe) params.set('timeframe', a.timeframe)
  if (a.ticker) params.set('ticker', a.ticker)
  if (a.limit != null) params.set('limit', String(a.limit))

  const res = await fetch(`${API_URL}/api/charts/query?${params.toString()}`, {
    headers: { authorization: `Bearer ${API_TOKEN}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { content: [{ type: 'text', text: `query_charts failed (${res.status}): ${json.error ?? 'unknown'}` }], isError: true }
  }
  return { content: [{ type: 'text', text: JSON.stringify(json, null, 2) }] }
}

// get_chart_bodies → GET /api/charts/bodies?slugs=a,b,c. Returns the bodies JSON.
async function getChartBodies(a) {
  const slugs = Array.isArray(a.slugs) ? a.slugs.filter(Boolean) : []
  if (!slugs.length) {
    return { content: [{ type: 'text', text: 'provide slugs: a non-empty array of chart slugs' }], isError: true }
  }
  const params = new URLSearchParams({ slugs: slugs.join(',') })
  const res = await fetch(`${API_URL}/api/charts/bodies?${params.toString()}`, {
    headers: { authorization: `Bearer ${API_TOKEN}` },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { content: [{ type: 'text', text: `get_chart_bodies failed (${res.status}): ${json.error ?? 'unknown'}` }], isError: true }
  }
  return { content: [{ type: 'text', text: JSON.stringify(json, null, 2) }] }
}

// add_article → POST /api/articles. Publishes/updates a blog article (the
// content-engine WRITE counterpart to add_chart). Returns the live /blog URL.
async function addArticle(a) {
  const payload = {
    slug: a.slug,
    title: a.title,
    body: a.body,
    chart_slugs: a.chart_slugs,
    type: a.type,
    target_pattern: a.target_pattern,
    tags: a.tags,
    status: a.status,
    meta_description: a.meta_description,
    og_image: a.og_image,
  }
  const res = await fetch(`${API_URL}/api/articles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${API_TOKEN}` },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { content: [{ type: 'text', text: `add_article failed (${res.status}): ${json.error ?? 'unknown'}` }], isError: true }
  }
  return { content: [{ type: 'text', text: `Article ${json.slug} (${json.status}) → ${API_URL}${json.url}` }] }
}

function ext(p) {
  const m = basename(p).match(/\.[a-z0-9]+$/i)
  return m ? m[0] : '.png'
}

const transport = new StdioServerTransport()
await server.connect(transport)
