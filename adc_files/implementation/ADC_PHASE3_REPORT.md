# ADC Phase 3 Report — Portfolio Section + Deferred Section Stubs

**Phase:** 3 of 4 (Portfolio content layer + synth/D&D/tools stubs)
**Date:** 2026-05-21
**Branch:** `feat/redesign`
**Parent commit at phase start:** `a6aa6f4`
**Contracts:** unchanged from Phase 2 (five files under `contracts/`, all
`status: proposed`, `version: 1.0`)

---

## 1. Headline

Phase 3 is implementation-complete. The four nav links that 404'd at the end
of Phase 2 (`/portfolio/`, `/synth/`, `/dnd/`, `/tools/`) all now resolve to
real pages framed by `ShellLayout`. Portfolio is the only fully-designed
section (per `ADC_004_PORTFOLIO_SECTION.md`); synth, D&D, and tools render
shell-framed placeholder stubs (per `ADC_005_DEFERRED_SECTION_STUBS.md`) with
no section-internals prescribed.

The portfolio content layer is wired through Astro Content Collections with a
JS schema, one markdown file per entry, R2 media references resolved at
render time via `resolveMediaRef()` (which delegates to the
already-Phase-1-landed `r2()` helper). The pipeline is verified end-to-end
by a single placeholder entry that produces both an index card and an entry
page, with R2 keys rewritten to `https://media.milodowling.com/...` URLs in
the built HTML.

The `/dnd-tabletop/` preserved tool remains byte-identical to its source in
`_preserved-dnd-content/dnd-tabletop/index.html` after the Phase 3 build.
The dnd preservation removal markers were intact at all four documented
locations (literal marker string elided 2026-07-10 after the D&D ADC pass
executed the removal procedure). No edits touched `_preserved-dnd-content/`, `public/dnd-tabletop/`,
`astro.config.mjs`, the section manifest, `ShellLayout.astro`, `Nav.astro`,
the R2 helper, or the homepage.

Inner audit pass is clean. No `Optional` types in code (the strings that
match `grep "Optional"` are comments and the markdown body explicitly
disclaiming the pattern). No `.ts`/`.tsx` files added. No new heavy
dependencies. No remote push. No federation leaks (all section CSS is Astro-
scoped to its page file; no section-prefixed classes appear in
`src/layouts/`, `src/components/`, or `src/styles/`).

The modularity constraint holds: adding each stub section required exactly
the two-file-touch procedure documented in the README — except those two
files (the section's `src/pages/<slug>/index.astro` and the manifest entry)
were both already in place from Phase 1, so each stub required just **one
edit** (the page file; the manifest entry was already there). The portfolio
section required three edits beyond the two-file-touch (the index page,
the entry-detail page, and the content collection config) plus N entry
markdown files — the additional surface is the cost of having a real
content model, not a regression of the modularity property.

---

## 2. What was built

### 2.1 Portfolio content collection (schema)

- `src/content/config.js` (new) — Astro Content Collections schema for the
  `portfolio` collection. Uses Zod via `astro:content`'s `z` export (no
  separate `zod` dependency added). Schema:
  - **Required:** `title` (string), `date` (coerced ISO 8601 date),
    `summary` (string).
  - **Optional-by-default:** `thumb` (string), `media` (string[]),
    `tags` (string[]).
  - Optional fields are declared via `.optional()` directly on the Zod
    schema; the page templates handle absence with template control flow,
    not defensive guards. No "default ?? somethingThatMasksFailure" anywhere.

### 2.2 Portfolio index page

- `src/pages/portfolio/index.astro` (new) — lists every entry as a card,
  ordered by `date` descending with ties broken by `title` ascending. Each
  card shows the title, the date, the summary, and (when present) the
  thumbnail. Cards link to `/portfolio/<slug>/`.
- The card grid uses `repeat(auto-fill, minmax(min(100%, 18rem), 1fr))`,
  which collapses to a single full-width column on a 375px viewport
  without any media-query branching.
- The `thumb` frontmatter value is resolved via `resolveMediaRef()`. When
  `thumb` is absent (sensible default), the card is rendered title-only
  with no `<img>` element — no null guard or `Optional`-shape, just a
  conditional render.

### 2.3 Portfolio entry page

