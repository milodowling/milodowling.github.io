# Preserved D&D Content

This directory holds D&D-related content from the Hugo site that needed to
survive the rebuild. The new stack (Astro + React islands on Cloudflare Pages)
will wire a stub of this in; the eventual D&D section gets its own design pass
later.

## Contents

- `dnd-tabletop/index.html` — single-file virtual tabletop tool (~35 KB).
  Previously served verbatim from Hugo's `static/dnd-tabletop/` at
  https://milodowling.github.io/dnd-tabletop/
- `dnd-tabletop/README.md` — feature list and TODOs for the tabletop tool.

## Why preserved here (not relied upon from `../dnd-tabletop/`)

A sibling directory at `../dnd-tabletop/` (relative to repo root) also
contains a copy of `index.html`, but:

- It is **not** a git repository (no `.git/`, no remote).
- It contains **only** `index.html` (no README).
- Its `index.html` is an **older** snapshot (35,532 bytes, Mar 30 22:33)
  than this repo's version (35,582 bytes, Mar 30 22:42). The files differ.

So the sibling cannot be treated as a safe backing store — the canonical,
most-recent version lived in this repo's `static/dnd-tabletop/`, and that is
what has been preserved here.

There is no submodule, symlink, or sync script connecting the two locations.
The `.gitmodules` file at the repo root references `quickstart/themes/reterminal`
(a leftover from the original Hugo quickstart template) and has nothing to do
with the D&D content.
