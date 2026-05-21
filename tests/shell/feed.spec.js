// ADC-IMPLEMENTS: <section-test-feed-03>
//
// Tests for the generic feed loader at src/lib/feed.js. The contract
// (<section-feature-feed-03>) locks:
//
//   - Files ordered by filename ascending (lexicographic)
//   - Each entry exposes { slug, frontmatter, body }
//   - The shell does NOT assert anything about frontmatter shape — entries
//     with no frontmatter, partial frontmatter, or arbitrary frontmatter all
//     pass through unchanged.
//
// The contract's scenario (<section-test-feed-03>) creates a synthetic
// section `test-feed` with three files under
// `src/pages/test-feed/feed/`. We do the same here: write the synthetic
// feed, call `loadFeed("test-feed")`, then clean up. The directory is
// outside any production section so cleanup never collides with real
// content.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const FEED_DIR = path.join(ROOT, "src", "pages", "test-feed", "feed");

beforeAll(() => {
  // Stage three feed files. Filenames are zero-padded so lex order is
  // unambiguous and matches the contract's example (001-, 002-, 003-).
  fs.mkdirSync(FEED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(FEED_DIR, "001-first.md"),
    "---\ntitle: First\n---\n\nfirst\n",
  );
  fs.writeFileSync(
    path.join(FEED_DIR, "002-second.md"),
    // Partial frontmatter (just a tag list); the loader must not validate.
    "---\ntag: alpha\n---\n\nsecond\n",
  );
  fs.writeFileSync(
    // No frontmatter at all — the loader must tolerate this case.
    path.join(FEED_DIR, "003-third.md"),
    "third\n",
  );
});

afterAll(() => {
  fs.rmSync(path.join(ROOT, "src", "pages", "test-feed"), {
    recursive: true,
    force: true,
  });
});

describe("<section-test-feed-03>: feed loader returns ordered markdown entries", () => {
  it("returns exactly 3 entries", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    const entries = loadFeed("test-feed", { root: ROOT });
    expect(entries.length).toBe(3);
  });

  it("orders entries by filename ascending (001-, 002-, 003-)", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    const entries = loadFeed("test-feed", { root: ROOT });
    expect(entries.map((e) => e.slug)).toEqual([
      "001-first",
      "002-second",
      "003-third",
    ]);
  });

  it("each entry exposes slug, frontmatter, and body", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    const entries = loadFeed("test-feed", { root: ROOT });
    for (const entry of entries) {
      expect(typeof entry.slug).toBe("string");
      expect(typeof entry.frontmatter).toBe("object");
      expect(entry.frontmatter).not.toBeNull();
      expect(typeof entry.body).toBe("string");
    }
  });

  it("tolerates files with no frontmatter (frontmatter is {})", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    const entries = loadFeed("test-feed", { root: ROOT });
    const third = entries.find((e) => e.slug === "003-third");
    expect(third.frontmatter).toEqual({});
    // Body retains the raw content (trimmed by the parser's whitespace
    // semantics — the body for a no-frontmatter file is the whole source).
    expect(third.body.trim()).toBe("third");
  });

  it("does not validate frontmatter shape (arbitrary keys pass through)", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    const entries = loadFeed("test-feed", { root: ROOT });
    const second = entries.find((e) => e.slug === "002-second");
    // The contract's step 4 — only that frontmatter exists; the shell does
    // NOT assert specific shape. `tag: alpha` is here purely to prove an
    // arbitrary key flows through.
    expect(second.frontmatter.tag).toBe("alpha");
  });

  it("throws on missing section directory (fail-not-fallback)", async () => {
    const { loadFeed } = await import("../../src/lib/feed.js");
    expect(() => loadFeed("definitely-not-a-section", { root: ROOT })).toThrow(
      /feed directory does not exist/,
    );
  });
});
