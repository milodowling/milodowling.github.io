# DND Preservation Artifacts

This document enumerates every file and line in the implementation that exists
only to satisfy the temporary `/dnd-tabletop/` URL-preservation contract
(`<shell-constraint-url-preservation-04>` in `contracts/ADC_001_SHELL_OVERVIEW.md`
and `<stubs-feature-dnd-tabletop-passthrough-03>` in
`contracts/ADC_005_DEFERRED_SECTION_STUBS.md`).

The future D&D ADC init pass will redesign the D&D section and decide whether
to keep `/dnd-tabletop/` as a separate URL or relocate the tool. When that
pass lands, every artifact listed below SHOULD be evaluated for removal so the
preserved tool can be cleanly absorbed.

All flagged code carries the inline marker:

```
DND-PRESERVATION: remove when D&D ADC init pass lands
```

The marker is grep-able from the repo root.

## Artifacts (Phase 1)

| File                                       | Lines / range          | What it does                                                                                                                                              |
| ------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `astro.config.mjs`                         | Header comment block   | Declares the inline `dndTabletopPassthrough()` integration as DND-preservation infrastructure.                                                            |
| `astro.config.mjs`                         | `dndTabletopPassthrough()` function | Inline Astro integration that copies `_preserved-dnd-content/dnd-tabletop/index.html` into `public/dnd-tabletop/` (dev) and `dist/dnd-tabletop/` (build). |
| `astro.config.mjs`                         | `integrations: [..., dndTabletopPassthrough()]` | Activates the passthrough integration.                                                                                                                    |
| `.gitignore`                               | `public/dnd-tabletop/` entry | Prevents the build-staged copy from being committed.                                                                                                      |
| `_preserved-dnd-content/`                  | Entire directory       | Read-only preserved content. Not modified by this implementation.                                                                                         |

## Removal procedure (for the future D&D ADC pass)

When the D&D ADC init pass lands and decides the disposition of `/dnd-tabletop/`:

1. `git grep -n "DND-PRESERVATION"` to find every flagged line. Should be zero
   matches after removal.
2. Remove the `dndTabletopPassthrough()` integration from `astro.config.mjs`
   (function definition, import-side imports if they become unused, and the
   entry in the `integrations:` array).
3. Remove `public/dnd-tabletop/` from `.gitignore`.
4. Decide what to do with `_preserved-dnd-content/`:
   - If the redesigned D&D section absorbs the tool: move/rewrite the content
     into the new section layout.
   - If the URL is retired: delete `_preserved-dnd-content/` and document the
     URL retirement.
5. Update `<shell-constraint-url-preservation-04>` and
   `<stubs-feature-dnd-tabletop-passthrough-03>` in the contracts to reflect
   the new disposition (deprecate the constraint, supersede with the new D&D
   contract, etc., per ADC versioning rules).
6. Delete this file (`adc_files/implementation/DND_PRESERVATION_ARTIFACTS.md`).

## Why this exists

The `/dnd-tabletop/` URL was shared with friends before the rebuild. The shell
contract guarantees that URL keeps serving the same tool until the D&D ADC
pass redesigns the section. The preservation is intentionally minimal — a
verbatim file passthrough, no shell-layout wrapping, no shell-managed
content. That minimality is what makes clean removal possible later.

If the D&D pass tries to remove preservation by grep-archaeology rather than
by following this file, removal will miss something. This file is the
authoritative removal map.
