// ADC-IMPLEMENTS: <dnd-impl-sync-protocol-03>
//
// Wire protocol shared by the tabletop client and the dnd-sync Worker.
//
// Every logical message is a JSON object with a `t` field:
//   {t:"hello"}                       client → server, request snapshot
//   {t:"snapshot", state}             server → client, full table state
//   {t:"op", op:{...}}                either direction, one reducer op
//   {t:"peers", n}                    server → client, connected count
//   {t:"chunk", mid, i, n, d}         transport frame, see below
//
// Workers close WebSocket messages over ~1 MiB, and table states carry
// image dataURLs that routinely exceed that. Any logical message whose JSON
// exceeds CHUNK_CHARS is split into `chunk` frames (`mid` groups them, `i`
// of `n`, `d` payload slice) and reassembled with FrameAssembler on the
// other side. dataURLs are base64/ASCII, so JSON chars ≈ UTF-8 bytes.

export const CHUNK_CHARS = 500_000;

let seq = 0;

/** Serialize a logical message into 1..N wire frames (strings). */
export function encodeFrames(message) {
  const json = JSON.stringify(message);
  if (json.length <= CHUNK_CHARS) return [json];
  const mid = "m" + Math.random().toString(36).slice(2, 10) + seq++;
  const n = Math.ceil(json.length / CHUNK_CHARS);
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push(
      JSON.stringify({
        t: "chunk",
        mid,
        i,
        n,
        d: json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS),
      }),
    );
  }
  return frames;
}

/**
 * Reassembles incoming wire frames into logical messages.
 * feed(raw) returns the decoded message, or null while a chunked message
 * is still incomplete. Malformed frames throw.
 */
export class FrameAssembler {
  constructor() {
    this.buffers = new Map(); // mid -> { parts: Array, received: number }
  }

  feed(raw) {
    const frame = JSON.parse(raw);
    if (frame.t !== "chunk") return frame;

    let buf = this.buffers.get(frame.mid);
    if (!buf) {
      buf = { parts: new Array(frame.n), received: 0 };
      this.buffers.set(frame.mid, buf);
    }
    if (buf.parts[frame.i] === undefined) {
      buf.parts[frame.i] = frame.d;
      buf.received++;
    }
    if (buf.received < frame.n) return null;
    this.buffers.delete(frame.mid);
    return JSON.parse(buf.parts.join(""));
  }
}
