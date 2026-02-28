---
title: ServalSheets Documentation
category: general
layout: home

hero:
  name: ServalSheets
  text: Google Sheets MCP Server
  tagline: Production-grade integration with 342 actions, safety rails, and AI-powered features
  image:
    src: /logo.svg
    alt: ServalSheets
  actions:
    - theme: brand
      text: Get Started
      link: /guides/FIRST_TIME_USER
    - theme: alt
      text: View on GitHub
      link: https://github.com/khill1269/servalsheets

features:
  - icon: 🎯
    title: MCP Protocol Native
    details: Full compliance with MCP 2025-11-25 specification. 22 tools, 342 actions, 6 resources, 6 prompts.
  - icon: 🛡️
    title: Safety Rails
    details: Dry-run mode, effect scope limits, user confirmations, and transaction rollback for worry-free automation.
  - icon: 🤖
    title: AI-Powered
    details: Formula generation, chart recommendations, pattern detection, and anomaly identification built-in.
  - icon: ⚡
    title: High Performance
    details: Smart request deduplication, batch optimization, rate limit handling with 50-70% API cost reduction.
  - icon: 🔐
    title: Enterprise Security
    details: OAuth 2.1 with PKCE, CSRF protection, signed state tokens, and comprehensive audit logging.
  - icon: 🚀
    title: Production Ready
    details: Docker, Kubernetes, Helm, Terraform modules for AWS/GCP. 1800+ tests, 92% coverage.
last_updated: 2026-01-30
---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #5f6fd9 30%, #41d1ff);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, #5f6fd9 50%, #41d1ff 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>

## Demo

<p align="center">
  <img src="/demos/hero-optimized.gif" alt="ServalSheets Demo" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
</p>

## Quick Example

```typescript
// Natural language to spreadsheet operations
await claude.chat('Create a sales report with Q1 data and add a chart');

// ServalSheets handles:
// ✅ Creating the spreadsheet
// ✅ Writing data with proper formatting
// ✅ Generating an appropriate chart
// ✅ All with safety confirmations
```

## Why ServalSheets?

<div class="comparison-grid">

| Feature          | ServalSheets       | Others |
| ---------------- | ------------------ | ------ |
| MCP Protocol     | ✅ Full 2025-11-25 | ❌     |
| Safety Rails     | ✅ Comprehensive   | ❌     |
| AI Features      | ✅ Built-in        | ❌     |
| Actions          | 252                | ~30    |
| Enterprise Ready | ✅                 | ⚠️     |

</div>

[View Full Comparison →](/COMPARISON_MATRIX)

## Trusted By

<div class="trusted-by">
  <span>Financial Services</span>
  <span>•</span>
  <span>SaaS Companies</span>
  <span>•</span>
  <span>Enterprise</span>
  <span>•</span>
  <span>Research Institutions</span>
</div>

[Read Case Studies →](/CASE_STUDIES)

<style>
.comparison-grid {
  margin: 2rem 0;
}
.trusted-by {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin: 2rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
</style>
