# ADC Phase 2 Report — Homepage and Engine Slot

**Phase:** 2 of 4 (Homepage + engine slot)
**Date:** 2026-05-21
**Branch:** `feat/redesign`
**Parent commit at phase start:** `80a8c3d`
**Contracts:** unchanged from Phase 1 (five files under `contracts/`, all
`status: proposed`, `version: 1.0`)

---

## 1. Headline

Phase 2 is implementation-complete. The hero-only homepage replaces the Phase
1 placeholder. The engine slot is a React island that owns the canvas, time
source, and pointer tracking, and exposes the locked `{time, pointer, params}`
interface from `<home-impl-engine-interface-03>`. The v1 placeholder is a
hand-written plain-WebGL2 fragment shader (no engine framework) that visibly
consumes both `time` and `pointer` and is deliberately diagrammatic (vertical
bars + crosshatch noise + crosshair, debug-pattern aesthetic) so it does not
prejudice the eventual engine's design direction.

Inner audit pass is clean. All Phase 2-scope contract blocks have
ADC-IMPLEMENTS markers immediately before their implementing artifacts. No
`Optional` types. No defensive guard clauses that mask failures (lifecycle
null-checks on React refs and degenerate rects are React idiom). No
`.ts`/`.tsx` files. No three.js / regl / glsl-canvas / hydra-synth imports.
No remote push. Preserved D&D content untouched.

The structural separation between the slot wrapper and the render
implementation (the "load-bearing separability" called out in the Phase 2
brief) is exercised by the default-render mechanism in `EngineSlot.jsx`:
swapping the placeholder for a different render is a one-line import change
on the slot OR a `render={Component}` prop from `Hero.astro`. Either path
satisfies the Phase 4 swap-test scenario.

---

## 2. What was built

### 2.1 Homepage — wholesale replacement

- `src/pages/index.astro` — replaced wholesale. The Phase 1 placeholder
  `.phase1-placeholder` markup and styles are gone. The new homepage
  renders `<ShellLayout>` wrapping `<Hero>`. No other content; the hero
  IS the homepage per `<home-feature-homepage-01>`.

### 2.2 Hero composition

- `src/components/Hero.astro` (new) — owns hero layout: a positioned
  container with the engine canvas mount (`absolute inset:0`) underneath
  and a non-interactive overlay (`pointer-events: none`) above carrying
  the wordmark and tagline. The overlay text uses shell-baseline tokens
  (`--shell-font-mono`, `--shell-fg`, `--shell-fg-muted`) so styling
  remains federation-clean.
- Hero mounts `<EngineSlot client:load params={{}} />`. `client:load` is
  the right choice (not `client:visible`) because the hero IS the engine
  canvas — there is no above-the-fold experience without it, and lazy
  hydration would leave a blank hero on first paint.
- `params={{}}` is the shell's no-op default per the contract: "The shell
  may pass an empty object `{}` in v1." The shell does not, anywhere,
  read into `params`.
- Hero min-height clamps between 28rem and 60rem, defaulting to
  `calc(100vh - 9rem)` to leave the shell header/footer chrome visible
  on tall viewports. On mobile (375x812), the hero fills the
  remaining viewport without horizontal overflow.

### 2.3 Engine slot — the React island

- `src/components/EngineSlot.jsx` (new) — the slot itself. Owns the
  `<canvas>` element, the rAF time source, and the pointer-event
  tracking. Exports a default React component with the locked interface.
- **Time source.** A `requestAnimationFrame` loop started in `useEffect`
  on mount. Each tick computes `(performance.now() - mountedAt) / 1000`
  and stores it in `time` state. Drift-free per the brief — we
  accumulate `performance.now()` deltas, not frame counts. The rAF is
  cancelled on unmount.
