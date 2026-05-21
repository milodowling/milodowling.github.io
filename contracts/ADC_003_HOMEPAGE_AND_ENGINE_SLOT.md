---
contract_id: homepage-engine-slot-adc-003
title: "Homepage and Engine Slot Interface"
author: "Milo Dowling"
status: "active"
version: 1.0
created_date: "2026-05-20"
last_updated: "2026-05-21"
---

# Homepage and Engine Slot

This contract specifies the homepage (hero-only) and the deferred-slot WebGL+JS
video-art engine interface that the homepage hosts. The engine itself is NOT
designed here — that gets its own ADC session. This contract locks the slot's
interface so a future engine pass can drop in without shell changes, and
specifies a deliberately minimal v1 placeholder that validates the slot.

---

### [Rationale: Why a deferred slot] <home-rationale-slot-01>

The owner does live visuals with analog video gear and wants to digitize an
analog-feedback-style video art engine (lineage of Hydra and Vynth). That
engine is a substantial design effort on its own and the owner explicitly
deferred it to a future ADC pass.

The homepage anchors the visual identity. We cannot wait for the engine pass to
ship the shell, but we also cannot prescribe engine internals here without
constraining the future pass. The compromise is:

1. The homepage reserves a slot — a React component mount point — that the
   engine will eventually fill.
2. The shell ships a minimal placeholder occupying that slot in v1.
3. The slot's interface contract is locked here so the engine pass can swap the
   implementation without touching shell code.

The interface is deliberately small: three named props, standard React
lifecycle. Anything richer (start/stop/pause control, parameter validation,
output capture) is the engine pass's call.

---

### [Feature: Homepage — hero-only] <home-feature-homepage-01>

The homepage at `/` is hero-only. The hero fills the viewport on first paint and
hosts the engine slot. Below the hero, the homepage routes out to sections via
the shell's standard navigation; there is no additional homepage content (no
about section, no portfolio preview grid, no scroll-driven narrative).

Hero composition:

- A full-viewport canvas region occupied by the engine slot
  (`<home-feature-engine-slot-02>`).
- Site identity (name, tagline) overlaid on the canvas with shell-baseline
  typography.
- Shell navigation (from `<section-feature-manifest-01>` in
  `ADC_002_SECTION_MANIFEST_AND_ROUTING.md`).

The hero is intentionally simple. Visual energy comes from the engine, not from
layout complexity. Future design passes may revisit homepage structure if the
hero-only choice constrains content the owner wants to surface.

**Parity:**
- **Implementation Scope:** `src/pages/index.astro`, `src/components/Hero.astro`
- **Tests:**
  - `tests/shell/homepage.spec.js`

---

### [Feature: Engine slot — deferred mount point] <home-feature-engine-slot-02>

The homepage exposes a single React-component mount point for the WebGL+JS video
engine. The slot is a React island. The shell imports the slot implementation
from a single, stable path so the engine pass can swap it by replacing one file:

```jsx
// src/components/EngineSlot.jsx — the only file the engine pass touches in the shell
export default function EngineSlot({ time, pointer, params }) { /* ... */ }
```

Engine pass swaps this file. Shell code does not change.

The slot's interface contract is specified in `<home-impl-engine-interface-03>`.

**Parity:**
- **Implementation Scope:** `src/components/EngineSlot.jsx`, `src/components/Hero.astro` (mounts the island)
- **Tests:**
  - `tests/shell/engine-slot.spec.js`
  - See `<home-test-engine-interface-01>` and `<home-test-mobile-degradation-02>`

---

### [Implementation: Engine slot interface contract] <home-impl-engine-interface-03>

**Locked interface (the engine pass conforms to this; the shell never calls a
method beyond standard React lifecycle):**

The engine slot is a React component with named props `{time, pointer, params}`.

- **`time`** (number) — monotonic seconds since the component mounted. The shell
  is responsible for producing this value (typically via a
  `requestAnimationFrame` loop in `Hero.astro` that re-renders the slot's
  parent or passes time via a context/store). The value is read-only from the
  engine's perspective; the engine does not advance time itself.

- **`pointer`** (`{x: number, y: number, active: boolean}`) — current pointer
  position. `x` and `y` are normalized to the inclusive range `[0, 1]` with the
  origin at the top-left of the canvas (so `{x: 0, y: 0}` is the top-left
  corner, `{x: 1, y: 1}` is the bottom-right). `active` is `true` when the
  pointer is over the canvas (mouse hover or active touch); `false` otherwise.
  On touch devices without an active touch, `active` is `false` and `x`/`y`
  carry the last-known position.

- **`params`** (object) — an open object the engine declares for its own use.
  The shell does NOT constrain this object's shape, key names, or value types.
  The engine pass defines what goes here. The shell may pass an empty object
  `{}` in v1.

**Lifecycle.** Standard React mount/unmount. The slot:

- Performs setup (WebGL context, shader compile, resource loading) in `useEffect`
  or constructor-equivalent on mount.