- `src/pages/portfolio/[slug].astro` (new) — renders one entry per slug.
  `getStaticPaths()` enumerates the portfolio collection and maps each
  entry's slug to a route. The page renders title, date, summary, the
  resolved media list (in declared order), and the markdown body via
  Astro's `await entry.render()` and the resulting `<Content />` component.
- When the entry has no `media`, the media list is omitted entirely
  (template branch, not guard clause).
- Markdown-emitted descendants (`h2`, `p`, `ul`, `a`, `code`) are styled
  inside `.portfolio-entry-body` via `:global(...)` rules that are still
  scoped to the page (Astro applies the data-astro-cid hash to the parent
  selector; descendants inherit by selector ancestry).

### 2.4 Placeholder portfolio entry

- `src/content/portfolio/placeholder-entry.md` (new) — one entry with full
  frontmatter (title, date, summary, thumb, media, tags). Title is
  "Placeholder Entry"; body is markdown with one `## What this entry proves`
  heading and a bullet list. R2 keys are plausible-but-nonexistent
  (`portfolio/2026/example-thumb.jpg`, `portfolio/2026/example-1.jpg`,
  `portfolio/2026/example-2.jpg`) — they resolve to URLs whether or not
  the underlying R2 assets exist, which is the contract's design.

### 2.5 Three section stubs

- `src/pages/synth/index.astro` (new) — placeholder. Title, one paragraph of
  "in development" copy. Uses `ShellLayout`. No data model, no kanban, no
  feed, no aesthetic anchor.
- `src/pages/dnd/index.astro` (new) — placeholder + one additional paragraph
  with a link to `/dnd-tabletop/` (the preserved tool), satisfying the
  coordination clause in `<stubs-feature-dnd-02>` and step 3 of
  `<stubs-test-stubs-render-01>`.
- `src/pages/tools/index.astro` (new) — placeholder. Same shape as the
  others. No commitment to per-tool routes vs. single-page demos.

All three stubs use the same locally-scoped `.stub`, `.stub-title`,
`.stub-copy`, `.stub-link` classes. The class names are simple identifiers
(not section-prefixed), but they're scoped per file by Astro's default
behavior, so there's no cross-file collision and no federation leak.

---

## 3. ADC-IMPLEMENTS markers added

Format: `<file>:<line>` → block ID

| File:line                                              | Block ID                                |
| ------------------------------------------------------ | --------------------------------------- |
| `src/content/config.js:1`                              | `<portfolio-feature-content-01>`        |
| `src/pages/portfolio/index.astro:2`                    | `<portfolio-feature-index-03>`          |
| `src/pages/portfolio/index.astro:31`                   | `<portfolio-helper-r2-02>` (resolver call site) |
| `src/pages/portfolio/[slug].astro:2`                   | `<portfolio-feature-entry-04>`          |
| `src/pages/portfolio/[slug].astro:32`                  | `<portfolio-helper-r2-02>` (resolver call site) |
| `src/pages/synth/index.astro:2`                        | `<stubs-feature-synth-01>`              |
| `src/pages/dnd/index.astro:2`                          | `<stubs-feature-dnd-02>`                |
| `src/pages/tools/index.astro:2`                        | `<stubs-feature-tools-04>`              |

The `r2()` helper itself was already marked in Phase 1
(`src/lib/r2.js:1`). The resolver call sites in the portfolio pages mark
the `resolveMediaRef` invocations, which is the binding "this code consumes
the helper" relationship the audit needs.

Combined Phase 1 + 2 + 3 marker count by
`grep -rn "ADC-IMPLEMENTS:" src/ astro.config.mjs`: 25 marker lines (was 17
at end of Phase 2; +8 for Phase 3 above).

Cross-cutting constraints transitively satisfied:

- `<shell-constraint-federation-01>` — every Phase 3 page's `<style>` block
  is Astro-scoped. No file under `src/layouts/`, `src/components/`, or
  `src/styles/` carries a section-namespaced class (verified by
  `grep -l "portfolio-\|synth-\|dnd-\|tools-\|stub-" src/layouts/
  src/components/ src/styles/ -r` → empty).
