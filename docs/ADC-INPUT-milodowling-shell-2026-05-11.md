# ADC Input — `milodowling.com` Shell Redesign

**Generated:** 2026-05-11 by `adc-design-companion` v1
**Project slug:** `milodowling-shell`
**Domain:** `web`
**Mode:** `structure`

---

## Step 1 — Spec for `@adc-contract-writer`

Paste this section (or reference it via `@docs/ADC-INPUT-milodowling-shell-2026-05-11.md`) when invoking the writer.

### **1. Executive Summary**

Greenfield rebuild of an existing personal website. The current site is a Hugo-based static site at `milodowling.github.io` with D&D content the owner wants to preserve; everything else is being thrown out. The new site is a **shell** — a playground frame that hosts several first-class sections, each of which can evolve independently. This pass designs the shell only.

The shell is built in **Astro with React islands**, deployed to **Cloudflare Pages**, with media on **Cloudflare R2**. The target domain is `milodowling.com` (owned, wired in when ready; `milodowling.github.io` is the fallback). The owner is learning React, so the project uses **JavaScript** by default; TypeScript is permitted but not required.

The homepage is anchored by a **deferred-slot WebGL+JS video-art engine** in the lineage of Hydra and Vynth. The engine is *not* designed in this pass — it gets its own ADC session later. The shell ships with a lightweight shader placeholder occupying the engine slot. The slot's interface is "client-side React component, parameters in as props, renders to canvas, no server." Anything that would invalidate that interface contract is out of scope for both the shell and the engine.

**Aesthetic principle: federation.** The shell carries its own identity (anchor references: remix.run combined with video-synthesis aesthetics — dark, type-forward, technical, with visual energy in the hero). Each section is free to set its own aesthetic anchor when *that section* is designed. The synth section's eventual anchor is **gieskes.nl** (raw, anti-grid, hand-crafted). The shell must remain aesthetically permissive — section styles must not leak into the shell or into other sections.

**Load-bearing constraint:** The site must be *easy for the owner to update*. The whole structure is in service of that — if the modular section pattern, the deploy flow, or the content authoring story makes updates feel like friction, the design has failed. Modularity, low-ceremony content addition, and a deploy path that "just works" trump elegance or completeness.

**One thing this site must never do:** lock out a future section by prescribing too much in the shell. Synth, D&D, tools, and the engine all get their own design passes. The shell anticipates them as *mount points*, not as defined subsystems.

### **2. Context**

This is greenfield work, so context inputs are limited. The design session that produced this prompt is at:

1. `docs/DESIGN-SESSION-milodowling-shell-2026-05-11.md` — narrative log of the design conversation, including the journey, key decisions, drift checks, and explicit deferrals to future ADC sessions.

If this file is unavailable, **fail — do not fall back**.

**Inherited architectural invariants:**
- None (greenfield). The existing site is being discarded except for D&D content, which lives in the shell as a stub.

**Adjacent workstreams (out-of-scope for this contract — flag for forward-compat only):**
- Synth section design (next ADC session — kanban + media + service notes + feed publishing)
- WebGL engine design (later ADC session — analog-feedback-style video art)
- D&D section design (later ADC session — full redesign)
- Tools section design (later ADC session — per-tool web demo interfaces)

The shell must leave room for all four without prescribing their internals.

**Current contracts in scope:** None (greenfield, first contract in the repo).

### **3. Technical Development Roadmap**

**Key tasks & Completion requirements**

1. **Shell foundations**
   * **Task:** Specify the stack, hosting, and deployment story (Astro + React islands, Cloudflare Pages, R2 for media, custom domain wiring story).
   * **Requirement for Completion:** A reader can stand up the project locally and deploy a static placeholder to Cloudflare Pages with confidence about how media is referenced.
   * **Task:** Specify the modular section pattern — how the shell exposes mount points such that adding a section is a low-ceremony operation.
   * **Requirement for Completion:** Adding a new section (e.g., a future "writing" section) does not require touching shell internals.

2. **Homepage and engine slot**
   * **Task:** Specify the homepage as hero-only, with a deferred-slot WebGL component. Specify the interface that the eventual engine will conform to (client-side, props-in, no-server-required) without specifying the engine itself.
   * **Requirement for Completion:** The placeholder shader satisfies the same interface that the real engine will, such that swapping it later requires no shell changes.
   * **Task:** Specify the v1 shader placeholder at a minimal level — enough to validate the slot, not enough to constrain the eventual engine.
   * **Requirement for Completion:** Homepage renders with the placeholder; placeholder degrades gracefully on mobile.

