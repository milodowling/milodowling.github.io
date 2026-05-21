# Design Session — `milodowling.com` Shell Redesign

**Date:** 2026-05-11
**Domain:** `web`
**Mode:** `structure`
**Skill version:** ADC Design Companion v1
**Project type:** Greenfield rebuild

---

## Session anchor (final)

> Greenfield rebuild of `milodowling.github.io` (migrating to `milodowling.com`) as an
> artistic, weird, hand-crafted personal-site shell built in Astro with React islands
> (the user wants to learn React). Aesthetic federation: the shell carries its own
> identity (remix.run + video-synthesis vibes); each section is free to set its own
> aesthetic anchor when that section is designed. The shell hosts five sections —
> Portfolio (designed this pass), D&D (content stub, designed later), Synth (mount
> point only — designed in its own session next), Tools (stub, designed later), and
> room for additional sections. The homepage anchors a deferred-slot WebGL+JS
> video-art engine (lineage of Hydra/Vynth; user does live visuals with analog video
> gear and wants to digitize feedback emulation; engine is its own ADC session
> later) — engine accepts parameters as props, renders client-side, no server
> requirement. Hosting: Cloudflare Pages + R2 for media; custom domain
> `milodowling.com` wired in when the user is ready. Modularity and expandability
> are non-negotiable; the site must be easy *for the user* to update or it won't
> get updated.

---

## Journey

### Phase 1 — Frame
- Confirmed `web` / `structure` mode.
- Established greenfield treatment of the existing repo: D&D content survives the migration as a stub but is not redesigned in this pass.
- Established deferred-section pattern: synth, tools, and D&D get mount points but no design pass in this session.

### Phase 2 — Elicit
- Hosting was reframed from "where do we self-host?" to "should we self-host at all?" — user is new to self-hosting and the real driver is media-serving needs.
- Stack: open, with a preference for learning React. User wanted a video-art background on the homepage tied to scroll and other inputs.
- Tools section: stub-mount confirmed.
- Aesthetic correction: dropped "sleek" — too product-y. User reframed to *artistic and weird*, citing **gieskes.nl** as a reference site.
- Engine-as-blocker question raised. Resolved: engine commits to a "client-side WebGL+JS component, parameters in, no server" interface, which decouples it from the shell. Engine becomes its own deferred ADC pass.

### Phase 3 — Research (~6 calls)
Confirmed:
- **gieskes.nl** — anti-grid, flat directory, hand-crafted typographic identity. Strong aesthetic anchor.
- **ojack.xyz/work/hydra** — WebRTC + WebGL, browser-only, modular-synth-inspired. No server.
- **github.com/jdillonh/Vynth** — pure JS + WebGL, fragment shaders, runs on `github.io`. Vanilla static site.
- **Framework comparisons** — Astro (islands + zero-JS-default + React per-island), Next.js (full React + SSR/RSC), Vite SPA (pure client React).
- **Hetzner Cloud** — CPX22 ~€7.99/mo, 80GB NVMe, 20TB EU traffic (1TB in US). Self-managed.
- **Cloudflare R2 vs Backblaze B2** — R2 has zero egress fees and native CF Pages integration; B2 is cheaper raw storage but suited for archive/backup.

Key reframe: the engine's interface assumption (client-only WebGL+JS) is validated by both references. The "I need self-hosting because of media" assumption is correctly challenged by Cloudflare Pages + R2 covering the use case at zero day-1 cost. Self-hosting can be revisited for the synth section if that section's eventual backend needs it.

### Phase 4 — Decompose
Surfaced and resolved seven design tensions:

| # | Tension | Resolution |
|---|---|---|
| T1 | Contract split | 2+ contracts likely. **Not prescribed** — ADC decides. The prompt communicates scope only. |
| T2 | Synth feed source | v1 = repo commits. Underlying goal: make it easy for the user to actually update the site. |
| T3 | Engine v1 placeholder | Lightweight shader stub. |
| T4 | TypeScript vs JavaScript | **JS-first**, TS permitted later. Removes a learning variable while the user is picking up React. |
| T5 | Homepage scroll model | **Hero-only**, routes out to sections. Less complex. |
| T6 | Mobile engine degradation | Constraint wired in; specifics handled in the engine pass. |
| T7 | Per-section aesthetic anchors | Each section sets its own when it's designed. Shell stays aesthetically permissive. |

### Mid-Phase-4 correction
The companion initially over-reached by producing a detailed block inventory with prescribed IDs, fields, and contract splits. User correctly pushed back: the design companion's job is to refine the *design intent* and produce a prompt for ADC, not to prescribe contract structure. The inventory was retained as shared sketch in this session record (validates the modular section concept) but **was not carried forward into the prompt to `@adc-contract-writer`**.

---

## Key design decisions (locked)

1. **Stack:** Astro + React islands. Pure JS to start; TS permitted later as user gains comfort.
2. **Hosting:** Cloudflare Pages (build + deploy) + Cloudflare R2 (media bucket). Custom domain `milodowling.com` wired in when ready; `milodowling.github.io` is fallback.
3. **Aesthetic federation:** Shell carries its own identity (remix.run + video-synthesis); each section sets its own aesthetic anchor when designed. Synth zone's eventual anchor is **gieskes.nl**.
4. **Homepage:** Hero-only with a WebGL canvas occupying the hero. v1 = lightweight shader placeholder. Routes out to section pages below the fold or via navigation.
5. **Engine slot:** Deferred mount. Engine commits to client-side WebGL+JS, props-in interface, no server. Designed in its own ADC pass later. v1 shader is a minimal placeholder validating the slot.
6. **Section pattern:** Each section is a routed area within the shell. Modularity-non-negotiable: adding a section must be easy.
7. **Sections in scope this pass:** Portfolio (designed). Synth, D&D, Tools (mount/stub only; designed in their own future ADC passes).
8. **Content authoring:** v1 = repo commits. The deeper requirement is to make updates frictionless enough that the user actually does them.

---

## Future ADC sessions (planned)

- **Synth section** — kanban-style project management + media/file management + service notes + blog feed output. Aesthetic anchor: gieskes.nl. Self-hosted vs Workers vs static is part of that session's research. Scheduled immediately after this one.
- **WebGL engine** — analog-feedback-style video art engine. User does live visuals with analog gear (camera + CRT loops) and wants to digitize. Lineage of Hydra and Vynth, but ultimately the user's own.
- **D&D section** — existing content redesigned from scratch.
- **Tools section** — non-programmer-friendly demo interfaces for tools the user open-sources over time.

---

## Drift checks
- Turn 7 (Phase 2 → Phase 3): user named remix.run as new aesthetic anchor. Anchor revised, not drifted — coherent expansion.
- Turn 11 (Phase 4): user flagged over-reach on contract prescription. Course-corrected per Rule 4; reframed Phase 4 output as intent, not structure.

No rabbit holes detected.

---

## Open questions explicitly punted to future sessions

- Synth section's eventual hosting model (Workers? Separate VPS? Static publish?) — synth pass.
- Engine architecture (shader DSL? Patch graph? Live-coded? Hybrid?) — engine pass.
- D&D content model and presentation — D&D pass.
- Tools section pattern (per-tool routes? Single page with embedded demos?) — tools pass.

---

## Deliverable

The companion prompt for `@adc-contract-writer` is in `ADC-INPUT-milodowling-shell-2026-05-11.md`.
