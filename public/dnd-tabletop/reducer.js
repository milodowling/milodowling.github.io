// ADC-IMPLEMENTS: <dnd-impl-reducer-02> <dnd-feature-scenes-12> <dnd-feature-fog-10>
// ADC-IMPLEMENTS: <dnd-feature-token-qol-11>
//
// Shared table-state reducer for the D&D tabletop. This file is the single
// source of truth for the state shape and the op vocabulary, and is consumed
// in three places:
//   - the tool's page script (public/dnd-tabletop/index.html, ES-module import)
//   - the sync Worker (workers/dnd-sync/src/index.js, bundled by wrangler)
//   - unit tests (tests/dnd/reducer.spec.js)
//
// All coordinates are WORLD coordinates: the map backdrop's natural pixel
// space when a backdrop is set, else DEFAULT_WORLD — per map. Never screen
// pixels — that is what makes the same table render consistently on every
// client, and what lets the per-player camera live entirely in the view
// layer.
//
// State v3 (multi-map): one room holds many maps; the icon library is
// room-wide; everything else (backdrop, grid, pieces, drawings, fog) is
// per map. Content ops carry `map: <mapId>`; when absent they target the
// active map.

export const STATE_VERSION = 3;

export const DEFAULT_WORLD = { w: 1920, h: 1080 };

export const FIRST_MAP_ID = "m1";

export function emptyMap(id, name) {
  return {
    id,
    name: String(name || "Map"),
    backdrop: null, // { src, w, h } — src is a dataURL, w/h natural pixels
    grid: { on: false, size: 64 },
    pieces: [], // placed tokens: { id, iconId, x, y, w, h, label?, ring?, hidden? }
    drawings: [], // { id, points: [{x,y}], color, width } (world coords)
    fog: [], // { id, points: [{x,y}], revealed } — closed polygons
  };
}

export function emptyState() {
  return {
    v: STATE_VERSION,
    icons: [], // room-wide library: { id, name, src }
    activeMap: FIRST_MAP_ID,
    maps: [emptyMap(FIRST_MAP_ID, "Map 1")],
  };
}

/** The map everyone is looking at (falls back to the first map). */
export function activeMapOf(state) {
  return findById(state.maps, state.activeMap) || state.maps[0];
}

export function worldSize(state) {
  const map = activeMapOf(state);
  return map.backdrop
    ? { w: map.backdrop.w, h: map.backdrop.h }
    : DEFAULT_WORLD;
}

/** Resolve the map an op targets: explicit `op.map`, else the active map. */
function targetMap(state, op) {
  if (op.map != null) return findById(state.maps, op.map) || null;
  return activeMapOf(state);
}

/**
 * Apply one op to the state, mutating and returning it. Unknown ops and ops
 * referencing missing ids/maps are tolerated as no-ops: in a multiplayer
 * session a peer may legitimately race a delete against a concurrent update,
 * and a newer client may send ops an older reducer doesn't know
 * (load-bearing for mixed-version rollout).
 */
