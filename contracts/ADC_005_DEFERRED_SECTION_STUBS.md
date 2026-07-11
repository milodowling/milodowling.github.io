---
contract_id: deferred-section-stubs-adc-005
title: "Deferred Section Stubs — Synth, D&D, Tools"
author: "Milo Dowling"
status: "active"
version: 1.1
created_date: "2026-05-20"
last_updated: "2026-07-10"
---

# Deferred Section Stubs

This contract specifies the mount points for the sections whose internals
are deferred to future ADC passes: synth and tools. Each stub is a
navigable placeholder page that future passes will fill in. The shell explicitly
does NOT prescribe internals (data model, feed shape, UI patterns, hosting
model) for these sections.

**v1.1 (2026-07-10):** the D&D section graduated. Its init pass landed as
`contracts/ADC_006_DND_TABLETOP.md`, superseding `<stubs-feature-dnd-02>`
and `<stubs-feature-dnd-tabletop-passthrough-03>` below (both kept for the
record). The `/dnd/` route and its stub-hygiene test remain governed by
`<stubs-test-stubs-render-01>`, now on ADC_006's behalf.

---

### [Rationale: Why stubs now, internals later] <stubs-rationale-01>

Synth, D&D, and tools each warrant their own design pass — they have content
models, presentation patterns, and (for synth) potentially backend needs that
the shell session is not equipped to resolve. Including them here as
mount-point stubs serves three purposes:

1. **Forward-compatibility verification.** The shell can be built and deployed
   end-to-end with all five sections present (portfolio + three stubs +
   homepage), proving the modular section pattern works at the intended scale.
2. **URL stability.** The D&D stub locks in `/dnd-tabletop/` preservation
   (`<shell-constraint-url-preservation-04>` in `ADC_001_SHELL_OVERVIEW.md`)
   so the migration doesn't break currently-shared URLs.
3. **Owner-visible affordance.** Even before the synth/D&D/tools design passes
   run, the owner sees the eventual section structure in nav and can route
   visitors to "coming soon" pages rather than 404s.

---

### [Feature: Synth stub] <stubs-feature-synth-01>

The synth section mounts at `/synth/` and renders a stub placeholder page. The
stub:

- Uses the shell layout (header, nav, footer).
- Displays a brief statement that the synth section is in development. Exact
  copy is the owner's call.
- Does NOT include any data model, kanban UI, feed renderer, service-notes
  pattern, or other synth-specific affordance. Those are the synth ADC pass's
  responsibility.
- Does NOT set an aesthetic anchor. The synth pass's eventual anchor is
  `gieskes.nl`; that direction lands in the synth pass, not here.

The shell's `feed/` convention (`<section-feature-feed-03>` in
`ADC_002_SECTION_MANIFEST_AND_ROUTING.md`) is available to the synth pass if it
wants to use it. The shell does not pre-populate any feed content for the stub.

**Open question (deferred to the synth pass):** Hosting model — Workers,
separate VPS, or pure static. This is explicitly out of scope for the shell
contract.

**Parity:**
- **Implementation Scope:** `src/pages/synth/index.astro`
- **Tests:**
  - `tests/stubs/synth.spec.js`

---

### [Feature: D&D stub] <stubs-feature-dnd-02>

**Status: SUPERSEDED (2026-07-10) by `<dnd-feature-landing-06>` in
`ADC_006_DND_TABLETOP.md`.** The D&D init pass landed; `/dnd/` is now the
section landing (still shell-framed, still links to `/dnd-tabletop/`, still
imports no section data models — the render test's requirements carry
forward unchanged).

v1.0 text (record): the D&D section mounted at `/dnd/` as a stub placeholder
analogous to the synth stub, linking to the preserved tool at
`/dnd-tabletop/` (never mounted under `/dnd/dnd-tabletop/`), pending a
future pass that would absorb, relocate, or replace the preserved tool.

**Parity:**
- **Implementation Scope:** `src/pages/dnd/index.astro`
- **Tests:**
  - `tests/stubs/stubs-render.spec.js`

---

### [Feature: Preserved /dnd-tabletop/ passthrough] <stubs-feature-dnd-tabletop-passthrough-03>

