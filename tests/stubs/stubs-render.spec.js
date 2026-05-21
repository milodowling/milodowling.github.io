// ADC-IMPLEMENTS: <stubs-test-stubs-render-01>
//
// Verifies that the three deferred-section stubs (synth, D&D, tools) render
// inside the shell layout and that the D&D stub coordinates with the URL
// preservation contract by linking to /dnd-tabletop/.
//
// Per <stubs-test-stubs-render-01>:
//   1. GET /synth/ returns 200 and renders within the shell layout (nav present).
//   2. GET /dnd/   returns 200 and renders within the shell layout (nav present).
//   3. GET /dnd/   contains a link to /dnd-tabletop/.
//   4. GET /tools/ returns 200 and renders within the shell layout (nav present).
//   5. None of the stub pages reference synth-specific, D&D-specific, or
//      tool-specific data models. (Source-file inspection: stub files contain
//      only layout + placeholder copy.)

import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  astroBuild,
  builtHtmlExists,
  readBuiltHtml,
} from "../_helpers/build.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

/**
 * Strip JS-style line/block comments, the Astro frontmatter block (which is
 * the file's only place for executable JS in a stub), and visible body text
 * inside the `<section>...<\/section>` block. What's left is the file's
 * non-comment, non-visible-copy surface — class names, layout structure,
 * imports. That's the surface the contract's "no internals" clause is
 * really about: a stub that *imports* a kanban data model has overreached;
 * a stub that *says* "no kanban" in a comment is doing its documentation
 * job.
 */
function stripCommentsAndCopy(src) {
  let out = src;
  // Strip /* ... */ block comments.
  out = out.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip // line comments.
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  // Strip HTML comments.
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Strip visible <p>...<\/p> bodies — placeholder copy is permitted to
  // mention deferral terms (e.g., the synth stub's "in development" sentence
  // mentions "synth" — that's fine, it's just the deferral message).
  out = out.replace(/<p\b[\s\S]*?<\/p>/g, "");
  // Strip <h1>...<\/h1> as well.
  out = out.replace(/<h1\b[\s\S]*?<\/h1>/g, "");
  return out;
}

beforeAll(() => {
  astroBuild();
}, 180_000);

describe("<stubs-test-stubs-render-01>: stub pages render and route", () => {
  it("/synth/ renders within the shell layout", () => {
    expect(builtHtmlExists("/synth/")).toBe(true);
    const html = readBuiltHtml("/synth/");
    expect(html).toMatch(/<nav[^>]*class="[^"]*shell-nav[^"]*"/);
    expect(html).toMatch(/<h1[^>]*>Synth<\/h1>/);
  });

  it("/dnd/ renders within the shell layout", () => {
    expect(builtHtmlExists("/dnd/")).toBe(true);
    const html = readBuiltHtml("/dnd/");
    expect(html).toMatch(/<nav[^>]*class="[^"]*shell-nav[^"]*"/);
    expect(html).toMatch(/<h1[^>]*>D&amp;D<\/h1>/);
  });

  it("/dnd/ contains a link to /dnd-tabletop/", () => {
    const html = readBuiltHtml("/dnd/");
    // Either /dnd-tabletop/ or /dnd-tabletop/index.html per the contract.
    const re = /<a[^>]*href="\/dnd-tabletop\/(?:index\.html)?"/;
    expect(html).toMatch(re);
  });

  it("/tools/ renders within the shell layout", () => {
    expect(builtHtmlExists("/tools/")).toBe(true);
    const html = readBuiltHtml("/tools/");
    expect(html).toMatch(/<nav[^>]*class="[^"]*shell-nav[^"]*"/);
    expect(html).toMatch(/<h1[^>]*>Tools<\/h1>/);
  });

  it("stub source files contain only layout + placeholder copy (no internals)", () => {
    // Per step 5: the stub files must not reference synth-specific, D&D-
    // specific, or tool-specific data models, feed shapes, or UI patterns.
    // This is verified by *absence* of such terms in the stub's executable
    // content. Comments that name what each stub explicitly defers to a
    // future ADC pass (e.g., "no kanban, no feed") are documentation, not
    // implementation, and are explicitly allowed by the contract — naming a
    // deferred internal is how we make the deferral legible. We strip
    // comments before scanning so the test catches only actual references.
    const forbidden = [
      // Each term names a section-specific *implementation* concept. If the
      // stub source actually wires up a kanban data model or an oscillator
      // graph, the stub has overreached. Naming the concept in a comment is
      // fine.
      "kanban",
      "patch-graph",
      "oscillator",
      "voltage",
      "encounter",
      "initiative-tracker",
      "spell-list",
      "embed-demo",
      "per-tool-route",
    ];
    const stubs = [
      path.join(ROOT, "src", "pages", "synth", "index.astro"),
      path.join(ROOT, "src", "pages", "dnd", "index.astro"),
      path.join(ROOT, "src", "pages", "tools", "index.astro"),
    ];
    for (const stub of stubs) {
      const raw = fs.readFileSync(stub, "utf8");
      const executable = stripCommentsAndCopy(raw).toLowerCase();
      for (const term of forbidden) {
        expect(
          executable.includes(term.toLowerCase()),
          `Stub ${path.relative(ROOT, stub)} references forbidden internals term "${term}" outside of comments/visible copy`,
        ).toBe(false);
      }
    }
  });
});
