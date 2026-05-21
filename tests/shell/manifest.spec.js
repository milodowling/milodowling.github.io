// ADC-IMPLEMENTS: <section-test-manifest-01>
//
// Verifies that the section manifest drives nav ordering and the `enabled`
// flag. The contract sets the manifest to:
//
//   [
//     { slug: "tools",     label: "Tools",     enabled: true  },
//     { slug: "portfolio", label: "Portfolio", enabled: true  },
//     { slug: "synth",     label: "Synth",     enabled: false },
//     { slug: "dnd",       label: "D&D",       enabled: true  },
//   ]
//
// ...then asserts:
//   1. Nav renders three items in order: Tools, Portfolio, D&D.
//   2. Synth is absent from nav.
//   3. /synth/ still returns 200 (filesystem routing is enabled-independent).
//   4. Each nav link's href is /<slug>/.
//
// Implementation strategy:
//   - Mutate src/sections.config.js to the contract's order.
//   - Run `astro build`.
//   - Read dist/index.html and dist/synth/index.html.
//   - Inspect the rendered nav (parsed from raw HTML — no DOM needed).
//   - Restore the manifest in afterAll. The test is single-fork so this
//     mutation is serialized with the other build-mutating specs.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildManifestSource,
  readManifestSource,
  writeManifestSource,
} from "../_helpers/tree.js";
import {
  astroBuild,
  builtHtmlExists,
  readBuiltHtml,
} from "../_helpers/build.js";

let originalManifest = "";

beforeAll(() => {
  originalManifest = readManifestSource();
  // Per the contract scenario.
  const next = buildManifestSource([
    { slug: "tools", label: "Tools", enabled: true },
    { slug: "portfolio", label: "Portfolio", enabled: true },
    { slug: "synth", label: "Synth", enabled: false },
    { slug: "dnd", label: "D&D", enabled: true },
  ]);
  writeManifestSource(next);
  astroBuild();
}, 180_000);

afterAll(() => {
  writeManifestSource(originalManifest);
  astroBuild();
}, 180_000);

/**
 * Parse the nav links out of a built page's HTML. The nav is rendered by
 * `src/components/Nav.astro` with the locked class `shell-nav` and items
 * `shell-nav-item`. We grab the `<nav class="shell-nav...">` block and
 * extract each `<a class="shell-nav-link" href="...">label</a>`.
 *
 * @param {string} html
 * @returns {Array<{href: string, label: string}>}
 */
function parseNavLinks(html) {
  // Find the nav block. Astro adds data-astro-cid hashes; match loosely.
  const navMatch = html.match(/<nav[^>]*class="[^"]*shell-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/);
  if (!navMatch) return [];
  const block = navMatch[1];
  const out = [];
  const linkRe = /<a[^>]*class="[^"]*shell-nav-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = linkRe.exec(block)) !== null) {
    out.push({
      href: m[1],
      // Decode HTML entities used in labels (e.g., `D&amp;D` for "D&D"). The
      // raw text node is what the user sees, so we normalize before comparing.
      label: m[2].replace(/&amp;/g, "&").trim(),
    });
  }
  return out;
}

describe("<section-test-manifest-01>: manifest drives nav order and the enabled flag", () => {
  it("nav renders three items in declared order: Tools, Portfolio, D&D", () => {
    const html = readBuiltHtml("/");
    const links = parseNavLinks(html);
    expect(links.map((l) => l.label)).toEqual(["Tools", "Portfolio", "D&D"]);
  });

  it("the disabled Synth entry is absent from nav", () => {
    const html = readBuiltHtml("/");
    const links = parseNavLinks(html);
    expect(links.find((l) => /synth/i.test(l.label))).toBeUndefined();
    expect(links.find((l) => l.href === "/synth/")).toBeUndefined();
  });

  it("/synth/ still routes (filesystem routing is enabled-independent)", () => {
    expect(builtHtmlExists("/synth/")).toBe(true);
    const html = readBuiltHtml("/synth/");
    // The page itself uses ShellLayout, so the synth stub still renders with
    // nav (which now hides synth). The route's HTML is non-empty.
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/<h1[^>]*>Synth<\/h1>/);
  });

  it("each nav link href has the shape /<slug>/", () => {
    const html = readBuiltHtml("/");
    const links = parseNavLinks(html);
    for (const link of links) {
      expect(link.href).toMatch(/^\/[a-z0-9-]+\/$/);
    }
  });
});
