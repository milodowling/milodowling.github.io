// ADC-IMPLEMENTS: <shell-test-url-preservation-04>
//
// Verifies that /dnd-tabletop/ continues to serve the preserved virtual
// tabletop tool with content identity preserved across HTTP decoding.
//
// Locked assertion type (from <shell-constraint-url-preservation-04>):
//   - The response body, AFTER gzip/brotli decoding and line-ending
//     normalization (CRLF → LF), must equal the bytes of
//     `_preserved-dnd-content/dnd-tabletop/index.html`.
//   - Byte-identity over the wire is REJECTED — Cloudflare Pages may
//     compress or normalize transparently and a strict-bytes check would
//     yield false positives.
//
// This test runs against the local `astro preview` server (configured in
// playwright.config.js as the webServer). Playwright's `request` API
// handles content-encoding decoding automatically for `text()` — the
// response body we receive is already decoded. We then normalize line
// endings before comparing.
//
// Step 4 of the contract scenario calls for running the test against both
// `milodowling.com` and `milodowling.github.io` "when both are configured."
// They are not yet configured to test against in CI (no deploy URL is
// known to Phase 4), so we restrict to the local preview server. If/when
// a future phase adds deploy-smoke tests, this file should be extended to
// loop over deploy URLs.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const PRESERVED = path.join(
  ROOT,
  "_preserved-dnd-content",
  "dnd-tabletop",
  "index.html",
);

function normalize(s) {
  // Line-ending normalization (CRLF → LF) per the contract.
  return s.replace(/\r\n/g, "\n");
}

test.describe("<shell-test-url-preservation-04>: /dnd-tabletop/ content identity after HTTP decode", () => {
  test("GET /dnd-tabletop/ returns 200", async ({ request }) => {
    const res = await request.get("/dnd-tabletop/");
    expect(res.status()).toBe(200);
  });

  test("GET /dnd-tabletop/index.html returns 200", async ({ request }) => {
    const res = await request.get("/dnd-tabletop/index.html");
    expect(res.status()).toBe(200);
  });

  test("GET /dnd-tabletop/ body equals preserved index.html after decoding + LF normalization", async ({
    request,
  }) => {
    const res = await request.get("/dnd-tabletop/");
    const body = await res.text();
    const expected = fs.readFileSync(PRESERVED, "utf8");
    expect(normalize(body)).toBe(normalize(expected));
  });

  test("GET /dnd-tabletop/index.html body equals preserved index.html after decoding + LF normalization", async ({
    request,
  }) => {
    const res = await request.get("/dnd-tabletop/index.html");
    const body = await res.text();
    const expected = fs.readFileSync(PRESERVED, "utf8");
    expect(normalize(body)).toBe(normalize(expected));
  });

  test("the preserved tool is NOT wrapped in the shell layout (no shell-wordmark / shell-nav)", async ({
    request,
  }) => {
    // The contract <stubs-feature-dnd-tabletop-passthrough-03> explicitly
    // says the preserved tool is NOT framed by the shell layout. Verify
    // by absence of shell chrome classes.
    const res = await request.get("/dnd-tabletop/");
    const body = await res.text();
    expect(body.includes("shell-wordmark")).toBe(false);
    expect(body.includes("shell-nav")).toBe(false);
  });
});
