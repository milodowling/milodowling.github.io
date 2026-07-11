// ADC-IMPLEMENTS: <dnd-test-multiplayer-04>
//
// End-to-end proof that shared tables work: two real browser contexts join
// the same room through a real dnd-sync Worker (wrangler dev, booted by the
// playwright webServer block) and see each other's map, tokens, and
// drawings live.
//
// Assertions read each client's localStorage mirror (the client persists
// every applied op, local or remote), plus one canvas-pixel check to prove
// remote ops actually render.

import { test, expect } from "@playwright/test";

// 1x1 red PNG — enough for icon and backdrop uploads.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function tableOf(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("dndTabletopV2") || "null"),
  );
}

test.describe("<dnd-test-multiplayer-04>: two clients share a live table", () => {
  test("host starts a table; guest joins and both see live updates", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // --- host starts a table ---
    await pageA.goto("/dnd-tabletop/");
    await expect(pageA.locator("#startTableBtn")).toBeEnabled();
    await pageA.click("#startTableBtn");
    await expect(pageA.locator("#statusDot")).toHaveClass(/live/, {
      timeout: 15_000,
    });
    const roomCode = await pageA.locator("#roomCodeLabel").textContent();
    expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);

    // --- guest joins via the shared link ---
    await pageB.goto("/dnd-tabletop/#room=" + roomCode);
    await expect(pageB.locator("#statusDot")).toHaveClass(/live/, {
      timeout: 15_000,
    });
    await expect(pageA.locator("#peersLabel")).toHaveText(/2 connected/, {
      timeout: 15_000,
    });
    await expect(pageB.locator("#peersLabel")).toHaveText(/2 connected/);

    // --- host draws; guest sees the drawing (state + pixels) ---
    const canvasA = pageA.locator("#mainCanvas");
    const box = await canvasA.boundingBox();
    await pageA.mouse.move(box.x + 300, box.y + 250);
    await pageA.mouse.down();
    await pageA.mouse.move(box.x + 450, box.y + 350, { steps: 10 });
    await pageA.mouse.up();

    await expect
      .poll(async () => (await tableOf(pageA))?.drawings?.length ?? 0)
      .toBe(1);
    await expect
      .poll(async () => (await tableOf(pageB))?.drawings?.length ?? 0, {
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
      .poll(async () => (await tableOf(pageB))?.drawings?.length ?? 0, {
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
      .poll(async () => (await tableOf(pageB))?.pieces?.length ?? 0, {
        timeout: 10_000,
      })
      .toBe(1);

    // --- guest toggles the grid; host follows ---
    await pageB.locator("#gridToggle").check();
    await expect
      .poll(async () => (await tableOf(pageA))?.grid?.on ?? false, {
        timeout: 10_000,
      })
      .toBe(true);

    // --- host sets a backdrop (map); guest receives it ---
    await pageA.setInputFiles("#backdropInput", {
      name: "map.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect
      .poll(async () => Boolean((await tableOf(pageB))?.backdrop), {
        timeout: 10_000,
      })
      .toBe(true);

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
          return t
            ? {
                icons: t.icons.length,
                pieces: t.pieces.length,
                backdrop: Boolean(t.backdrop),
                grid: t.grid.on,
              }
            : null;
        },
        { timeout: 15_000 },
      )
      .toEqual({ icons: 1, pieces: 1, backdrop: true, grid: true });

    await ctxA.close();
    await ctxB.close();
    await ctxC.close();
  });
});