- **Pointer source.** Pointer events on the canvas:
  `pointermove`, `pointerenter`, `pointerleave`, `pointercancel`,
  `pointerdown`, `pointerup`. Coordinates are normalized to `[0, 1]`
  against the canvas's `getBoundingClientRect()` with origin top-left,
  clamped to the inclusive range to absorb sub-pixel edge events.
  `active` is true while hovering OR while a pointer is down OR while a
  touch is on the canvas (matching the contract's "mouse hover or active
  touch" definition); false otherwise. After `pointerup`, hover state
  persists on mouse/pen (`active=true`) but releases on touch
  (`active=false`).
- **Render implementation.** Accepted via the optional `render` prop;
  defaults to the v1 placeholder. The slot does not impose any
  `start`/`stop`/`pause` API on the render implementation — it just
  passes `{time, pointer, params}` and a `canvasRef`.
- **The slot does not read `params`.** `params` is destructured at the
  function signature, defaulted to `{}` if absent, and passed through to
  the render implementation. No `params.foo` access exists in the slot.
  This satisfies `<home-constraint-params-no-precedent-05>` at the slot
  layer.

### 2.4 v1 placeholder shader

- `src/components/engine/PlaceholderShader.jsx` (new) — the v1
  placeholder render implementation. Plain WebGL2 only, no frameworks.
- **Vertex shader.** Standard fullscreen-triangle trick: positions
  computed from `gl_VertexID`, no vertex buffer needed. An empty VAO
  satisfies WebGL2's "must bind a VAO" requirement.
- **Fragment shader.** Hand-written test pattern composed of:
  1. Vertical stripes drifting horizontally (time-driven).
  2. Hue cycle on the stripe colors (time-driven).
  3. Crosshatch noise overlay using a cheap `hash()` (time-driven; gives
     unambiguous per-frame pixel delta for the Phase 4 pixel-change
     assertion).
  4. Crosshair + ring marker tracking the pointer (pointer-driven).
  5. Radial stripe pull toward the pointer (pointer-driven warp).
  6. Faint corner markers (test-card framing).
  The aesthetic is deliberately diagrammatic — vertical bars, crosshairs,
  noise — so nothing about the placeholder suggests analog-feedback
  video art. Confirmed by inspection: zero feedback loops, zero
  painterly color blending, zero "this could be the real thing"
  ambiguity.
- **Time + pointer visibly consumed.** Hue cycle, stripe drift, and
  noise field all advance with `u_time`. Crosshair tracks `u_pointer`
  with a clear bright magenta marker. Both inputs are observable by
  eye in <500ms of watching the canvas.
- **Mobile degradation.** Inside the ResizeObserver callback, DPR is
  clamped: viewport width < 600px → DPR clamp to 1; otherwise clamp to
  2. This keeps mobile GPUs out of trouble per `<shell-constraint-mobile-03>`
  and the placeholder's "doesn't break" bar.
- **WebGL2 failure path.** If `canvas.getContext("webgl2", …)` returns
  null, the canvas receives a `engine-slot-canvas--no-webgl` class and
  the render function bails. Hero.astro defines a CSS fallback
  (diagonal-stripe pattern in baseline colors) for that class so the
  page still renders a visible, intentional-looking neutral state.
  This satisfies `<home-test-mobile-degradation-02>` step 3.
- **`params` declaration.** The placeholder declares two demonstration
  keys (`speed` and `tintShift`) inside `extractParams()`. The marker
  for `<home-constraint-params-no-precedent-05>` lives immediately
  before that function, and the function's comment explicitly disclaims
  precedent: "The eventual engine pass MAY redefine these keys, rename
  them, change their types, or remove them without any shell-side
  coordination."

### 2.5 Separability — the load-bearing structural property

The slot vs. placeholder separation is real and exercised at three layers:

1. **Default-import swap.** Replacing `src/components/engine/PlaceholderShader.jsx`
   with a different implementation that conforms to
   `{canvasRef, time, pointer, params}` requires zero other changes
   (the slot's `defaultRender` imports it by relative path).
2. **Render-prop swap.** Passing `<EngineSlot render={MyComponent} />`
   from any caller bypasses the default entirely. Hero.astro uses the
   default; a Phase 4 swap test can pass a `render` override without
   touching `EngineSlot.jsx`.
3. **EngineSlot.jsx wholesale replacement.** The Phase 4 swap test
   scenario step 4 ("Replace `src/components/EngineSlot.jsx` with a
   second placeholder…") still works — replacing this file replaces the
   slot and its default render together. The slot's external surface
   (the `<EngineSlot />` JSX element in Hero.astro) is the only thing
   that needs to stay stable, and it does.

---

## 3. ADC-IMPLEMENTS markers added

Format: `<file>:<line>` → block ID

| File:line                                              | Block ID                                       | Notes |
| ------------------------------------------------------ | ---------------------------------------------- | ----- |
| `src/pages/index.astro:2`                              | `<home-feature-homepage-01>`                   | File-level marker on the homepage page. |
| `src/components/Hero.astro:2`                          | `<home-feature-homepage-01>`                   | File-level marker on the hero composition (Implementation Scope explicitly includes Hero.astro). |
| `src/components/Hero.astro:3`                          | `<home-feature-engine-slot-02>`                | Hero mounts the React island. |
| `src/components/EngineSlot.jsx:1`                      | `<home-feature-engine-slot-02>`                | File-level marker on the slot component. |
| `src/components/EngineSlot.jsx:2`                      | `<home-impl-engine-interface-03>`              | File-level marker — the slot owns the locked interface. |
| `src/components/EngineSlot.jsx:36`                     | `<home-impl-engine-interface-03>`              | Marker immediately before the default-export `EngineSlot` function, where the `{time, pointer, params}` props are destructured. |
| `src/components/engine/PlaceholderShader.jsx:1`        | `<home-impl-placeholder-04>`                   | File-level marker on the placeholder. |
| `src/components/engine/PlaceholderShader.jsx:29`       | `<home-constraint-params-no-precedent-05>`     | Marker immediately before `extractParams()`, the function that declares the demonstration `params` keys, with explicit no-precedent disclaimer in the surrounding comment. |

Phase 1 markers remain untouched and continue to satisfy their respective
blocks. Combined Phase 1 + Phase 2 marker count by `grep -rn`:
`src/`, `astro.config.mjs` → 17 marker lines.

Cross-cutting Constraints that Phase 2 transitively touches:

- `<shell-constraint-mobile-03>` — the placeholder's DPR clamp keeps the
  mobile render-buffer reasonable; the hero's `min-height` clamp keeps
  the layout itself overflow-free at 375px. Both still bind transitively
  to the Phase 1 baseline `body { overflow-x: hidden }` safety net.
- `<shell-constraint-federation-01>` — all hero styles use shell-namespaced
  class names (`shell-hero-*`, `engine-slot-*`). The `:global(...)` rules
  in Hero.astro for the engine-slot canvas are namespaced `engine-slot-*`,
  which the federation TestScenarios treat as shell-namespace-equivalent
  (not section-namespaced). No section-prefixed classes leak in.

---

## 4. Inline sanity-checks run

Phase 4 (validation) owns the full TestScenario suite per the roadmap. Phase
2 ran only ad-hoc smoke checks:

| Check                                                                              | Outcome |
| ---------------------------------------------------------------------------------- | ------- |
| `npm run build` completes without errors                                           | PASS    |
| `dist/index.html` is produced (one page)                                           | PASS    |
| Built HTML contains exactly one `<astro-island>` tag                               | PASS    |
| Built HTML embeds the SSR slot DOM: `<div class="engine-slot-root"><canvas class="engine-slot-canvas">` | PASS    |
| Built HTML contains the wordmark "milodowling" and tagline overlay                 | PASS    |
| Dev server responds 200 on `/`                                                     | PASS    |
| Dev server SSR'd output also contains the slot DOM                                 | PASS    |
| `grep -rn "ADC-IMPLEMENTS:" src/ astro.config.mjs` lists 17 lines (was 9 pre-phase) | PASS    |
| `grep -rn "Optional" src/` returns zero hits                                       | PASS    |
| `grep -rin "three\|regl\|glsl-canvas\|hydra-synth" src/ package.json` returns zero hits | PASS    |
| `find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "env.d.ts"` returns empty | PASS    |
| `grep -rn "params\." src/ --include="*.jsx" --include="*.astro"` outside `EngineSlot.jsx`/`PlaceholderShader.jsx` returns zero hits | PASS    |
| Hero renders at desktop width (browser inspection): wordmark and tagline visible over shader | PASS — confirmed via dev server |
| Hero renders at 375px width without horizontal scroll (browser devtools mobile emulation) | PASS — confirmed via dev server |
| Pointer movement over canvas visibly moves the crosshair (live verification)       | PASS — confirmed via dev server |
| `git diff --stat 80a8c3d..HEAD -- src/` shows exactly the four expected files       | PASS — see §6 |

Full TestScenario suite (`<home-test-engine-interface-01>`,
`<home-test-mobile-degradation-02>`, `<home-test-params-no-precedent-03>`,
and the broader Phase 4 suite) remains deferred to Phase 4.

---

## 5. Deviations and findings

### 5.1 Deviation — placeholder split out of `EngineSlot.jsx`

**Contract Parity scope at `<home-impl-placeholder-04>`:**
`src/components/EngineSlot.jsx (placeholder body), src/shaders/placeholder.frag.glsl`

**As-implemented:**
- Placeholder body lives in `src/components/engine/PlaceholderShader.jsx`,
  not in `EngineSlot.jsx`.
- GLSL source is inlined as JS template strings (`VERTEX_SHADER_SRC` and
  `FRAGMENT_SHADER_SRC`), not in a `src/shaders/placeholder.frag.glsl`
  file.

**Justification:**
1. The Phase 2 brief explicitly endorses this layout: "A natural
   structure: `src/components/EngineSlot.jsx` is a thin wrapper that
   owns the canvas element + the `time`/`pointer` tracking, and accepts
   the rendering implementation as a child or render prop. The
   placeholder shader is then a separate file (e.g.,
   `src/components/engine/PlaceholderShader.jsx`) that conforms to the
   contract. Use your judgment on the structure, but the
   **separability** is load-bearing for the Phase 4 swap test."
2. Inlining GLSL as a template string avoids adding a `.glsl` loader to
   Vite's config (one less dependency surface, one less build-time
   moving part). Vite has no native `.glsl` import; supporting it would
   require `vite-plugin-glsl` or similar — out of scope for "zero new
   heavy dependencies."
3. Phase 4's swap scenario step 4 ("Replace `src/components/EngineSlot.jsx`
   with a second placeholder that has the same `{time, pointer, params}`
   interface but renders solid red") still works: the swap operates on
   the slot file; the test does not depend on the placeholder living
   inside that file.

**Recommendation:** This deviation is non-blocking. If the contract's
Parity scope should be updated to reflect the split, that's a refinement
for a future ADC pass — Phase 2's instructions explicitly forbid editing
contracts directly. Surfacing here per the brief: "If you find a
contradiction, surface it as a Phase 2 report finding for refinement —
do not edit the contract yourself."

### 5.2 Finding — `engine-slot-*` CSS class namespace

The hero uses `:global(.engine-slot-root)` and `:global(.engine-slot-canvas)`
rules to style the React island's DOM (which Astro can't scope from
inside a `.astro` file because React owns the markup). The class names
are NOT `shell-`-prefixed.

The federation constraint is "Section-namespaced CSS classes (any class
prefixed with a section identifier — e.g., `synth-`, `portfolio-`,
`dnd-`, `tools-`) must not appear in shell-level CSS output." The
`engine-slot-*` prefix is not a section identifier — there is no
`engine-slot/` section in the manifest. It is a shell-internal
component namespace, analogous to `shell-hero-*`.

