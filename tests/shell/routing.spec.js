// ADC-IMPLEMENTS: <section-test-routing-02>
//
// Verifies filesystem-driven section routing. With the default manifest in
// place:
//
//   1. /portfolio/ returns 200 and renders the portfolio index.
//   2. /portfolio/<existing-entry-slug>/ returns 200 and renders the entry.
//   3. /synth/, /dnd/, /tools/ return 200 and render their stub pages.
//   4. /<nonexistent>/ returns 404 (no dist/ artifact exists).
//   5. Section pages that import ShellLayout render with the shell nav and
//      header chrome.
//
// We build the site (the manifest-spec restored the default manifest in its
// afterAll, so this run uses the default config) and then inspect dist/
// for the routes. "Returns 200" in a static-build context means "the
// `dist/<route>/index.html` file exists and contains a non-empty document."
// "Returns 404" means "the route's dist/ artifact does not exist" — Pages
// will emit a 404 at runtime since no file is found.

import { beforeAll, describe, expect, it } from "vitest";
import { astroBuild, builtHtmlExists, readBuiltHtml } from "../_helpers/build.js";

beforeAll(() => {
  // Defensive build. Cheap if dist/ is already current; correctness-critical
  // if a prior failing spec left dist/ in an unexpected state.
  astroBuild();
}, 180_000);

describe("<section-test-routing-02>: filesystem routing resolves all section pages", () => {
  it("/portfolio/ renders the portfolio index", () => {
    expect(builtHtmlExists("/portfolio/")).toBe(true);
    const html = readBuiltHtml("/portfolio/");
    expect(html).toMatch(/<h1[^>]*>Portfolio<\/h1>/);
  });

  it("/portfolio/placeholder-entry/ renders the entry page", () => {
    // The placeholder entry was committed in Phase 3; its slug is
    // "placeholder-entry" (filename stem). The contract step 2 only
    // requires one existing entry route to resolve; we use the real one.
    expect(builtHtmlExists("/portfolio/placeholder-entry/")).toBe(true);
    const html = readBuiltHtml("/portfolio/placeholder-entry/");
    expect(html).toMatch(/Placeholder Entry/);
  });

  it("/synth/ renders the synth stub", () => {
    expect(builtHtmlExists("/synth/")).toBe(true);
    expect(readBuiltHtml("/synth/")).toMatch(/<h1[^>]*>Synth<\/h1>/);
  });

  it("/dnd/ renders the D&D stub", () => {
    expect(builtHtmlExists("/dnd/")).toBe(true);
    expect(readBuiltHtml("/dnd/")).toMatch(/<h1[^>]*>D&amp;D<\/h1>/);
  });

  it("/tools/ renders the tools stub", () => {
    expect(builtHtmlExists("/tools/")).toBe(true);
    expect(readBuiltHtml("/tools/")).toMatch(/<h1[^>]*>Tools<\/h1>/);
  });

  it("a nonexistent section returns no dist artifact (Pages 404 at runtime)", () => {
    expect(builtHtmlExists("/this-section-does-not-exist/")).toBe(false);
  });

  it("section pages render with the shell layout (header chrome present)", () => {
    for (const route of ["/portfolio/", "/synth/", "/dnd/", "/tools/"]) {
      const html = readBuiltHtml(route);
      // The shell header contains the wordmark + nav.
      expect(html, `${route} should carry the shell header`).toMatch(
        /<a[^>]*class="[^"]*shell-wordmark[^"]*"[^>]*>milodowling<\/a>/,
      );
      expect(html, `${route} should carry the shell nav`).toMatch(
        /<nav[^>]*class="[^"]*shell-nav[^"]*"/,
      );
    }
  });
});