3. **Sections in this pass**
   * **Task:** Specify the **portfolio** section's content model and presentation. Adding a portfolio entry should be a single-markdown-file operation.
   * **Requirement for Completion:** New portfolio entries appear in the index and on individual pages with media references resolving from R2.
   * **Task:** Specify **section stubs** for synth, D&D, and tools. Stubs are placeholder pages with routes that future ADC sessions will fill in; they should not constrain those future sessions.
   * **Requirement for Completion:** Each stub renders a navigable placeholder page. The shell explicitly *does not* prescribe internals (data model, feed shape, UI patterns) for these sections.

4. **Cross-cutting constraints**
   * **Task:** Encode aesthetic federation — section styles must not leak to the shell or to other sections. The shell anchors are remix.run + video synthesis; synth's eventual anchor is gieskes.nl; others TBD per their pass.
   * **Requirement for Completion:** A test or convention ensures that styling a section does not affect the shell or other sections.
   * **Task:** Encode modularity as a non-negotiable — adding a section must be lightweight (low file count, minimal touchpoints in the shell).
   * **Requirement for Completion:** Adding a section is documented and demonstrably easy.
   * **Task:** Encode mobile-renders — every shell route must render cleanly on a 375px-wide viewport. Engine-on-mobile fidelity specifics are deferred to the engine pass; the shell only needs the placeholder to degrade gracefully.
   * **Requirement for Completion:** Shell routes render without horizontal scroll at 375px.

5. **Content authoring ergonomics**
   * **Task:** Specify the content authoring story for v1 (repo commits acceptable). The deeper goal is to ensure adding content is frictionless enough that the owner actually does it.
   * **Requirement for Completion:** The story is documented; if friction points exist, they are named so future sessions can address them.

**Final Integration:**
* **Task:** Verify the shell can be built, deployed, navigated, and extended without contradicting any deferred-section direction (synth, D&D, tools, engine).
* **Requirement for Completion:** A forward-compat check: stub mounts for the four deferred subsystems are reachable, and the contracts explicitly leave their internals unspecified.

**Contract Updates and Versioning:**
* **Task:** Produce contracts versioned at 1.0 with status `proposed`. Do not over-specify implementation within the contracts; design-focused output that is comprehensible and ready for code generation is the goal.
* **Requirement for Completion:** Contracts are written, internally consistent, and ready for the audit/refine loop.

**Ensure build-ready product at the end of this process.**

### **4. Open Architectural Questions**

For the refiner to surface back through the Q&A loop. These are deliberately unanswered — the owner wants ADC to surface options and pick a direction (or push back through the refiner).

1. **Section mount-point shape.** Is each section a top-level page directory under `src/pages/<section>/`, or does the shell expose a more formal "section registration" mechanism (a central config file, a typed manifest, etc.)? Pick a shape that respects the modularity-non-negotiable constraint.
2. **Feed-mount anticipation for synth.** The synth section will eventually publish content into the shell. The shell needs to leave room for this *without* prescribing the eventual payload shape. How should the shell represent "this section has a feed source TBD"?
3. **Engine slot interface — minimum viable contract.** What is the smallest possible interface the shell can encode for the engine slot such that a future engine swap is friction-free, but the shell isn't over-specifying what the engine has to do?
4. **Aesthetic federation enforcement.** Is "Astro scoped styles by default" sufficient, or does the shell need a stricter mechanism (a lint rule, a test) to enforce that section styles don't leak?
5. **Modularity-as-test vs modularity-as-convention.** Should the constraint that "adding a section is lightweight" be enforced by a test (e.g., a section can be added with N file changes and renders correctly), by a documented convention, or both?

### **5. Block inventory hints (non-binding)**

The writer has authority to add, omit, rename, or restructure. These are *starting suggestions only* — the design companion deliberately did **not** decide block IDs, contract splits, or field-level shapes. Phrase requirements as requirements; let the writer choose the encoding.

Major design intent areas the writer is likely to encode in some form:

| Intent area | What it covers |
|---|---|
| Project rationale and federation principle | Why this site exists; aesthetic federation as a load-bearing concept |
| Stack and deployment | Astro + React islands; Cloudflare Pages; R2; custom domain wiring |
| Homepage and engine slot | Hero-only homepage; placeholder shader; engine interface contract |
| Modular section pattern | How sections mount; how navigation reads sections; how a new section is added |
| Portfolio section | Content model and presentation for the only fully-designed section in this pass |
| Section stubs | Placeholder mounts for synth, D&D, tools |
| Cross-cutting constraints | Aesthetic federation, modularity, mobile rendering, content authoring ergonomics |
| Forward-compat references | Pointers to the four future ADC sessions (synth, engine, D&D, tools) |

The writer may consolidate these into one contract or split them — the design session recommended 2+ contracts but did not prescribe a count or split. Split sensibly per the ADC max-8-per-directory rule and per change-cadence reasoning (e.g., a stable shell vs. a portfolio that adds entries often).

### **6. Conventions**