If the Phase 4 federation lint preference tightens to "shell-level CSS
output may contain only `shell-*` and shell-baseline `:where(...)` rules,"
then `engine-slot-*` will need to either be renamed to `shell-engine-slot-*`
or whitelisted as a shell-internal namespace. No action in Phase 2.

### 5.3 No other deviations

Contracts unmodified. `_preserved-dnd-content/` and `public/dnd-tabletop/`
untouched. No remote push. No `--no-verify` or signing bypass intended at
commit time.

---

## 6. Build artifacts (Phase 2)

### Files added

```
src/components/Hero.astro
src/components/EngineSlot.jsx
src/components/engine/PlaceholderShader.jsx
adc_files/implementation/ADC_PHASE2_REPORT.md (this file)
```

### Files modified

```
src/pages/index.astro                            (Phase 1 placeholder → Phase 2 hero)
```

Combined Phase 2 git diff: 4 added files + 1 modified file. No edits to
`astro.config.mjs`, `package.json`, `src/lib/`, `src/styles/`,
`src/layouts/`, `src/sections.config.js`, `src/components/Nav.astro`, or
README.md.

---

## 7. Readiness verdict for Phase 3

Ready. The engine-slot work is complete and the homepage stands on its
own. Phase 3 (portfolio content layer + section stubs) has a clean place
to land: it adds files under `src/pages/portfolio/`, `src/pages/synth/`,
`src/pages/dnd/`, `src/pages/tools/`, and possibly `src/lib/feed.js`.
None of those touch the homepage or engine slot. The federation rules
already in baseline + scoped styles cleanly accommodate per-section
styling.

The locked engine-slot interface is now exercised by the v1 placeholder,
so Phase 4's `<home-test-engine-interface-01>` has concrete artifacts to
validate. The `<home-test-params-no-precedent-03>` static-analysis
assertion ("`grep` shell sources for `params.<placeholder-key-name>` and
assert zero matches outside `src/components/EngineSlot.jsx` and the
placeholder shader's own scope") already passes — verified inline.

---

## 8. Notes for review

- The placeholder is deliberately ugly. If, on viewing the dev server, the
  output looks too polished or could be confused for design direction,
  flag it — the contract requires it be a debug pattern, not a teaser.
- The `engine-slot-*` namespace question (§5.2) is a soft surface; raise it
  if Phase 4 federation testing wants tighter rules.
- The Parity-scope deviation (§5.1) is the only contract-vs-implementation
  divergence to surface for a future refinement pass.

Pause here for review.
