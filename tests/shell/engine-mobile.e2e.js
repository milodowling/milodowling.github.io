// ADC-IMPLEMENTS: <home-test-mobile-degradation-02>
//
// Verifies the engine placeholder degrades gracefully on a 375px viewport:
//
//   1. Homepage renders (no thrown errors, no unhandled rejections).
//   2. No horizontal scroll (scrollWidth <= 375). This overlaps with
//      <shell-test-mobile-03>; both must pass.
//   3. If WebGL initialization fails entirely, the homepage must still
//      render (a neutral fallback may show but the page is not broken).
//      Playwright with normal Chromium has WebGL2 available, so the
//      WebGL-fails branch is hard to exercise without emulation. We test
//      both the "WebGL available" path here and document the
//      WebGL-unavailable behavior at the source level
//      (PlaceholderShader.jsx adds an `engine-slot-canvas--no-webgl`
//      class on context-creation failure — see the conditional CSS rule
//      in Hero.astro for the fallback striping).
//   4. No console errors at `error` level during a 2-second observation
//      window.

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test.describe("<home-test-mobile-degradation-02>: engine placeholder degrades gracefully on 375px", () => {
  test("/ renders without thrown errors, no unhandled rejections, no console errors", async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(String(err));
    });

    await page.goto("/", { waitUntil: "networkidle" });
    // 2-second observation window.
    await page.waitForTimeout(2000);

    expect(
      pageErrors,
      `Page-level errors during homepage load: ${pageErrors.join(", ")}`,
    ).toEqual([]);
    expect(
      consoleErrors,
      `Console errors during homepage load: ${consoleErrors.join(", ")}`,
    ).toEqual([]);
  });

  test("/ at 375px has no horizontal scroll", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test("the canvas mounts at 375px (engine slot is present) and the page renders", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    // The canvas is the engine slot's render target. On a 375px viewport
    // it should still mount (with DPR clamped per PlaceholderShader's
    // mobile branch). The hero section + canvas must both exist.
    await expect(page.locator(".shell-hero")).toHaveCount(1);
    await expect(page.locator("canvas.engine-slot-canvas")).toHaveCount(1);
    // The shell-hero-overlay (wordmark + tagline) must also be visible.
    await expect(page.locator(".shell-hero-name")).toHaveCount(1);
  });
});
