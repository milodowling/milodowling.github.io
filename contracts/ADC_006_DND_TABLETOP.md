---
contract_id: dnd-tabletop-adc-006
title: "D&D Section — Virtual Tabletop with Shared Tables"
author: "Milo Dowling"
status: "active"
version: 2.0
created_date: "2026-07-10"
last_updated: "2026-07-12"
---

> **v2.0 (2026-07-12, session 5):** the "v2 pass" per owner triage (see the website corpus
> DECISIONS log, 2026-07-12). State moves to v3 (multi-map scenes); adds GM role via
> capability link, fog of war, ephemeral presence (ping/ruler), token QoL (snap, labels,
> rings, GM-hide), per-player camera (zoom/pan), image downscaling, and room-lifecycle
> fixes. All op additions are tolerated as no-ops by older reducers; the Worker deploys
> before or with the client so mixed versions degrade, never crash.

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
- **Seeding (changed in v2.0):** ONLY the client that clicked **Start shared
  table** seeds an empty room with its local table (`state.replace`). A
  client that arrives via a `#room=` link NEVER seeds — v1.0's
  any-joiner-seeds heuristic could publish a guest's private solo table into
  a friend's fresh room (observed in session-5 exploration).
- **Roles:** see `<dnd-feature-roles-09>` — the starter claims the GM key;
  the invite link stays the player link.
- **Local persistence around rooms (changed in v2.0):** joining a room must
  not clobber the solo table. Solo play persists under `dndTabletopV2`;
  room state is mirrored under `dndRoomCache:<CODE>` (most-recent rooms
  kept, older pruned). Leaving a room restores the solo table. The last
  room (code + role key) is remembered so the offline panel can offer
  **Rejoin last table**.
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
Worker, and unit-tested directly. State shape (v3, multi-map):

```
{ v: 3,
  icons: [{ id, name, src }],               // room-wide token library
  activeMap: <mapId>,                       // the map everyone is looking at
  maps: [{                                   // ≥1 always (normalize guarantees)
    id, name,
    backdrop: null | { src, w, h },          // dataURL + natural pixels
    grid:     { on, size },                  // world units
    pieces:   [{ id, iconId, x, y, w, h,
                 label?, ring?, hidden? }],   // placed tokens (QoL fields opt.)
    drawings: [{ id, points, color, width }],
    fog:      [{ id, points, width, reveal }] }]  // fog brush strokes, ordered
}
```

**World coordinates (load-bearing, unchanged):** every coordinate in the
state is in WORLD space — the map backdrop's natural pixel space, or
`DEFAULT_WORLD` (1920×1080) with no backdrop, PER MAP. Clients map
world→screen with a local view transform (fit-contain composed with the
per-player camera, `<dnd-feature-view-camera-07>`). Never store screen
pixels in the state.

Ops (map-scoped content ops carry `map: <mapId>`; when absent they target
the active map — tolerance for older senders):

- `backdrop.set`, `grid.set` — per map
- `icon.add/remove/rename` — room-wide (`icon.remove` cascades pieces on all maps)
- `piece.add/update/remove` — `add`/`update` accept the QoL fields:
  `label` (string ≤ 40), `ring` (CSS color string ≤ 24 or null), `hidden` (bool)
- `draw.add/remove/clear` — per map
- `fog.add` (stroke: id + ≥2 world points + width + `reveal` bool),
  `fog.remove` (ids), `fog.clear` — per map, GM-gated
  (see `<dnd-feature-roles-09>`); strokes composite in array order
- `map.add` ({ id, name } → empty map), `map.rename`, `map.remove` (last map
  survives: removing the final map is a no-op; removing the active map
  activates another), `map.switch` (sets `activeMap`) — GM-gated
- `state.replace` — whole-table swap through `normalizeState`

