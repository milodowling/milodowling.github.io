# ADC Phase 1 Report — Foundations

**Phase:** 1 of 4 (Foundations)
**Date:** 2026-05-21
**Branch:** `feat/redesign`
**Parent commit at phase start:** `afd6149`
**Contracts:** five files under `contracts/`, all `status: proposed`, `version: 1.0`

---

## 1. Headline

Phase 1 is implementation-complete. The Astro + React shell scaffold builds
cleanly to a static placeholder, the section-manifest-driven nav is live, the
R2 helper resolves keys to URLs with fail-loud validation, and the
`/dnd-tabletop/` preservation passthrough produces a byte-identical copy of
the preserved tool in `dist/dnd-tabletop/index.html`.

Inner audit pass is clean. All Phase 1-scope contract blocks have
ADC-IMPLEMENTS markers. No deferred-subsystem internals were designed. No
`Optional` types. No defensive guard clauses. No `--no-verify`. No remote
push. Preserved D&D content untouched.

Phase 4 TestScenarios are deferred to the Phase 4 validation pass per the
roadmap. Ad-hoc smoke verification of the R2 helper and the DND passthrough
ran inline.

---

## 2. What was built

### 2.1 Project scaffolding

- `package.json` — declares the project as an ES-module Astro app with React
  islands. Pinned major versions: Astro 4.x, React 18.x, `@astrojs/react`.
  No TypeScript (per project preference). No build adapter (static-output
  Cloudflare Pages doesn't need `@astrojs/cloudflare` — that adapter is for
  SSR/Workers, which the shell does not need).
- `astro.config.mjs` — `output: "static"`, React integration, and the inline
  `dndTabletopPassthrough()` integration. R2 base URL is build-time injected
  via `vite.define` so the helper resolves to a baked string in the static
  output.
- `.env.example` — documents `R2_PUBLIC_BASE`.
- `.gitignore` — extended for build artifacts and the build-staged
  `public/dnd-tabletop/` copy (the canonical source stays in
  `_preserved-dnd-content/`).

### 2.2 Section pattern

- `src/sections.config.js` — the manifest. Four entries in nav order:
  `portfolio`, `synth`, `dnd`, `tools`, all `enabled: true`.
- `src/components/Nav.astro` — reads the manifest, filters to
  `enabled: true`, renders one `<a href="/<slug>/">` per entry with
  `aria-current="page"` on the active route. Reads only the three documented
  fields (`slug`, `label`, `enabled`).
- `src/layouts/ShellLayout.astro` — shell chrome (header + nav, main slot,
  footer). Sections opt in by importing. Scoped styles confined to
  shell-namespaced (`shell-` prefix) classes.
- `src/styles/baseline.css` — minimal reset + tokens, all `shell-` prefixed
  or scoped via `:where()` for zero specificity weight. `body { overflow-x:
  hidden }` as the mobile safety net.

### 2.3 R2 helper

- `src/lib/r2.js` — `r2(key)` returns a string URL. Throws on empty key or
  empty base. Also exports `resolveMediaRef(value)` which transparently
  handles both plain URLs and `r2:`-prefixed frontmatter values. Build-time
  base URL injection means the helper resolves to a baked string in the
  static output.

### 2.4 Cloudflare Pages build/deploy posture

- Astro static output goes to `dist/`. Cloudflare Pages dashboard
  configuration (set out-of-band; documented in README): build command
  `npm run build`, build output `dist`, Node 20+, env var `R2_PUBLIC_BASE`.
- Phase 1 placeholder homepage at `src/pages/index.astro` exists solely so
  the build produces a deployable artifact. It will be replaced in Phase 2.

### 2.5 README — add-a-section procedure

- `README.md` — documents the locked two-file-touch procedure
  (`src/pages/<slug>/index.astro` + one `src/sections.config.js` entry),
  stack, dev/build commands, R2 usage, engine-slot forward-compat note, and
  the `/dnd-tabletop/` preservation note. This is the procedure that
  `<shell-test-modularity-02>` (Phase 4) verifies.

### 2.6 DND preservation

- `astro.config.mjs` — inline `dndTabletopPassthrough()` integration copies
  `_preserved-dnd-content/dnd-tabletop/index.html` into `public/dnd-tabletop/`
  (dev) and `dist/dnd-tabletop/` (build). Only `index.html` is copied; the
  preserved `README.md` is NOT published, per
  `<stubs-feature-dnd-tabletop-passthrough-03>`.
- `adc_files/implementation/DND_PRESERVATION_ARTIFACTS.md` — the load-bearing
  enumeration of every artifact tied to `/dnd-tabletop/` preservation, plus
  the removal procedure for the future D&D ADC init pass. Every flagged
  artifact carries the grep-able `DND-PRESERVATION: remove when D&D ADC init
  pass lands` marker.

---

## 3. ADC-IMPLEMENTS markers added

Format: `<file>:<line>` → block ID

| File:line                             | Block ID                                       | Notes |
| ------------------------------------- | ---------------------------------------------- | ----- |
| `astro.config.mjs:8`                  | `<shell-impl-stack-01>`                        | File-level marker on the build config that implements the stack. |
| `astro.config.mjs:13`                 | `<stubs-feature-dnd-tabletop-passthrough-03>`  | File-level marker on the integration declaration. |
| `astro.config.mjs:41`                 | `<stubs-feature-dnd-tabletop-passthrough-03>`  | Marker immediately before the `dndTabletopPassthrough()` function. |
| `src/sections.config.js:1`            | `<section-feature-manifest-01>`                | File-level marker on the manifest file. |
| `src/components/Nav.astro:2`          | `<section-feature-manifest-01>`                | Marker on the manifest consumer. |
| `src/layouts/ShellLayout.astro:2`     | `<section-feature-routing-02>`                 | Marker on the shell layout (the routing-shape implementation). |
| `src/lib/r2.js:1`                     | `<portfolio-helper-r2-02>`                     | Marker on the R2 helper module. |
| `src/styles/baseline.css:2`           | `<shell-constraint-federation-01>`             | Marker on the baseline/reset that defines the federation seam. |
| `src/styles/baseline.css:~62`         | `<shell-constraint-mobile-03>`                 | Marker on the `overflow-x: hidden` mobile safety-net rule. |

