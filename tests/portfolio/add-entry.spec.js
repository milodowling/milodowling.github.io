// ADC-IMPLEMENTS: <portfolio-test-add-entry-01>
//
// Verifies the one-file-touch portfolio authoring path. The scenario:
//
//   1. Create src/content/portfolio/test-entry.md with the canonical
//      frontmatter (title, date, summary, thumb, media[]).
//   2. Build the site.
//   3. Assert:
//      - The git diff has exactly one new file (we verify by checking the
//        filesystem snapshot before and after — see "exactly one new file
//        touched").
//      - /portfolio/ includes a card for "Test Entry" in date-descending
//        position.
//      - The card's thumbnail <img src=...> resolves to the configured R2
//        base + "/portfolio/test/thumb.jpg".
//      - /portfolio/test-entry/ returns 200 and renders title, date, both
//        media items in order, and the body.
//      - No shell-level files are modified.
//
// Then the second half: create a text-only entry (no thumb, no media) and
// verify it renders without errors and without a media block.

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
  removePortfolioEntry,
  writePortfolioEntry,
} from "../_helpers/tree.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

// The R2 public base baked into the build (set in astro.config.mjs).
const R2_BASE = "https://media.milodowling.com";

const ENTRY_BODY = `---
title: "Test Entry"
date: "2026-05-20"
summary: "A test portfolio entry."
thumb: "r2:portfolio/test/thumb.jpg"
media:
  - "r2:portfolio/test/image-1.jpg"
  - "r2:portfolio/test/image-2.jpg"
---

This is the entry body.
`;

const TEXT_ONLY_BODY = `---
title: "Text Only"
date: "2026-05-19"
summary: "A text-only test portfolio entry."
---

Body only. No thumb, no media.
`;

// Snapshot of shell-scope file mtimes before the mutation; the contract's
// step 5 ("No shell-level files are modified") translates to mtimes being
// unchanged for everything under src/ EXCEPT the two markdown files we
// touched.
let preMutationFiles = new Map();

beforeAll(() => {
  astroBuild();
  // Snapshot src/ file mtimes excluding the content directory (which is
  // where authoring lives and where mtimes change).
  preMutationFiles = snapshotFiles(path.join(ROOT, "src"));

  writePortfolioEntry("test-entry", ENTRY_BODY);
  writePortfolioEntry("text-only-entry", TEXT_ONLY_BODY);
  astroBuild();
}, 180_000);

afterAll(() => {
  removePortfolioEntry("test-entry");
  removePortfolioEntry("text-only-entry");
  astroBuild();
}, 180_000);

