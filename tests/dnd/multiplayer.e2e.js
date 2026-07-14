// ADC-IMPLEMENTS: <dnd-test-multiplayer-04>
//
// End-to-end proof that shared tables work: real browser contexts join the
// same room through a real dnd-sync Worker (wrangler dev, booted by the
// playwright webServer block) and see each other's map, tokens, drawings,
// fog, and presence live.
//
// Assertions read each client's live table via the window.__dndTable test
// hook (the localStorage mirror is debounced and per-room since v2.0),
// plus canvas-pixel checks to prove remote ops actually render.

import { test, expect } from "@playwright/test";

// 1x1 red PNG — enough for icon uploads.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function tableOf(page) {
  return page.evaluate(() => window.__dndTable?.() ?? null);
}

function netOf(page) {
  return page.evaluate(() => window.__dndNet?.() ?? null);
}

async function activeMapOf(page) {
  const t = await tableOf(page);
  if (!t) return null;
  return t.maps.find((m) => m.id === t.activeMap) ?? null;
}

/** Screen coords of a world point, replicating the client's fit view. */
async function toScreen(page, wx, wy) {
  return page.evaluate(
    ([wx, wy]) => {
      const t = window.__dndTable();
      const map = t.maps.find((m) => m.id === t.activeMap);
      const wsz = map.backdrop
        ? { w: map.backdrop.w, h: map.backdrop.h }
        : { w: 1920, h: 1080 };
      const canvas = document.getElementById("mainCanvas");
      const scale = Math.min(canvas.width / wsz.w, canvas.height / wsz.h);
      const ox = (canvas.width - wsz.w * scale) / 2;
      const oy = (canvas.height - wsz.h * scale) / 2;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x + wx * scale + ox,
        y: rect.y + wy * scale + oy,
      };
    },
    [wx, wy],
  );
}

/** Generate a solid-color PNG of the given size inside the page. */
async function makePngBuffer(page, w, h, fill) {
  const dataUrl = await page.evaluate(
    ([w, h, fill]) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.fillStyle = fill;
      g.fillRect(0, 0, w, h);
      return c.toDataURL("image/png");
    },
    [w, h, fill],
  );
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

