---
title: "Placeholder Entry"
date: "2026-05-21"
summary: "A clearly-marked dummy entry. Proves the portfolio content pipeline renders end-to-end before any real work is published."
thumb: "r2:portfolio/2026/example-thumb.jpg"
media:
  - "r2:portfolio/2026/example-1.jpg"
  - "r2:portfolio/2026/example-2.jpg"
tags:
  - placeholder
---

This is a placeholder portfolio entry created during the Phase 3 build of the
site shell. It exists to verify the rendering pipeline end-to-end: the index
page lists it, the entry page renders it, and the R2 helper resolves the
frontmatter `r2:`-prefixed keys to public URLs at build time.

The body is freeform markdown. Real entries replace this one (or sit alongside
it). When real entries exist, this placeholder can be deleted with a single
file removal — no other site files need to change.

## What this entry proves

- Single-file authoring: one `.md` file under `src/content/portfolio/`
  produced both this entry page at `/portfolio/placeholder-entry/` and a card
  on the index at `/portfolio/`.
- R2 reference resolution: the `r2:` prefix on `thumb` and `media` entries is
  rewritten to the configured R2 public base URL by the page templates.
- Optional-by-default frontmatter: a separate text-only entry with no `thumb`
  and no `media` would render cleanly without errors or null guards.
