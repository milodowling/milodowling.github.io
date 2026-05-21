// ADC-IMPLEMENTS: <shell-test-modularity-02>
//
// Verifies the two-file-touch "add a section" procedure documented in
// README.md. The scenario adds a synthetic `writing` section by performing
// EXACTLY:
//
//   1. Creating `src/pages/writing/index.astro` with a single <h1>Writing</h1>.
//   2. Adding `{ slug: "writing", label: "Writing", enabled: true }` to
//      `src/sections.config.js`.
//
// Build. Verify:
//
//   - Navigation includes a "Writing" entry in the order declared by the
//     manifest (i.e., last, since we append).
//   - /writing/ returns 200 and renders the <h1>.
//   - No other section's output is affected.
//   - The diff for the change touches exactly two files (the new page file
//     and the manifest update).
//
// Then clean up — remove both touches and verify the project returns to its
// prior state (no orphan artifacts, build still clean).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  astroBuild,
  builtHtmlExists,
  readBuiltHtml,
} from "../_helpers/build.js";
import {
  patchManifestWithEntry,
  readManifestSource,
  removeSyntheticPage,
  writeManifestSource,
  writeSyntheticPage,
} from "../_helpers/tree.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SLUG = "writing";

const PAGE_BODY = `---
import ShellLayout from "../../layouts/ShellLayout.astro";
---
<ShellLayout title="Writing — milodowling.com">
  <h1>Writing</h1>
</ShellLayout>
`;

// Snapshots for the per-route HTML hashes BEFORE the writing section is
// added; we use these to confirm "no other section's output is affected"
// post-mutation. The Astro build emits stable HTML for unchanged input,
// modulo the nav block (which changes because the nav reads the manifest).
// We assert each section page still renders its primary <h1> AND its body
// text after the mutation — that's the contract's "no other section's
// output is affected" surface. Nav diffs are expected by design.
let originalManifest = "";
let preMutationSnapshots = {};

beforeAll(() => {
  // Snapshot the section pages before mutation. Builds first to guarantee
  // dist/ is current.
  astroBuild();
  for (const route of [
    "/",
    "/portfolio/",
    "/portfolio/placeholder-entry/",
    "/synth/",
    "/dnd/",
    "/tools/",
  ]) {
    preMutationSnapshots[route] = readBuiltHtml(route);
  }

  // Perform the documented two-file-touch.
  originalManifest = readManifestSource();
  writeManifestSource(
    patchManifestWithEntry(originalManifest, {
      slug: SLUG,
      label: "Writing",
      enabled: true,
    }),
  );
  writeSyntheticPage(SLUG, PAGE_BODY);

  astroBuild();
}, 180_000);

afterAll(() => {
  writeManifestSource(originalManifest);
  removeSyntheticPage(SLUG);
  astroBuild();
}, 180_000);

