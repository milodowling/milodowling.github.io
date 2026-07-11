// ADC-IMPLEMENTS: <shell-test-mobile-03>
// ADC-IMPLEMENTS: <dnd-test-url-continuity-01>
// ADC-IMPLEMENTS: <dnd-test-multiplayer-04>
// ADC-IMPLEMENTS: <home-test-engine-interface-01>
// ADC-IMPLEMENTS: <home-test-mobile-degradation-02>
//
// Playwright configuration. Playwright covers every TestScenario that
// requires a real browser:
//
//   - <shell-test-mobile-03>            : 375px scrollWidth across all shell routes
//   - <dnd-test-url-continuity-01>      : /dnd-tabletop/ keeps serving the tool
//   - <dnd-test-multiplayer-04>         : two clients share a live table via dnd-sync
//   - <home-test-engine-interface-01>   : engine slot canvas animates + reacts + swaps
//   - <home-test-mobile-degradation-02> : engine on 375px viewport (no errors, no overflow)
//
// Playwright spins up `astro preview` AND the dnd-sync Worker (wrangler dev)
// via the `webServer` block, so the tests run against the production-built
// `dist/` output and a real room server. `npm run test:e2e` builds first; the
// build step is a separate npm script so it can be cached by CI in the future.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.e2e\.js$/,
  // Tests run serially. The engine-slot swap test mutates `src/` and runs
  // `astro build` mid-suite — that clobbers the dist/ directory served by
  // the suite-wide preview server. Serial execution keeps the rest of the
  // suite reading a stable dist/. The suite is small (~20 tests, ~30s
  // total) so the wall-clock cost is acceptable.
  fullyParallel: false,
  workers: 1,
  // No retries — fail loudly per the brief's "no defensive guards" stance.
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Default viewport; mobile tests override per-test via `test.use()`.
    viewport: { width: 1280, height: 720 },
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --host 127.0.0.1 --port " + PORT,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // dnd-sync room server; the tabletop client auto-targets
      // ws://127.0.0.1:8787 when the page itself is served from localhost.
      command: "npm run sync:dev -- --ip 127.0.0.1 --port 8787",
      url: "http://127.0.0.1:8787/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
