---
contract_id: dnd-tabletop-adc-006
title: "D&D Section — Virtual Tabletop with Shared Tables"
author: "Milo Dowling"
status: "active"
version: 1.0
created_date: "2026-07-10"
last_updated: "2026-07-10"
---

# D&D Section — Virtual Tabletop

This contract is the D&D ADC init pass that `ADC_001_SHELL_OVERVIEW.md` and
`ADC_005_DEFERRED_SECTION_STUBS.md` anticipated. It absorbs the previously
preserved `/dnd-tabletop/` tool as first-party source, adds shared tables
(live multiplayer), and defines the section's structure and tests.

**Disposition of the preservation era (owner decision 2026-07-10):** the
`/dnd-tabletop/` URL is KEPT and stays canonical — friends hold links to it.
The byte-freeze against the Hugo-era copy is retired; the tool now evolves as
normal source. `<shell-constraint-url-preservation-04>` (v1.0's
content-identity assertion) and `<stubs-feature-dnd-tabletop-passthrough-03>`
are superseded by this contract; the URL-continuity guarantee itself carries
forward in `<dnd-feature-tool-route-01>`.

---

### [Feature: Tool route — /dnd-tabletop/ canonical and standalone] <dnd-feature-tool-route-01>

The virtual tabletop is committed source at `public/dnd-tabletop/`:

- `index.html` — the app (single page, vanilla JS, ES-module script)
- `reducer.js` — shared table-state reducer (see `<dnd-impl-reducer-02>`)
- `sync-protocol.js` — shared wire protocol (see `<dnd-impl-sync-protocol-03>`)

Constraints carried forward from the preservation era:

- `GET /dnd-tabletop/` and `GET /dnd-tabletop/index.html` MUST return 200 and
  serve the tool on every deploy target. The URL must never silently break;
  retiring it requires a deliberate redirect and a version bump here.
- The tool serves STANDALONE — never wrapped in the shell layout. It is a
  full-viewport canvas app; shell chrome would break it and the federation
  principle exempts it (`<shell-constraint-federation-01>` scope note).
- The tool remains exempt from the 375px no-horizontal-scroll shell test
  (as under v1.0 of the shell contract).
- Solo use requires no server: state persists to localStorage
  (`dndTabletopV2` key; legacy `dndTabletop` v1 saves are migrated on load).

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/`
- **Tests:**
  - `tests/shell/url-preservation.e2e.js` (`<dnd-test-url-continuity-01>`)

---

### [Feature: Shared tables (multiplayer)] <dnd-feature-multiplayer-02>

Target UX: a host clicks **Start shared table**, gets a room code in the URL
fragment (`/dnd-tabletop/#room=CODE`), and shares the link. Guests who open
the link see the same map, tokens, and drawings, live. A latecomer receives
the full table as a snapshot. Leaving the table returns to solo/local play.

Architecture (owner decision 2026-07-10, memo in the website corpus):

- **Server:** `workers/dnd-sync/` — a Cloudflare Worker on the owner's
  PERSONAL account. One room = one Durable Object (`idFromName(code)`),
  SQLite-backed, using the WebSocket Hibernation API so idle rooms cost
  nothing on the free plan.
- **Authority:** the DO is authoritative. It applies every op through the
  SAME reducer the client uses, persists the result, and rebroadcasts the op
  to the other clients. Joiners send `hello` and receive `snapshot`.
- **Seeding:** if a joiner's snapshot shows an empty room and the joiner has
  local content, the joiner seeds the room with `state.replace` (this is the
  host-creates-table flow).
- **Client server resolution:** `?sync=` query override (tests) → local
  `ws://127.0.0.1:8787` when the page is served from localhost →
  the deployed Worker URL baked into `SYNC_SERVER` in `index.html`. Until
  the production URL is stamped, the Start button is disabled with an
  explanatory hint and everything else works offline.
- **No auth:** rooms are capability URLs (unguessable 6-char codes from a
  31-char alphabet). Acceptable for a friends table; revisit only if abuse
  appears.

**Parity:**
- **Implementation Scope:** `workers/dnd-sync/src/index.js`,
  `workers/dnd-sync/wrangler.toml`, multiplayer section of
  `public/dnd-tabletop/index.html`
- **Configuration Scope:** `package.json` (`sync:dev`, `sync:deploy`),
  `playwright.config.js` (boots `wrangler dev` for e2e)
- **Tests:**
  - `tests/dnd/multiplayer.e2e.js` (`<dnd-test-multiplayer-04>`)

---

### [Implementation: Shared table-state reducer] <dnd-impl-reducer-02>

`public/dnd-tabletop/reducer.js` is the single source of truth for the state
shape and op vocabulary, imported by the page script, bundled into the
Worker, and unit-tested directly. State shape (v2):

```
{ v: 2,
  backdrop: null | { src, w, h },          // dataURL + natural pixels
  grid:     { on, size },                   // world units
  icons:    [{ id, name, src }],            // library
  pieces:   [{ id, iconId, x, y, w, h }],   // placed tokens
  drawings: [{ id, points, color, width }] }
```