describe("<portfolio-test-add-entry-01>: adding a portfolio entry is one-file (media case)", () => {
  it("the only mutations under src/ are the two new content files (no shell files modified)", () => {
    const post = snapshotFiles(path.join(ROOT, "src"));
    const diffs = [];
    for (const [file, mtime] of post) {
      const prior = preMutationFiles.get(file);
      if (prior === undefined) {
        diffs.push({ file: path.relative(ROOT, file), kind: "added" });
      } else if (prior !== mtime) {
        diffs.push({ file: path.relative(ROOT, file), kind: "modified" });
      }
    }
    // Expected additions: the two markdown files. No modifications anywhere
    // else in src/.
    const allowedAdds = new Set([
      path.join(ROOT, "src", "content", "portfolio", "test-entry.md"),
      path.join(ROOT, "src", "content", "portfolio", "text-only-entry.md"),
    ]);
    const unauthorized = diffs.filter(
      (d) => !allowedAdds.has(path.join(ROOT, d.file)),
    );
    expect(
      unauthorized,
      `Authoring a portfolio entry touched extra files under src/: ${JSON.stringify(unauthorized)}`,
    ).toEqual([]);
  });

  it("/portfolio/ includes a card for Test Entry in date-descending position", () => {
    const html = readBuiltHtml("/portfolio/");
    expect(html).toMatch(/Test Entry/);

    // Date-descending: "Test Entry" (2026-05-20) sorts before "Placeholder
    // Entry" (2026-05-21)? Wait — 05-21 > 05-20, so Placeholder Entry
    // comes first. We assert the relative position: Test Entry must come
    // AFTER Placeholder Entry (the existing entry is dated 2026-05-21),
    // and BEFORE Text Only (dated 2026-05-19).
    const placeholderIdx = html.indexOf("Placeholder Entry");
    const testIdx = html.indexOf("Test Entry");
    const textIdx = html.indexOf("Text Only");
    expect(placeholderIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    expect(textIdx).toBeGreaterThan(-1);
    expect(placeholderIdx).toBeLessThan(testIdx);
    expect(testIdx).toBeLessThan(textIdx);
  });

  it("the card's thumbnail src resolves to the configured R2 base + key", () => {
    const html = readBuiltHtml("/portfolio/");
    const expected = `${R2_BASE}/portfolio/test/thumb.jpg`;
    expect(html.includes(`src="${expected}"`)).toBe(true);
  });

  it("/portfolio/test-entry/ returns 200 and renders title, date, body", () => {
    expect(builtHtmlExists("/portfolio/test-entry/")).toBe(true);
    const html = readBuiltHtml("/portfolio/test-entry/");
    expect(html).toMatch(/<h1[^>]*>Test Entry<\/h1>/);
    expect(html).toMatch(/2026-05-20/);
    expect(html).toMatch(/This is the entry body/);
  });

  it("/portfolio/test-entry/ renders both media items in declared order", () => {
    const html = readBuiltHtml("/portfolio/test-entry/");
    const img1 = `${R2_BASE}/portfolio/test/image-1.jpg`;
    const img2 = `${R2_BASE}/portfolio/test/image-2.jpg`;
    const idx1 = html.indexOf(img1);
    const idx2 = html.indexOf(img2);
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(-1);
    expect(idx1).toBeLessThan(idx2);
  });
});

describe("<portfolio-test-add-entry-01>: text-only entry case (no thumb, no media)", () => {
  it("/portfolio/text-only-entry/ renders without errors and without a media block", () => {
    expect(builtHtmlExists("/portfolio/text-only-entry/")).toBe(true);
    const html = readBuiltHtml("/portfolio/text-only-entry/");
    expect(html).toMatch(/<h1[^>]*>Text Only<\/h1>/);
    expect(html).toMatch(/Body only/);
    // The entry page's media block uses class `portfolio-entry-media`. With
    // no media, the template omits the <ul> element entirely. The class
    // SELECTOR may still appear in the page's inlined <style> block (CSS
    // rules ship per-page even if unused on that route); we verify the
    // absence of the actual DOM element. The `<ul class="portfolio-entry-media...">`
    // open tag is unique to the entry page's media block.
    expect(/<ul\b[^>]*\bportfolio-entry-media\b/.test(html)).toBe(false);
  });

  it("/portfolio/ shows the text-only card title-only (no thumbnail img)", () => {
    const html = readBuiltHtml("/portfolio/");
    // Find the card's surrounding link block (the page renders one <li>
    // per entry). The text-only card should not contain an <img> inside
    // its anchor block.
    const cardMatch = html.match(
      /<li[^>]*class="[^"]*portfolio-card[^"]*"[^>]*>([\s\S]*?)<\/li>(?=[\s\S]*Text Only)/g,
    );
    // Simpler approach: look for the literal anchor scope around "Text Only".
    const textOnlyBlockRe = /<a[^>]*href="\/portfolio\/text-only-entry\/"[^>]*>([\s\S]*?)<\/a>/;
    const m = html.match(textOnlyBlockRe);
    expect(m).not.toBeNull();
    const block = m[1];
    expect(block.includes("<img")).toBe(false);
  });
});

/**
 * Recursively snapshot file mtimes under a root, EXCLUDING the
 * src/content/portfolio/ directory (where the mutation legitimately lives).
 *
 * @param {string} dir
 * @returns {Map<string, number>}
 */
function snapshotFiles(dir) {
  const out = new Map();
  walk(dir, (file) => {
    out.set(file, fs.statSync(file).mtimeMs);
  });
  return out;
}

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
