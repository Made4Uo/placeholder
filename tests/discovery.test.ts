/**
 * The discovery gate.
 *
 * All of this is off unless DISCOVERY is on, so the thing worth testing is
 * that "off" really means nothing ships, not that a flag flipped somewhere.
 * With it off, a crawler sees the ordinary title and description and nothing
 * more.
 */

import { describe, expect, it } from "vitest";
import { discoveryEnabled, llmsTxt, robots, sitemap } from "../src/discovery";
import { playground } from "../src/playground";

const ORIGIN = "https://x.test";
const REPO = "https://github.com/Made4Uo/placeholder";

describe("the flag", () => {
  it("is off unless a deployment says otherwise", () => {
    for (const value of [undefined, "", " ", "off", "false", "0", "no", "maybe"]) {
      expect(discoveryEnabled(value)).toBe(false);
    }
  });

  it("accepts the spellings someone would actually type", () => {
    for (const value of ["on", "ON", " on ", "true", "1", "yes"]) {
      expect(discoveryEnabled(value)).toBe(true);
    }
  });
});

describe("robots.txt", () => {
  it("stays plain and valid when discovery is off", () => {
    const txt = robots(ORIGIN, false);
    expect(txt).toBe("User-agent: *\nAllow: /\n");
    expect(txt).not.toContain("Sitemap:");
    expect(txt).not.toContain("GPTBot");
  });

  it("names the answer engines and the sitemap when it is on", () => {
    const txt = robots(ORIGIN, true);
    expect(txt).toContain("User-agent: GPTBot");
    expect(txt).toContain("User-agent: ClaudeBot");
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it("allows rather than blocks, in both modes", () => {
    for (const txt of [robots(ORIGIN, false), robots(ORIGIN, true)]) {
      expect(txt).toContain("Allow: /");
      expect(txt).not.toContain("Disallow: /");
    }
  });
});

describe("the page with discovery off", () => {
  const html = playground(ORIGIN, REPO, false);

  it.each([
    ["canonical", "rel=\"canonical\""],
    ["Open Graph", "og:title"],
    ["Twitter cards", "twitter:card"],
    ["structured data", "application/ld+json"],
    ["the robots directive", "name=\"robots\""],
    ["the llms.txt link", "/llms.txt"],
    ["the sitemap link", "rel=\"sitemap\""],
  ])("ships no %s", (_label, needle) => {
    expect(html).not.toContain(needle);
  });

  it("keeps the ordinary HTML any page should have", () => {
    expect(html).toContain("<title>");
    expect(html).toContain('name="description"');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg">/);
    expect(html).toContain('lang="en"');
  });

  it("still links the repository and the icon index", () => {
    expect(html).toContain(REPO);
    expect(html).toContain("/icons.json");
  });
});

describe("the structured data block", () => {
  it("cannot be closed early by a closing script tag in its content", () => {
    // The origin is the one request-derived value in the block. A real
    // hostname cannot hold "<", so this forces the case the guard exists for.
    const hostile = "https://x.test/</script><script>alert(1)</script>";
    const html = playground(hostile, REPO, true);

    const open = '<script type="application/ld+json">';
    const start = html.indexOf(open) + open.length;
    const block = html.slice(start, html.indexOf("</script>", start));

    const data = JSON.parse(block);
    expect(data["@graph"][0].url).toBe(hostile + "/");
  });
});

describe("the page with discovery on", () => {
  const html = playground(ORIGIN, REPO, true);

  it.each([
    ["canonical", `<link rel="canonical" href="${ORIGIN}/">`],
    ["Open Graph", "og:image"],
    ["Twitter cards", "twitter:card"],
    ["structured data", "application/ld+json"],
    ["the llms.txt link", "/llms.txt"],
    ["the sitemap link", 'rel="sitemap"'],
  ])("ships the %s", (_label, needle) => {
    expect(html).toContain(needle);
  });

  it("describes itself as three things a crawler understands", () => {
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const graph = JSON.parse(raw![1].replace(/\\u003c/g, "<"))["@graph"];
    expect(graph.map((g: { "@type": string }) => g["@type"])).toEqual([
      "WebApplication",
      "HowTo",
      "FAQPage",
    ]);
  });

  it("points every HowTo step at an anchor the page actually has", () => {
    const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const graph = JSON.parse(raw![1].replace(/\\u003c/g, "<"))["@graph"];
    const howto = graph.find((g: { "@type": string }) => g["@type"] === "HowTo");
    for (const step of howto.step) {
      expect(html).toContain(`id="${step.url.split("#")[1]}"`);
    }
  });

  it("takes its origin from the request, so every link names the host serving it", () => {
    const other = playground("https://someone-else.example", "", true);
    expect(other).toContain('<link rel="canonical" href="https://someone-else.example/">');
    expect(other).not.toContain(ORIGIN);
  });
});

describe("llms.txt", () => {
  const txt = llmsTxt(ORIGIN, REPO);

  it("leads with the one URL that matters", () => {
    expect(txt).toContain(`${ORIGIN}/600x400`);
    expect(txt.indexOf("## The one thing to know")).toBeLessThan(txt.indexOf("## Parameters"));
  });

  it("documents every parameter the page documents", () => {
    for (const key of ["bg", "gradient", "icon", "iconsize", "radius", "border", "font", "format"]) {
      expect(txt).toContain(key);
    }
  });

  it("names the repository when there is one, and copes when there is not", () => {
    expect(txt).toContain(`Source: ${REPO}`);
    expect(llmsTxt(ORIGIN, "")).not.toContain("Source:");
  });
});

describe("sitemap.xml", () => {
  it("lists the one page there is", () => {
    const xml = sitemap(ORIGIN);
    expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
    expect(xml.match(/<url>/g)).toHaveLength(1);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });
});
