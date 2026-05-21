# ADC Phase 4 Report — TestScenarios as Runnable Tests

**Phase:** 4 of 4 (final implementation phase — runnable test infrastructure)
**Date:** 2026-05-21
**Branch:** `feat/redesign`
**Parent commit at phase start:** `4726654`
**Contracts:** five files under `contracts/` (all `version: 1.0`, promoted from `status: proposed` to `status: active` at the close of this phase)

---

## 1. Headline

Phase 4 lands every `[TestScenario]` block across the five contracts as a
runnable test. The test surface ships under `tests/`, is dispatched by
`npm test`, and uses two runners: **Vitest 4** for unit and
static-analysis tests, **Playwright 1.60** for browser-required tests.
The full suite is **61 Vitest tests across 10 spec files + 19 Playwright
tests across 4 e2e files = 80 tests, all passing, with zero retries and
no flake**.

One implementation gap surfaced and was fixed inline:
`src/lib/feed.js` (the generic feed loader covered by
`<section-test-feed-03>`) had been mentioned by both Phase 1 and Phase 2
reports as deferred to Phase 3 work but never landed; Phase 4 implemented
it from scratch so the TestScenario could be exercised. No contract edits
were required — the implementation hewed to the existing
`<section-feature-feed-03>` shape.

Audit pass is clean. All five contracts promoted from `proposed` to
`active`. ADC-IMPLEMENTS marker count: **54 cumulative** (26 in source
+ 28 in tests).

---

## 2. Test runner choice and rationale

Two runners, split by capability:

- **Vitest 4** — static analysis of built HTML/CSS, pure JS unit tests
  (R2 helper, feed loader), and build-orchestrated tests that mutate the
  source tree and inspect `dist/`. Fast (~22s for 61 tests), zero
  browser, no server. Uses `vi.stubEnv` to test the R2 helper's
  build-time env baking.

- **Playwright 1.60** — every TestScenario that needs a real browser:
  the 375px-viewport scrollWidth gate, the engine slot's canvas
  animation + pointer reactivity + swap proof, the HTTP fetch +
  content-decode for `/dnd-tabletop/` URL preservation. The `webServer`
  config block spins up `astro preview` automatically; tests against the
  production `dist/` output, not the dev server.

Why both: a single tool can technically cover everything (Playwright can
run plain assertions), but mixing browser-orchestration overhead into
fast unit tests would have lengthened the inner-loop dev cycle from
seconds to minutes for tests that don't need a DOM. The two-runner
split keeps the inner loop tight (Vitest watches `*.spec.js`) and
isolates browser cost to the e2e specs.

**File-naming convention enforces the split** so neither runner picks up
the other's specs:

- `*.spec.js` → Vitest only (`vitest.config.js` `include` pattern)
- `*.e2e.js` → Playwright only (`playwright.config.js` `testMatch`
  pattern)

**Both runners are dispatched by `npm test`** which runs
`npm run test:unit && npm run test:e2e`. The e2e script builds first to
guarantee Playwright reads a fresh `dist/`.

**Heavy-dep audit:** added two dev dependencies (`vitest`,
`@playwright/test`), per the brief's allowance. No other test
infrastructure or framework dependencies were added.

---

## 3. TestScenario coverage matrix

Every `[TestScenario]` block across the five contracts maps to one or
more concrete test files. Below: the scenario, the binding test file,
and the line where its primary assertion lives.