Semantics the tests pin down: adds are idempotent per id; ops referencing
missing ids/maps are tolerated no-ops (concurrent-delete races must not
throw); unknown ops are no-ops (load-bearing for mixed-version rollout);
`normalizeState` coerces arbitrary input and migrates v1 (pre-multiplayer)
and v2 (single-map) saves — a v2 table becomes `maps[0]` ("Map 1").

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/reducer.js`
- **Tests:**
  - `tests/dnd/reducer.spec.js` (`<dnd-test-reducer-02>`)

---

### [Implementation: Wire protocol + chunking] <dnd-impl-sync-protocol-03>

`public/dnd-tabletop/sync-protocol.js`, shared client/Worker. Logical JSON
messages are split into `chunk` frames when they exceed ~500k chars, because
Workers cap WebSocket messages at 1 MiB and table states carry image
dataURLs. `FrameAssembler` reassembles, tolerating interleaved senders and
duplicate frames. Server-side, image blobs are stored chunked under the
DO's 2 MiB value cap, keyed per map (`blob:backdrop:<mapId>`) and per icon,
and are only rewritten by the ops that change them (a token move never
rewrites the map).

Message vocabulary (v2.0):

- `{t:"hello", claimGm?, gmKey?, name?}` client → server. `claimGm: true`
  claims the GM role for a fresh room (first claim wins); `gmKey` presents
  an existing key.
- `{t:"snapshot", state, role, gmKey?}` server → client. `role` is
  `"gm" | "player"`; `gmKey` is included only on a successful claim/present.
- `{t:"op", op}` either direction — one reducer op.
- `{t:"peers", n}` server → client.
- `{t:"ephemeral", kind, ...payload, name, color}` either direction —
  presence traffic (`kind: "ping" | "ruler"`). NEVER persisted, NEVER
  reduced: the Worker relays to the other sockets verbatim. Clients ignore
  unknown `kind`s; pre-v2.0 Workers ignore unknown `t`s — both directions
  degrade silently.

Unknown message types and unknown op types are tolerated no-ops everywhere;
that tolerance is the rollout mechanism (Worker deploys first).

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

### [Feature: Per-player camera — zoom/pan] <dnd-feature-view-camera-07>

The view transform composes fit-contain with a per-player camera: wheel
zooms to the cursor, middle/right-drag (or space+drag) pans, two-finger
touch pans, pinch zooms, and a reset control (⟲) restores auto-fit. The
camera is LOCAL ONLY — never synced, never in state (the v1.0
world-coordinate bet exists precisely so this touches only the view layer).
Zoom clamps to [fit, 8×fit]. Map switch and backdrop change reset the
camera. Single-pointer interactions (draw, drag, resize) are unchanged.

**Parity:**
- **Implementation Scope:** view/camera section of `public/dnd-tabletop/index.html`
- **Tests:** camera math exercised implicitly by every e2e canvas assertion;
  zoom/pan e2e in `tests/dnd/multiplayer.e2e.js` (pixel proof after zoom)

---

### [Feature: Presence — named ping] <dnd-feature-presence-08>

Each participant has a display name (asked once in the Table panel, stored
in `localStorage.dndPlayerName`) and a deterministic color (hash of name
over a fixed palette). The presence gesture is carried as `ephemeral`
messages (never state, never history):

- **Ping** — dedicated Point mode (drag streams a fading colored trail with
  a name tag), plus double-click/double-tap in any mode for a one-shot
  ping pulse. Peers render pings above everything; a ping outside the
  current viewport draws an edge arrow pointing toward it.

A Measure/ruler mode shipped in the first v2.0 build and was CUT at the
owner preview gate (2026-07-14, "useless for this table"). Clients ignore
unknown ephemeral `kind`s, so any peer still emitting rulers degrades
silently.

**Parity:**
- **Implementation Scope:** presence section of `public/dnd-tabletop/index.html`,
  ephemeral relay in `workers/dnd-sync/src/index.js`
- **Tests:** ephemeral relay + ping render in `tests/dnd/multiplayer.e2e.js`

---

### [Feature: GM role via capability link] <dnd-feature-roles-09>

No accounts (unchanged). The **Start shared table** client sends
`claimGm: true`; the DO mints a `gmKey` (first claim wins), returns it, and
the client persists it (per-room, localStorage) and appends `&gm=<key>` to
its own URL — that URL is the GM link, re-usable across devices. The plain
`#room=` invite stays the player link.

Trust model (owner decision 2026-07-12): the DEFAULT stays
everything-editable-by-everyone (friends table). The Worker enforces
GM-gating only where the game breaks otherwise: `fog.*` and `map.*` ops
from non-GM sockets are dropped, and the `hidden` field is stripped from
non-GM piece ops. Concealment (fog fill, hidden tokens) is CLIENT-SIDE
rendering — a devtools-literate player can peek; accepted and documented
for the friends-table species. Destructive room-wide actions (import,
clear) get a confirm dialog for everyone.

**Parity:**
- **Implementation Scope:** role handling in `workers/dnd-sync/src/index.js`,
  Table panel + gating in `public/dnd-tabletop/index.html`
- **Tests:** GM claim + non-GM fog-op drop in `tests/dnd/multiplayer.e2e.js`

---

### [Feature: Fog of war — brushed] <dnd-feature-fog-10>

Brush-painted fog, GM-only (redesigned at the owner preview gate
2026-07-14; the original polygon-patch/click-to-reveal model read as
"weird" and not opaque enough). Fog mode has two brushes, mirroring
Draw/Erase: **Cover** paints fog strokes, **Reveal** wipes them
(`destination-out`). Strokes are fat (≈64 screen px), stored per map as
`{ id, points, width, reveal }` in world units, and composited in array
order into an offscreen layer that renders through a small screen-space
blur so it reads as smoke, not vector shapes. Opacity: ~97% for players,
~80% for the GM (enough to stage under it). A click is a dab. `Clear fog`
resets the map's fog. Fog is shared state (`fog.add/remove/clear`) but not
in the drawing undo stack. Walls/vision/dynamic lighting are explicitly
OUT of species (research + owner sign-off).

