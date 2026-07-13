// ADC-IMPLEMENTS: <dnd-impl-sync-worker-04> <dnd-feature-roles-09>
// ADC-IMPLEMENTS: <dnd-feature-presence-08>
//
// dnd-sync Worker — realtime room server for the D&D tabletop.
// See contracts/ADC_006_DND_TABLETOP.md (<dnd-feature-multiplayer-02>).
//
// One room = one Durable Object (idFromName(roomCode)). The DO is the
// authority for table state: it applies every op through the same reducer
// the client uses, persists the result, and rebroadcasts the op to the
// other connected clients. Late joiners get a full snapshot. Uses the
// WebSocket Hibernation API so idle rooms cost nothing; state is lazily
// reloaded from DO storage after hibernation, and each socket's role
// survives hibernation via serializeAttachment.
//
// Roles: the first client to claim (`hello.claimGm`) mints the room's
// gmKey; presenting the key on hello re-grants GM on any device. GM-gated
// ops (`fog.*`, `map.*`) from non-GM sockets are dropped, and the `hidden`
// token field is stripped from non-GM piece ops. Everything else stays
// everyone-editable by design (friends table).
//
// Ephemeral messages (pings, rulers) are relayed to the other sockets
// verbatim — never reduced, never persisted.
//
// Storage layout (SQLite-backed KV, 2 MiB value cap):
//   gmKey                  the room's GM capability key
//   doc                    state JSON with image srcs stripped (small,
//                          rewritten on every op)
//   blob:backdrop:<mapId>:*  per-map backdrop dataURL, chunked
//   blob:icon:<id>:*       icon dataURL, chunked
// Blobs are only rewritten by the ops that change them, so a token move
// never rewrites a multi-MB map image.

import {
  emptyState,
  applyOp,
  normalizeState,
} from "../../../public/dnd-tabletop/reducer.js";
import {
  encodeFrames,
  FrameAssembler,
} from "../../../public/dnd-tabletop/sync-protocol.js";

const ROOM_CODE_RE = /^[A-Za-z0-9-]{4,32}$/;
const BLOB_CHUNK = 1_000_000; // chars per storage value, under the 2 MiB cap

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response("dnd-sync ok", { status: 200 });
    }

    const match = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!match) return new Response("not found", { status: 404 });
    const code = match[1];
    if (!ROOM_CODE_RE.test(code)) {
      return new Response("bad room code", { status: 400 });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }

    const id = env.ROOM.idFromName(code.toUpperCase());
    return env.ROOM.get(id).fetch(request);
  },
};

