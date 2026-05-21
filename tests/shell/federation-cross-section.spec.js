// ADC-IMPLEMENTS: <shell-test-federation-cross-section-05>
//
// Federation, direction B: a class declared in one section's scoped style
// MUST NOT affect DOM in a different section's route. Section ↔ section
// isolation.
//
// Scenario (from <shell-test-federation-cross-section-05>):
//   - Add synthetic section `test-federation-a/` declaring `body { background: red }`.
//   - Add synthetic section `test-federation-b/` declaring `body { background: blue }`.
//   - Build.
//   - Verify:
//       1. /test-federation-a/ renders with red within its own scope.
//       2. /test-federation-b/ renders with blue within its own scope.
//       3. /test-federation-a/ does NOT contain the blue rule (no leakage B→A).
//       4. /test-federation-b/ does NOT contain the red rule (no leakage A→B).
//       5. CSS for A contains no rules sourced from B and vice versa.
//       6. /portfolio/ effective background is neither red nor blue
//          (spot check for any cross-section leak into a real section).
//
// Implementation strategy mirrors federation.spec.js: write synthetic pages,
// build, inspect dist/, restore.

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

const SLUG_A = "test-federation-a";
const SLUG_B = "test-federation-b";

function syntheticPage(label, color) {
  return `---
import ShellLayout from "../../layouts/ShellLayout.astro";
---
<ShellLayout title="${label}">
  <section class="${label}-page">
    <h1 class="${label}-marker">${label}</h1>
  </section>
</ShellLayout>

<style>
  body {
    background: ${color};
  }

  .${label}-page {
    padding: 2rem;
    background: ${color};
  }
</style>
`;
}

beforeAll(() => {
  writeSyntheticPage(SLUG_A, syntheticPage(SLUG_A, "red"));
  writeSyntheticPage(SLUG_B, syntheticPage(SLUG_B, "blue"));
  astroBuild();
}, 180_000);

afterAll(() => {
  removeSyntheticPage(SLUG_A);
  removeSyntheticPage(SLUG_B);
  astroBuild();
}, 180_000);

// Map each CSS color keyword to the set of forms a CSS minifier might emit.
// Vite/Astro's CSS pipeline shortens `blue` → `#00f` (1 byte saved) but
// leaves `red` as-is (same length as `#f00`). We accept any equivalent form
// because the contract is about rule semantics, not literal text.
const COLOR_FORMS = {
  red: ["red", "#f00", "#ff0000"],
  blue: ["blue", "#00f", "#0000ff"],
};

function hasBodyBackground(css, color) {
  const flat = css.replace(/\s+/g, "");
  const forms = COLOR_FORMS[color];
  if (!forms) {
    throw new Error(`hasBodyBackground: unknown color "${color}"`);
  }
  for (const form of forms) {
    // Escape `#` for the regex (technically not needed but explicit).
    const esc = form.replace(/[#]/g, "\\#");
    const re = new RegExp(
      `(^|[^a-zA-Z0-9-])body(\\[[^\\]]*\\])?\\{background:${esc}[;}]`,
    );
    if (re.test(flat)) return true;
  }
  return false;
}

describe("<shell-test-federation-cross-section-05>: sections do not leak into other sections", () => {
  it("/test-federation-a/ contains its own red rule (sanity)", () => {
    const html = readBuiltHtml(`/${SLUG_A}/`);
    const css = extractStyles(html);
    expect(hasBodyBackground(css, "red")).toBe(true);
  });

  it("/test-federation-b/ contains its own blue rule (sanity)", () => {
    const html = readBuiltHtml(`/${SLUG_B}/`);
    const css = extractStyles(html);
    expect(hasBodyBackground(css, "blue")).toBe(true);
  });

  it("/test-federation-a/ does NOT contain a `body { background: blue }` rule (no B→A leak)", () => {
    const html = readBuiltHtml(`/${SLUG_A}/`);
    const css = extractStyles(html);
    expect(hasBodyBackground(css, "blue")).toBe(false);
  });

  it("/test-federation-b/ does NOT contain a `body { background: red }` rule (no A→B leak)", () => {
    const html = readBuiltHtml(`/${SLUG_B}/`);
    const css = extractStyles(html);
    expect(hasBodyBackground(css, "red")).toBe(false);
  });

  it("/test-federation-a/ CSS references no `test-federation-b` selectors", () => {
    const html = readBuiltHtml(`/${SLUG_A}/`);
    const css = extractStyles(html);
    expect(css.includes("test-federation-b")).toBe(false);
  });

  it("/test-federation-b/ CSS references no `test-federation-a` selectors", () => {
    const html = readBuiltHtml(`/${SLUG_B}/`);
    const css = extractStyles(html);
    expect(css.includes("test-federation-a")).toBe(false);
  });

  it("/portfolio/ background is neither red nor blue (spot check)", () => {
    const html = readBuiltHtml("/portfolio/");
    const css = extractStyles(html);
    expect(hasBodyBackground(css, "red")).toBe(false);
    expect(hasBodyBackground(css, "blue")).toBe(false);
    expect(css.includes("test-federation-a")).toBe(false);
    expect(css.includes("test-federation-b")).toBe(false);
  });
});