- Performs cleanup (GL context disposal, resource release, listener removal) on
  unmount.
- Does NOT expose imperative `start()`, `stop()`, or `pause()` methods. The
  shell does not call any such API. If the engine pass wants those capabilities,
  it must implement them internally and surface them via `params` (e.g.,
  `params.running = false`) or via its own UI.

**What the shell guarantees:**

- The slot is mounted exactly once per homepage visit, in a stable position.
- `time` advances monotonically while mounted.
- `pointer` updates on `pointermove` / `pointerleave` / `pointercancel` /
  `touchstart` / `touchend` events over the canvas.
- The slot unmounts cleanly on route navigation away from `/`.

**What the shell does NOT guarantee:**

- Anything about `params`. The shell does not own its contents.
- Render cadence. The engine implements its own draw loop using `time`.
- Performance budgets. The engine pass owns those constraints.

**`params` non-precedent.** The v1 placeholder will demonstrate the interface
by accepting a few `params` keys (see `<home-impl-placeholder-04>`). The shell
deliberately makes NO claim that those placeholder keys are reserved or that
the engine pass must preserve them. The engine pass MAY redefine `params`
entirely. This non-precedent property is promoted to a hard Constraint at
`<home-constraint-params-no-precedent-05>` and bound by a dedicated TestScenario
at `<home-test-params-no-precedent-03>`. The TestScenario exercising the
placeholder must not assert anything about the *names* of params keys — only
that the interface accepts the shape.

**Parity:**
- **Implementation Scope:** `src/components/EngineSlot.jsx`, `src/components/Hero.astro`
- **Tests:**
  - See `<home-test-engine-interface-01>`
  - See `<home-test-params-no-precedent-03>`

---

### [Implementation: v1 engine placeholder] <home-impl-placeholder-04>

The v1 placeholder is a **lightweight test-pattern fragment shader** (animated
noise or a flowing color pattern). It exists to:

1. Validate that the engine slot mounts, receives props, and renders to a
   canvas.
2. Visibly consume `time` and `pointer` so the slot interface is
   provably working at runtime (a static placeholder would not prove the
   wiring).

The placeholder MUST:

- Render to a WebGL canvas occupying the hero region.
- Animate visibly using `time` (e.g., a hue cycle or scrolling noise field
  driven by `time`).
- React visibly to `pointer` (e.g., a position-tracking highlight or a
  pointer-driven distortion) when `pointer.active` is true.
- Degrade gracefully on mobile and low-end devices (no overflow, no GPU
  crashes, no unhandled errors). Mobile-specific fidelity (framerate, shader
  complexity) is the engine pass's problem; the placeholder's bar is "doesn't
  break."
- Be visually distinct from anything the eventual engine is expected to
  produce. The placeholder is a *test pattern*, not a teaser. Aesthetic
  direction for the hero belongs to the engine pass; the placeholder must NOT
  prejudice that work by anchoring expectations.

The placeholder MUST NOT:

- Make any claim on `params` key names that would soft-bind the engine pass
  (see `<home-constraint-params-no-precedent-05>`).
