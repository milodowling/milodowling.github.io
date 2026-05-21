// ADC-IMPLEMENTS: <portfolio-test-r2-resolution-02>
//
// Unit tests for the R2 helper at src/lib/r2.js. Verifies the four assertions
// in <portfolio-test-r2-resolution-02>:
//
//   1. r2("foo/bar.jpg") resolves to base + "/foo/bar.jpg"
//   2. r2("portfolio/2026/x.png") resolves correctly with nested keys
//   3. (frontmatter `r2:` resolution) — covered here via resolveMediaRef
//   4. (img src in rendered page) — covered by the portfolio-add-entry spec
//      which builds the site and inspects rendered HTML
//   5. The helper returns a string in all cases (no component-return variant)
//
// The helper reads R2_PUBLIC_BASE from `import.meta.env` at module-load time.
// The base is baked at build time by `astro.config.mjs` via `vite.define`.
// For these unit tests we stub `import.meta.env.R2_PUBLIC_BASE` via Vitest's
// `vi.stubEnv` which works with Vite-style env access.
//
// Per the contract step 5, R2_PUBLIC_BASE=https://media.example.test for
// this test's expectations.

import { describe, expect, it, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// Stub `import.meta.env.R2_PUBLIC_BASE` then reset module cache so the
// helper module's top-level `const BASE = import.meta.env.R2_PUBLIC_BASE`
// captures the new value on re-import.
async function loadHelper(base) {
  vi.stubEnv("R2_PUBLIC_BASE", base);
  vi.resetModules();
  return await import("../../src/lib/r2.js");
}

describe("<portfolio-test-r2-resolution-02>: r2() resolves keys to URLs", () => {
  it("r2('foo/bar.jpg') returns base + key", async () => {
    const { r2 } = await loadHelper("https://media.example.test");
    expect(r2("foo/bar.jpg")).toBe("https://media.example.test/foo/bar.jpg");
  });

  it("r2('portfolio/2026/x.png') returns base + nested key", async () => {
    const { r2 } = await loadHelper("https://media.example.test");
    expect(r2("portfolio/2026/x.png")).toBe(
      "https://media.example.test/portfolio/2026/x.png",
    );
  });

  it("strips a trailing slash on the base and a leading slash on the key", async () => {
    const { r2 } = await loadHelper("https://media.example.test/");
    expect(r2("/foo/bar.jpg")).toBe("https://media.example.test/foo/bar.jpg");
  });

  it("returns a string (no component-return variant in v1)", async () => {
    const { r2 } = await loadHelper("https://media.example.test");
    const v = r2("a.jpg");
    expect(typeof v).toBe("string");
  });

  it("fails loudly on an empty/non-string key (fail-not-fallback)", async () => {
    const { r2 } = await loadHelper("https://media.example.test");
    expect(() => r2("")).toThrow(/non-empty string/i);
    expect(() => r2(null)).toThrow(/non-empty string/i);
    expect(() => r2(undefined)).toThrow(/non-empty string/i);
  });

  it("fails loudly when R2_PUBLIC_BASE is missing (fail-not-fallback)", async () => {
    const { r2 } = await loadHelper("");
    expect(() => r2("foo.jpg")).toThrow(/R2_PUBLIC_BASE/);
  });
});

describe("<portfolio-test-r2-resolution-02>: resolveMediaRef() handles r2: prefix and bare URLs", () => {
  it("transforms an `r2:<key>` value into the resolved URL", async () => {
    const { resolveMediaRef } = await loadHelper("https://media.example.test");
    expect(resolveMediaRef("r2:foo.jpg")).toBe(
      "https://media.example.test/foo.jpg",
    );
  });

  it("transforms `r2:portfolio/2026/thumb.jpg` to the configured base", async () => {
    const { resolveMediaRef } = await loadHelper("https://media.example.test");
    expect(resolveMediaRef("r2:portfolio/2026/thumb.jpg")).toBe(
      "https://media.example.test/portfolio/2026/thumb.jpg",
    );
  });

  it("returns absolute URLs unchanged", async () => {
    const { resolveMediaRef } = await loadHelper("https://media.example.test");
    expect(resolveMediaRef("https://example.com/external.png")).toBe(
      "https://example.com/external.png",
    );
  });
});
