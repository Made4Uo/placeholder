/**
 * The files that make this findable: robots.txt, sitemap.xml and llms.txt.
 *
 * There is one HTML page here, so classic SEO has very little surface to work
 * with. What it does have is a URL grammar that is the whole product, which is
 * exactly the sort of thing an answer engine can quote if it is written down
 * plainly. llms.txt is that: the full reference as text, no markup to wade
 * through, so a model asked "how do I get a placeholder image" has the actual
 * URL to hand rather than a guess.
 *
 * https://llmstxt.org is the convention it follows.
 *
 * ALL OF THIS IS OFF BY DEFAULT, and turned on with DISCOVERY="on"; see
 * wrangler.jsonc. Nothing here is sensitive: with it on, all of it is served
 * openly.
 */

import { BUNDLED_FONTS, TEMPLATES } from "./params";
import { NAMED_COLOURS } from "./colors";
import { ICON_NAMES } from "./templates";

/** Whether a deployment has opted into being indexed and quoted. */
export function discoveryEnabled(value: string | undefined): boolean {
  return ["on", "true", "1", "yes"].includes((value ?? "").trim().toLowerCase());
}

/**
 * Crawlers that answer questions rather than rank pages.
 *
 * Naming them is not the same as `User-agent: *`. Most sites block these, so
 * an explicit allow is a clearer signal than a wildcard, and some of them
 * document that they look for their own name first. This service is free, MIT
 * licensed and has nothing to protect: the whole point is that a model asked
 * for a placeholder image knows the URL rather than guessing at one.
 */
const ANSWER_ENGINES = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "Bingbot",
  "DuckAssistBot",
  "cohere-ai",
  "YouBot",
];

export function robots(origin: string, enabled: boolean): string {
  // With discovery off, still a valid robots.txt, just a plain one: there is
  // no sitemap to point at and nothing to invite crawlers to.
  if (!enabled) return "User-agent: *\nAllow: /\n";

  return [
    "# Every image URL is generated on request and there are infinitely many of",
    "# them. The page and the files at the bottom are the whole of it.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    "# Answer engines are welcome, and told so by name rather than left to read",
    "# a wildcard. /llms.txt is the reference in a form you can quote.",
    "",
    ...ANSWER_ENGINES.flatMap((agent) => [`User-agent: ${agent}`, "Allow: /", ""]),
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemap(origin: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url>\n` +
    `    <loc>${origin}/</loc>\n` +
    `    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n` +
    `    <priority>1.0</priority>\n` +
    `  </url>\n` +
    `</urlset>\n`
  );
}

export function llmsTxt(origin: string, repo: string): string {
  const fonts = BUNDLED_FONTS.map((f) => f.key).join(", ");

  return `# Placeholder

> A placeholder image generator. Put a size in the URL and get an image back.
> No account, no upload, no tracking. MIT licensed.

Base URL: ${origin}
${repo ? `Source: ${repo}\n` : ""}
## The one thing to know

    ${origin}/600x400

That returns a 600 by 400 placeholder image, as SVG. Use it directly in an
\`<img>\` tag. Everything else on this page is optional.

## Sizes

    ${origin}/600x400        an explicit size
    ${origin}/600            a square
    ${origin}/16:9?w=800     a ratio, scaled to a width (returns 800x450)
    ${origin}/16:9?h=450     a ratio, scaled from a height
    ${origin}/16:9           a ratio with no width given, defaults to 1200 wide
    ${origin}/600x400.png    the format as a file extension

Sizes are capped at 5000px per side. Raster output is capped at 4 million
pixels after any scaling. PNG and WebP renders are rate limited per address
(HTTP 429 with Retry-After); SVG, the default, is not.

## Parameters

All optional, all query parameters.

    text, t        The caption. Default is the size, e.g. "600x400".
                   \\n starts a new line, up to 8. text= on its own is blank.
    bg             Background. Hex with or without the #, a colour name, or
                   "transparent". Two to six comma-separated colours make a
                   gradient. Default e2e8f0.
    gradient       Gradient direction: degrees (90), a keyword (to-right,
                   to-bottom-left), or "radial". Default to-bottom. Needs two
                   or more colours in bg.
    color, fg      Text and icon colour. Default is chosen automatically to
                   clear WCAG AA against the background.
    icon           Any Lucide icon name, e.g. shopping-cart. ${ICON_NAMES.length} available,
                   listed at ${origin}/icons.json
    iconsize, is   Icon size in pixels, or a percentage of the shorter side
                   (40%). Capped at the shorter side. Default is 30% of it.
    type           A preset: ${TEMPLATES.join(", ")}.
                   An icon plus behaviour, e.g. avatar rounds itself.
    radius, r      Corner radius in pixels, a percentage (50%), or "full".
    border, b      "2", "2,cbd5e1", or a bare colour for a 1px rule.
    opacity, o     0 to 100.
    blur           0 to 100. Applies to the caption and icon, not the plate.
    font           sans, serif, mono, or a bundled family:
                   ${fonts}.
                   Any other family works in SVG if the viewer has it.
    fs, fontsize   Caption size in pixels. Default is fitted to the box.
    fw, weight     100 to 900. Default 600.
    format, f      svg, png or webp. Default svg.
    scale, dpr     1 to 4. Raster output only.
    q, quality     1 to 100. WebP only.

Colour names use the Tailwind 500 scale rather than the CSS one, because CSS
"red" is #ff0000 and that is not a colour anyone wants behind a caption:
${NAMED_COLOURS.join(", ")}.

## Worked examples

    ${origin}/600x400
    ${origin}/600x400?text=Hero+image
    ${origin}/600x400?bg=0c6fd0&color=ffffff
    ${origin}/600x400?bg=0c6fd0,6c5ce7&gradient=to-right
    ${origin}/600x400?bg=6c5ce7,0f172a&gradient=radial
    ${origin}/600x400?bg=0c6fd0,transparent
    ${origin}/16:9?w=800&bg=0f172a&type=video
    ${origin}/160?type=avatar&bg=6c5ce7
    ${origin}/400x400?icon=shopping-cart&bg=0c6fd0
    ${origin}/400x400?icon=shopping-cart&iconsize=70%
    ${origin}/600x400?radius=24&border=2,cbd5e1
    ${origin}/600x400?bg=0c6fd0&blur=6&text=Loading
    ${origin}/600x400?format=png&scale=2

## Other endpoints

    ${origin}/            the playground: every parameter, wired up live
    ${origin}/icons.json  every icon name, as JSON
    ${origin}/?u=<url>    opens the playground with that URL loaded

## Notes

SVG is the default. It is a few hundred bytes, stays sharp at any zoom, and
needs no pixel work. Ask for PNG or WebP when you need real pixels.

Every URL is immutable: the same URL returns the same bytes and is cached for
a year. Change a parameter to get a different image.

CORS is open and Cross-Origin-Resource-Policy is set, so these can be drawn
into a <canvas> without tainting it.

An unparseable parameter returns HTTP 400 with a sentence saying what was
wrong, rather than a silently incorrect image.
`;
}