export function applyOp(state, op) {
  const map = targetMap(state, op);

  switch (op.op) {
    case "backdrop.set":
      if (!map) return state;
      map.backdrop = op.src ? { src: op.src, w: op.w, h: op.h } : null;
      return state;

    case "grid.set":
      if (!map) return state;
      map.grid = {
        on: !!op.on,
        size: clampNumber(op.size, 8, 4096, map.grid.size),
      };
      return state;

    case "icon.add":
      if (op.icon && op.icon.id && !findById(state.icons, op.icon.id)) {
        state.icons.push({
          id: op.icon.id,
          name: String(op.icon.name || "Icon"),
          src: op.icon.src,
        });
      }
      return state;

    case "icon.remove":
      state.icons = state.icons.filter((i) => i.id !== op.id);
      for (const m of state.maps) {
        m.pieces = m.pieces.filter((p) => p.iconId !== op.id);
      }
      return state;

    case "icon.rename": {
      const icon = findById(state.icons, op.id);
      if (icon) icon.name = String(op.name || "").slice(0, 60) || icon.name;
      return state;
    }

    case "piece.add":
      if (
        map &&
        op.piece &&
        op.piece.id &&
        findById(state.icons, op.piece.iconId) &&
        !findById(map.pieces, op.piece.id)
      ) {
        const { id, iconId, x, y, w, h } = op.piece;
        const piece = { id, iconId, x, y, w, h };
        applyQol(piece, op.piece);
        map.pieces.push(piece);
      }
      return state;

    case "piece.update": {
      const piece = map && findById(map.pieces, op.id);
      if (piece) {
        for (const k of ["x", "y", "w", "h"]) {
          if (typeof op[k] === "number" && Number.isFinite(op[k])) {
            piece[k] = op[k];
          }
        }
        applyQol(piece, op);
        // Raise to top, matching the local interaction behavior.
        map.pieces.splice(map.pieces.indexOf(piece), 1);
        map.pieces.push(piece);
      }
      return state;
    }

    case "piece.remove":
      if (map) map.pieces = map.pieces.filter((p) => p.id !== op.id);
      return state;

    case "draw.add":
      if (
        map &&
        op.path &&
        op.path.id &&
        Array.isArray(op.path.points) &&
        op.path.points.length >= 2 &&
        !findById(map.drawings, op.path.id)
      ) {
        const { id, points, color, width } = op.path;
        map.drawings.push({ id, points, color, width });
      }
      return state;

    case "draw.remove": {
      if (!map) return state;
      const ids = new Set(op.ids || []);
      map.drawings = map.drawings.filter((d) => !ids.has(d.id));
      return state;
    }

    case "draw.clear":
      if (map) map.drawings = [];
      return state;

    case "fog.add":
      if (
        map &&
        op.patch &&
        op.patch.id &&
        Array.isArray(op.patch.points) &&
        op.patch.points.length >= 3 &&
        !findById(map.fog, op.patch.id)
      ) {
        map.fog.push({
          id: op.patch.id,
          points: op.patch.points,
          revealed: !!op.patch.revealed,
        });
      }
      return state;

    case "fog.set": {
      const patch = map && findById(map.fog, op.id);
      if (patch) patch.revealed = !!op.revealed;
      return state;
    }

    case "fog.remove":
      if (map) map.fog = map.fog.filter((f) => f.id !== op.id);
      return state;

    case "fog.clear":
      if (map) map.fog = [];
      return state;

    case "map.add":
      if (op.map && op.map.id && !findById(state.maps, op.map.id)) {
        state.maps.push(emptyMap(op.map.id, op.map.name || nextMapName(state)));
      }
      return state;

    case "map.rename": {
      const m = findById(state.maps, op.id);
      if (m) m.name = String(op.name || "").slice(0, 60) || m.name;
      return state;
    }

    case "map.remove":
      // The last map survives: a table always has somewhere to stand.
      if (state.maps.length > 1 && findById(state.maps, op.id)) {
        state.maps = state.maps.filter((m) => m.id !== op.id);
        if (state.activeMap === op.id) state.activeMap = state.maps[0].id;
      }
      return state;

    case "map.switch":
      if (findById(state.maps, op.id)) state.activeMap = op.id;
      return state;

    case "state.replace":
      if (op.state && typeof op.state === "object") {
        const fresh = normalizeState(op.state);
        for (const k of Object.keys(emptyState())) state[k] = fresh[k];
      }
      return state;

    default:
      return state;
  }
}

/**
 * Apply the optional token-QoL fields carried by `source` onto `piece`.
 * A field absent from `source` is left alone; an empty label, null ring, or
 * false hidden clears it (the fields only exist on pieces that use them).
 */
function applyQol(piece, source) {
  if (typeof source.label === "string") {
    const label = source.label.slice(0, 40);
    if (label) piece.label = label;
    else delete piece.label;
  }
  if ("ring" in source) {
    const ring = typeof source.ring === "string" ? source.ring.slice(0, 24) : null;
    if (ring) piece.ring = ring;
    else delete piece.ring;
  }
  if (typeof source.hidden === "boolean") {
    if (source.hidden) piece.hidden = true;
    else delete piece.hidden;
  }
}

function nextMapName(state) {
  return "Map " + (state.maps.length + 1);
}

/**
 * Coerce an arbitrary parsed object (imported file, remote snapshot, old
 * localStorage save) into a valid v3 state. Migrates:
 *   v1 — the pre-multiplayer shape (iconLibrary dataURL strings, placedIcons
 *        by imageIndex, drawings without ids)
 *   v2 — the single-map multiplayer shape; becomes maps[0] ("Map 1")
 */