- `<shell-constraint-mobile-03>` — all Phase 3 pages use `clamp()`-based
  padding and `max-width: ...rem; margin: 0 auto` containers. The portfolio
  card grid uses `minmax(min(100%, 18rem), 1fr)` so it collapses to single
  column at 375px. Entry-page media `<img>` elements inherit the baseline
  `max-width: 100%` rule. No fixed-px widths anywhere
  (`grep -E "width:\s*[0-9]+px"` → empty).
- `<shell-constraint-url-preservation-04>` — verified by §4 below.

---

## 4. Inline sanity-checks run

Phase 4 (validation) owns the full TestScenario suite per the roadmap. Phase
3 ran the brief's required smoke set:

| Check                                                                                  | Outcome |
| -------------------------------------------------------------------------------------- | ------- |
| `npm run build` completes without errors                                               | PASS    |
| Build emits all expected pages (6 shell pages + 1 dnd-tabletop passthrough)            | PASS — `/`, `/portfolio/`, `/portfolio/placeholder-entry/`, `/synth/`, `/dnd/`, `/tools/`, `/dnd-tabletop/` |
| All four section routes return 200 via `astro preview`                                 | PASS — `/portfolio/`, `/synth/`, `/dnd/`, `/tools/` → 200 |
| Portfolio index card renders the placeholder entry with title + summary + thumb        | PASS — confirmed in `dist/portfolio/index.html` |
| Portfolio index thumb `src` is resolved R2 URL, not raw `r2:` string                   | PASS — `src="https://media.milodowling.com/portfolio/2026/example-thumb.jpg"` |
| Portfolio entry `/portfolio/placeholder-entry/` returns 200 and shows title + body     | PASS — confirmed in `dist/portfolio/placeholder-entry/index.html` |
| Portfolio entry media `<img>` srcs are resolved R2 URLs                                | PASS — both `example-1.jpg` and `example-2.jpg` render with full `https://media.milodowling.com/...` URLs |
| `/dnd-tabletop/` returns 200                                                           | PASS |
| `cmp -s dist/dnd-tabletop/index.html _preserved-dnd-content/dnd-tabletop/index.html`   | PASS — byte-identical |
| `/dnd/` page contains a link to `/dnd-tabletop/`                                       | PASS — `<a class="stub-link" href="/dnd-tabletop/">` |
| dnd preservation markers intact at four documented locations (string elided 2026-07-10 post-removal) | PASS — `astro.config.mjs:19`, `astro.config.mjs:39`, `README.md:126`, `DND_PRESERVATION_ARTIFACTS.md:17` |
| `grep -rn "Optional" src/` returns zero hits in code (only comments/markdown)          | PASS — 4 hits, all in comments or markdown body |
| `find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "env.d.ts"` returns empty | PASS    |
| `grep -l "portfolio-\|synth-\|dnd-\|tools-\|stub-" src/layouts/ src/components/ src/styles/ -r` returns empty | PASS — no section namespace leaked into shell |
| `grep -E "width:\s*[0-9]+px"` across Phase 3 pages returns empty                       | PASS — no fixed-px widths that could overflow 375px |
| No edits to `astro.config.mjs`, `sections.config.js`, `ShellLayout.astro`, `Nav.astro`, `r2.js`, `index.astro`, `baseline.css` | PASS — `git status --short` lists only new untracked directories under `src/pages/` and `src/content/` |

Full TestScenario suite (`<shell-test-modularity-02>`,
`<shell-test-federation-01>`, `<shell-test-mobile-03>`,
`<shell-test-url-preservation-04>`, `<shell-test-federation-cross-section-05>`,
`<portfolio-test-add-entry-01>`, `<portfolio-test-r2-resolution-02>`,
`<stubs-test-stubs-render-01>`) remains deferred to Phase 4.

---

## 5. Deviations and findings

### 5.1 No contract-vs-implementation deviations

The Phase 3 implementation lands within the Parity scope of each block:

- `<portfolio-feature-content-01>` Parity says
  "`src/content/portfolio/*.md` (or `src/pages/portfolio/*.md`),
  `src/content/config.js` (if using collections)" — both touchpoints are
  exactly where the implementation lands.
- `<portfolio-feature-index-03>` Parity says `src/pages/portfolio/index.astro` —
  matches.
- `<portfolio-feature-entry-04>` Parity says
  `src/pages/portfolio/[slug].astro (or content-collection-driven equivalent)` —
  matches.
