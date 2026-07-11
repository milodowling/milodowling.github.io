// ADC-IMPLEMENTS: <dnd-test-protocol-03>
//
// Round-trip coverage for the chunked wire protocol. Table states carry
// image dataURLs well past the Workers 1 MiB WebSocket frame cap, so
// correctness of split/reassemble (including interleaved senders) is
// load-bearing for multiplayer.

import { describe, expect, it } from "vitest";
import {
  encodeFrames,
  FrameAssembler,
  CHUNK_CHARS,
} from "../../public/dnd-tabletop/sync-protocol.js";

describe("<dnd-test-protocol-03>: sync wire protocol", () => {
  it("small messages pass through as a single frame", () => {
    const msg = { t: "op", op: { op: "draw.clear" } };
    const frames = encodeFrames(msg);
    expect(frames).toHaveLength(1);
    expect(new FrameAssembler().feed(frames[0])).toEqual(msg);
  });

  it("oversized messages chunk and reassemble byte-identically", () => {
    const msg = {
      t: "snapshot",
      state: { blob: "x".repeat(CHUNK_CHARS * 2 + 123) },
    };
    const frames = encodeFrames(msg);
    expect(frames.length).toBeGreaterThan(1);
    for (const frame of frames) {
      expect(frame.length).lessThanOrEqual(CHUNK_CHARS + 200); // envelope overhead
    }
    const assembler = new FrameAssembler();
    let result = null;
    for (const frame of frames) result = assembler.feed(frame);
    expect(result).toEqual(msg);
  });

  it("returns null until a chunked message completes", () => {
    const frames = encodeFrames({ t: "x", d: "y".repeat(CHUNK_CHARS + 1) });
    const assembler = new FrameAssembler();
    expect(assembler.feed(frames[0])).toBeNull();
  });

  it("interleaved chunked messages from different mids both complete", () => {
    const msgA = { t: "a", d: "a".repeat(CHUNK_CHARS + 1) };
    const msgB = { t: "b", d: "b".repeat(CHUNK_CHARS + 1) };
    const [a0, a1] = encodeFrames(msgA);
    const [b0, b1] = encodeFrames(msgB);
    const assembler = new FrameAssembler();
    expect(assembler.feed(a0)).toBeNull();
    expect(assembler.feed(b0)).toBeNull();
    expect(assembler.feed(a1)).toEqual(msgA);
    expect(assembler.feed(b1)).toEqual(msgB);
  });

  it("duplicate frames are ignored", () => {
    const frames = encodeFrames({ t: "x", d: "z".repeat(CHUNK_CHARS + 1) });
    const assembler = new FrameAssembler();
    expect(assembler.feed(frames[0])).toBeNull();
    expect(assembler.feed(frames[0])).toBeNull();
    expect(assembler.feed(frames[1])).toEqual({
      t: "x",
      d: "z".repeat(CHUNK_CHARS + 1),
    });
  });

  it("malformed frames throw (caller drops them)", () => {
    expect(() => new FrameAssembler().feed("not json")).toThrow();
  });
});
