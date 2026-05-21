// ADC-IMPLEMENTS: <shell-test-federation-01>
// ADC-IMPLEMENTS: <shell-test-federation-cross-section-05>
// ADC-IMPLEMENTS: <shell-test-modularity-02>
// ADC-IMPLEMENTS: <section-test-manifest-01>
// ADC-IMPLEMENTS: <section-test-routing-02>
// ADC-IMPLEMENTS: <section-test-feed-03>
// ADC-IMPLEMENTS: <portfolio-test-add-entry-01>
// ADC-IMPLEMENTS: <portfolio-test-r2-resolution-02>
// ADC-IMPLEMENTS: <stubs-test-stubs-render-01>
// ADC-IMPLEMENTS: <home-test-params-no-precedent-03>
//
// Vitest configuration. Vitest covers every TestScenario that does NOT need a
// real browser — static analysis of built HTML/CSS (federation, stub render),
// pure-JS unit tests (R2 helper, feed loader), and build-orchestrated tests
// that mutate the source tree, run `astro build`, and inspect `dist/`
// (modularity, federation, portfolio-add-entry).
//
// Browser-required scenarios (mobile viewport scrollWidth, engine slot canvas
// pixel changes, the engine swap test, /dnd-tabletop/ HTTP fetch) live in
// `tests/**/*.e2e.js` and run under Playwright; see `playwright.config.js`.
//
// Naming convention enforces the split:
//   *.spec.js → Vitest    (this file's `include` pattern)
//   *.e2e.js  → Playwright (playwright.config.js's `testMatch`)
// Both runners are dispatched by `npm test`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.js"],
    // Some Vitest tests run `astro build` against the real source tree and
    // can take 30+ seconds; give the suite headroom. Per-test timeouts inside
    // the suites tighten this when appropriate.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Tests that mutate `src/` (modularity, federation synthetic sections,
    // portfolio-add-entry) MUST run serially — they hold a lock on the
    // working tree. We disable file parallelism globally; suites are
    // independent across files but share the source tree.
    fileParallelism: false,
    pool: "forks",
    forks: { singleFork: true },
  },
});