export function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== "object") return state;

  if (raw.v === STATE_VERSION) {
    for (const i of raw.icons || []) {
      if (i && i.id && i.src) {
        state.icons.push({ id: i.id, name: String(i.name || "Icon"), src: i.src });
      }
    }
    const maps = [];
    for (const m of Array.isArray(raw.maps) ? raw.maps : []) {
      if (m && m.id) maps.push(normalizeMap(m, state.icons));
    }
    if (maps.length) state.maps = maps;
    state.activeMap = findById(state.maps, raw.activeMap)
      ? raw.activeMap
      : state.maps[0].id;
    return state;
  }

  // v2 (single-map multiplayer shape) → one-map v3.
  if (raw.v === 2) {
    for (const i of raw.icons || []) {
      if (i && i.id && i.src) {
        state.icons.push({ id: i.id, name: String(i.name || "Icon"), src: i.src });
      }
    }
    state.maps = [normalizeMap({ ...raw, id: FIRST_MAP_ID, name: "Map 1" }, state.icons)];
    state.activeMap = FIRST_MAP_ID;
    return state;
  }

  // v1 (pre-multiplayer localStorage shape)
  const map = state.maps[0];
  if (raw.backdrop && typeof raw.backdrop === "string") {
    // v1 stored only the dataURL; natural size is unknown here. The client
    // fills in w/h after the image decodes (see migrateBackdropSize).
    map.backdrop = { src: raw.backdrop, w: 0, h: 0 };
  }
  const iconIds = [];
  for (const [i, src] of (raw.iconLibrary || []).entries()) {
    const id = "icon-v1-" + i;
    iconIds.push(id);
    state.icons.push({ id, name: "Icon " + (i + 1), src });
  }
  for (const [i, p] of (raw.placedIcons || []).entries()) {
    const iconId = iconIds[p.imageIndex];
    if (!iconId) continue;
    map.pieces.push({
      id: "piece-v1-" + i,
      iconId,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      w: Number(p.width) || 64,
      h: Number(p.height) || 64,
    });
  }
  for (const [i, d] of (raw.drawings || []).entries()) {
    if (d && Array.isArray(d.points) && d.points.length >= 2) {
      map.drawings.push({
        id: "draw-v1-" + i,
        points: d.points,
        color: d.color,
        width: d.width,
      });
    }
  }
  return state;
}

/** Coerce one raw map object (v3 member or a whole v2 state). */
function normalizeMap(raw, icons) {
  const map = emptyMap(raw.id, raw.name || "Map");
  if (raw.backdrop && raw.backdrop.src) {
    map.backdrop = {
      src: raw.backdrop.src,
      w: Number(raw.backdrop.w) || DEFAULT_WORLD.w,
      h: Number(raw.backdrop.h) || DEFAULT_WORLD.h,
    };
  }
  if (raw.grid) {
    map.grid = {
      on: !!raw.grid.on,
      size: clampNumber(raw.grid.size, 8, 4096, 64),
    };
  }
  for (const p of raw.pieces || []) {
    if (p && p.id && findById(icons, p.iconId)) {
      const piece = {
        id: p.id,
        iconId: p.iconId,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        w: Number(p.w) || 64,
        h: Number(p.h) || 64,
      };
      applyQol(piece, p);
      map.pieces.push(piece);
    }
  }
  for (const d of raw.drawings || []) {
    if (d && d.id && Array.isArray(d.points) && d.points.length >= 2) {
      map.drawings.push({
        id: d.id,
        points: d.points,
        color: d.color,
        width: d.width,
      });
    }
  }
  for (const f of raw.fog || []) {
    if (f && f.id && Array.isArray(f.points) && f.points.length >= 3) {
      map.fog.push({ id: f.id, points: f.points, revealed: !!f.revealed });
    }
  }
  return map;
}

/** True when the table has no user content (fresh room / fresh browser). */
export function isEmptyState(state) {
  return (
    state.icons.length === 0 &&
    state.maps.length === 1 &&
    !state.maps[0].backdrop &&
    state.maps[0].pieces.length === 0 &&
    state.maps[0].drawings.length === 0 &&
    state.maps[0].fog.length === 0
  );
}

function findById(arr, id) {
  return arr.find((x) => x.id === id);
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
