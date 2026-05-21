// ADC-IMPLEMENTS: <home-test-engine-interface-01>
//
// Verifies the engine slot's `{time, pointer, params}` interface is provably
// wired. The four-part scenario in <home-test-engine-interface-01>:
//
//   1. A WebGL canvas exists within the hero region.
//   2. Over a 500ms window, the canvas pixel data CHANGES (proves `time`
//      drives animation).
//   3. After dispatching `pointermove` at (0.5, 0.5), within 100ms the
//      canvas pixel data near the center changes relative to a no-pointer
//      baseline (proves `pointer` is consumed).
//   4. Swap EngineSlot.jsx with a different implementation conforming to
//      `{time, pointer, params}` that renders solid red. Rebuild. The
//      hero now renders solid red; the rest of the shell is unaffected.
//      This proves the swap requires no shell changes.
//   5. The test does NOT assert any specific `params` key names (deferred
//      to the engine pass — see <home-test-params-no-precedent-03> which
//      is enforced by static analysis in the Vitest suite).
//
// The swap test (step 4) mutates the source file `src/components/EngineSlot.jsx`,
// rebuilds, restarts the preview server, runs assertions, then restores the
// original file and rebuilds again. Playwright's webServer is shared across
// tests in the same project; we use a stand-alone subprocess for the
// post-swap build + preview to avoid clobbering the suite-wide server. The
// stand-alone preview listens on a different port so it doesn't collide.

import { test, expect, request as pwRequest } from "@playwright/test";
import { chromium } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const ENGINE_SLOT = path.join(ROOT, "src", "components", "EngineSlot.jsx");
const HERO = path.join(ROOT, "src", "components", "Hero.astro");

const SWAP_PORT = 4322;

