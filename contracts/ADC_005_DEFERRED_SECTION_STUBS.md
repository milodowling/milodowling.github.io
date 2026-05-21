---
contract_id: deferred-section-stubs-adc-005
title: "Deferred Section Stubs — Synth, D&D, Tools"
author: "Milo Dowling"
status: "active"
version: 1.0
created_date: "2026-05-20"
last_updated: "2026-05-21"
---

# Deferred Section Stubs

This contract specifies the mount points for the three sections whose internals
are deferred to future ADC passes: synth, D&D, and tools. Each stub is a
navigable placeholder page that future passes will fill in. The shell explicitly
does NOT prescribe internals (data model, feed shape, UI patterns, hosting
model) for these sections.

The D&D stub additionally encodes a hard URL-preservation contract for the
existing `/dnd-tabletop/` virtual-tabletop tool, which is live and shared with
friends and must keep serving across the rebuild.

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

The D&D section mounts at `/dnd/` and renders a stub placeholder page,
analogous to the synth stub: shell layout, "in development" copy, no
prescription of internals.

**Additionally**, the D&D stub coordinates with the URL-preservation contract:

- The stub page at `/dnd/` SHOULD link to `/dnd-tabletop/` so visitors who
  navigate to the D&D section can still reach the preserved virtual-tabletop
  tool.
- The preserved tool itself is published at `/dnd-tabletop/` per
  `<stubs-feature-dnd-tabletop-passthrough-03>` below. It is NOT mounted under
  `/dnd/dnd-tabletop/` — the original URL is preserved verbatim.

The D&D pass will eventually redesign the full section and may absorb,
relocate, or replace the preserved tool. Until then, the preserved tool
remains canonical at `/dnd-tabletop/`.

**Parity:**
- **Implementation Scope:** `src/pages/dnd/index.astro`
- **Tests:**
  - `tests/stubs/dnd.spec.js`

---

### [Feature: Preserved /dnd-tabletop/ passthrough] <stubs-feature-dnd-tabletop-passthrough-03>

The single-file virtual-tabletop tool at
`_preserved-dnd-content/dnd-tabletop/index.html` is published verbatim at
`/dnd-tabletop/`. This is a build-time static-asset passthrough, not a routed
page through the shell layout.

Implementation guidance:

- The build pipeline copies `_preserved-dnd-content/dnd-tabletop/` into the
  output directory at `dist/dnd-tabletop/` (or arranges an equivalent static
  passthrough via Astro's `public/` directory, a symlink, or a build script).
- The preserved tool is NOT wrapped in the shell layout. It served standalone
  on the Hugo site and must continue to do so.
- The preserved tool's `README.md` (`_preserved-dnd-content/dnd-tabletop/README.md`)
  is NOT published; only `index.html` is exposed at the public route.

This contract is enforced by the URL-preservation TestScenario
`<shell-test-url-preservation-04>` in `ADC_001_SHELL_OVERVIEW.md`.

**Parity:**
- **Implementation Scope:** `astro.config.mjs` (or `public/dnd-tabletop/` if used), build script
- **Configuration Scope:** `astro.config.mjs`
- **Tests:**
  - `<shell-test-url-preservation-04>` in `ADC_001_SHELL_OVERVIEW.md` covers
    this feature

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

The `/dnd-tabletop/` content-identity test is `<shell-test-url-preservation-04>`
in `ADC_001_SHELL_OVERVIEW.md`. It is the binding test for
`<stubs-feature-dnd-tabletop-passthrough-03>`.

### [Reference: Future synth ADC pass] <stubs-ref-synth-future-01>

The synth section's full design — kanban project management, media/file
management, service notes, blog feed publishing, aesthetic anchor (`gieskes.nl`),
and hosting model — is the next ADC session after this one. The shell does not
constrain that pass beyond the mount point and the optional `feed/` convention.

### [Reference: Future D&D ADC pass] <stubs-ref-dnd-future-01>

The D&D section's full redesign is a later ADC session. That pass decides
whether to keep `/dnd-tabletop/` as a separate URL or relocate the tool into a
redesigned D&D section structure. Until then, URL preservation holds.

### [Reference: Future tools ADC pass] <stubs-ref-tools-future-01>

The tools section's structure (per-tool routes vs. single-page demos vs.
something else) is a later ADC session. The shell does not pre-commit to a
pattern.

### [Reference: Future engine ADC pass] <stubs-ref-engine-future-01>

The WebGL engine that fills the homepage slot is a later ADC session. See
`<home-feature-engine-slot-02>` and `<home-impl-engine-interface-03>` in
`ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md` for the interface contract that pass
must conform to.
