import { describe, expect, it } from "vitest";
import { parse } from "../src/params";
import { renderSvg } from "../src/svg";

const render = (path: string) => renderSvg(parse(new URL("https://x.test" + path)));

describe("document", () => {
  it("carries the size on both the attributes and the viewBox", () => {
    const svg = render("/600x400");
    expect(svg).toContain('width="600" height="400" viewBox="0 0 600 400"');
  });

  it("names itself for assistive technology", () => {
    expect(render("/600x400?text=Hero+image")).toContain("<title>Hero image</title>");
    expect(render("/160?type=avatar")).toContain("<title>Avatar placeholder</title>");
  });

  it("emits no defs when nothing needs them", () => {
    expect(render("/600x400")).not.toContain("<defs>");
  });
});

describe("escaping", () => {
  it("neutralises markup in a caption", () => {
    const svg = render("/600x400?text=" + encodeURIComponent('</text><script>alert(1)</script>'));
    expect(svg).not.toContain("<script");
    expect(svg.match(/<text[ >]/g)).toHaveLength(1);
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes the accessible name too, since it lands in an attribute", () => {
    const svg = render("/600x400?text=" + encodeURIComponent('" onload="alert(1)'));
    expect(svg).not.toContain('onload="alert(1)"');
    expect(svg).toContain("&quot;");
  });

  it("drops control characters rather than emitting invalid XML", () => {
    const bel = String.fromCharCode(7);
    const svg = render("/600x400?text=" + encodeURIComponent("a" + bel + "b"));
    expect(svg).not.toContain(bel);
    expect(svg).toContain("ab");
  });
});

describe("shape", () => {
  it("clips to a rounded rect only when there is a radius", () => {
    expect(render("/600x400")).not.toContain("clipPath");
    expect(render("/600x400?radius=24")).toContain("clipPath");
  });

  it("insets the border by half its width so the stroke stays inside", () => {
    const svg = render("/600x400?border=8,cbd5e1");
    expect(svg).toContain('x="4" y="4" width="592" height="392"');
    expect(svg).toContain('stroke="#cbd5e1" stroke-width="8"');
  });

  it("keeps the border out of the blur", () => {
    const svg = render("/600x400?blur=6&border=2");
    const filterAt = svg.indexOf('filter="url(');
    const strokeAt = svg.indexOf("stroke-width=");
    expect(filterAt).toBeGreaterThan(-1);
    expect(strokeAt).toBeGreaterThan(filterAt);
    expect(svg.slice(strokeAt)).not.toContain("</g>");
  });

  it("blurs the caption without blurring the plate it sits on", () => {
    const svg = render("/600x400?blur=6");
    // The background rect must not be inside the filtered group, or the blur
    // pulls transparency in from outside and fades the image at its own edges.
    const plateAt = svg.indexOf("<rect");
    const filterAt = svg.indexOf('filter="url(');
    expect(plateAt).toBeLessThan(filterAt);
    expect(svg.slice(filterAt)).toContain("<text");
    expect(svg.slice(filterAt)).not.toContain("<rect");
  });

  it("skips the filter entirely when there is nothing to blur", () => {
    expect(render("/600x400?blur=6&text=")).not.toContain("filter=");
  });

  it("omits the background rect entirely when it is transparent", () => {
    expect(render("/600x400?bg=transparent&text=")).not.toContain("<rect");
  });

  it("writes alpha as a separate attribute, not as eight-digit hex", () => {
    const svg = render("/600x400?bg=0c6fd080");
    expect(svg).toContain('fill="#0c6fd0"');
    expect(svg).toContain("fill-opacity=");
  });
});