export class TableRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.state = null; // in-memory table state; reloaded after hibernation
    this.assemblers = new Map(); // ws -> FrameAssembler (transient; see note)
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation API: the runtime holds the socket and wakes us per message.
    this.ctx.acceptWebSocket(server);
    this.broadcastPeers();
    return new Response(null, { status: 101, webSocket: client });
  }

  isGm(ws) {
    try {
      return !!ws.deserializeAttachment()?.gm;
    } catch {
      return false;
    }
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string") return; // protocol is JSON text frames

    // Chunk groups are sent back-to-back by one client, so a partial buffer
    // lost to hibernation mid-message is unlikely; the client also resends
    // its snapshot on reconnect, which heals any dropped logical message.
    let assembler = this.assemblers.get(ws);
    if (!assembler) {
      assembler = new FrameAssembler();
      this.assemblers.set(ws, assembler);
    }

    let message;
    try {
      message = assembler.feed(raw);
    } catch {
      return; // malformed frame — drop it
    }
    if (message === null) return; // chunked message still incomplete

    if (message.t === "hello") {
      await this.ensureState();
      const grant = await this.resolveRole(message);
      ws.serializeAttachment({ gm: grant.gm });
      this.sendTo(ws, {
        t: "snapshot",
        state: this.state,
        role: grant.gm ? "gm" : "player",
        ...(grant.gm ? { gmKey: grant.gmKey } : {}),
      });
      return;
    }

    if (message.t === "ephemeral") {
      // Presence traffic: relay, never reduce, never persist.
      for (const peer of this.ctx.getWebSockets()) {
        if (peer !== ws) this.sendTo(peer, message);
      }
      return;
    }

    if (message.t === "op" && message.op) {
      const op = message.op;
      const gm = this.isGm(ws);
      if (!gm) {
        // GM-gated vocabulary: fog and map management.
        if (/^(fog|map)\./.test(op.op)) return;
        // Players can't hide/unhide tokens.
        if (op.op === "piece.add" && op.piece) delete op.piece.hidden;
        if (op.op === "piece.update") delete op.hidden;
      }
      await this.ensureState();
      applyOp(this.state, op);
      await this.persist(op);
      for (const peer of this.ctx.getWebSockets()) {
        if (peer !== ws) this.sendTo(peer, { t: "op", op });
      }
    }
  }

  async resolveRole(hello) {
    let gmKey = await this.ctx.storage.get("gmKey");
    if (hello.claimGm && !gmKey) {
      gmKey = crypto.randomUUID().replaceAll("-", "");
      await this.ctx.storage.put("gmKey", gmKey);
      return { gm: true, gmKey };
    }
    if (gmKey && hello.gmKey === gmKey) return { gm: true, gmKey };
    return { gm: false };
  }

  webSocketClose(ws) {
    this.assemblers.delete(ws);
    this.broadcastPeers(ws);
  }

  webSocketError(ws) {
    this.assemblers.delete(ws);
    this.broadcastPeers(ws);
  }

  sendTo(ws, message) {
    try {
      for (const frame of encodeFrames(message)) ws.send(frame);
    } catch {
      // Socket already gone; close events handle the peer count.
    }
  }

  broadcastPeers(closing) {
    const sockets = this.ctx.getWebSockets().filter((s) => s !== closing);
    const frame = JSON.stringify({ t: "peers", n: sockets.length });
    for (const ws of sockets) {
      try {
        ws.send(frame);
      } catch {
        // ignore
      }
    }
  }

  // ---- persistence ----

  async ensureState() {
    if (this.state) return;
    const doc = await this.ctx.storage.get("doc");
    if (!doc) {
      this.state = emptyState();
      return;
    }
    const state = normalizeState(JSON.parse(doc));
    for (const map of state.maps) {
      if (!map.backdrop) continue;
      map.backdrop.src = await this.getBlob("blob:backdrop:" + map.id);
      if (!map.backdrop.src) map.backdrop = null;
    }
    for (const icon of [...state.icons]) {
      icon.src = await this.getBlob("blob:icon:" + icon.id);
      if (!icon.src) applyOp(state, { op: "icon.remove", id: icon.id });
    }
    this.state = state;
  }

  async persist(op) {
    switch (op.op) {
      case "backdrop.set": {
        // Same resolution the reducer used: explicit map, else active. A
        // ghost map id means the reducer no-oped — don't orphan a blob.
        const mapId = op.map ?? this.state.activeMap;
        if (!this.state.maps.some((m) => m.id === mapId)) break;
        if (op.src) await this.putBlob("blob:backdrop:" + mapId, op.src);
        else await this.deleteBlob("blob:backdrop:" + mapId);
        break;
      }
      case "icon.add":
        if (op.icon && op.icon.id) {
          await this.putBlob("blob:icon:" + op.icon.id, op.icon.src);
        }
        break;
      case "icon.remove":
        await this.deleteBlob("blob:icon:" + op.id);
        break;
      case "map.remove":
        // Only if the reducer actually removed it (the last map survives).
        if (!this.state.maps.some((m) => m.id === op.id)) {
          await this.deleteBlob("blob:backdrop:" + op.id);
        }
        break;
      case "state.replace": {
        await this.deleteBlobPrefix("blob:");
        for (const map of this.state.maps) {
          if (map.backdrop) {
            await this.putBlob("blob:backdrop:" + map.id, map.backdrop.src);
          }
        }
        for (const icon of this.state.icons) {
          await this.putBlob("blob:icon:" + icon.id, icon.src);
        }
        break;
      }
      default:
        break;
    }

    // The doc (everything except image srcs) is small; rewrite it every op.
    const doc = {
      ...this.state,
      maps: this.state.maps.map((map) => ({
        ...map,
        backdrop: map.backdrop
          ? { w: map.backdrop.w, h: map.backdrop.h, src: "blob" }
          : null,
      })),
      icons: this.state.icons.map(({ id, name }) => ({ id, name, src: "blob" })),
    };
    await this.ctx.storage.put("doc", JSON.stringify(doc));
  }

  async putBlob(name, value) {
    await this.deleteBlobPrefix(name + ":");
    const str = String(value ?? "");
    const n = Math.max(1, Math.ceil(str.length / BLOB_CHUNK));
    const entries = { [name + ":n"]: n };
    for (let i = 0; i < n; i++) {
      entries[name + ":" + i] = str.slice(i * BLOB_CHUNK, (i + 1) * BLOB_CHUNK);
    }
    await this.ctx.storage.put(entries);
  }

  async getBlob(name) {
    const n = await this.ctx.storage.get(name + ":n");
    if (!n) return null;
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push((await this.ctx.storage.get(name + ":" + i)) ?? "");
    }
    return parts.join("");
  }

  async deleteBlob(name) {
    await this.deleteBlobPrefix(name + ":");
  }

  async deleteBlobPrefix(prefix) {
    const keys = await this.ctx.storage.list({ prefix });
    if (keys.size) await this.ctx.storage.delete([...keys.keys()]);
  }
}
