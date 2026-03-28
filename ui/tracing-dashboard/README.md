# ServalSheets Tracing Dashboard

Interactive React dashboard for visualizing request traces with flame graphs.

This app now lives at `ui/tracing-dashboard/` and is built from the repo root
into `dist/ui/tracing`.

The repo-root `package.json` and `vite.config.ts` are the canonical build and
dev entrypoints. This directory intentionally keeps only source-facing config.

## Quick Start

```bash
npm run dev:ui        # Development (repo-root Vite config)
npm run build:ui      # Production build into dist/ui/tracing
npm run ui:typecheck  # Type checking
npm run ui:clean      # Optional: remove local dashboard node_modules/dist
```

## Tech Stack

- React 18 + TypeScript
- Vite (build tool with HMR)
- D3.js + d3-flame-graph
- Server-Sent Events (SSE)

## Project Structure

```
src/
├── main.tsx           # React entry
├── App.tsx            # Main layout
├── types.ts           # TypeScript types
├── api.ts             # API client (REST + SSE)
├── utils.ts           # Helper functions
└── components/
    ├── FlameGraph.tsx
    ├── SpanTable.tsx
    ├── TraceList.tsx
    ├── TraceDetail.tsx
    ├── FilterBar.tsx
    └── StatsPanel.tsx
```

## Features

- Flame Graph - Interactive hierarchical view
- Span Analysis - Detailed span table
- Real-Time Streaming - Live trace updates
- Advanced Filtering - Multi-criteria search
- Performance Metrics - P50/P95/P99
- JSON Export - Download traces

## Development

**Dev server:** http://localhost:5173
**Production:** http://localhost:3000/ui/tracing

Backend API proxied to `http://localhost:3000/traces`

## Build

```bash
npm run build:ui
# Output: dist/ui/tracing/index.html, dist/ui/tracing/assets/*
```

## Integration

Built dashboard served by ServalSheets HTTP server:

- See `src/ui/tracing.ts`
- Route: `GET /ui/tracing`

---

**Full Docs:** `docs/operations/TRACING_DASHBOARD.md`
