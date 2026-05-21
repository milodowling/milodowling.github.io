# milodowling.com

Personal site shell. Astro + React islands, deployed on Cloudflare Pages with
media on Cloudflare R2.

The site is governed by Agent Design Contracts (ADCs) under `contracts/`. The
contracts are the source of truth; this README documents the operating
procedures that the contracts assume exist.

## Stack

- **Framework:** [Astro](https://astro.build) with React islands.
  JavaScript by default; TypeScript is permitted but not required.
- **Hosting:** Cloudflare Pages (static).
- **Media:** Cloudflare R2 via the helper at `src/lib/r2.js`. Media is
  referenced by R2 key, never by hard-coded bucket URL.
- **Domain:** `milodowling.com` (target) and `milodowling.github.io`
  (fallback).

## Local development

```sh
npm install
npm run dev      # local Astro dev server
npm run build    # produce ./dist/
npm run preview  # serve ./dist/ locally
```

The dev server stages the preserved `/dnd-tabletop/` tool from
`_preserved-dnd-content/` into `public/` automatically (see the
`dndTabletopPassthrough` integration in `astro.config.mjs`). Do not edit
files under `_preserved-dnd-content/` or `public/dnd-tabletop/` — the
preserved tool is read-only and managed by the build.

## Adding a section

This is the documented two-file-touch procedure that the shell modularity
constraint (`<shell-constraint-modularity-02>` in
`contracts/ADC_001_SHELL_OVERVIEW.md`) is built around. Adding a section
must require only the two touches below. If you find yourself editing
shell layouts, the nav component, or routing internals, stop — the
modularity constraint has regressed.

### Procedure (two edits, no more)

1. Create the section's page directory and at least one page:

    ```sh
    mkdir -p src/pages/<slug>
    cat > src/pages/<slug>/index.astro <<'EOF'
   ---
   import ShellLayout from "../../layouts/ShellLayout.astro";
   ---
   <ShellLayout title="<Label> — milodowling.com">
     <h1><Label></h1>
   </ShellLayout>
   EOF
    ```

2. Add one entry to `src/sections.config.js`:

   ```js
   { slug: "<slug>", label: "<Label>", enabled: true },
   ```

That's the entire procedure. The nav reads the manifest and renders the new
section. Astro's filesystem routing serves `/<slug>/` from the page file.

### Manifest fields

| Field     | Type    | Meaning                                                     |
| --------- | ------- | ----------------------------------------------------------- |
| `slug`    | string  | Lowercase, URL-safe. Must match the directory name.         |
| `label`   | string  | Free-form. Shown in navigation.                             |
| `enabled` | boolean | `false` hides the section from nav (route stays reachable). |

The shell's nav code reads only these three fields. Sections may carry
additional metadata on their manifest entry, but that metadata is invisible
to the shell.

## Engine slot (forward-compat note)

The homepage exposes a single React-island mount point at
`src/components/EngineSlot.jsx` with the locked interface
`{time, pointer, params}` (see `<home-impl-engine-interface-03>` in
`contracts/ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md`). The eventual WebGL+JS
video engine swaps this one file. Shell code does not change.

The v1 placeholder shader (lands in Phase 2) is deliberately ugly and
non-suggestive — it proves the wiring works without prejudicing the
engine's eventual aesthetic.

## R2 media

The R2 helper at `src/lib/r2.js` resolves R2 object keys to public URLs:

```js
import { r2 } from "../lib/r2.js";
const url = r2("portfolio/2026/hero.jpg");
// → "https://media.milodowling.com/portfolio/2026/hero.jpg"
```

The base URL comes from the `R2_PUBLIC_BASE` env var (see `.env.example`)
and is baked into the static build.

In portfolio markdown frontmatter, use the `r2:` prefix:

```yaml
thumb: "r2:portfolio/2026/thumb.jpg"
media:
  - "r2:portfolio/2026/image-1.jpg"
```

The portfolio entry/index pages resolve `r2:`-prefixed values via the helper.

## Preserved `/dnd-tabletop/`

The single-file virtual-tabletop tool at
`_preserved-dnd-content/dnd-tabletop/index.html` is published verbatim at
`/dnd-tabletop/`. This is a hard URL-preservation contract
(`<shell-constraint-url-preservation-04>` in
`contracts/ADC_001_SHELL_OVERVIEW.md`) — the URL was shared with friends
before the rebuild and must keep serving.

Implementation artifacts specifically supporting this preservation are
flagged with `DND-PRESERVATION: remove when D&D ADC init pass lands` and
enumerated in `adc_files/implementation/DND_PRESERVATION_ARTIFACTS.md`.
The future D&D ADC pass will redesign the section and remove these
artifacts cleanly.

## Repository layout

```
contracts/              ADC contracts (source of truth)
adc_files/              ADC workflow artifacts (audits, refinements, impl)
docs/                   Original design-session inputs
_preserved-dnd-content/ Read-only preserved D&D content
src/
  layouts/              ShellLayout.astro
  components/           Nav.astro, EngineSlot.jsx (Phase 2)
  pages/                Filesystem-routed pages
  lib/                  r2.js, feed.js (Phase 3)
  styles/               baseline.css
  sections.config.js    The section manifest
public/                 Static passthrough (build-managed)
```

## Deploy (Cloudflare Pages)

Cloudflare Pages is configured to:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20+ (set via the Pages dashboard environment).
- Environment variables: `R2_PUBLIC_BASE` (see `.env.example`).

Pages deploys on push to `main`. The `feat/redesign` branch deploys as a
preview environment.

## Contracts

The shell is governed by five contracts under `contracts/`:

- `ADC_001_SHELL_OVERVIEW.md` — stack, cross-cutting constraints, federation.
- `ADC_002_SECTION_MANIFEST_AND_ROUTING.md` — manifest + filesystem routing.
- `ADC_003_HOMEPAGE_AND_ENGINE_SLOT.md` — hero + engine slot interface.
- `ADC_004_PORTFOLIO_SECTION.md` — portfolio content model + R2 helper.
- `ADC_005_DEFERRED_SECTION_STUBS.md` — synth/D&D/tools stubs.

Implementation phase reports live under `adc_files/implementation/`.