test.describe("<dnd-test-multiplayer-04>: clients share a live table", () => {
  test("host is GM; guest joins; state, fog, presence, and maps sync", async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // --- host starts a table and becomes GM ---
    await pageA.goto("/dnd-tabletop/");
    await expect(pageA.locator("#startTableBtn")).toBeEnabled();
    await pageA.click("#startTableBtn");
    await expect(pageA.locator("#statusDot")).toHaveClass(/live/, {
      timeout: 15_000,
    });
    const roomCode = await pageA.locator("#roomCodeLabel").textContent();
    expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);
    await expect.poll(async () => (await netOf(pageA))?.role).toBe("gm");
    await expect(pageA.locator("#roleBadge")).toBeVisible();
    await expect(pageA.locator("#copyGmLinkBtn")).toBeVisible();
    // The GM key rides the URL — that URL is the reusable GM link.
    expect(pageA.url()).toMatch(/#room=[A-Z2-9]{6}&gm=\w{8,}/);

    // --- guest joins via the shared link, as a player ---
    await pageB.goto("/dnd-tabletop/#room=" + roomCode);
    await expect(pageB.locator("#statusDot")).toHaveClass(/live/, {
      timeout: 15_000,
    });
    await expect(pageA.locator("#peersLabel")).toHaveText(/2 connected/, {
      timeout: 15_000,
    });
    await expect.poll(async () => (await netOf(pageB))?.role).toBe("player");
    await expect(pageB.locator("#roleBadge")).toBeHidden();
    await expect(pageB.locator("#fogModeBtn")).toBeHidden(); // GM-only mode
    await expect(pageA.locator("#fogModeBtn")).toBeVisible();

    // --- host draws; guest sees the drawing (state + pixels) ---
    const canvasA = pageA.locator("#mainCanvas");
    const box = await canvasA.boundingBox();
    await pageA.mouse.move(box.x + 300, box.y + 250);
    await pageA.mouse.down();
    await pageA.mouse.move(box.x + 450, box.y + 350, { steps: 10 });
    await pageA.mouse.up();

    await expect
      .poll(async () => (await activeMapOf(pageA))?.drawings?.length ?? 0)
      .toBe(1);
    await expect
      .poll(async () => (await activeMapOf(pageB))?.drawings?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);

    // Pixel proof on the guest: the default red marker (#cc3333) appears.
    const redVisible = await pageB.evaluate(() => {
      const canvas = document.getElementById("mainCanvas");
      const data = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 4) {
        if (
          Math.abs(data[i] - 0xcc) < 12 &&
          Math.abs(data[i + 1] - 0x33) < 12 &&
          Math.abs(data[i + 2] - 0x33) < 12 &&
          data[i + 3] > 100
        ) {
          return true;
        }
      }
      return false;
    });
    expect(redVisible).toBe(true);

    // --- host undoes; the drawing disappears for the guest too ---
    await pageA.click("#undoBtn");
    await expect
      .poll(async () => (await activeMapOf(pageB))?.drawings?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(0);

    // --- host adds an icon and renames it; guest's library follows ---
    await pageA.setInputFiles("#iconInput", {
      name: "goblin.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(pageA.locator(".icon-item")).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(pageB.locator(".icon-item")).toHaveCount(1, {
      timeout: 10_000,
    });

    await pageA.locator(".icon-rename").click();
    await pageA.locator(".icon-name-input").fill("Boblin");
    await pageA.locator(".icon-name-input").press("Enter");
    await expect(pageB.locator(".icon-name")).toHaveText("Boblin", {
      timeout: 10_000,
    });

    // --- host places the icon on the table; guest gets the token ---
    await pageA.evaluate(() => {
      const item = document.querySelector(".icon-item");
      const dt = new DataTransfer();
      item.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }),
      );
      const canvas = document.getElementById("mainCanvas");
      const rect = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });
    await expect
      .poll(async () => (await activeMapOf(pageB))?.pieces?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);

    // --- guest toggles the grid; host follows ---
    await pageB.locator("#gridToggle").check();
    await expect
      .poll(async () => (await activeMapOf(pageA))?.grid?.on ?? false, {
        timeout: 10_000,
      })
      .toBe(true);

    // --- host uploads an oversize map; it arrives DOWNSCALED on the guest ---
    // (<dnd-feature-robustness-13>: 4000px source → ≤2560px world)
    const bigMap = await makePngBuffer(pageA, 4000, 2500, "#d8cba8");
    await pageA.setInputFiles("#backdropInput", {
      name: "big-map.png",
      mimeType: "image/png",
      buffer: bigMap,
    });
    await expect
      .poll(async () => (await activeMapOf(pageB))?.backdrop?.w ?? 0, {
        timeout: 15_000,
      })
      .toBe(2560);
    expect((await activeMapOf(pageB)).backdrop.h).toBe(1600);

    // --- host brushes fog; guest sees it near-opaque ---
    // (<dnd-feature-fog-10>) Cover stroke through world (300,500)→(900,500).
    await pageA.locator(".mode-btn[data-mode='fog']").click();
    const fogFrom = await toScreen(pageA, 300, 500);
    const fogTo = await toScreen(pageA, 900, 500);
    await pageA.mouse.move(fogFrom.x, fogFrom.y);
    await pageA.mouse.down();
    await pageA.mouse.move(fogTo.x, fogTo.y, { steps: 8 });
    await pageA.mouse.up();

    await expect
      .poll(async () => (await activeMapOf(pageA))?.fog?.length ?? 0)
      .toBe(1);
    await expect
      .poll(async () => (await activeMapOf(pageB))?.fog?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);

    // Pixel proof at the stroke midpoint on the PLAYER's canvas: the light
    // tan backdrop must be buried under near-opaque fog.
    const fogPixel = (page) =>
      page.evaluate(() => {
        const t = window.__dndTable();
        const map = t.maps.find((m) => m.id === t.activeMap);
        const wsz = { w: map.backdrop.w, h: map.backdrop.h };
        const canvas = document.getElementById("mainCanvas");
        const scale = Math.min(canvas.width / wsz.w, canvas.height / wsz.h);
        const ox = (canvas.width - wsz.w * scale) / 2;
        const oy = (canvas.height - wsz.h * scale) / 2;
        const x = Math.round(600 * scale + ox);
        const y = Math.round(500 * scale + oy);
        return [...canvas.getContext("2d").getImageData(x, y, 1, 1).data];
      });
    const fogged = await fogPixel(pageB);
    expect(fogged[0]).toBeLessThan(80); // tan (216,203,168) buried in smoke

    // --- the Worker DROPS GM-gated ops from the player socket ---
    await pageB.evaluate(() => window.__dndSend({ op: "fog.clear" }));
    await pageA.waitForTimeout(1500);
    expect((await activeMapOf(pageA)).fog).toHaveLength(1);

    // --- GM wipes with the Reveal brush; the guest's map comes back ---
    await pageA.locator(".thickness-btn[data-fogtool='reveal']").click();
    await pageA.mouse.move(fogFrom.x, fogFrom.y);
    await pageA.mouse.down();
    await pageA.mouse.move(fogTo.x, fogTo.y, { steps: 8 });
    await pageA.mouse.up();
    await expect
      .poll(async () => (await activeMapOf(pageB))?.fog?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(2);
    await expect
      .poll(async () => (await fogPixel(pageB))[0], { timeout: 10_000 })
      .toBeGreaterThan(140); // the tan backdrop shows through again
    await pageA.locator(".mode-btn[data-mode='draw']").click();

    // --- token label via the piece editor syncs ---
    // (<dnd-feature-token-qol-11>) The piece sits at the world center.
    const pieceWorld = await pageA.evaluate(() => {
      const t = window.__dndTable();
      const map = t.maps.find((m) => m.id === t.activeMap);
      const p = map.pieces[0];
      return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    });
    const pieceScreen = await toScreen(pageA, pieceWorld.x, pieceWorld.y);
    await pageA.mouse.dblclick(pieceScreen.x, pieceScreen.y);
    await expect(pageA.locator("#pieceEditor")).toBeVisible();
    await pageA.locator("#pieceLabelInput").fill("Bloodied");
    await pageA.locator("#pieceLabelInput").press("Enter");
    await expect
      .poll(async () => (await activeMapOf(pageB))?.pieces?.[0]?.label, {
        timeout: 10_000,
      })
      .toBe("Bloodied");

    // --- snap-to-grid: a dragged token lands on a cell center ---
    const dragTo = await toScreen(pageA, 777, 777);
    await pageA.mouse.move(pieceScreen.x, pieceScreen.y);
    await pageA.mouse.down();
    await pageA.mouse.move(dragTo.x, dragTo.y, { steps: 8 });
    await pageA.mouse.up();
    const snapped = await pageA.evaluate(() => {
      const t = window.__dndTable();
      const map = t.maps.find((m) => m.id === t.activeMap);
      const p = map.pieces[0];
      const size = map.grid.size;
      const cx = ((p.x + p.w / 2) % size) / size;
      const cy = ((p.y + p.h / 2) % size) / size;
      return { cx, cy, gridOn: map.grid.on };
    });
    expect(snapped.gridOn).toBe(true);
    expect(Math.abs(snapped.cx - 0.5)).toBeLessThan(0.01);
    expect(Math.abs(snapped.cy - 0.5)).toBeLessThan(0.01);

    // --- ping: host double-clicks empty map; guest receives the ephemeral ---
    // (<dnd-feature-presence-08>)
    const pingAt = await toScreen(pageA, 2300, 200); // top-right, away from the piece
    await pageA.mouse.dblclick(pingAt.x, pingAt.y);
    await expect
      .poll(
        async () =>
          pageB.evaluate(() => window.__dndLastEphemeral?.kind ?? null),
        { timeout: 10_000 },
      )
      .toBe("ping");

    // --- multi-map scenes: host adds a map; everyone follows the switch ---
    // (<dnd-feature-scenes-12>)
    await pageA.locator("#addMapBtn").click();
    await expect
      .poll(async () => (await tableOf(pageB))?.maps?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(2);
    const firstMapId = (await tableOf(pageA)).maps[0].id;
    await expect
      .poll(async () => (await tableOf(pageB))?.activeMap)
      .not.toBe(firstMapId);
    // The new map is empty; the old content is intact on map 1.
    expect((await activeMapOf(pageB)).pieces).toHaveLength(0);

    // Host switches back via the map list; guest follows.
    await pageA.locator(".map-item").first().click();
    await expect
      .poll(async () => (await tableOf(pageB))?.activeMap, {
        timeout: 10_000,
      })
      .toBe(firstMapId);
    expect((await activeMapOf(pageB)).pieces).toHaveLength(1);

    // Guests get no map-management buttons.
    await expect(pageB.locator("#addMapBtn")).toBeHidden();

    // --- a latecomer gets the whole table from the room snapshot ---
    const ctxC = await browser.newContext();
    const pageC = await ctxC.newPage();
    await pageC.goto("/dnd-tabletop/#room=" + roomCode);
    await expect(pageC.locator("#statusDot")).toHaveClass(/live/, {
      timeout: 15_000,
    });
    await expect
      .poll(
        async () => {
          const t = await tableOf(pageC);
          if (!t) return null;
          const map = t.maps.find((m) => m.id === t.activeMap);
          return {
            icons: t.icons.length,
            maps: t.maps.length,
            pieces: map.pieces.length,
            label: map.pieces[0]?.label,
            fog: map.fog.length,
            backdrop: Boolean(map.backdrop),
            grid: map.grid.on,
          };
        },
        { timeout: 15_000 },
      )
      .toEqual({
        icons: 1,
        maps: 2,
        pieces: 1,
        label: "Bloodied",
        fog: 2,
        backdrop: true,
        grid: true,
      });

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });
});