describe("gradients", () => {
  it("defines a linear gradient and points the plate at it", () => {
    const svg = render("/600x400?bg=0c6fd0,6c5ce7");
    expect(svg).toContain("<linearGradient");
    expect(svg).toMatch(/<rect[^>]+fill="url\(#g[a-z0-9]+\)"/);
    expect(svg).toContain('stop-color="#0c6fd0"');
    expect(svg).toContain('stop-color="#6c5ce7"');
  });

  it("spreads stops evenly along the line", () => {
    const svg = render("/600x400?bg=f00,0f0,00f");
    expect(svg).toContain('offset="0"');
    expect(svg).toContain('offset="0.5"');
    expect(svg).toContain('offset="1"');
  });

  it("runs a default gradient top to bottom", () => {
    // The CSS default, so the line is vertical and spans the full height.
    expect(render("/600x400?bg=f00,00f")).toContain('x1="300" y1="0" x2="300" y2="400"');
  });

  it("runs a 90 degree gradient left to right", () => {
    expect(render("/600x400?bg=f00,00f&gradient=90")).toContain('x1="0" y1="200" x2="600" y2="200"');
  });

  it("stretches a diagonal to the corners rather than stopping short", () => {
    // CSS gradient-line length: (|dx|w + |dy|h) / 2 either side of centre.
    const svg = render("/600x400?bg=f00,00f&gradient=45");
    const half = (Math.SQRT1_2 * 600 + Math.SQRT1_2 * 400) / 2;
    expect(svg).toContain(`x1="${round(300 - Math.SQRT1_2 * half)}"`);
  });

  it("uses bounding-box units for radial, so it fills a wide box", () => {
    const svg = render("/600x400?bg=f00,00f&gradient=radial");
    expect(svg).toContain('<radialGradient');
    expect(svg).toContain('cx="0.5" cy="0.5" r="0.7072"');
  });

  it("writes a transparent stop as its neighbour's colour at zero opacity", () => {
    const svg = render("/600x400?bg=0c6fd0,transparent");
    expect(svg).not.toContain('stop-color="#000000"');
    expect(svg).toContain('stop-opacity="0"');
  });
});

describe("layout", () => {
  it("shrinks the caption to fit a long line", () => {
    const short = render("/600x400?text=Hi");
    const long = render("/600x400?text=" + encodeURIComponent("A rather long caption indeed"));
    expect(size(long)).toBeLessThan(size(short));
  });

  it("honours an explicit font size", () => {
    expect(size(render("/600x400?fs=40"))).toBe(40);
  });

  it("centres a single line on its cap box, not its em box", () => {
    const svg = render("/600x400?fs=40");
    // Cap box is 40 * 0.71 tall, so the baseline sits half of that below centre.
    expect(svg).toContain(`y="${200 + (40 * 0.71) / 2}"`);
  });

  it("keeps the default caption comfortably inside the box", () => {
    const svg = render("/600x400");
    expect(size(svg)).toBe(72); // min(600, 400) * 0.18
  });

  it("gives every tspan its own x and y, so wrapping does not depend on dy", () => {
    const svg = render("/600x400?text=one%5Cntwo");
    const tspans = svg.match(/<tspan /g) ?? [];
    expect(tspans).toHaveLength(2);
    expect(svg).not.toContain("dy=");
  });

  it("draws the Lucide geometry for a named icon", () => {
    const svg = render("/400?icon=shopping-cart");
    expect(svg).toContain('stroke-width="1.75"');
    expect(svg).toContain("<circle"); // the two wheels
    expect(svg).toContain("<title>shopping cart placeholder</title>");
  });

  it("honours an explicit icon size", () => {
    // Every icon is drawn in a 24 box, so the scale is size / 24.
    expect(render("/400?icon=cat&iconsize=120")).toContain('scale(5)');
    expect(render("/400?icon=cat&iconsize=48")).toContain('scale(2)');
  });

  it("recentres the icon when it is resized", () => {
    const svg = render("/400?icon=cat&iconsize=100");
    expect(svg).toContain('translate(150 150)');
  });

  it("scales the icon into place rather than rewriting its geometry", () => {
    // Every Lucide icon is drawn in a 24 box, so placement is one transform.
    const svg = render("/400?icon=cat");
    expect(svg).toMatch(/transform="translate\(140 140\) scale\(5\)"/);
  });

  it("draws an icon and a caption together when both are asked for", () => {
    const svg = render("/400x400?type=product&text=Product");
    expect(svg).toContain("<g transform=");
    expect(svg).toContain("Product");
  });
});

function round(v: number): number {
  return Number(v.toFixed(2));
}

function size(svg: string): number {
  const m = svg.match(/font-size="([\d.]+)"/);
  if (!m) throw new Error("no font-size in output");
  return Number(m[1]);
}
