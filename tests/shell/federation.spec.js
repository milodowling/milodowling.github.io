// ADC-IMPLEMENTS: <shell-test-federation-01>
//
// Federation, direction A: section styles MUST NOT leak into the shell.
//
// Scenario (from <shell-test-federation-01>):
//   - Add a synthetic section `test-federation/` with a scoped style that
//     declares `body { background: red; }`.
//   - Build the site.
//   - Verify:
//       1. The synthetic section's page contains the red rule (in its own
//          scoped CSS).
//       2. The shell's homepage and other shell-owned chrome pages do NOT
//          have the red rule applied.
//       3. The CSS for the shell's homepage and shell chrome contains no
//          rules whose selectors include `test-federation`-namespaced
//          classes nor the unscoped `body { background: red }` declaration.
//
// Implementation:
//   - We write the synthetic page, run `astro build`, read dist/, then
//     restore. Astro inlines per-page CSS into a `<style>` block inside the
//     route's `<head>`. The federation contract is satisfied if and only if
//     the homepage's inlined CSS contains zero references to the synthetic
//     section's namespace and contains no `body{background:red}` (or
//     equivalent normalized variants).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  astroBuild,
  extractStyles,
  readBuiltHtml,
} from "../_helpers/build.js";
import {
  removeSyntheticPage,
  writeSyntheticPage,
} from "../_helpers/tree.js";

const SLUG = "test-federation";

// Astro scopes styles to the page by appending a `data-astro-cid-...`
// attribute on selectors. The synthetic page's body rule will compile into a
// page-scoped selector — NOT a global `body { background: red }`.
// To prove federation, the homepage's CSS must contain neither of:
//   (a) any selector mentioning the synthetic namespace (a class like
//       `test-federation-*` or scope hash that came from this page), and
//   (b) any unscoped `body { background: red }` rule.
const SYNTHETIC_PAGE = `---
// Synthetic page for <shell-test-federation-01>. Declares a scoped style
// that — if Astro's scoping mechanism leaks — would tint the entire shell
// red. The federation contract holds iff the homepage CSS contains no
// trace of this rule.
import ShellLayout from "../../layouts/ShellLayout.astro";
---
<ShellLayout title="test-federation">
  <section class="test-federation-page">
    <h1 class="test-federation-marker">Test Federation Sentinel</h1>
  </section>
</ShellLayout>

<style>
  /* Per the contract, the synthetic page declares an unscoped \`body\`
     selector that would, if scoping were broken, turn EVERY shell page
     red. Astro's scoped-styles mechanism is supposed to rewrite this to
     a page-scoped selector. */
  body {
    background: red;
  }

  .test-federation-page {
    padding: 2rem;
    background: red;
  }

  .test-federation-marker {
    color: white;
  }
</style>
`;

beforeAll(() => {
  writeSyntheticPage(SLUG, SYNTHETIC_PAGE);
  astroBuild();
}, 180_000);

afterAll(() => {
  removeSyntheticPage(SLUG);
  astroBuild();
}, 180_000);

/**
 * Detect an effective `body { background: red }` rule applied by a page's
 * inlined CSS. We strip whitespace and look for the declaration in any
 * `body` selector — including selectors that Astro suffixed with a scope
 * hash. The Vite/Astro CSS pipeline may shorten color keywords (e.g.,
 * `blue` → `#00f`), so we accept any equivalent form.
 *
 * Astro scoping adds a `[data-astro-cid-...]` attribute selector to each
 * scoped selector. We accept both forms because *either* the rule is
 * unscoped (federation violation: it leaks) OR the rule is scoped to a
 * page (which is contained — only an issue if it appears in another page's
 * CSS).
 *
 * @param {string} css
 * @returns {boolean}
 */
function hasBodyBackgroundRed(css) {
  const flat = css.replace(/\s+/g, "");
  for (const form of ["red", "#f00", "#ff0000"]) {
    const esc = form.replace(/[#]/g, "\\#");
    const re = new RegExp(
      `(^|[^a-zA-Z0-9-])body(\\[[^\\]]*\\])?\\{background:${esc}[;}]`,
    );
    if (re.test(flat)) return true;
  }
  return false;
}

describe("<shell-test-federation-01>: section styles do not leak to the shell", () => {
  it("the synthetic page itself contains the red rule (sanity)", () => {
    const html = readBuiltHtml(`/${SLUG}/`);
    const css = extractStyles(html);
    expect(hasBodyBackgroundRed(css)).toBe(true);
  });

  it("the homepage's inlined CSS does NOT contain the synthetic section's body-red rule", () => {
    const html = readBuiltHtml("/");
    const css = extractStyles(html);
    expect(
      hasBodyBackgroundRed(css),
      "Homepage CSS leaked a `body { background: red }` rule from the synthetic section",
    ).toBe(false);
  });

  it("the homepage's inlined CSS does NOT contain any `test-federation`-namespaced classes", () => {
    const html = readBuiltHtml("/");
    const css = extractStyles(html);
    expect(
      /test-federation/.test(css),
      "Homepage CSS contains a `test-federation` namespaced selector — section leaked into shell",
    ).toBe(false);
  });

  for (const route of ["/portfolio/", "/synth/", "/dnd/", "/tools/"]) {
    it(`${route} CSS does NOT contain the synthetic section's body-red rule`, () => {
      const html = readBuiltHtml(route);
      const css = extractStyles(html);
      expect(hasBodyBackgroundRed(css)).toBe(false);
      expect(/test-federation/.test(css)).toBe(false);
    });
  }
});