- Be aesthetically suggestive of analog-feedback video art (the eventual
  engine's domain).
- Add UI controls or settings panels. The engine pass decides what control
  surface, if any, lives on the homepage.

**Parity:**
- **Implementation Scope:** `src/components/engine/PlaceholderShader.jsx`
- **Tests:**
  - See `<home-test-engine-interface-01>` and `<home-test-mobile-degradation-02>`

---

### [Constraint: Placeholder `params` keys carry no precedent for the engine pass] <home-constraint-params-no-precedent-05>

The v1 placeholder (`<home-impl-placeholder-04>`) MAY declare and consume
specific keys inside the `params` prop for demonstration purposes (for example,
a `params.tint` color or a `params.speed` scalar). This is permitted purely as
a wiring proof.

The engine pass is **NOT bound** by any placeholder-declared `params` keys. The
engine pass:

- MAY redefine `params` entirely with a new key set.
- MAY rename any placeholder key without preserving the old name.
- MAY remove any placeholder key without providing a backward-compatible alias.
- MAY change the value type of any placeholder key (e.g., from `number` to
  `object`) without ceremony.

The shell does NOT read, validate, or branch on any `params` key. The shell
passes `params` through to the slot opaquely (and may pass `{}` in v1). The
slot contract is `{time, pointer, params}`; the *shape and semantics of
`params`* are not part of that contract.

**Why this is a Constraint, not a recommendation.** This is the single most
load-bearing forward-compat surface in the shell. If the shell accreted any
behavior that read placeholder `params` keys, future engine pass changes to
`params` would cause shell-side regressions, defeating the swap-in-one-file
guarantee from `<home-feature-engine-slot-02>`.

**Parity:**
- **Implementation Scope:** `src/components/EngineSlot.jsx`, `src/components/Hero.astro`
- **Tests:**
  - See `<home-test-params-no-precedent-03>`

---

### [TestScenario: Engine slot interface is provably wired] <home-test-engine-interface-01>

**Covers:** `<home-feature-engine-slot-02>`, `<home-impl-engine-interface-03>`,
`<home-impl-placeholder-04>`

**Scenario.** Mount the homepage in a headless browser.

1. Assert a WebGL canvas exists within the hero region.
2. Assert that, over a 500ms window, the canvas pixel data changes (proves
   `time` is being consumed and drives animation).
3. Dispatch a `pointermove` event at canvas-relative position (0.5, 0.5).
   Within 100ms, assert that canvas pixel data near the center changes
   relative to a no-pointer baseline (proves `pointer` is being consumed).
4. Replace `src/components/EngineSlot.jsx` with a second placeholder that has
   the same `{time, pointer, params}` interface but renders solid red.
   Rebuild. Assert the hero now renders solid red and the rest of the shell
   (nav, layout, sections) is unaffected. This proves the swap requires no
   shell changes.
5. Do NOT assert anything about specific `params` key names. Tests on `params`
   are deferred to the engine pass.

**Parity:**
- **Implementation Scope:** `tests/shell/engine-slot.spec.js`
- **Tests:**
  - `tests/shell/engine-slot.spec.js`

---

### [TestScenario: Engine placeholder degrades gracefully on mobile] <home-test-mobile-degradation-02>

**Covers:** `<home-impl-placeholder-04>`, `<shell-constraint-mobile-03>`

**Scenario.** Load `/` in a headless browser at viewport 375x812 with WebGL
emulation set to a low-tier profile.

1. Assert the homepage renders (no thrown errors, no unhandled rejections).
2. Assert no horizontal scroll (`scrollWidth <= 375`). This overlaps with the
   broader mobile test in `<shell-test-mobile-03>`; both must pass.
3. If WebGL initialization fails entirely (e.g., context creation returns
   null), the homepage must still render — the canvas region may show a
   neutral fallback (a solid color, a CSS-rendered placeholder) but the page
   must not be broken.
4. Assert no console errors at `error` level during a 2-second observation
   window after load.

**Parity:**
- **Implementation Scope:** `tests/shell/engine-mobile.spec.js`
- **Tests:**
  - `tests/shell/engine-mobile.spec.js`

---

### [TestScenario: Engine pass can ship a different `params` shape without breaking the shell] <home-test-params-no-precedent-03>

**Covers:** `<home-constraint-params-no-precedent-05>`,
`<home-impl-engine-interface-03>`

**Scenario.** This scenario proves the shell does not soft-bind on placeholder
`params` keys. It runs against two successive `EngineSlot.jsx` implementations
with deliberately disjoint `params` shapes.

1. **Baseline.** With the v1 placeholder mounted (which may declare arbitrary
   demonstration keys such as `params.tint`, `params.speed`, etc.), build the
   site and confirm `/` returns 200, the canvas renders, and no shell-level
   code path reads, branches on, or logs any specific `params` key name. (Static
   analysis assertion: `grep` shell sources for `params.<placeholder-key-name>`
   and assert zero matches outside `src/components/EngineSlot.jsx` and the
   placeholder shader's own scope.)

2. **Swap to a disjoint `params` shape.** Replace
   `src/components/EngineSlot.jsx` with a second slot implementation that:
   - Still conforms to the `{time, pointer, params}` interface.
   - Declares an entirely different `params` shape (none of the placeholder's
     key names appear; types of any reused names are deliberately changed,
     e.g., a `number` becomes a nested object).
   - May include keys that did not exist in the placeholder.

3. **Rebuild and verify.** After the swap:
   - `/` still returns 200.
   - The canvas still renders.
   - No build error, type error, or runtime error originates from the shell
     (any errors must originate from the swapped slot itself, not from shell
     code touching `params`).
   - The rest of the shell (nav, layout, other sections) is unaffected.

4. **Empty `params` case.** Mount a third slot variant whose component ignores
   `params` entirely. The shell may pass `{}`. Verify `/` still returns 200 and
   the canvas mounts cleanly.

5. The test must NOT assert anything positive about the placeholder's specific
   `params` key names. The placeholder is permitted to declare any keys; the
   test verifies the absence of shell-side dependence on those names.

**Parity:**
- **Implementation Scope:** `tests/shell/engine-params-no-precedent.spec.js`
- **Tests:**
  - `tests/shell/engine-params-no-precedent.spec.js`

---

### [Reference: Future engine ADC pass] <home-ref-engine-future-01>

The full WebGL+JS video-art engine is designed in a separate, future ADC
session. That session will:

- Define what `params` actually contains.
- Specify shader DSL / patch-graph / live-coding approach.
- Set performance budgets.
- Specify mobile fidelity targets.

This shell contract is forward-compatible with any engine that conforms to the
`{time, pointer, params}` interface and standard React lifecycle. The engine
pass is not constrained by the v1 placeholder.