| TestScenario ID | Contract | Test file | Line(s) | Status |
| --- | --- | --- | --- | --- |
| `<shell-test-federation-01>` (section→shell CSS leak) | ADC_001 | `tests/shell/federation.spec.js` | 110 (sanity), 119 (homepage check), 128 (namespace check), 137 (other-route loop) | PASS |
| `<shell-test-federation-cross-section-05>` (section↔section CSS leak) | ADC_001 | `tests/shell/federation-cross-section.spec.js` | 94 (sanity A), 100 (sanity B), 106 (B→A absence), 112 (A→B absence), 118/124 (cross-section selector absence), 130 (portfolio spot-check) | PASS |
| `<shell-test-modularity-02>` (two-file-touch "writing" section) | ADC_001 | `tests/shell/modularity.spec.js` | 98 (nav-on-every-route), 113 (route renders), 119 (last in nav), 129 (exactly-two-files-touched), 156 (other sections unaffected), 168 (cleanup restores state) | PASS |
| `<shell-test-mobile-03>` (375px scrollWidth) | ADC_001 | `tests/shell/mobile.e2e.js` | 32 (per-route loop over 6 shell routes), 47 (documented `/dnd-tabletop/` exemption) | PASS |
| `<shell-test-url-preservation-04>` (`/dnd-tabletop/` HTTP-decoded content identity) | ADC_001 | `tests/shell/url-preservation.e2e.js` | 47 (200 on `/dnd-tabletop/`), 52 (200 on `/dnd-tabletop/index.html`), 57/66 (body equals preserved after LF normalize), 75 (no shell chrome) | PASS |
| `<section-test-manifest-01>` (manifest drives nav order + enabled) | ADC_002 | `tests/shell/manifest.spec.js` | 98 (order), 105 (Synth absence), 112 (still-routes when disabled), 121 (href shape) | PASS |
| `<section-test-routing-02>` (filesystem routing) | ADC_002 | `tests/shell/routing.spec.js` | 33 (`/portfolio/`), 40 (entry route), 48/53/58 (stubs), 64 (404 absence), 70 (shell-layout chrome present) | PASS |
| `<section-test-feed-03>` (feed loader ordered markdown) | ADC_002 | `tests/shell/feed.spec.js` | 60 (3 entries), 67 (lex order), 76 (shape), 85 (no-frontmatter case), 95 (no-shape validation), 103 (fail-not-fallback) | PASS |
| `<home-test-engine-interface-01>` (slot wired + swap proof) | ADC_003 | `tests/shell/engine-slot.e2e.js` | 42 (canvas exists), 48 (time-drives-pixels over 500ms), 103 (pointer-changes-pixels), 183 (swap proof: replace EngineSlot.jsx, rebuild on separate port, verify red hero) | PASS |
| `<home-test-mobile-degradation-02>` (engine at 375px, no errors) | ADC_003 | `tests/shell/engine-mobile.e2e.js` | 25 (no console/page errors), 49 (scrollWidth), 58 (canvas+overlay mount) | PASS |
| `<home-test-params-no-precedent-03>` (static grep for params.*) | ADC_003 | `tests/shell/engine-params-no-precedent.spec.js` | 66 (grep src/ for `params.X` and `params['X']` outside PlaceholderShader.jsx), 84 (EngineSlot.jsx forwards opaquely), 92 (Hero.astro mounts opaquely) | PASS |
| `<portfolio-test-add-entry-01>` (one-file add) | ADC_004 | `tests/portfolio/add-entry.spec.js` | 86 (no shell-files modified), 110 (date-descending position), 130 (R2-resolved thumbnail), 137 (entry route renders), 148 (media-order), 158 (text-only-entry case), 173 (text-only card has no img) | PASS |
| `<portfolio-test-r2-resolution-02>` (R2 helper) | ADC_004 | `tests/portfolio/r2.spec.js` | 30 (base+key), 35 (nested), 41 (slash normalization), 47 (returns string), 53 (fail-on-empty), 59 (fail-on-no-base), 71 (r2: prefix), 77 (nested prefix), 84 (absolute URLs untouched) | PASS |
| `<stubs-test-stubs-render-01>` (stubs render w/ shell layout, no internals) | ADC_005 | `tests/stubs/stubs-render.spec.js` | 35 (`/synth/`), 41 (`/dnd/`), 49 (D&D→tabletop link), 54 (`/tools/`), 90 (no internals in source) | PASS |

**Coverage: 14/14 TestScenarios bound. 80/80 individual test assertions
pass.**

---

## 4. Implementation gaps surfaced and fixed

### 4.1 `src/lib/feed.js` was missing

`<section-feature-feed-03>` (ADC_002:103-136) describes a generic feed
loader at `src/lib/feed.js`. The Phase 1 report stated the loader
"lands in Phase 3 alongside stub work" (ADC_PHASE1_REPORT.md:173-175).
Phase 3 did not ship it (Phase 3 report makes no reference to feed
implementation; only mentions that the synth stub has "no feed" as a
deferred-internals decision).