**Parity:**
- **Implementation Scope:** fog section of `public/dnd-tabletop/index.html`,
  reducer `fog.*` ops
- **Tests:** reducer units (`tests/dnd/reducer.spec.js`); fog sync + player
  opacity in `tests/dnd/multiplayer.e2e.js`

---

### [Feature: Token QoL — snap, labels, rings, GM-hide] <dnd-feature-token-qol-11>

- **Snap-to-grid:** when the grid is on, a dropped/dragged piece snaps its
  center to the nearest cell center on release (Alt bypasses). Resize is
  not snapped.
- **Label:** free text ≤ 40 chars under the token (players use it for
  HP/conditions/emoji per the research); edited via the piece editor
  (double-click a piece, or its ✎ badge while hovered).
- **Ring:** optional colored halo ring around the piece (small fixed
  palette + none).
- **GM-hide:** GM-only eye toggle; hidden pieces render ghosted for the GM
  and not at all for players (client-side concealment per the trust model).
- **Grid calibration:** a **Fit grid** affordance in the Backdrop panel —
  drag a box over one map square and the grid size snaps to it; grid line
  color auto-adapts to backdrop luminance (dark lines on light maps).

**Parity:**
- **Implementation Scope:** `public/dnd-tabletop/index.html`, reducer piece
  fields
- **Tests:** reducer units (label/ring/hidden coercion); label + snap sync
  in `tests/dnd/multiplayer.e2e.js`

---

### [Feature: Multi-map scenes] <dnd-feature-scenes-12>

One room holds many maps (owner pulled this into v2 over the defer
recommendation, 2026-07-12). The Maps sidebar panel lists the room's maps;
the GM adds (empty), renames, deletes, and switches the live map
(`map.switch` → everyone follows `activeMap`). Every map keeps its own
backdrop, grid, drawings, pieces, and fog; the icon library is room-wide.
Solo (no room) users get the same panel ungated. The Worker stores each
map's backdrop blob under `blob:backdrop:<mapId>` so switching maps never
rewrites images.

**Parity:**
- **Implementation Scope:** maps section of `public/dnd-tabletop/index.html`,
  reducer `map.*` ops + v3 state, Worker blob keys
- **Tests:** reducer units (map ops, v2→v3 migration); map-switch sync in
  `tests/dnd/multiplayer.e2e.js`

---

### [Feature: Image robustness] <dnd-feature-robustness-13>

- **Client-side downscale on upload:** backdrops re-encoded to fit
  2560px max dimension (JPEG q0.85); icons to 512px PNG (after the
  existing background-trim). A session-5 probe showed a raw 7.6 MB phone
  photo syncs fine but silently exceeds the localStorage quota.
- **Quota surfacing:** when the local save fails, a one-per-session toast
  says the table won't survive a reload locally and suggests Export (in a
  room, the server copy is unaffected).
- **Save debounce:** `saveLocal` coalesces (~400 ms trailing) so streamed
  remote drags don't re-serialize a multi-MB state per frame.

**Parity:**
- **Implementation Scope:** upload + persistence paths in
  `public/dnd-tabletop/index.html`
- **Tests:** downscale dimensions asserted in `tests/dnd/multiplayer.e2e.js`
  (uploaded oversize image arrives ≤ cap on the peer)

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

Real browser contexts + a real `wrangler dev` room server: host starts a
table (and becomes GM), guest joins by link, drawings/undo/icons/renames/
tokens/grid/backdrop sync in both directions, and a latecomer context
receives the complete table from the snapshot. v2.0 extends the same suite:
fog cover strokes sync and render near-opaque for players, and a reveal
stroke wipes them on the peer; a non-GM fog op is dropped by the Worker;
map add/switch moves every client; piece labels and snap positions sync; a
ping reaches the peer; an oversized upload arrives downscaled. Assertions read each client's table via the
`window.__dndTable` debug hook (the localStorage mirror moved to per-room
keys in v2.0). — `tests/dnd/multiplayer.e2e.js`

---

### [Reference: Deploy] <dnd-ref-deploy-01>

The site ships via GitHub Actions → GitHub Pages
(`.github/workflows/deploy-pages.yml`, owner decision 2026-07-10 — see the
website corpus DECISIONS log). The dnd-sync Worker deploys separately and
manually: `npm run sync:deploy` (requires `wrangler login` on the owner's
personal Cloudflare account), then stamp the Worker URL into `SYNC_SERVER`
in `public/dnd-tabletop/index.html`. The Worker has no coupling to the
site's deploy target — it works with any origin serving the tool.