describe("<shell-test-modularity-02>: adding a section is a two-file-touch operation", () => {
  it("nav on every route includes a Writing entry pointing to /writing/", () => {
    for (const route of [
      "/",
      "/portfolio/",
      "/synth/",
      "/dnd/",
      "/tools/",
      "/writing/",
    ]) {
      const html = readBuiltHtml(route);
      // The nav block in <Nav.astro> emits one <a> per enabled entry. We
      // search for the Writing link directly.
      expect(
        html.includes('href="/writing/"'),
        `${route} nav is missing the Writing link`,
      ).toBe(true);
    }
  });

  it("/writing/ returns 200 (its dist/ artifact exists) and renders the <h1>", () => {
    expect(builtHtmlExists("/writing/")).toBe(true);
    const html = readBuiltHtml("/writing/");
    expect(html).toMatch(/<h1[^>]*>Writing<\/h1>/);
  });

  it("Writing appears LAST in nav order (the procedure appends to the manifest)", () => {
    const html = readBuiltHtml("/");
    // Extract the ordered href sequence from the nav.
    const navMatch = html.match(/<nav[^>]*class="[^"]*shell-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/);
    expect(navMatch).not.toBeNull();
    const hrefs = [...navMatch[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs[hrefs.length - 1]).toBe("/writing/");
  });

  it("the procedure required exactly two file touches (page + manifest)", () => {
    // We programmatically performed the two touches; verify by inspection
    // that those two files (and only those two) carry the synthetic
    // section's footprint. The page file exists; the manifest contains the
    // new entry. No other file under src/ should mention `writing`.
    const pageFile = path.join(ROOT, "src", "pages", "writing", "index.astro");
    const manifestFile = path.join(ROOT, "src", "sections.config.js");
    expect(fs.existsSync(pageFile)).toBe(true);

    // Walk src/ and check for any other file that mentions `writing` as a
    // standalone word. ("writing" the noun in arbitrary comments is fine
    // — we look for a standalone token in NON-comment context. For
    // simplicity we accept that the only files in src/ that contain the
    // raw `"writing"` string are the two we touched. The R2 helper, the
    // shell layout, etc., have no reason to mention this slug. Comments
    // in src/ files that mention the word "writing" coincidentally would
    // be a false positive; the current codebase has none.)
    const offenders = [];
    walk(path.join(ROOT, "src"), (file) => {
      if (file === pageFile || file === manifestFile) return;
      const src = fs.readFileSync(file, "utf8");
      // Look for the literal slug `"writing"` (quoted) or `/writing/` —
      // either form would indicate the file participates in the section.
      if (/"writing"|\/writing\//.test(src)) {
        offenders.push(path.relative(ROOT, file));
      }
    });
    expect(
      offenders,
      `Adding the writing section touched extra files: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("no other section's primary content is affected (h1/body unchanged)", () => {
    // The nav block legitimately changes (it picked up a new entry), so we
    // can't compare full-page HTML. We compare each section's primary
    // <h1> + body region, which the contract calls "the section's output".
    for (const route of [
      "/portfolio/",
      "/portfolio/placeholder-entry/",
      "/synth/",
      "/dnd/",
      "/tools/",
    ]) {
      const before = primaryContent(preMutationSnapshots[route]);
      const after = primaryContent(readBuiltHtml(route));
      expect(
        after,
        `${route} primary content (h1 + first paragraph) drifted after adding writing section`,
      ).toBe(before);
    }
  });

  it("cleanup restores the project: removing both touches returns dist/ to pre-mutation state", () => {
    // Mid-test: simulate the cleanup half of the scenario inline, then
    // re-do the mutation so the afterAll hook is idempotent. This
    // captures the "verify the project returns to its prior state" half
    // of the scenario without polluting the build state for sibling specs.
    writeManifestSource(originalManifest);
    removeSyntheticPage(SLUG);
    astroBuild();

    // Confirm no orphan dist artifact.
    expect(builtHtmlExists("/writing/")).toBe(false);
    // Confirm pre-mutation snapshots match exactly now.
    for (const route of [
      "/",
      "/portfolio/",
      "/synth/",
      "/dnd/",
      "/tools/",
    ]) {
      expect(readBuiltHtml(route)).toBe(preMutationSnapshots[route]);
    }

    // Re-apply the mutation so the remaining describe-level assertions
    // and the afterAll cleanup operate on a consistent state. (We
    // restore the mutation rather than reordering the suite because
    // ordering this test last would obscure its intent.)
    writeManifestSource(
      patchManifestWithEntry(originalManifest, {
        slug: SLUG,
        label: "Writing",
        enabled: true,
      }),
    );
    writeSyntheticPage(SLUG, PAGE_BODY);
    astroBuild();
  });
});

/**
 * Walk a directory tree, calling `cb` on every regular file.
 */
function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, cb);
    } else {
      cb(full);
    }
  }
}

/**
 * Extract a section page's primary content region — the <main>'s primary
 * <h1> and the immediately surrounding body markup. This is what the
 * contract means by "the section's output" — the section-owned content,
 * not the shell chrome (which legitimately changes when the manifest
 * grows). We grab from the first <h1> to the closing </main>.
 */
function primaryContent(html) {
  const m = html.match(/<h1[\s\S]*?<\/main>/);
  return m ? m[0] : "";
}