**World coordinates (load-bearing):** every coordinate in the state is in
WORLD space — the backdrop's natural pixel space, or `DEFAULT_WORLD`
(1920×1080) with no backdrop. Clients map world→screen with a local
fit-contain view transform. This is what makes one table render consistently
on every screen; never store screen pixels in the state.

Ops: `backdrop.set`, `grid.set`, `icon.add/remove/rename`,
`piece.add/update/remove`, `draw.add/remove/clear`, `state.replace`.
Semantics the tests pin down: adds are idempotent per id; ops referencing
missing ids are tolerated no-ops (concurrent-delete races must not throw);
`normalizeState` coerces arbitrary input (imports, snapshots, v1 saves).

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/reducer.js`
- **Tests:**
  - `tests/dnd/reducer.spec.js` (`<dnd-test-reducer-02>`)

---

### [Implementation: Wire protocol + chunking] <dnd-impl-sync-protocol-03>

`public/dnd-tabletop/sync-protocol.js`, shared client/Worker. Logical JSON
messages (`hello`, `snapshot`, `op`, `peers`) are split into `chunk` frames
when they exceed ~500k chars, because Workers cap WebSocket messages at
1 MiB and table states carry image dataURLs. `FrameAssembler` reassembles,
tolerating interleaved senders and duplicate frames. Server-side, image
blobs are stored chunked under the DO's 2 MiB value cap, and are only
rewritten by the ops that change them (a token move never rewrites the map).

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/sync-protocol.js`,
  blob helpers in `workers/dnd-sync/src/index.js`
- **Tests:**
  - `tests/dnd/sync-protocol.spec.js` (`<dnd-test-protocol-03>`)

---

### [Feature: Table features (2026-07-10 triage)] <dnd-feature-table-features-05>

Built this pass (owner triage decision 2026-07-10):

- **Undo/redo for drawings** — history stack over draw ops (add/erase/clear),
  buttons + Ctrl/Cmd+Z / Shift+Z / Y. Drawing-scope only by design; tokens
  and images are not in the history. Remote peers' ops don't enter local
  history; undo of a local action syncs to the room as a normal op.
- **Grid overlay** — toggle + size in world units, rendered between backdrop
  and tokens; part of the shared state.
- **Session export/import** — the table state as a downloadable JSON file;
  import runs through `state.replace` (and therefore syncs if in a room).
- **Icon naming** — names in the library (✎ or double-click to rename),
  synced.

Deferred with owner sign-off (same decision): zoom/pan, fog of war,
token/drawing layers. The world-coordinate model was chosen partly so a
future zoom/pan pass only touches the view transform, not the state.
Resolved as already-done: the v1 README's "whitespace trim" TODO — the
corner-sampling background detection has been in the tool since preservation.

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/index.html`
- **Tests:**
  - undo + grid sync paths in `tests/dnd/multiplayer.e2e.js`;
    reducer semantics in `tests/dnd/reducer.spec.js`

---

### [Feature: /dnd/ section landing] <dnd-feature-landing-06>

`/dnd/` remains a shell-framed page (nav present, scoped styles, no section
internals imported — the stub-hygiene test still applies) and links to
`/dnd-tabletop/`. Its copy now describes the real tool instead of a
deferral notice. Deeper D&D content (campaign notes, etc.) is future work
and does not block this contract.

**Parity:**
- **Implementation Scope:** `src/pages/dnd/index.astro`
- **Tests:**
  - `tests/stubs/stubs-render.spec.js` (route, shell chrome, link)

---

### [TestScenario: URL continuity] <dnd-test-url-continuity-01>

Against the built site: `/dnd-tabletop/` and `/dnd-tabletop/index.html`
return 200; the served body equals the committed
`public/dnd-tabletop/index.html` after HTTP decoding + CRLF→LF normalization
(catches build-pipeline mangling); `reducer.js` and `sync-protocol.js` are
served alongside; no shell chrome in the response; the app boots (canvas +
sidebar render).

- **Tests:** `tests/shell/url-preservation.e2e.js`

### [TestScenario: Reducer semantics] <dnd-test-reducer-02>

Unit coverage of every op, id-tolerance semantics, v1 migration, and
garbage-input normalization. — `tests/dnd/reducer.spec.js`

### [TestScenario: Wire protocol] <dnd-test-protocol-03>

Chunk/reassemble round-trips, interleaving, duplicate frames, malformed
input. — `tests/dnd/sync-protocol.spec.js`

### [TestScenario: Multiplayer end-to-end] <dnd-test-multiplayer-04>

Two real browser contexts + a real `wrangler dev` room server: host starts a
table, guest joins by link, drawings/undo/icons/renames/tokens/grid/backdrop
sync in both directions, and a third latecomer context receives the complete
table from the snapshot. — `tests/dnd/multiplayer.e2e.js`

---

### [Reference: Deploy] <dnd-ref-deploy-01>

The site ships via GitHub Actions → GitHub Pages
(`.github/workflows/deploy-pages.yml`, owner decision 2026-07-10 — see the
website corpus DECISIONS log). The dnd-sync Worker deploys separately and
manually: `npm run sync:deploy` (requires `wrangler login` on the owner's
personal Cloudflare account), then stamp the Worker URL into `SYNC_SERVER`
in `public/dnd-tabletop/index.html`. The Worker has no coupling to the
site's deploy target — it works with any origin serving the tool.
