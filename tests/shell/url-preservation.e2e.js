// ADC-IMPLEMENTS: <dnd-test-url-continuity-01>
//
// Verifies that /dnd-tabletop/ — the URL shared with friends before the
// rebuild — keeps serving the virtual tabletop tool, standalone (not wrapped
// in the shell layout).
//
// History: this file previously enforced <shell-test-url-preservation-04>,
// which froze the tool byte-for-byte against a preserved Hugo-era copy. The
// D&D ADC pass (contracts/ADC_006_DND_TABLETOP.md, 2026-07-10) absorbed the
// tool as first-party source at public/dnd-tabletop/ and superseded the
// freeze: the URL stays canonical, the content now evolves. The identity
// assertion therefore compares against the committed source file — it
// catches build-pipeline mangling, not development.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SOURCE = path.join(ROOT, "public", "dnd-tabletop", "index.html");

function normalize(s) {
  // Line-ending normalization (CRLF → LF), tolerating proxy rewrites.
  return s.replace(/\r\n/g, "\n");
}

test.describe("<dnd-test-url-continuity-01>: /dnd-tabletop/ keeps serving the tool", () => {
  test("GET /dnd-tabletop/ returns 200", async ({ request }) => {
    const res = await request.get("/dnd-tabletop/");
    expect(res.status()).toBe(200);
  });

  test("GET /dnd-tabletop/index.html returns 200", async ({ request }) => {
    const res = await request.get("/dnd-tabletop/index.html");
    expect(res.status()).toBe(200);
  });

  test("GET /dnd-tabletop/ body equals the committed source after decoding + LF normalization", async ({
    request,
  }) => {
    const res = await request.get("/dnd-tabletop/");
    const body = await res.text();
    const expected = fs.readFileSync(SOURCE, "utf8");
    expect(normalize(body)).toBe(normalize(expected));
  });

  test("the tool's module assets are served alongside it", async ({
    request,
  }) => {
    for (const asset of ["reducer.js", "sync-protocol.js"]) {
      const res = await request.get("/dnd-tabletop/" + asset);
      expect(res.status(), asset).toBe(200);
    }
  });

  test("the tool is NOT wrapped in the shell layout (no shell-wordmark / shell-nav)", async ({
    request,
  }) => {
    // Per <dnd-feature-tool-route-01>: the tool serves standalone, exactly
    // as it did on the Hugo site and through the preservation era.
    const res = await request.get("/dnd-tabletop/");
    const body = await res.text();
    expect(body.includes("shell-wordmark")).toBe(false);
    expect(body.includes("shell-nav")).toBe(false);
  });

  test("the tool boots: canvas present, sidebar sections render", async ({
    page,
  }) => {
    await page.goto("/dnd-tabletop/");
    await expect(page.locator("#mainCanvas")).toBeVisible();
    await expect(page.locator("#startTableBtn")).toBeVisible();
    await expect(page.locator("#iconBtn")).toBeVisible();
  });
});
