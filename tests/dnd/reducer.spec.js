// ADC-IMPLEMENTS: <dnd-test-reducer-02>
//
// Unit coverage for the shared table-state reducer — the op vocabulary both
// the client and the dnd-sync Worker apply. Multiplayer correctness leans on
// these semantics: idempotent adds, tolerated missing ids, v1 migration.

import { describe, expect, it } from "vitest";
import {
  emptyState,
  applyOp,
  normalizeState,
  isEmptyState,
  worldSize,
  DEFAULT_WORLD,
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

function stateWithIcon() {
  const s = emptyState();
  applyOp(s, { op: "icon.add", icon: ICON });
  return s;
}

describe("<dnd-test-reducer-02>: table-state reducer", () => {
  it("empty state is empty and uses the default world", () => {
    const s = emptyState();
    expect(isEmptyState(s)).toBe(true);
    expect(worldSize(s)).toEqual(DEFAULT_WORLD);
  });

  it("backdrop.set installs the backdrop and drives world size", () => {
    const s = emptyState();
    applyOp(s, { op: "backdrop.set", src: "data:x", w: 800, h: 600 });
    expect(s.backdrop).toEqual({ src: "data:x", w: 800, h: 600 });
    expect(worldSize(s)).toEqual({ w: 800, h: 600 });
    expect(isEmptyState(s)).toBe(false);
  });

  it("grid.set clamps size and coerces on", () => {
    const s = emptyState();
    applyOp(s, { op: "grid.set", on: 1, size: 100000 });
    expect(s.grid).toEqual({ on: true, size: 4096 });
    applyOp(s, { op: "grid.set", on: false, size: "nonsense" });
    expect(s.grid.size).toBe(4096); // falls back to previous size
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

  it("icon.remove removes the icon and its placed pieces", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p1", iconId: "i1", x: 0, y: 0, w: 64, h: 64 },
    });
    applyOp(s, { op: "icon.remove", id: "i1" });
    expect(s.icons).toHaveLength(0);
    expect(s.pieces).toHaveLength(0);
  });

  it("piece.add requires a known icon and a fresh id", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "piece.add",
      piece: { id: "p1", iconId: "missing", x: 0, y: 0, w: 64, h: 64 },
    });
    expect(s.pieces).toHaveLength(0);
    const piece = { id: "p1", iconId: "i1", x: 0, y: 0, w: 64, h: 64 };
    applyOp(s, { op: "piece.add", piece });
    applyOp(s, { op: "piece.add", piece });
    expect(s.pieces).toHaveLength(1);
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
    const top = s.pieces[s.pieces.length - 1];
    expect(top.id).toBe("p1");
    expect(top.x).toBe(42);
    expect(top.y).toBe(0);
    expect(top.w).toBe(64);
    // A concurrent-delete race must not throw.
    expect(() =>
      applyOp(s, { op: "piece.update", id: "ghost", x: 1 }),
    ).not.toThrow();
  });

  it("draw.add / draw.remove / draw.clear", () => {
    const s = emptyState();
    applyOp(s, { op: "draw.add", path: PATH });
    applyOp(s, { op: "draw.add", path: PATH }); // duplicate id — no-op
    expect(s.drawings).toHaveLength(1);
    applyOp(s, { op: "draw.remove", ids: ["d1", "ghost"] });
    expect(s.drawings).toHaveLength(0);
    applyOp(s, { op: "draw.add", path: PATH });
    applyOp(s, { op: "draw.clear" });
    expect(s.drawings).toHaveLength(0);
  });

  it("draw.add rejects degenerate paths", () => {
    const s = emptyState();
    applyOp(s, {
      op: "draw.add",
      path: { id: "d2", points: [{ x: 0, y: 0 }], color: "#fff", width: 2 },
    });
    expect(s.drawings).toHaveLength(0);
  });

  it("state.replace swaps in a normalized state", () => {
    const s = stateWithIcon();
    applyOp(s, {
      op: "state.replace",
      state: { v: 2, drawings: [PATH] },
    });
    expect(s.icons).toHaveLength(0);
    expect(s.drawings).toHaveLength(1);
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
    expect(s.v).toBe(2);
    expect(s.backdrop.src).toBe("data:image/jpeg;base64,BBB");
    expect(s.icons).toHaveLength(2);
    expect(s.icons[0].name).toBe("Icon 1");
    expect(s.pieces).toHaveLength(1);
    expect(s.pieces[0].iconId).toBe(s.icons[1].id);
    expect(s.pieces[0].w).toBe(32);
    expect(s.drawings).toHaveLength(1);
  });

  it("normalizeState drops pieces whose icon is missing (v2 input)", () => {
    const s = normalizeState({
      v: 2,
      icons: [ICON],
      pieces: [
        { id: "p1", iconId: "i1", x: 0, y: 0, w: 10, h: 10 },
        { id: "p2", iconId: "gone", x: 0, y: 0, w: 10, h: 10 },
      ],
    });
    expect(s.pieces).toHaveLength(1);
  });

  it("normalizeState tolerates garbage", () => {
    expect(isEmptyState(normalizeState(null))).toBe(true);
    expect(isEmptyState(normalizeState("junk"))).toBe(true);
    expect(isEmptyState(normalizeState({ v: 99 }))).toBe(true);
  });
});
