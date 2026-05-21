// ADC-IMPLEMENTS: <portfolio-feature-content-01>
//
// Portfolio content collection schema. One markdown file under
// `src/content/portfolio/<slug>.md` becomes one portfolio entry; the file's
// stem becomes the URL slug at `/portfolio/<slug>/`.
//
// Frontmatter shape is locked by <portfolio-feature-content-01>:
//   Required:
//     - title    (string)
//     - date     (Date — Astro coerces ISO 8601 strings)
//     - summary  (string)
//   Optional-by-default (sensible defaults; authors may omit):
//     - thumb    (string, "r2:<key>" or absolute URL)
//     - media    (array of strings, each "r2:<key>" or absolute URL)
//     - tags     (array of strings; v1 index does not filter, forward-compat)
//
// No `Optional` types and no defensive guards — the schema declares
// optional fields as plain optional. Sensible defaults are applied at the
// consumer (the index card shows title-only without a thumb; the entry
// page renders text-only without media). See <portfolio-rationale-01> for
// the "one markdown file per entry" load-bearing constraint.
//
// The `r2:`-prefix resolution itself lives in `src/lib/r2.js`
// (`resolveMediaRef`), called at render time by the index and entry pages.
import { defineCollection, z } from "astro:content";

const portfolio = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    thumb: z.string().optional(),
    media: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { portfolio };
