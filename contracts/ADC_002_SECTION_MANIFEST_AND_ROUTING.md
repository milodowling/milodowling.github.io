---
contract_id: section-manifest-adc-002
title: "Section Manifest, Filesystem Routing, and Feed Convention"
author: "Milo Dowling"
status: "proposed"
version: 1.0
created_date: "2026-05-20"
last_updated: "2026-05-21"
---

# Section Manifest and Routing

This contract specifies how sections mount into the shell. Two mechanisms work
together: **filesystem-driven routing** (Astro's default — what URLs exist) and a
**thin manifest file** at `src/sections.config.js` (what navigation shows and in
what order). The manifest is the source of truth for navigation; the filesystem
is the source of truth for routing.

---

### [Rationale: Why both manifest and filesystem] <section-rationale-01>

Filesystem routing alone cannot express navigation order, human-readable labels,
or an `enabled` flag (for landing-in-development sections). A central registry
alone breaks the low-ceremony promise — every section addition would require
touching a shell-internal config in a more invasive way.

The split is: the filesystem decides what exists. The manifest decides what's
*visible* and *how it's labeled*. This keeps the cost of adding a section to two
file touches (the new page directory and one manifest entry) while still giving
the owner explicit control over nav presentation.

This satisfies the modularity constraint `<shell-constraint-modularity-02>` from
`ADC_001_SHELL_OVERVIEW.md`.

---

### [Feature: Section manifest] <section-feature-manifest-01>

The shell publishes a single manifest file at `src/sections.config.js` that
declares all sections in nav order. Each entry has the shape:

```js
// src/sections.config.js
export default [
  { slug: "portfolio", label: "Portfolio", enabled: true },
  { slug: "synth",     label: "Synth",     enabled: true },
  { slug: "dnd",       label: "D&D",       enabled: true },
  { slug: "tools",     label: "Tools",     enabled: true },
  // add new sections here
];
```

**Field semantics:**

- `slug` — string, lowercase, URL-safe. Must match the directory name under
  `src/pages/<slug>/` for the section's pages to resolve.
- `label` — string, displayed in navigation. Free-form human text.
- `enabled` — boolean. When `false`, the section is hidden from navigation but
  its routes remain reachable by direct URL. (Sections in early development can
  ship their pages without appearing in nav.)

**The shell does NOT mandate any additional fields.** Sections may extend the
manifest entry with section-specific metadata (e.g., a future
`feed: "feed/"` hint), but the shell's nav code reads only the three fields
above. Sections that want to publish richer metadata should do so within their
own section internals, not by expanding the shell's contract with the manifest.

**Parity:**
- **Implementation Scope:** `src/sections.config.js`, `src/components/Nav.astro` (or equivalent)
- **Configuration Scope:** `src/sections.config.js`
- **Tests:**
  - `tests/shell/manifest.spec.js`
  - Covered by `<shell-test-modularity-02>` in `ADC_001_SHELL_OVERVIEW.md`

---

### [Feature: Filesystem routing for sections] <section-feature-routing-02>

Sections route via Astro's filesystem-based page resolution. A section with slug
`<s>` serves at `/<s>/...` from files under `src/pages/<s>/...`. The shell does
not impose constraints on the internal structure of a section's directory — the
section is free to define nested routes, dynamic routes (`[slug].astro`), or any
Astro-supported pattern within its own subtree.

The shell's responsibility ends at:

1. Top-level navigation pointing to `/<slug>/` for each enabled manifest entry.
2. A consistent shell layout wrapping section pages (header, nav, footer),
   applied via a shared `src/layouts/ShellLayout.astro`.

Sections opt in to the shell layout by importing it. Sections that need a
different framing chrome (e.g., a future immersive engine demo route) may opt
out — the shell does not enforce layout adoption.

**Parity:**
- **Implementation Scope:** `src/pages/<section>/`, `src/layouts/ShellLayout.astro`
- **Tests:**
  - `tests/shell/routing.spec.js`

---

### [Feature: Section feed convention] <section-feature-feed-03>

If a section's content tree contains a `feed/` subdirectory (e.g.,
`src/pages/<section>/feed/` or `src/content/<section>/feed/` — the exact root is
the section's choice), the shell provides a **generic feed loader** that reads
markdown files from that directory **in order** and exposes them as an ordered
list to the section's pages.

**Order semantics.** Files are ordered by filename ascending (lexicographic).
Sections that want chronological ordering should prefix filenames with ISO dates
or zero-padded sequence numbers. The shell does not parse frontmatter for
ordering.

**Payload shape.** The shell does NOT constrain the markdown payload beyond
"valid markdown with optional frontmatter." The section consumes the loader's
output and renders it however it likes.

**Loader signature (informational, not prescriptive):**

```js
// returns: Array<{ slug: string, frontmatter: object, body: string }>
import { loadFeed } from "@shell/feed";
const entries = loadFeed("synth");
```

The synth section's own ADC pass will define what the feed actually contains and
how it's rendered. The shell's responsibility here is solely to *not preclude*
that future shape.

**Parity:**
- **Implementation Scope:** `src/lib/feed.js`
- **Tests:**
  - `tests/shell/feed.spec.js`

---

### [TestScenario: Manifest drives nav order and labels] <section-test-manifest-01>

**Covers:** `<section-feature-manifest-01>`

**Scenario.** Set the manifest to:

```js
[
  { slug: "tools",     label: "Tools",     enabled: true  },
  { slug: "portfolio", label: "Portfolio", enabled: true  },
  { slug: "synth",     label: "Synth",     enabled: false },
  { slug: "dnd",       label: "D&D",       enabled: true  },
]
```

Build and verify:

1. Nav renders three items in order: `Tools`, `Portfolio`, `D&D`.
2. The `Synth` item is absent from nav.
3. `/synth/` still returns 200 (filesystem routing is unaffected by
   `enabled: false`).
4. Each nav link's `href` is `/<slug>/`.

**Parity:**
- **Implementation Scope:** `tests/shell/manifest.spec.js`
- **Tests:**
  - `tests/shell/manifest.spec.js`

---

### [TestScenario: Filesystem routing — section pages resolve] <section-test-routing-02>

**Covers:** `<section-feature-routing-02>`

**Scenario.** With the default manifest, verify:

1. `/portfolio/` returns 200 and renders the portfolio index.
2. `/portfolio/<existing-entry-slug>/` returns 200 and renders the entry.
3. `/synth/`, `/dnd/`, `/tools/` return 200 and render their stub pages.
4. `/<nonexistent>/` returns 404.
5. Section pages that import `ShellLayout` render with the shell's nav and
   header chrome.

**Parity:**
- **Implementation Scope:** `tests/shell/routing.spec.js`
- **Tests:**
  - `tests/shell/routing.spec.js`

---

### [TestScenario: Feed loader returns ordered markdown entries] <section-test-feed-03>

**Covers:** `<section-feature-feed-03>`

**Scenario.** Create a synthetic section `test-feed` with three files under
`src/pages/test-feed/feed/`:

- `001-first.md` with body "first"
- `002-second.md` with body "second"
- `003-third.md` with body "third"

In a test page that calls `loadFeed("test-feed")`, verify:

1. The returned array has exactly 3 entries.
2. The order is `[001-first, 002-second, 003-third]`.
3. Each entry exposes `slug`, `frontmatter`, and `body`.
4. The shell does NOT assert anything about frontmatter shape — entries with
   no frontmatter, partial frontmatter, or arbitrary frontmatter all pass.

**Parity:**
- **Implementation Scope:** `tests/shell/feed.spec.js`
- **Tests:**
  - `tests/shell/feed.spec.js`

---

### [Reference: Cross-cutting modularity constraint] <section-ref-modularity-01>

The modularity constraint and its test are in `ADC_001_SHELL_OVERVIEW.md`:
`<shell-constraint-modularity-02>` and `<shell-test-modularity-02>`.
