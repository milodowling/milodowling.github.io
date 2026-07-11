// ADC-IMPLEMENTS: <dnd-impl-reducer-02>
//
// Shared table-state reducer for the D&D tabletop. This file is the single
// source of truth for the state shape and the op vocabulary, and is consumed
// in three places:
//   - the tool's page script (public/dnd-tabletop/index.html, ES-module import)
//   - the sync Worker (workers/dnd-sync/src/index.js, bundled by wrangler)
//   - unit tests (tests/dnd/reducer.spec.js)
//
// All coordinates are WORLD coordinates: the backdrop image's natural pixel
// space when a backdrop is set, else DEFAULT_WORLD. Never screen pixels —
// that is what makes the same table render consistently on every client.

export const STATE_VERSION = 2;

export const DEFAULT_WORLD = { w: 1920, h: 1080 };

export function emptyState() {
  return {
    v: STATE_VERSION,
    backdrop: null, // { src, w, h } — src is a dataURL, w/h natural pixels
    grid: { on: false, size: 64 },
    icons: [], // library: { id, name, src }
    pieces: [], // placed tokens: { id, iconId, x, y, w, h } (world coords)
    drawings: [], // { id, points: [{x,y}], color, width } (world coords)
  };
}

export function worldSize(state) {
  return state.backdrop
    ? { w: state.backdrop.w, h: state.backdrop.h }
    : DEFAULT_WORLD;
}

/**
 * Apply one op to the state, mutating and returning it. Unknown ops and ops
 * referencing missing ids are tolerated as no-ops: in a multiplayer session
 * a peer may legitimately race a delete against a concurrent update.
 */
export function applyOp(state, op) {
  switch (op.op) {
    case "backdrop.set":
      state.backdrop = op.src ? { src: op.src, w: op.w, h: op.h } : null;
      return state;

    case "grid.set":
      state.grid = {
        on: !!op.on,
        size: clampNumber(op.size, 8, 4096, state.grid.size),
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
      state.pieces = state.pieces.filter((p) => p.iconId !== op.id);
      return state;

    case "icon.rename": {
      const icon = findById(state.icons, op.id);
      if (icon) icon.name = String(op.name || "").slice(0, 60) || icon.name;
      return state;
    }

    case "piece.add":
      if (
        op.piece &&
        op.piece.id &&
        findById(state.icons, op.piece.iconId) &&
        !findById(state.pieces, op.piece.id)
      ) {
        const { id, iconId, x, y, w, h } = op.piece;
        state.pieces.push({ id, iconId, x, y, w, h });
      }
      return state;

    case "piece.update": {
      const piece = findById(state.pieces, op.id);
      if (piece) {
        for (const k of ["x", "y", "w", "h"]) {
          if (typeof op[k] === "number" && Number.isFinite(op[k])) {
            piece[k] = op[k];
          }
        }
        // Raise to top, matching the local interaction behavior.
        state.pieces.splice(state.pieces.indexOf(piece), 1);
        state.pieces.push(piece);
      }
      return state;
    }

    case "piece.remove":
      state.pieces = state.pieces.filter((p) => p.id !== op.id);
      return state;

    case "draw.add":
      if (
        op.path &&
        op.path.id &&
        Array.isArray(op.path.points) &&
        op.path.points.length >= 2 &&
        !findById(state.drawings, op.path.id)
      ) {
        const { id, points, color, width } = op.path;
        state.drawings.push({ id, points, color, width });
      }
      return state;

    case "draw.remove": {
      const ids = new Set(op.ids || []);
      state.drawings = state.drawings.filter((d) => !ids.has(d.id));
      return state;
    }

    case "draw.clear":
      state.drawings = [];
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
 * Coerce an arbitrary parsed object (imported file, remote snapshot, old
 * localStorage save) into a valid v2 state. Handles the v1 shape the tool
 * used before multiplayer: iconLibrary as bare dataURL strings, placedIcons
 * referencing imageIndex, drawings without ids, screen-space coordinates
 * (kept as-is — a one-time approximation).
 */
export function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== "object") return state;

  if (raw.v === STATE_VERSION) {
    if (raw.backdrop && raw.backdrop.src) {
      state.backdrop = {
        src: raw.backdrop.src,
        w: Number(raw.backdrop.w) || DEFAULT_WORLD.w,
        h: Number(raw.backdrop.h) || DEFAULT_WORLD.h,
      };
    }
    if (raw.grid) {
      state.grid = {
        on: !!raw.grid.on,
        size: clampNumber(raw.grid.size, 8, 4096, 64),
      };
    }
    for (const i of raw.icons || []) {
      if (i && i.id && i.src) {
        state.icons.push({ id: i.id, name: String(i.name || "Icon"), src: i.src });
      }
    }
    for (const p of raw.pieces || []) {
      if (p && p.id && findById(state.icons, p.iconId)) {
        state.pieces.push({
          id: p.id,
          iconId: p.iconId,
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          w: Number(p.w) || 64,
          h: Number(p.h) || 64,
        });
      }
    }
    for (const d of raw.drawings || []) {
      if (d && d.id && Array.isArray(d.points) && d.points.length >= 2) {
        state.drawings.push({
          id: d.id,
          points: d.points,
          color: d.color,
          width: d.width,
        });
      }
    }
    return state;
  }

  // v1 (pre-multiplayer localStorage shape)
  if (raw.backdrop) {
    // v1 stored only the dataURL; natural size is unknown here. The client
    // fills in w/h after the image decodes (see migrateBackdropSize).
    state.backdrop = { src: raw.backdrop, w: 0, h: 0 };
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
    state.pieces.push({
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
      state.drawings.push({
        id: "draw-v1-" + i,
        points: d.points,
        color: d.color,
        width: d.width,
      });
    }
  }
  return state;
}

/** True when the table has no user content (fresh room / fresh browser). */
export function isEmptyState(state) {
  return (
    !state.backdrop &&
    state.icons.length === 0 &&
    state.pieces.length === 0 &&
    state.drawings.length === 0
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