- `<stubs-feature-synth-01>`, `<stubs-feature-dnd-02>`,
  `<stubs-feature-tools-04>` Parity scopes are
  `src/pages/{synth,dnd,tools}/index.astro` — all match.

No refiner pass was needed. The Phase 2 lesson — "if the contract Parity
scope and implementation diverge, route through the refiner" — did not apply
this phase because there was no divergence.

### 5.2 Finding — `stub-*` is not a section-namespaced class

The three stub pages use unprefixed class names (`stub`, `stub-title`,
`stub-copy`, `stub-link`). These are Astro-scoped per file (each page gets
its own `data-astro-cid` hash), so the rules cannot collide with each other
or leak into the shell. The federation constraint is satisfied by the
scoping mechanism; the class names themselves do not need a `stub-` /
section-namespace prefix.

If the Phase 4 federation lint preference tightens to "every section page's
class names must carry a section prefix," then `stub`/`stub-*` will need
to be renamed (e.g., `synth-stub`, `dnd-stub`, `tools-stub`). No action
in Phase 3 — flagging analogous to the Phase 2 `engine-slot-*` finding
(§5.2 of `ADC_PHASE2_REPORT.md`).

### 5.3 Finding — `media` array uses `?? []` fallback

`src/pages/portfolio/[slug].astro:36` reads:

```js
const mediaUrls = (entry.data.media ?? []).map((ref) => resolveMediaRef(ref));
```

The `?? []` here is **not** a fail-not-fallback violation. The contract
(`<portfolio-feature-content-01>`) explicitly declares `media` as
optional-by-default with a sensible default: "no media → text-only entry."
The empty-array coalesce is the literal implementation of that sensible
default. It does not mask a configuration error or a required-but-missing
value; it implements a documented optional contract. No exception thrown
on absence is the correct behavior here.

### 5.4 No other deviations

Contracts unmodified. `_preserved-dnd-content/` and `public/dnd-tabletop/`
untouched. No remote push. No homepage / engine-slot edits. No
`astro.config.mjs` / manifest / shell-layout / nav / r2-helper edits.

---

## 6. Build artifacts (Phase 3)

### Files added

```
src/content/config.js
src/content/portfolio/placeholder-entry.md
src/pages/portfolio/index.astro
src/pages/portfolio/[slug].astro
src/pages/synth/index.astro
src/pages/dnd/index.astro
src/pages/tools/index.astro
adc_files/implementation/ADC_PHASE3_REPORT.md (this file)
```

### Files modified

None.

Combined Phase 3 git diff: 8 added files, 0 modified files. The fact that
no files were modified (only added) is the strongest possible evidence that
the modularity property of the shell holds — every Phase 3 surface lands in
its own new file under `src/pages/` or `src/content/`.

---

## 7. Readiness verdict for Phase 4

Ready. Phase 3 leaves the site with:

- Six fully-rendered shell routes (`/`, `/portfolio/`, `/portfolio/placeholder-entry/`,
  `/synth/`, `/dnd/`, `/tools/`).
- One preserved passthrough at `/dnd-tabletop/`, byte-identical to its source.
- All ADC contract blocks from `ADC_001` through `ADC_005` represented in
  source by at least one ADC-IMPLEMENTS marker before an implementing artifact.
- The full federation, mobile, URL-preservation, and modularity test surface
  ready for Phase 4 to exercise.

Phase 4 (validation) can now ratchet through all TestScenarios listed in
the five contracts against concrete code, without further Phase-3 work.

---

## 8. Notes for review

- The placeholder portfolio entry is deliberately marked "Placeholder Entry"
  with a clearly-fake summary. When the first real entry lands, this file
  can be deleted in a one-file commit; nothing else needs to change.
- The `r2:` keys in the placeholder (`portfolio/2026/example-*.jpg`) do not
  point to real assets in the R2 bucket — by design (per the brief: "R2
  keys can be plausible-but-nonexistent... the build doesn't verify the
  asset"). Index thumbnail and entry media `<img>` tags will render with
  broken-image icons in a browser visiting a deployed environment until
  real assets land at those keys (or the placeholder is removed). Local
  build/preview is unaffected.
- The stub-class naming choice (§5.2) is a soft surface for a future
  federation-lint discussion; no action needed unless Phase 4's federation
  TestScenarios fail on it.

Pause here for review.