- File extension: `.qmd` (Quarto markdown)
- Filename pattern: `ADC_NNN_NAME.qmd` under `contracts/` (writer assigns NNN per directory rules)
- Max 8 contracts per directory — split into sibling subdirectory if exceeded
- Block IDs follow `<{module-prefix}-{noun}-NN>` pattern
- Block ID assignment is the writer's responsibility; do not prescribe IDs in this prompt

### **7. Anti-patterns**

- Do not over-specify implementation within the contracts.
- Do not skip the writer ↔ refiner Q&A loop. If something is unclear, ask via the refiner.
- Do not add `Optional` types or defensive guard clauses — the writer's role definition forbids these.
- Do not design the synth section, D&D section, tools section, or WebGL engine in these contracts. Each gets its own future ADC session. Reference them, do not specify them.
- Do not prescribe field-level shapes for the synth feed mount or the engine slot. The shell encodes the *minimum* interface; specifics belong to those future passes.

---

## Prompt sequence

The role-by-role prompts to invoke after the writer has produced contracts. Pause for review at each checkpoint.

### Step 1 — Run the writer

Two invocation options:

**(a) Direct invocation (universal, single-pass):**
```
as @adc-contract-writer create contracts based on @docs/ADC-INPUT-milodowling-shell-2026-05-11.md

Use the block inventory hints as starting suggestions only — you have authority to add, omit, rename, or restructure. Convert requirements into the appropriate mix of [Constraint], [Implementation], [Feature], [TestScenario], etc. per your judgment.

Write contracts as `.qmd` files under contracts/ following ADC_NNN_NAME.qmd naming. Respect the max-8-contracts-per-directory rule.

The design companion deliberately did NOT prescribe contract splits, block IDs, or field-level shapes. You decide. Ask clarifying questions on anything underspecified — three to five intentional unanswered questions is healthier than zero.
```

**(b) Orchestrator-mediated (if `adc-workflow-orchestrator` is installed locally):**
```
adc-contract: create contracts for a greenfield personal-site shell built in Astro + React islands, deployed to Cloudflare Pages + R2. The shell is modular and aesthetically permissive — section internals are deferred to future ADC sessions.

Full spec: @docs/ADC-INPUT-milodowling-shell-2026-05-11.md
```

**Expected artifacts:** `contracts/ADC_NNN_*.qmd` files.

**Checkpoint:** Review contracts before continuing. If using option (a), the writer may have surfaced clarifying questions — answer them before Step 2. If using option (b), the loop has already incorporated answers; just review the final output.

### Step 2 — Audit contracts

```
as @adc-compliance-auditor review @contracts/

Check for:
- Missing Parity sections on implementable blocks
- ID collisions or non-unique <ids>
- Blocks referenced from [Diagram] or [Reference] that don't exist
- Coverage of [Constraint] blocks by [TestScenario] blocks
- Whether aesthetic federation and modularity constraints are encoded testably
- Whether the shell over-specifies anything that should be deferred to the synth, D&D, tools, or engine sessions

Output a structured findings report I can hand to @adc-contract-refiner. Refinement reports go in adc_files/refinement/ per ADC convention.
```

**Checkpoint:** Review audit findings before deciding whether Step 3 is needed.

### Step 3 — Refine contracts (only if option (a) was used in Step 1, or audit flagged issues)

```
as @adc-contract-refiner update @contracts/ based on @adc_files/refinement/{report_filename}

Priority:
1. Blocking compliance issues
2. Missing TestScenarios for the federation, modularity, mobile, and engine-independence constraints
3. Tightening or relaxing Constraints based on audit findings
4. Clarity improvements

Do NOT add new Features unless the report explicitly calls them out.
Preserve existing block IDs — only add or refine, never renumber.
```

### Step 4 — Implement

```
as @adc-workflow-orchestrator implement @contracts/ following a roadmap with phases:

Phase 1 — Foundations:
- Project scaffolding (Astro init, Cloudflare Pages config, R2 bucket wiring)
- Section pattern and navigation skeleton

Phase 2 — Homepage and engine slot:
- Homepage with placeholder shader
- Engine slot interface

Phase 3 — Sections:
- Portfolio (full)
- Synth / D&D / tools stubs

Phase 4 — Validation:
- All TestScenario blocks must pass
- Mobile-render verification
- Aesthetic federation verification

After each phase, run the inner audit loop until compliant before moving on.
Pause for my review between phases by writing a brief phase report.
```

**Checkpoint:** Review each phase report before proceeding.

### Step 5 — Evaluate

```
as @adc-system-evaluator run my system and provide insights in ADC-INSIGHTS.md

Focus on:
- Whether the modularity constraint holds in practice (add a fake section, measure friction)
- Whether the engine-slot interface holds (swap the placeholder for a different placeholder, verify no shell changes needed)
- Whether mobile renders correctly across the shell
- Whether content authoring (adding a portfolio entry) is as frictionless as intended

Output structured findings keyed by block ID for downstream use by @adc-contract-refiner.
```
