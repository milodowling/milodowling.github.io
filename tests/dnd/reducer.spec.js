// ADC-IMPLEMENTS: <dnd-test-reducer-02>
//
// Unit coverage for the shared table-state reducer — the op vocabulary both
// the client and the dnd-sync Worker apply. Multiplayer correctness leans on
// these semantics: idempotent adds, tolerated missing ids/maps, v1/v2
// migration, unknown-op tolerance (the mixed-version rollout mechanism).

import { describe, expect, it } from "vitest";
import {
  emptyState,
  applyOp,
  normalizeState,
  isEmptyState,
  worldSize,
  activeMapOf,
  DEFAULT_WORLD,
  FIRST_MAP_ID,
} from "../../public/dnd-tabletop/reducer.js";

const ICON = { id: "i1", name: "Goblin", src: "data:image/png;base64,AAA" };
const PATH = {
  id: "d1",
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  color: "#cc3333",
  width: 4,
};
const FOG_PATCH = {
  id: "f1",
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
};

function stateWithIcon() {
  const s = emptyState();
  applyOp(s, { op: "icon.add", icon: ICON });
  return s;
}

describe("<dnd-test-reducer-02>: table-state reducer", () => {
  it("empty state is empty, single-map, and uses the default world", () => {
    const s = emptyState();
    expect(isEmptyState(s)).toBe(true);
    expect(s.maps).toHaveLength(1);
    expect(s.activeMap).toBe(FIRST_MAP_ID);
    expect(activeMapOf(s).id).toBe(FIRST_MAP_ID);
    expect(worldSize(s)).toEqual(DEFAULT_WORLD);
  });

  it("backdrop.set installs the backdrop on the active map and drives world size", () => {
    const s = emptyState();
    applyOp(s, { op: "backdrop.set", src: "data:x", w: 800, h: 600 });
    expect(activeMapOf(s).backdrop).toEqual({ src: "data:x", w: 800, h: 600 });
    expect(worldSize(s)).toEqual({ w: 800, h: 600 });
    expect(isEmptyState(s)).toBe(false);
  });

  it("grid.set clamps size and coerces on", () => {
    const s = emptyState();
    applyOp(s, { op: "grid.set", on: 1, size: 100000 });
    expect(activeMapOf(s).grid).toEqual({ on: true, size: 4096 });
    applyOp(s, { op: "grid.set", on: false, size: "nonsense" });
    expect(activeMapOf(s).grid.size).toBe(4096); // falls back to previous size
  });

  it("icon.add is idempotent per id", () => {
    const s = stateWithIcon();
    applyOp(s, { op: "icon.add", icon: ICON });
    expect(s.icons).toHaveLength(1);
  });

  it("icon.rename renames; empty names are rejected", () => {
    const s = stateWithIcon();
    applyOp(s, { op: "icon.rename", id: "i1", name: "Hobgoblin" });
    expect(s.icons[0].name).toBe("Hobgoblin");
    applyOp(s, { op: "icon.rename", id: "i1", name: "" });
    expect(s.icons[0].name).toBe("Hobgoblin");
  });

  it("icon.remove removes the icon and its placed pieces on every map", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p1", iconId: "i1", x: 0, y: 0, w: 64, h: 64 },
    });
    applyOp(s, { op: "map.add", map: { id: "m2", name: "Cellar" } });
    applyOp(s, {
      op: "piece.add",
      map: "m2",
      piece: { id: "p2", iconId: "i1", x: 0, y: 0, w: 64, h: 64 },
    });
    applyOp(s, { op: "icon.remove", id: "i1" });
    expect(s.icons).toHaveLength(0);
    expect(s.maps[0].pieces).toHaveLength(0);
    expect(s.maps[1].pieces).toHaveLength(0);
  });

  it("piece.add requires a known icon and a fresh id", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p1", iconId: "missing", x: 0, y: 0, w: 64, h: 64 },
    });
    expect(activeMapOf(s).pieces).toHaveLength(0);
    const piece = { id: "p1", iconId: "i1", x: 0, y: 0, w: 64, h: 64 };
    applyOp(s, { op: "piece.add", piece });
    applyOp(s, { op: "piece.add", piece });
    expect(activeMapOf(s).pieces).toHaveLength(1);
  });

  it("piece.update moves/resizes partially, raises to top, tolerates missing ids", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p1", iconId: "i1", x: 0, y: 0, w: 64, h: 64 },
    });
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p2", iconId: "i1", x: 100, y: 100, w: 64, h: 64 },
    });
    applyOp(s, { op: "piece.update", id: "p1", x: 42 });
    const pieces = activeMapOf(s).pieces;
    const top = pieces[pieces.length - 1];
    expect(top.id).toBe("p1");
    expect(top.x).toBe(42);
    expect(top.y).toBe(0);
    expect(top.w).toBe(64);
    // A concurrent-delete race must not throw.
    expect(() =>
      applyOp(s, { op: "piece.update", id: "ghost", x: 1 }),
    ).not.toThrow();
  });

  it("piece QoL fields: label/ring/hidden set, coerce, and clear", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: {
        id: "p1",
        iconId: "i1",
        x: 0,
        y: 0,
        w: 64,
        h: 64,
        label: "x".repeat(99),
        ring: "#cc3333",
        hidden: true,
      },
    });
    const piece = () => activeMapOf(s).pieces[0];
    expect(piece().label).toHaveLength(40); // clamped
    expect(piece().ring).toBe("#cc3333");
    expect(piece().hidden).toBe(true);

    // Partial update leaves untouched fields alone.
    applyOp(s, { op: "piece.update", id: "p1", x: 5 });
    expect(piece().ring).toBe("#cc3333");

    // Clearing: empty label, null ring, false hidden remove the fields.
    applyOp(s, {
      op: "piece.update",
      id: "p1",
      label: "",
      ring: null,
      hidden: false,
    });
    expect("label" in piece()).toBe(false);
    expect("ring" in piece()).toBe(false);
    expect("hidden" in piece()).toBe(false);

    // Garbage types are coerced, never thrown on.
    applyOp(s, { op: "piece.update", id: "p1", ring: { evil: true } });
    expect("ring" in piece()).toBe(false);
  });

  it("draw.add / draw.remove / draw.clear", () => {
    const s = emptyState();
    applyOp(s, { op: "draw.add", path: PATH });
    applyOp(s, { op: "draw.add", path: PATH }); // duplicate id — no-op
    expect(activeMapOf(s).drawings).toHaveLength(1);
    applyOp(s, { op: "draw.remove", ids: ["d1", "ghost"] });
    expect(activeMapOf(s).drawings).toHaveLength(0);
    applyOp(s, { op: "draw.add", path: PATH });
    applyOp(s, { op: "draw.clear" });
    expect(activeMapOf(s).drawings).toHaveLength(0);
  });

  it("draw.add rejects degenerate paths", () => {
    const s = emptyState();
    applyOp(s, {
      op: "draw.add",
      path: { id: "d2", points: [{ x: 0, y: 0 }], color: "#fff", width: 2 },
    });
    expect(activeMapOf(s).drawings).toHaveLength(0);
  });

  it("fog.add / fog.set / fog.remove / fog.clear", () => {
    const s = emptyState();
    applyOp(s, { op: "fog.add", patch: FOG_PATCH });
    applyOp(s, { op: "fog.add", patch: FOG_PATCH }); // duplicate id — no-op
    const fog = () => activeMapOf(s).fog;
    expect(fog()).toHaveLength(1);
    expect(fog()[0].revealed).toBe(false);
    applyOp(s, { op: "fog.set", id: "f1", revealed: true });
    expect(fog()[0].revealed).toBe(true);
    applyOp(s, { op: "fog.set", id: "ghost", revealed: true }); // tolerated
    applyOp(s, { op: "fog.remove", id: "f1" });
    expect(fog()).toHaveLength(0);
    applyOp(s, { op: "fog.add", patch: FOG_PATCH });
    applyOp(s, { op: "fog.clear" });
    expect(fog()).toHaveLength(0);
  });

  it("fog.add rejects degenerate patches (<3 points)", () => {
    const s = emptyState();
    applyOp(s, {
      op: "fog.add",
      patch: { id: "f2", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
    });
    expect(activeMapOf(s).fog).toHaveLength(0);
  });

  it("map.add / map.rename / map.switch / map.remove", () => {
    const s = emptyState();
    applyOp(s, { op: "map.add", map: { id: "m2", name: "Cellar" } });
    applyOp(s, { op: "map.add", map: { id: "m2", name: "Dupe" } }); // no-op
    expect(s.maps).toHaveLength(2);
    expect(s.maps[1].name).toBe("Cellar");

    applyOp(s, { op: "map.rename", id: "m2", name: "Deep Cellar" });
    expect(s.maps[1].name).toBe("Deep Cellar");

    applyOp(s, { op: "map.switch", id: "m2" });
    expect(s.activeMap).toBe("m2");
    applyOp(s, { op: "map.switch", id: "ghost" }); // tolerated
    expect(s.activeMap).toBe("m2");

    // Removing the active map activates a survivor.
    applyOp(s, { op: "map.remove", id: "m2" });
    expect(s.maps).toHaveLength(1);
    expect(s.activeMap).toBe(FIRST_MAP_ID);

    // The last map survives removal.
    applyOp(s, { op: "map.remove", id: FIRST_MAP_ID });
    expect(s.maps).toHaveLength(1);
  });

  it("content ops scope to op.map, defaulting to the active map", () => {
    const s = emptyState();
    applyOp(s, { op: "map.add", map: { id: "m2", name: "Cellar" } });
    // Explicit scope: draw onto m2 while m1 is active.
    applyOp(s, { op: "draw.add", map: "m2", path: PATH });
    expect(s.maps[0].drawings).toHaveLength(0);
    expect(s.maps[1].drawings).toHaveLength(1);
    // Missing map id: tolerated no-op.
    expect(() =>
      applyOp(s, { op: "draw.add", map: "ghost", path: { ...PATH, id: "d9" } }),
    ).not.toThrow();
    expect(s.maps[0].drawings).toHaveLength(0);
  });

  it("state.replace swaps in a normalized state", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "state.replace",
      state: { v: 2, drawings: [PATH] },
    });
    expect(s.icons).toHaveLength(0);
    expect(activeMapOf(s).drawings).toHaveLength(1);
  });

  it("unknown ops are tolerated", () => {
    const s = emptyState();
    expect(() => applyOp(s, { op: "future.op", data: 1 })).not.toThrow();
  });

  it("normalizeState migrates the v1 (pre-multiplayer) localStorage shape", () => {
    const v1 = {
      backdrop: "data:image/jpeg;base64,BBB",
      iconLibrary: ["data:image/png;base64,AAA", "data:image/png;base64,CCC"],
      placedIcons: [
        { imageIndex: 1, x: 5, y: 6, width: 32, height: 48 },
        { imageIndex: 9, x: 0, y: 0, width: 10, height: 10 }, // dangling
      ],
      drawings: [PATH, { points: [{ x: 0, y: 0 }] }], // second is degenerate
    };
    const s = normalizeState(v1);
    expect(s.v).toBe(3);
    const map = activeMapOf(s);
    expect(map.backdrop.src).toBe("data:image/jpeg;base64,BBB");
    expect(s.icons).toHaveLength(2);
    expect(s.icons[0].name).toBe("Icon 1");
    expect(map.pieces).toHaveLength(1);
    expect(map.pieces[0].iconId).toBe(s.icons[1].id);
    expect(map.pieces[0].w).toBe(32);
    expect(map.drawings).toHaveLength(1);
  });

  it("normalizeState migrates a v2 (single-map) state into maps[0]", () => {
    const v2 = {
      v: 2,
      backdrop: { src: "data:x", w: 800, h: 600 },
      grid: { on: true, size: 100 },
      icons: [ICON],
      pieces: [{ id: "p1", iconId: "i1", x: 1, y: 2, w: 64, h: 64 }],
      drawings: [PATH],
    };
    const s = normalizeState(v2);
    expect(s.v).toBe(3);
    expect(s.maps).toHaveLength(1);
    expect(s.activeMap).toBe(FIRST_MAP_ID);
    const map = s.maps[0];
    expect(map.backdrop.w).toBe(800);
    expect(map.grid).toEqual({ on: true, size: 100 });
    expect(map.pieces).toHaveLength(1);
    expect(map.drawings).toHaveLength(1);
    expect(map.fog).toEqual([]);
  });

  it("normalizeState (v3) keeps maps, drops dangling pieces, fixes activeMap", () => {
    const s = normalizeState({
      v: 3,
      icons: [ICON],
      activeMap: "ghost",
      maps: [
        {
          id: "mA",
          name: "A",
          pieces: [
            { id: "p1", iconId: "i1", x: 0, y: 0, w: 10, h: 10, hidden: true },
            { id: "p2", iconId: "gone", x: 0, y: 0, w: 10, h: 10 },
          ],
          fog: [FOG_PATCH, { id: "bad", points: [] }],
        },
        null, // garbage member
      ],
    });
    expect(s.maps).toHaveLength(1);
    expect(s.activeMap).toBe("mA");
    expect(s.maps[0].pieces).toHaveLength(1);
    expect(s.maps[0].pieces[0].hidden).toBe(true);
    expect(s.maps[0].fog).toHaveLength(1);
  });

  it("normalizeState tolerates garbage", () => {
    expect(isEmptyState(normalizeState(null))).toBe(true);
    expect(isEmptyState(normalizeState("junk"))).toBe(true);
    expect(isEmptyState(normalizeState({ v: 99 }))).toBe(true);
  });
});
