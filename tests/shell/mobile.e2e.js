// ADC-IMPLEMENTS: <shell-test-mobile-03>
//
// Verifies no horizontal scroll at a 375px-wide viewport across every shell
// route. Per <shell-test-mobile-03> step 5, the preserved /dnd-tabletop/
// tool is EXEMPT (it predates the shell), so this test deliberately does
// NOT exercise that route.
//
// Implementation:
//   - Use Playwright at viewport 375x812.
//   - For each shell route, navigate and assert
//     `document.documentElement.scrollWidth <= 375`.
//   - Wait for `networkidle` first so any client-script-driven layout
//     settles before the measurement. (The engine slot's WebGL canvas
//     mounts asynchronously; an early measurement could miss a rogue
//     transform that runs post-mount.)

import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

const ROUTES = [
  "/",
  "/portfolio/",
  "/portfolio/placeholder-entry/",
  "/synth/",
  "/dnd/",
  "/tools/",
];

test.describe("<shell-test-mobile-03>: no horizontal scroll at 375px viewport", () => {
  for (const route of ROUTES) {
    test(`${route} fits within 375px viewport (scrollWidth <= 375)`, async ({ page }) => {
      await page.goto(route, { waitUntil: "networkidle" });
      // Small settle window for the engine slot's first rAF tick + canvas
      // ResizeObserver on the homepage.
      await page.waitForTimeout(300);
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(
        scrollWidth,
        `${route} has horizontal overflow at 375px: scrollWidth=${scrollWidth}`,
      ).toBeLessThanOrEqual(375);
    });
  }

  test("/dnd-tabletop/ is EXEMPT per the contract (test does not assert scrollWidth on it)", () => {
    // <shell-test-mobile-03> step 5 EXPLICITLY exempts /dnd-tabletop/ from
    // the 375px constraint. The preserved tool predates the shell and the
    // contract does not constrain its mobile behavior. This stub test
    // exists to document the exemption alongside the rest of the suite —
    // future maintainers reading the spec can confirm the exemption is
    // intentional, not an oversight.
    expect(true).toBe(true);
  });
});