Without the loader, the bound TestScenario `<section-test-feed-03>`
could not be exercised. Fixed by implementing `src/lib/feed.js` (95
lines, JavaScript only, fail-not-fallback throws on missing-directory
and empty-feed cases, tolerant frontmatter parser that handles
no-frontmatter, partial-frontmatter, and arbitrary keys without
shape-validation). No contract edits — the implementation hewed to
the contract's locked signature `loadFeed(section) → Array<{ slug,
frontmatter, body }>` and lexicographic ordering.

**Added marker:** one new ADC-IMPLEMENTS in `src/lib/feed.js:1`
referencing `<section-feature-feed-03>`.

### 4.2 No other bugs found

The 14 TestScenarios all passed on first or second attempt against the
existing Phase 1–3 implementation. The only test-side adjustments
needed were unrelated to implementation:

- Federation tests: the CSS minifier emits `#00f` for `blue` (1 byte
  shorter than `blue`). The initial test regex only matched the
  keyword form; I broadened it to accept all three CSS forms (keyword,
  3-digit hex, 6-digit hex). This was a test-author oversight, not a
  contract or implementation issue.

- Stubs-render test: a too-broad string-include check tripped on the
  `kanban` token in a synth-stub *comment* that explicitly documents
  the deferral. I narrowed the check to non-comment, non-visible-copy
  regions of stub source via a `stripCommentsAndCopy()` helper. The
  intent of the contract's step 5 ("stub files contain only layout +
  placeholder copy") is about executable surface, not documentation —
  the refined check matches that intent.

- Portfolio add-entry text-only test: initial check used a literal
  string `"portfolio-entry-media"` to detect absence of the media
  block, but the page's inlined CSS *selector* contains that string
  even when the DOM element is absent. Changed to a DOM-element check
  (`<ul\b[^>]*\bportfolio-entry-media\b`). Implementation was correct;
  the test was over-strict.

### 4.3 No refiner-mediated contract edits

Zero contract edits this phase. Every TestScenario was implementable
as specified — the contracts were Phase-1-and-2-audit-clean and held
up under Phase-4 implementation pressure without further refinement.

---

## 5. Test infrastructure

### 5.1 New files

```
vitest.config.js                                         — Vitest config (serial, single-fork, 120s test timeout)
playwright.config.js                                     — Playwright config (serial workers=1, baseURL :4321, webServer)
tests/_helpers/build.js                                  — astroBuild(), readBuiltHtml(), extractStyles() shared helpers
tests/_helpers/tree.js                                   — manifest patcher, synthetic-page writer/remover, portfolio entry writer
tests/portfolio/r2.spec.js                               — <portfolio-test-r2-resolution-02>     (9 tests)
tests/portfolio/add-entry.spec.js                        — <portfolio-test-add-entry-01>         (7 tests)
tests/shell/feed.spec.js                                 — <section-test-feed-03>                (6 tests)
tests/shell/manifest.spec.js                             — <section-test-manifest-01>            (4 tests)
tests/shell/routing.spec.js                              — <section-test-routing-02>             (7 tests)
tests/shell/federation.spec.js                           — <shell-test-federation-01>            (7 tests)
tests/shell/federation-cross-section.spec.js             — <shell-test-federation-cross-section-05> (7 tests)
tests/shell/modularity.spec.js                           — <shell-test-modularity-02>            (6 tests)
tests/shell/engine-params-no-precedent.spec.js           — <home-test-params-no-precedent-03>    (3 tests)
tests/shell/engine-mobile.e2e.js                         — <home-test-mobile-degradation-02>     (3 tests)
tests/shell/engine-slot.e2e.js                           — <home-test-engine-interface-01>       (4 tests)
tests/shell/mobile.e2e.js                                — <shell-test-mobile-03>                (7 tests)
tests/shell/url-preservation.e2e.js                      — <shell-test-url-preservation-04>      (5 tests)
tests/stubs/stubs-render.spec.js                         — <stubs-test-stubs-render-01>          (5 tests)
src/lib/feed.js                                          — generic feed loader for <section-feature-feed-03>
```

### 5.2 Modified files

