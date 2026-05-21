---
title: "Placeholder Entry"
date: "2026-05-21"
summary: "A clearly-marked dummy entry. Proves the portfolio content pipeline renders end-to-end before any real work is published."
tags:
  - placeholder
---

This is a deliberately media-free placeholder portfolio entry created during
the Phase 3 build of the site shell. It exists to verify the rendering
pipeline end-to-end: the index page lists it and the entry page renders it.

The body is freeform markdown. Real entries replace this one (or sit alongside
it). When real entries exist, this placeholder can be deleted with a single
file removal — no other site files need to change.

## What this entry proves

- Single-file authoring: one `.md` file under `src/content/portfolio/`
  produced both this entry page at `/portfolio/placeholder-entry/` and a card
  on the index at `/portfolio/`.
- Optional-by-default frontmatter: with no `thumb` and no `media`, the entry
  renders cleanly as a text-only card and text-only entry page without errors
  or null guards.
