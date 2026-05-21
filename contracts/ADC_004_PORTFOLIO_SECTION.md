---
contract_id: portfolio-section-adc-004
title: "Portfolio Section — Content Model, R2 Media, and Presentation"
author: "Milo Dowling"
status: "active"
version: 1.0
created_date: "2026-05-20"
last_updated: "2026-05-21"
---

# Portfolio Section

Portfolio is the only fully-designed section in this pass. It is the change-cadence
hot zone — entries get added often — so its contract is split from the more
stable shell contracts. This contract specifies the content model, how media
references resolve to Cloudflare R2, and the index + entry presentation.

---

### [Rationale: Why portfolio is fully designed now] <portfolio-rationale-01>

Portfolio is the lowest-risk section to fully design in v1: its content shape
(work items with media + descriptive text) is well understood and stable.
Specifying it now proves the section-pattern works end-to-end (modular mount +
content authoring + media via R2) before the higher-risk sections (synth, the
engine) come online.

The load-bearing test of portfolio is **author ergonomics**: adding a portfolio
entry must be a single-markdown-file operation. If authoring becomes a multi-file
ceremony, the design has regressed.

---

### [Feature: Portfolio content model] <portfolio-feature-content-01>

Each portfolio entry is **one markdown file**. The file lives under a content
root the section owns (suggested: `src/content/portfolio/<slug>.md` using
Astro's content collections, or `src/pages/portfolio/<slug>.md` if a flatter
shape is preferred — the implementer chooses, but the constraint "one file per
entry" is locked).

**Required frontmatter fields:**

- `title` (string) — entry title
- `date` (ISO 8601 date string) — used for ordering on the index page
- `summary` (string) — short description used on the index card

**Optional-by-default frontmatter fields:** (these have sensible defaults; the
author may omit them entirely)

- `thumb` (string) — R2 key for the index thumbnail. When omitted, the index
  card shows the entry's title typography only.
- `media` (array of R2 keys) — ordered list of media to display on the entry
  page. When omitted, the entry renders text-only.
- `tags` (array of strings) — for future filtering. The v1 index does not
  filter on tags; this is forward-compat.

**Body.** Standard markdown. Renders on the entry page below the media.

**Ordering.** The portfolio index lists entries by `date` descending. Ties
break by `title` ascending.

**The shell does not impose Optional types or null checks.** Defaults are
sensible (no thumb → text-only card; no media → text-only entry; no tags →
no filtering). Authors get the simplest possible authoring path.

**Parity:**
- **Implementation Scope:** `src/content/portfolio/*.md` (or `src/pages/portfolio/*.md`), `src/content/config.js` (if using collections)
- **Tests:**
  - `tests/portfolio/content.spec.js`
  - See `<portfolio-test-add-entry-01>`

---

### [Feature: R2 media helper] <portfolio-helper-r2-02>

The shell exposes a helper that resolves an R2 key to a public URL. The helper
is the only sanctioned way for section content to reference R2 media — sections
must not hard-code R2 bucket URLs in markdown.

**Locked signature.** The helper returns a **string URL**, not a component.
Portfolio entries author with `.md` files using a templating/frontmatter
convention (e.g., the `r2:` frontmatter prefix described below) to reference
R2 URLs via the helper. The component-returning alternative is dropped from the
v1 contract.

```js
import { r2 } from "@shell/r2";
const url = r2("portfolio/2026/project-x-hero.jpg");
// → "https://media.milodowling.com/portfolio/2026/project-x-hero.jpg"
```

The base URL (`https://media.milodowling.com` or whatever R2 public hostname is
configured) lives in shell configuration; entries reference keys only.

**Why string-returning, not component-returning.** A string URL is usable from:

- Frontmatter values (via a build-time transform that resolves `r2:` prefixed
  values), which keeps the "one markdown file per entry" constraint clean.
- MDX/Astro templates (`<img src={r2("...")} />`) for sections that author in
  templates rather than pure markdown.
- The feed convention (`<section-feature-feed-03>`) without imposing a
  component dependency on synth's eventual feed renderer.

A component-returning helper would force entries that reference R2 media to be
authored in MDX/Astro rather than pure `.md`, which conflicts with the
portfolio's "single markdown file per entry" constraint. The shell picks the
authoring-ergonomics direction.

**Future-extension path (not part of v1).** If a future section's ADC pass
requires responsive images, art direction, or lazy-loading wired through a
component, the helper MAY be extended to expose an *additional* component
variant alongside the string return (e.g., `r2.image(key)` returns a JSX
component while `r2(key)` continues to return a string). v1 ships string-only;
the TestScenario covers string-return. A component variant is out of scope
unless and until a section's ADC pass explicitly requests it, and when added
it must extend — not replace — the string signature locked above.

**Build-time resolution.** When the helper is used in frontmatter (e.g.,
`thumb: r2:portfolio/2026/thumb.jpg`), the build pipeline rewrites the value to
the resolved URL before render. This is a build concern, not a runtime concern;
the implementer chooses how (a remark plugin, a content-collection transform,
or an explicit author convention like calling `r2()` in the page template).

**Parity:**
- **Implementation Scope:** `src/lib/r2.js`, `astro.config.mjs` (env config), `src/content/config.js` (frontmatter transform if used)
- **Configuration Scope:** `.env` (`R2_PUBLIC_BASE`), `wrangler.toml` (if R2 bucket binding is used at build time)
- **Tests:**
  - `tests/portfolio/r2.spec.js`
  - See `<portfolio-test-r2-resolution-02>`

---

### [Feature: Portfolio index page] <portfolio-feature-index-03>

The portfolio index at `/portfolio/` lists all entries as cards, ordered by
`date` descending. Each card shows:

- The entry `title`
- The entry `summary`
- The thumbnail (resolved via the R2 helper from the entry's `thumb` key, if
  present)
- A link to `/portfolio/<slug>/`

The index does NOT paginate in v1. If entry count exceeds a reasonable bound
(say, 50), a future pass adds pagination. The shell does not pre-impose that.

**Parity:**
- **Implementation Scope:** `src/pages/portfolio/index.astro`
- **Tests:**
  - `tests/portfolio/index.spec.js`

---

### [Feature: Portfolio entry page] <portfolio-feature-entry-04>

Each portfolio entry serves at `/portfolio/<slug>/` where `<slug>` is derived
from the markdown filename. The entry page renders:

- The entry `title`
- The entry `date`
- The `media` array (each item resolved via the R2 helper), in declared order
- The markdown body

The entry page uses the shell layout for consistency with other sections.

**Parity:**
- **Implementation Scope:** `src/pages/portfolio/[slug].astro` (or content-collection-driven equivalent)
- **Tests:**
  - `tests/portfolio/entry.spec.js`
  - See `<portfolio-test-add-entry-01>`

---

### [TestScenario: Adding a portfolio entry is one-file] <portfolio-test-add-entry-01>

**Covers:** `<portfolio-feature-content-01>`, `<portfolio-feature-index-03>`,
`<portfolio-feature-entry-04>`

**Scenario.** Add a new portfolio entry by creating a single file
`src/content/portfolio/test-entry.md` (or equivalent path per the chosen
content-collection layout) with:

```markdown
---
title: "Test Entry"
date: "2026-05-20"
summary: "A test portfolio entry."
thumb: "r2:portfolio/test/thumb.jpg"
media:
  - "r2:portfolio/test/image-1.jpg"
  - "r2:portfolio/test/image-2.jpg"
---

This is the entry body.
```

No other files are touched. Build and verify:

1. The git diff contains exactly one new file.
2. `/portfolio/` includes a card for "Test Entry" in date-descending position.
3. The card shows the thumbnail with `src` resolved to the configured R2 base
   URL.
4. `/portfolio/test-entry/` returns 200 and renders the title, date, both
   media items in order, and the body.
5. No shell-level files are modified.

Also verify the no-media case: create `src/content/portfolio/text-only.md`
with only the required fields. Verify `/portfolio/text-only/` renders without
errors and without a media block (no `Optional`-type errors or null guards
required — sensible defaults handle the absence).

**Parity:**
- **Implementation Scope:** `tests/portfolio/add-entry.spec.js`
- **Tests:**
  - `tests/portfolio/add-entry.spec.js`

---

### [TestScenario: R2 helper resolves keys to URLs] <portfolio-test-r2-resolution-02>

**Covers:** `<portfolio-helper-r2-02>`

**Scenario.** With `R2_PUBLIC_BASE=https://media.example.test` configured:

1. `r2("foo/bar.jpg")` returns `"https://media.example.test/foo/bar.jpg"`.
2. `r2("portfolio/2026/x.png")` returns
   `"https://media.example.test/portfolio/2026/x.png"`.
3. Frontmatter values prefixed `r2:` are transformed at build time to the
   resolved URL (e.g., `thumb: "r2:foo.jpg"` becomes
   `thumb: "https://media.example.test/foo.jpg"` in the rendered output).
4. A page that consumes a resolved URL renders an `<img>` whose `src` matches
   the expected URL.
5. The helper returns a string in all cases (no component-return variant in
   v1).

**Parity:**
- **Implementation Scope:** `tests/portfolio/r2.spec.js`
- **Tests:**
  - `tests/portfolio/r2.spec.js`

---

### [Reference: Cross-cutting constraints] <portfolio-ref-cross-cutting-01>

Portfolio pages must satisfy the shell's cross-cutting constraints from
`contracts/ADC_001_SHELL_OVERVIEW.md`:

- `<shell-constraint-federation-01>` — portfolio styles must not leak to shell
  or other sections. Bound by `<shell-test-federation-01>` (section → shell)
  and `<shell-test-federation-cross-section-05>` (section → other-section).
- `<shell-constraint-mobile-03>` — `/portfolio/` and each entry page must
  render cleanly at 375px viewport. Bound by `<shell-test-mobile-03>`.