```
package.json     — added scripts: test, test:unit, test:e2e; added devDeps: vitest, @playwright/test
package-lock.json — npm lockfile update for the two new dev deps
.gitignore       — added test-results/ and playwright-report/ (Playwright output dirs)
contracts/ADC_001_SHELL_OVERVIEW.md          — status: proposed → active
contracts/ADC_002_SECTION_MANIFEST_AND_ROUTING.md — status: proposed → active
contracts/ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md     — status: proposed → active
contracts/ADC_004_PORTFOLIO_SECTION.md            — status: proposed → active
contracts/ADC_005_DEFERRED_SECTION_STUBS.md       — status: proposed → active
```

### 5.3 Serial execution constraints

Two reasons the suite runs serially:

- **Vitest:** several spec files mutate `src/` (modularity adds a
  `writing/` page + manifest entry; federation specs add synthetic
  `test-federation*/` pages; portfolio add-entry creates content
  files). Parallel file execution would race on the source tree.
  `fileParallelism: false` and a single fork (`forks: { singleFork:
  true }`) serialize execution at the cost of ~22s wall-clock.

- **Playwright:** the engine-slot swap test (step 4 of
  `<home-test-engine-interface-01>`) rewrites
  `src/components/EngineSlot.jsx` and re-runs `astro build`
  mid-suite, clobbering `dist/` that the suite-wide preview server
  reads. Parallel workers would race on `dist/`. `workers: 1`
  serializes execution at the cost of ~17s wall-clock.

Both wall-clock costs are acceptable for a static site of this size,
and serial execution is simpler than the alternative (per-test
ephemeral dist/ + per-test preview servers).

---

## 6. Contract status promotions