**Status: SUPERSEDED (2026-07-10) by `<dnd-feature-tool-route-01>` in
`ADC_006_DND_TABLETOP.md`.** The preservation era ended: the tool is now
first-party committed source at `public/dnd-tabletop/` (no build-time copy
step; the `dndTabletopPassthrough()` integration, the `.gitignore` staging
entry, and `_preserved-dnd-content/` were all removed per the removal map,
which is itself deleted). What survives as live contract in ADC_006: the
URL stays canonical at `/dnd-tabletop/` and the tool serves standalone,
never shell-wrapped.

v1.0 text (record): the preserved single-file tool was published verbatim
from `_preserved-dnd-content/dnd-tabletop/index.html` via a build-time
static-asset passthrough; the preserved `README.md` was not published;
enforcement was `<shell-test-url-preservation-04>`.

**Parity:**
- **Implementation Scope:** superseded — see `ADC_006_DND_TABLETOP.md`
- **Tests:**
  - `<dnd-test-url-continuity-01>` in `ADC_006_DND_TABLETOP.md`

---

### [Feature: Tools stub] <stubs-feature-tools-04>

The tools section mounts at `/tools/` and renders a stub placeholder page,
analogous to the synth and D&D stubs. The shell does not prescribe whether the
eventual tools section uses per-tool routes, a single page with embedded demos,
or some other pattern. That is the tools ADC pass's call.

**Parity:**
- **Implementation Scope:** `src/pages/tools/index.astro`
- **Tests:**
  - `tests/stubs/tools.spec.js`

---

### [TestScenario: Stub pages render and route] <stubs-test-stubs-render-01>

**Covers:** `<stubs-feature-synth-01>`, `<stubs-feature-dnd-02>`,
`<stubs-feature-tools-04>`

**Scenario.** Against the built site:

1. `GET /synth/` returns 200 and renders within the shell layout (nav present).
2. `GET /dnd/` returns 200 and renders within the shell layout (nav present).
3. `GET /dnd/` contains a link to `/dnd-tabletop/` (any anchor whose `href`
   matches `/dnd-tabletop/` or `/dnd-tabletop/index.html`).
4. `GET /tools/` returns 200 and renders within the shell layout (nav present).
5. None of the stub pages reference synth-specific, D&D-specific, or
   tool-specific data models, feed shapes, or UI patterns. (This is verified
   by absence: the stub source files contain only layout + placeholder copy.)

**Parity:**
- **Implementation Scope:** `tests/stubs/stubs-render.spec.js`
- **Tests:**
  - `tests/stubs/stubs-render.spec.js`

---

### [Reference: URL preservation TestScenario] <stubs-ref-url-preservation-01>

Superseded 2026-07-10: the binding test for the `/dnd-tabletop/` route is
now `<dnd-test-url-continuity-01>` in `ADC_006_DND_TABLETOP.md`
(`tests/shell/url-preservation.e2e.js`).

### [Reference: Future synth ADC pass] <stubs-ref-synth-future-01>

The synth section's full design — kanban project management, media/file
management, service notes, blog feed publishing, aesthetic anchor (`gieskes.nl`),
and hosting model — is the next ADC session after this one. The shell does not
constrain that pass beyond the mount point and the optional `feed/` convention.

### [Reference: Future D&D ADC pass] <stubs-ref-dnd-future-01>

Landed 2026-07-10 as `contracts/ADC_006_DND_TABLETOP.md`. The pass decided
to KEEP `/dnd-tabletop/` as the canonical URL and absorbed the tool as
first-party source with shared-table multiplayer.

### [Reference: Future tools ADC pass] <stubs-ref-tools-future-01>

The tools section's structure (per-tool routes vs. single-page demos vs.
something else) is a later ADC session. The shell does not pre-commit to a
pattern.

### [Reference: Future engine ADC pass] <stubs-ref-engine-future-01>

The WebGL engine that fills the homepage slot is a later ADC session. See
`<home-feature-engine-slot-02>` and `<home-impl-engine-interface-03>` in
`ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md` for the interface contract that pass
must conform to.