Markers were placed immediately before the implementing artifact per schema
§4. For multi-block files (`astro.config.mjs`), each block has its own
co-located marker.

Cross-cutting Constraints that are satisfied transitively (no direct marker,
satisfied by Feature implementations that DO carry markers):

- `<shell-constraint-modularity-02>` — satisfied by
  `<section-feature-manifest-01>` (manifest + Nav) and README procedure.
- `<shell-constraint-url-preservation-04>` — satisfied by
  `<stubs-feature-dnd-tabletop-passthrough-03>` build-side passthrough.

Phase 4 TestScenarios bind these constraints to verifiable assertions.

---

## 4. Tests run and outcomes

Phase 4 (validation) owns the full TestScenario suite per the roadmap. Phase
1 ran only ad-hoc smoke checks to confirm the scaffold works:

| Check                                                        | Outcome |
| ------------------------------------------------------------ | ------- |
| `npm install` completes without errors                       | PASS    |
| `npm run build` completes without errors                     | PASS    |
| `dist/index.html` is produced                                | PASS    |
| `dist/dnd-tabletop/index.html` is byte-identical to `_preserved-dnd-content/dnd-tabletop/index.html` (`cmp -s`) | PASS    |
| `public/dnd-tabletop/index.html` is byte-identical to the preserved source | PASS    |
| Manifest-driven nav renders four sections in declared order in `dist/index.html` | PASS    |
| R2 helper smoke (`r2("foo/bar.jpg")` with `R2_PUBLIC_BASE` set) returns expected URL | PASS    |
| R2 helper throws loudly on empty key                         | PASS    |
| `grep -n "ADC-IMPLEMENTS:" src/ astro.config.mjs` lists nine markers covering all Phase 1-scope blocks | PASS    |
| `grep "Optional"` across src — zero hits                     | PASS    |
| `grep "DND-PRESERVATION"` is grep-able and lists every flagged artifact | PASS    |

Full TestScenario suite (`<shell-test-federation-01>`,
`<shell-test-federation-cross-section-05>`, `<shell-test-modularity-02>`,
`<shell-test-mobile-03>`, `<shell-test-url-preservation-04>`,
`<home-test-engine-interface-01>`, `<home-test-mobile-degradation-02>`,
`<home-test-params-no-precedent-03>`, `<portfolio-test-add-entry-01>`,
`<portfolio-test-r2-resolution-02>`, `<stubs-test-stubs-render-01>`,
`<section-test-manifest-01>`, `<section-test-routing-02>`,
`<section-test-feed-03>`) is Phase 4 work. Phase 1 does not implement them.

---

## 5. Unresolved deviations

None.

Items intentionally deferred to later phases per the roadmap (not deviations):

- The hero homepage and engine slot — deferred to Phase 2 per
  `<home-feature-homepage-01>` / `<home-feature-engine-slot-02>`. Phase 1
  ships a placeholder homepage solely to make `dist/` deployable.
- The feed loader at `src/lib/feed.js` (`<section-feature-feed-03>`) —
  consumed only by future synth/D&D passes; not required by Phase 1's
  "filesystem routing skeleton" item. Lands in Phase 3 alongside stub work
  if any current section needs it (none do).
- Portfolio content layer (`<portfolio-feature-content-01>`,
  `<portfolio-feature-index-03>`, `<portfolio-feature-entry-04>`) and stubs
  (`<stubs-feature-synth-01>`, `<stubs-feature-dnd-02>`,
  `<stubs-feature-tools-04>`) — Phase 3.
- All TestScenario implementations — Phase 4.
- Contract `status` transitions from `proposed` to `active` — Phase 4 end,
  per the roadmap's explicit instruction.

---

## 6. Readiness verdict for Phase 2

Ready. The engine-slot work in Phase 2 has a clean place to land: it adds
`src/components/Hero.astro`, `src/components/EngineSlot.jsx`, and
`src/shaders/placeholder.frag.glsl`, and replaces the contents of
`src/pages/index.astro`. The shell layout, baseline styles, nav, and section
manifest are all in place and federation-clean — Phase 2 does not need to
modify any of them.

The locked `{time, pointer, params}` interface from
`<home-impl-engine-interface-03>` is the only API surface Phase 2 needs to
implement. The `<home-constraint-params-no-precedent-05>` constraint (no
shell-side reads of placeholder `params` keys) is a Phase 2 design discipline
constraint — verifiable in Phase 4 via the static-analysis assertion in
`<home-test-params-no-precedent-03>`.

---

## 7. Build artifacts (for review)

```
package.json
astro.config.mjs
.env.example
.gitignore                                       (extended)
README.md                                        (new — add-a-section procedure)
src/
  sections.config.js
  styles/baseline.css
  layouts/ShellLayout.astro
  components/Nav.astro
  lib/r2.js
  pages/index.astro                              (Phase 1 placeholder)
adc_files/implementation/
  ADC_PHASE1_REPORT.md                           (this file)
  DND_PRESERVATION_ARTIFACTS.md
```

Pause here for review.