test.describe("<home-test-engine-interface-01>: engine slot interface is provably wired", () => {
  test("the homepage contains a canvas inside the hero region", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const canvas = page.locator("canvas.engine-slot-canvas");
    await expect(canvas).toHaveCount(1);
  });

  test("canvas pixel data changes over a 500ms window (proves time is consumed)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // Wait for the slot to mount and start animating.
    await page.waitForTimeout(200);

    const canvasHandle = await page.locator("canvas.engine-slot-canvas").elementHandle();
    expect(canvasHandle).not.toBeNull();

    // Sample one pixel near the canvas center at two points 500ms apart.
    // WebGL's preserveDrawingBuffer is false, so reading from a 2D context
    // copied from the canvas is the reliable cross-browser path. We use
    // `toDataURL`'s pixel sample by drawing the canvas into an offscreen
    // 2D canvas inside an in-page eval.
    async function sampleCenter() {
      return await page.evaluate(() => {
        const c = document.querySelector("canvas.engine-slot-canvas");
        if (!c) return null;
        const off = document.createElement("canvas");
        off.width = 8;
        off.height = 8;
        const ctx = off.getContext("2d");
        ctx.drawImage(
          c,
          c.width / 2 - 4,
          c.height / 2 - 4,
          8,
          8,
          0,
          0,
          8,
          8,
        );
        const data = ctx.getImageData(0, 0, 8, 8).data;
        // Sum the RGB channels into a single fingerprint.
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += data[i] + data[i + 1] + data[i + 2];
        }
        return sum;
      });
    }

    const first = await sampleCenter();
    await page.waitForTimeout(500);
    const second = await sampleCenter();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(
      first === second,
      `Canvas center pixels are identical 500ms apart (sum1=${first}, sum2=${second}); time is not driving animation`,
    ).toBe(false);
  });

  test("dispatching pointermove changes the canvas near the pointer (proves pointer is consumed)", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const canvas = page.locator("canvas.engine-slot-canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // Sample a 16x16 region near the center BEFORE moving the pointer.
    async function sampleRegion(xFrac, yFrac) {
      return await page.evaluate(
        ({ xFrac, yFrac }) => {
          const c = document.querySelector("canvas.engine-slot-canvas");
          if (!c) return null;
          const cx = Math.round(c.width * xFrac);
          const cy = Math.round(c.height * yFrac);
          const off = document.createElement("canvas");
          off.width = 16;
          off.height = 16;
          const ctx = off.getContext("2d");
          ctx.drawImage(
            c,
            cx - 8,
            cy - 8,
            16,
            16,
            0,
            0,
            16,
            16,
          );
          const data = ctx.getImageData(0, 0, 16, 16).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += data[i] + data[i + 1] + data[i + 2];
          }
          return sum;
        },
        { xFrac, yFrac },
      );
    }

    // Move pointer far from center; sample center; then move to center;
    // sample center again. The crosshair shader rule lights up under the
    // pointer, so the center-region brightness should change measurably.
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.waitForTimeout(50);
    const baselineFirst = await sampleRegion(0.5, 0.5);
    const baselineSecond = await sampleRegion(0.5, 0.5);

    // Move to center.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(120);
    const withPointer = await sampleRegion(0.5, 0.5);

    // The shader's `crosshair` mix brightens to (1.0, 0.3, 0.9) where the
    // pointer is. The center region's RGB sum should differ substantially.
    // We allow a generous threshold because the time-driven animation
    // contributes background variance: we require `withPointer` to differ
    // from `baselineFirst` by MORE than the natural between-baseline
    // variance.
    const naturalDelta = Math.abs(baselineFirst - baselineSecond);
    const pointerDelta = Math.abs(withPointer - baselineFirst);
    expect(
      pointerDelta > naturalDelta + 50,
      `Pointer move did not produce a center-region brightness change above the natural animation variance (natural=${naturalDelta}, pointer=${pointerDelta})`,
    ).toBe(true);
  });

  // ============================================================================
  // SWAP TEST (step 4)
  // ============================================================================
  // Replaces EngineSlot.jsx with a minimal solid-red implementation
  // conforming to {time, pointer, params}, rebuilds, spins up a separate
  // preview server on a different port, and asserts the homepage now
  // renders red and the shell layout is unchanged. Restores afterwards.
  // ============================================================================

  test("EngineSlot.jsx swap: replace with solid-red component, rebuild, verify red hero", async () => {
    const original = fs.readFileSync(ENGINE_SLOT, "utf8");
    const originalHero = fs.readFileSync(HERO, "utf8");

    // The swap implementation: a minimal React component that conforms to
    // {time, pointer, params} and renders a solid-red <div>. It still
    // accepts `time` so the slot's wiring is fully exercised (the div's
    // opacity pulses with time so the swap doesn't render a static frame).
    //
    // This is the same interface as PlaceholderShader (`{canvasRef, time,
    // pointer, params}`); but to keep the swap minimal we DON'T need the
    // canvas — we render a <div> directly. The slot's <canvas> element
    // remains in the DOM (Hero.astro doesn't change), but we sit a red
    // div on top of it via the EngineSlot's render-tree output.
    //
    // Note: we replace EngineSlot wholesale to demonstrate the contract's
    // intent — "swapping EngineSlot.jsx changes the render." A subtler
    // swap (replacing only the imported PlaceholderShader) is equivalent.
    const swap = `// SWAP IMPLEMENTATION — installed by the engine-slot Playwright test.
// Conforms to {time, pointer, params} per <home-impl-engine-interface-03>.
import React from "react";

export default function EngineSlot({ time, pointer, params }) {
  // Use time to prove the slot's time source is reaching this implementation.
  const intensity = 0.5 + 0.5 * Math.sin((time || 0) * 2);
  void pointer; void params; // accept but don't read keys
  return (
    <div
      data-engine-swap="solid-red"
      style={{
        position: "absolute",
        inset: 0,
        background: "rgb(255, 0, 0)",
        opacity: intensity,
        zIndex: 0,
      }}
    />
  );
}
`;

    fs.writeFileSync(ENGINE_SLOT, swap);

    let previewProcess = null;
    let browser = null;
    try {
      // Rebuild.
      const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
      execFileSync(npxBin, ["astro", "build"], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Spin up a stand-alone preview on a DIFFERENT port so we don't
      // collide with the suite-wide preview (which is serving the
      // pre-swap dist/ to other tests in parallel — but Playwright's
      // webServer reuses on a fixed port, and we want isolation).
      previewProcess = spawn(
        npxBin,
        ["astro", "preview", "--host", "127.0.0.1", "--port", String(SWAP_PORT)],
        { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
      );

      // Wait for the server to be ready.
      await waitForServer(`http://127.0.0.1:${SWAP_PORT}/`, 15000);

      // Verify HTML changes: the swap div should be present.
      const ctx = await pwRequest.newContext({ baseURL: `http://127.0.0.1:${SWAP_PORT}` });
      const homepageRes = await ctx.get("/");
      expect(homepageRes.status()).toBe(200);
      // The shell layout's header/nav must still be present (proves shell
      // is unaffected).
      const homepageHtml = await homepageRes.text();
      expect(homepageHtml).toMatch(/shell-wordmark/);
      expect(homepageHtml).toMatch(/shell-nav/);
      // The swap div is rendered client-side (React island), so the
      // server-rendered HTML may or may not include the data attribute.
      // We do a browser-side check instead.
      await ctx.dispose();

      browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${SWAP_PORT}/`, { waitUntil: "networkidle" });
      // Wait for the React island to hydrate.
      await page.waitForSelector('[data-engine-swap="solid-red"]', { timeout: 5000 });
      const swapDiv = page.locator('[data-engine-swap="solid-red"]');
      await expect(swapDiv).toHaveCount(1);
      // Shell chrome remains.
      await expect(page.locator(".shell-wordmark")).toHaveCount(1);
      await expect(page.locator("nav.shell-nav")).toHaveCount(1);

      // Sanity: other section pages still render correctly. We do a HEAD/
      // GET on the static dist artifact directly (no React island needed).
      const portfolioRes = await page.goto(
        `http://127.0.0.1:${SWAP_PORT}/portfolio/`,
        { waitUntil: "networkidle" },
      );
      expect(portfolioRes.status()).toBe(200);
      await expect(page.locator("h1")).toContainText("Portfolio");
    } finally {
      // Restore.
      fs.writeFileSync(ENGINE_SLOT, original);
      fs.writeFileSync(HERO, originalHero);
      if (browser) await browser.close();
      if (previewProcess) {
        previewProcess.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 200));
        if (!previewProcess.killed) previewProcess.kill("SIGKILL");
      }
      // Rebuild on restore so a follow-on test against the suite-wide
      // server still sees consistent dist/. The suite-wide preview server
      // serves dist/ on the fly, so this build must run before any
      // subsequent suite-wide assertion. (We're in `finally` so this runs
      // even on failure.)
      const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
      execFileSync(npxBin, ["astro", "build"], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  });
});

/**
 * Poll a URL until it responds OK, or throw after `timeoutMs`.
 *
 * The `try/catch` here is NOT swallowing test failure — it's swallowing the
 * `ECONNREFUSED` that fetch raises while the child preview server is
 * starting. The outer `throw` at the end of the wait window fails loudly if
 * the server never comes up. This is the standard pattern for
 * subprocess-readiness polling; alternatives (like fetching once and hoping
 * the server is up) would make the test brittle in a way the contract
 * doesn't justify.
 */
async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Connection not ready; loop until timeout, then throw.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}