All five contracts promoted from `status: proposed` to `status: active`
at the close of Phase 4. `last_updated` is `2026-05-21` (today,
unchanged from Phase 2's refinement timestamp). `version` remains
`1.0` per the brief — status promotion is a state change, not a
version increment.

| Contract | Path | Before | After |
| --- | --- | --- | --- |
| Shell Overview | `contracts/ADC_001_SHELL_OVERVIEW.md` | proposed | **active** |
| Section Manifest | `contracts/ADC_002_SECTION_MANIFEST_AND_ROUTING.md` | proposed | **active** |
| Homepage + Engine Slot | `contracts/ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md` | proposed | **active** |
| Portfolio Section | `contracts/ADC_004_PORTFOLIO_SECTION.md` | proposed | **active** |
| Deferred Section Stubs | `contracts/ADC_005_DEFERRED_SECTION_STUBS.md` | proposed | **active** |

---

## 7. Cumulative ADC-IMPLEMENTS marker count

Phase 3 closed at **25 markers**. Phase 4 adds:

- **+1 source marker** in `src/lib/feed.js:1` (the new feed loader for
  `<section-feature-feed-03>`).
- **+28 test markers** across 14 test spec files + 2 config files
  (`vitest.config.js`, `playwright.config.js`) — every test file
  carries one or more ADC-IMPLEMENTS lines naming the TestScenario IDs
  it implements.

**Phase 4 cumulative total: 54 markers** (26 in `src/` + `astro.config.mjs`,
28 in `tests/` + `vitest.config.js` + `playwright.config.js`).

---

## 8. Audit / sanity checks

| Check | Result |
| --- | --- |
| `npm test` passes cleanly | PASS — 80/80 tests pass (61 Vitest + 19 Playwright), zero retries, two consecutive full runs both clean |
| `npm run build` clean | PASS — six pages built, no errors, no warnings |
| `find src tests -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name 'env.d.ts'` returns empty | PASS — zero TypeScript files added |
| `grep -rn 'params\.' src/ --include='*.js' --include='*.jsx' --include='*.astro'` returns hits only in PlaceholderShader.jsx | PASS — two hits, both in `src/components/engine/PlaceholderShader.jsx:44-45` (placeholder-only demonstration keys, explicitly allowed by `<home-constraint-params-no-precedent-05>`) |
| `grep -rn 'Optional' src/ tests/` returns hits only in comments | PASS — all four hits are in disclaimer comments (`src/content/config.js:12,17`, `src/pages/portfolio/[slug].astro:13`, `src/content/portfolio/placeholder-entry.md:29`) |
| `grep -rn 'try {' tests/` returns only paired with `finally` (no catch swallowing assertion failures) | PASS — three try blocks total: two in `engine-slot.e2e.js` (paired with finally for cleanup; no catch) and one in a polling helper (catch ECONNREFUSED while waiting for child server, explicit `throw` on timeout) |
| `grep -rn 'portfolio-\|synth-\|dnd-\|tools-\|writing-' src/layouts/ src/components/ src/styles/` returns empty | PASS — no section namespace leaked into shell scope |
| `_preserved-dnd-content/` mtime unchanged | PASS — directory untouched (git status confirms) |
| DND-PRESERVATION markers intact | PASS — all four markers still present (`astro.config.mjs:19`, `astro.config.mjs:39`, `README.md:126`, `adc_files/implementation/DND_PRESERVATION_ARTIFACTS.md:17`) |
| No `.github/workflows/` or CI service config added | PASS — none added (per the brief, deployment plumbing is out of scope for this phase) |
| `_preserved-dnd-content/dnd-tabletop/index.html` byte-identity after build (Phase 3 check) | PASS — preserved file byte-identical to its source; `<shell-test-url-preservation-04>` further verifies content-identity-after-HTTP-decode end-to-end |
| Every section route renders shell-layout chrome | PASS — verified by `tests/shell/routing.spec.js:70` over all four section routes |
| Mobile 375px gate clean across 6 shell routes | PASS — `tests/shell/mobile.e2e.js` exercises `/`, `/portfolio/`, `/portfolio/placeholder-entry/`, `/synth/`, `/dnd/`, `/tools/`; `/dnd-tabletop/` exempted per the contract |
| Engine swap proof: `EngineSlot.jsx` is the single file the engine pass touches | PASS — `tests/shell/engine-slot.e2e.js:183` replaces EngineSlot.jsx wholesale, rebuilds, verifies red div renders + shell chrome unchanged, restores |
| Federation: section CSS does not appear in shell HTML | PASS — `tests/shell/federation.spec.js` synthetic-section test verifies absence on `/`, `/portfolio/`, `/synth/`, `/dnd/`, `/tools/`. Cross-section variant verifies the same property pairwise. |
| Modularity: adding a section requires exactly the two documented touches | PASS — `tests/shell/modularity.spec.js:129` walks `src/` and verifies no file other than `src/pages/writing/index.astro` and `src/sections.config.js` mentions the `writing` slug |

---

## 9. What "done" looks like (re-asserted from the brief)

- [x] `npm test` passes cleanly on every TestScenario in every contract.
- [x] All five contracts at `status: active`, `version: 1.0`,
      `last_updated: 2026-05-21`.
- [x] Audit clean. ADC-IMPLEMENTS markers cover every implementable
      block (54 cumulative).
- [x] Phase 4 report (this file) written and committed.
- [x] Pause for user review. **Do not proceed to Step 5 (system
      evaluation).**

---

## 10. Things future phases inherit

- **Test infrastructure** is ready for incremental contract expansion. Adding a new TestScenario means dropping a new `tests/<scope>/<name>.spec.js` or `*.e2e.js` and (for static tests) optionally extending `_helpers/`.
- **Vitest fileParallelism is off.** If future phases add tests that don't mutate `src/`, they can opt into parallelism per-file with `vi.todo`-style annotations — but the cost of serial execution is small and the source-tree-mutation pattern recurs across many of the existing specs.
- **The engine-slot swap test rebuilds the project mid-suite.** Future engine-pass work that changes the swap surface must update `tests/shell/engine-slot.e2e.js:185-220` (the swap implementation source string) to keep the interface contract honest.
- **The dnd-tabletop URL preservation test reads `_preserved-dnd-content/` verbatim and compares against the served body after LF normalization.** A future D&D ADC pass that retires the preserved tool will need to retire this test alongside the `DND-PRESERVATION:` markers in the codebase.
- **The `writing` synthetic section in the modularity test is fully cleaned up in afterAll.** A future "real writing section" addition would NOT collide; the test reserves no slug.

---

## 11. Phase 4 summary

Five contracts. Fourteen TestScenarios. Eighty individual test
assertions. One small implementation gap (`src/lib/feed.js`) fixed
inline without contract drift. Two test runners, ~40 seconds end-to-end
for the full suite, zero retries. All five contracts promoted to
`active`.

The shell is now contract-bound, test-validated, and ready for the next
phase (system evaluation — explicitly out of scope for Phase 4).
