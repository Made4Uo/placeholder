import { describe, expect, it } from "vitest";
import type { Gradient } from "../src/colors";
import { BadRequest, BUNDLED_FONTS, MAX_DIM, parse } from "../src/params";

const spec = (path: string) => parse(new URL("https://x.test" + path));
const fails = (path: string) => () => spec(path);

describe("size", () => {
  it("reads WxH", () => {
    expect(spec("/600x400")).toMatchObject({ w: 600, h: 400 });
  });

  it("reads a bare number as a square", () => {
    expect(spec("/240")).toMatchObject({ w: 240, h: 240 });
  });

  it("accepts the multiplication sign as well as x", () => {
    expect(spec("/600%C3%97400")).toMatchObject({ w: 600, h: 400 });
  });

  it("scales a ratio from ?w", () => {
    expect(spec("/16:9?w=800")).toMatchObject({ w: 800, h: 450 });
  });

  it("scales a ratio from ?h", () => {
    expect(spec("/16:9?h=450")).toMatchObject({ w: 800, h: 450 });
  });

  it("gives a bare ratio a default width", () => {
    expect(spec("/4:3")).toMatchObject({ w: 1200, h: 900 });
  });

  it("accepts an underscore ratio, for paths where a colon is awkward", () => {
    expect(spec("/16_9?w=320")).toMatchObject({ w: 320, h: 180 });
  });

  it("rejects a size past the cap", () => {
    expect(fails(`/${MAX_DIM + 1}x10`)).toThrow(BadRequest);
  });

  it("rejects a ratio whose derived side blows the cap", () => {
    expect(fails(`/1:100?w=${MAX_DIM}`)).toThrow(BadRequest);
  });

  it("rejects malformed percent-encoding as a bad request, not a crash", () => {
    expect(fails("/%E0%A4%A")).toThrow(BadRequest);
  });

  it("rejects nonsense", () => {
    expect(fails("/banana")).toThrow(BadRequest);
    expect(fails("/0x400")).toThrow(BadRequest);
    expect(fails("/600x400/extra")).toThrow(BadRequest);
  });
});

describe("colours", () => {
  it("reads bg and color", () => {
    const s = spec("/600x400?bg=0c6fd0&color=ffffff");
    expect(s.bg).toEqual({ hex: "#0c6fd0", alpha: 1 });
    expect(s.fg).toEqual({ hex: "#ffffff", alpha: 1 });
  });

  it("accepts fg and colour as aliases for color", () => {
    expect(spec("/600x400?fg=ffffff").fg.hex).toBe("#ffffff");
    expect(spec("/600x400?colour=ffffff").fg.hex).toBe("#ffffff");
  });

  it("refuses colours in the path, and says where they go", () => {
    expect(fails("/600x400/0c6fd0")).toThrow(/\?bg=/);
  });

  it("defaults the background to slate 200", () => {
    expect(spec("/600x400").bg).toEqual({ hex: "#e2e8f0", alpha: 1 });
  });

  it("expands short hex", () => {
    expect(spec("/600x400?bg=f00").bg).toEqual({ hex: "#ff0000", alpha: 1 });
  });

  it("splits eight-digit hex into a colour and an alpha", () => {
    expect(spec("/600x400?bg=0c6fd080").bg).toEqual({ hex: "#0c6fd0", alpha: 0.502 });
  });

  it("treats transparent and a zero alpha as no background", () => {
    expect(spec("/600x400?bg=transparent").bg).toBeNull();
    expect(spec("/600x400?bg=0c6fd000").bg).toBeNull();
  });

  it("picks a readable foreground when none is given", () => {
    expect(spec("/600x400?bg=ffffff").fg.hex).toBe("#475569");
    expect(spec("/600x400?bg=0f172a").fg.hex).toBe("#f8fafc");
  });

  it("rejects a colour it cannot parse", () => {
    expect(fails("/600x400?bg=notacolour")).toThrow(BadRequest);
    expect(fails('/600x400?bg=%22%3E%3Cscript%3E')).toThrow(BadRequest);
  });
});

describe("icons", () => {
  it("takes any Lucide name", () => {
    expect(spec("/400?icon=shopping-cart").icon).toBe("shopping-cart");
  });

  it("resolves a preset to its icon", () => {
    expect(spec("/400?type=avatar").icon).toBe("user-round");
    expect(spec("/400?type=video").icon).toBe("circle-play");
  });

  it("lets an explicit icon override the preset glyph but keep its behaviour", () => {
    const s = spec("/400?type=avatar&icon=cat");
    expect(s.icon).toBe("cat");
    expect(s.radius).toBe(200); // still round, because it is still an avatar
  });

  it("suppresses the default size caption, the way a preset does", () => {
    expect(spec("/400?icon=cat").lines).toEqual([]);
  });

  it("rejects an unknown name and suggests near misses", () => {
    expect(fails("/400?icon=cart")).toThrow(/shopping-cart/);
  });

  it("rejects an unknown name that has no near miss, without suggesting nothing", () => {
    expect(fails("/400?icon=zzzzqqqq")).toThrow(/No Lucide icon/);
    expect(fails("/400?icon=zzzzqqqq")).not.toThrow(/Did you mean/);
  });

  it("treats an empty icon as no icon", () => {
    expect(spec("/400?icon=").icon).toBeNull();
  });

  it("sizes itself against the shorter side unless told otherwise", () => {
    expect(spec("/400?icon=cat").iconSize).toBeNull();
  });

  it("takes an icon size in pixels or as a percentage", () => {
    expect(spec("/400x200?icon=cat&iconsize=120").iconSize).toBe(120);
    expect(spec("/400x200?icon=cat&iconsize=50%").iconSize).toBe(100);
    expect(spec("/400x200?icon=cat&is=64").iconSize).toBe(64);
  });

  it("caps the icon at the shorter side, since a bigger one is just cropped", () => {
    expect(spec("/400x200?icon=cat&iconsize=9999").iconSize).toBe(200);
    expect(spec("/400x200?icon=cat&iconsize=100%").iconSize).toBe(200);
  });

  it("ignores an icon size when nothing is drawing an icon, the way fs does", () => {
    expect(() => spec("/400?iconsize=80")).not.toThrow();
  });

  it("rejects an icon size it cannot read", () => {
    expect(fails("/400?icon=cat&iconsize=huge")).toThrow(BadRequest);
  });
});

describe("gradients", () => {
  const grad = (path: string) => spec(path).bg as Gradient;

  it("turns two or more colours into a gradient", () => {
    expect(grad("/600x400?bg=0c6fd0,6c5ce7")).toEqual({
      kind: "linear",
      angle: 180,
      stops: [
        { hex: "#0c6fd0", alpha: 1 },
        { hex: "#6c5ce7", alpha: 1 },
      ],
    });
  });

  it("leaves a single colour flat", () => {
    expect(spec("/600x400?bg=0c6fd0").bg).toEqual({ hex: "#0c6fd0", alpha: 1 });
  });

  it("reads a direction in degrees, in keywords, and radial", () => {
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=90")).toMatchObject({ kind: "linear", angle: 90 });
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=45deg")).toMatchObject({ angle: 45 });
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=to-right")).toMatchObject({ angle: 90 });
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=radial")).toMatchObject({ kind: "radial" });
  });

  it("wraps an out-of-range angle rather than rejecting it", () => {
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=-90")).toMatchObject({ angle: 270 });
    expect(grad("/600x400?bg=0c6fd0,6c5ce7&gradient=450")).toMatchObject({ angle: 90 });
  });

  it("gives a transparent stop its neighbour's colour", () => {
    // Fading to transparent BLACK is the classic grey bruise, so the stop
    // keeps the hue next to it and only loses its alpha.
    expect(grad("/600x400?bg=0c6fd0,transparent").stops).toEqual([
      { hex: "#0c6fd0", alpha: 1 },
      { hex: "#0c6fd0", alpha: 0 },
    ]);
  });

  it("keeps a fully transparent gradient rather than collapsing it", () => {
    expect(grad("/600x400?bg=transparent,transparent").stops).toHaveLength(2);
  });

  it("scores the text colour against the worst stop, not the average", () => {
    // Nothing flat is readable over black to white, so this is the least bad
    // answer rather than a passing one. Averaging would have picked black,
    // which vanishes into the black end where a caption often sits.
    expect(spec("/600x400?bg=000000,ffffff").fg.hex).toBe("#475569");
  });

  it("still clears AA when the gradient stays in one register", () => {
    expect(spec("/600x400?bg=0c6fd0,6c5ce7").fg.hex).toBe("#f8fafc");
    expect(spec("/600x400?bg=e2e8f0,f8fafc").fg.hex).toBe("#475569");
  });

  it("rejects a direction with nothing to point at", () => {
    expect(fails("/600x400?bg=0c6fd0&gradient=90")).toThrow(/at least two colours/);
  });

  it("rejects more stops than it draws well", () => {
    expect(fails("/600x400?bg=f00,0f0,00f,ff0,0ff,f0f,000")).toThrow(/at most 6 colours/);
  });

  it("rejects a direction it cannot read", () => {
    expect(fails("/600x400?bg=0c6fd0,6c5ce7&gradient=sideways")).toThrow(BadRequest);
  });
});

describe("fonts", () => {
  it("puts the bundled family first, so raster and svg agree where they can", () => {
    for (const font of BUNDLED_FONTS) {
      expect(spec("/600x400?font=" + font.key).fontFamily).toBe(font.stack);
      expect(font.stack).toMatch(new RegExp("^'" + font.family + "',"));
    }
  });

  it("resolves each generic to the family the build marked as its default", () => {
    expect(spec("/600x400?font=sans").fontFamily).toMatch(/^'Inter',/);
    expect(spec("/600x400?font=serif").fontFamily).toMatch(/^'Lora',/);
    expect(spec("/600x400?font=mono").fontFamily).toMatch(/^'JetBrains Mono',/);
  });

  it("accepts a family by key or by its own name", () => {
    expect(spec("/600x400?font=noto-sans").fontFamily).toBe(spec("/600x400?font=Noto Sans").fontFamily);
    expect(spec("/600x400?font=inter").fontFamily).toBe(spec("/600x400?font=sans").fontFamily);
    expect(spec("/600x400?font=playfair").fontFamily).toContain("Playfair Display");
  });

  it("offers the twelve families the popular services do, and then some", () => {
    const families = BUNDLED_FONTS.map((f) => f.family);
    for (const expected of [
      "Lato", "Lora", "Montserrat", "Noto Sans", "Open Sans", "Oswald",
      "Playfair Display", "Poppins", "PT Sans", "Raleway", "Roboto",
    ]) {
      expect(families).toContain(expected);
    }
  });

  it("quotes an unknown family and falls through to the sans stack", () => {
    expect(spec("/600x400?font=Comic Sans MS").fontFamily).toContain("'Comic Sans MS',");
  });

  it("strips anything that could break out of the attribute", () => {
    const f = spec('/600x400?font=' + encodeURIComponent('a" onload="x')).fontFamily;
    expect(f).not.toContain('"');
  });
});

describe("radius", () => {
  it("clamps to half the shorter side", () => {
    expect(spec("/600x400?radius=9999").radius).toBe(200);
  });

  it("reads a percentage of the shorter side", () => {
    expect(spec("/600x400?radius=25%").radius).toBe(100);
  });

  it("treats full as a stadium", () => {
    expect(spec("/600x400?radius=full").radius).toBe(200);
  });

  it("rounds an avatar by default, and lets that be overridden", () => {
    expect(spec("/160?type=avatar").radius).toBe(80);
    expect(spec("/160?type=avatar&radius=0").radius).toBe(0);
  });
});

describe("border", () => {
  it("reads a width on its own", () => {
    expect(spec("/600x400?border=2").border).toMatchObject({ width: 2 });
  });

  it("reads width and colour", () => {
    expect(spec("/600x400?border=3,cbd5e1").border).toEqual({
      width: 3,
      colour: { hex: "#cbd5e1", alpha: 1 },
    });
  });

  it("reads a bare colour as a hairline", () => {
    expect(spec("/600x400?border=cbd5e1").border).toMatchObject({ width: 1 });
  });

  it("drops a zero-width border rather than emitting an invisible stroke", () => {
    expect(spec("/600x400?border=0").border).toBeNull();
  });

  it("rejects a reversed pair", () => {
    expect(fails("/600x400?border=cbd5e1,3")).toThrow(BadRequest);
  });
});

describe("text", () => {
  it("captions with the size by default", () => {
    expect(spec("/600x400").lines).toEqual(["600×400"]);
  });

  it("says nothing by default when a template is drawing", () => {
    expect(spec("/600x400?type=image").lines).toEqual([]);
  });

  it("treats an empty text as a deliberate blank", () => {
    expect(spec("/600x400?text=").lines).toEqual([]);
  });

  it("splits on an escaped newline", () => {
    expect(spec("/600x400?text=one%5Cntwo").lines).toEqual(["one", "two"]);
  });

  it("caps the line count", () => {
    const many = Array(20).fill("x").join("\\n");
    expect(spec("/600x400?text=" + encodeURIComponent(many)).lines).toHaveLength(8);
  });
});

describe("format and scale", () => {
  it("defaults to svg", () => {
    expect(spec("/600x400").format).toBe("svg");
  });

  it("reads a file extension", () => {
    expect(spec("/600x400.png").format).toBe("png");
    expect(spec("/16:9.webp?w=320").format).toBe("webp");
  });

  it("leaves an unknown extension for the size parser to reject", () => {
    expect(fails("/600x400.gif")).toThrow(BadRequest);
  });

  it("lets the query beat the extension", () => {
    expect(spec("/600x400.png?format=svg").format).toBe("svg");
  });

  it("pins scale to 1 for svg, since it means nothing there", () => {
    expect(spec("/600x400?scale=3").scale).toBe(1);
    expect(spec("/600x400?format=png&scale=3").scale).toBe(3);
  });

  it("refuses a raster job past the pixel budget", () => {
    expect(fails("/3000x3000?format=png")).toThrow(BadRequest);
    expect(fails("/1500x1500?format=png&scale=2")).toThrow(BadRequest);
    expect(() => spec("/3000x3000")).not.toThrow();
  });

  it("rejects an unknown format", () => {
    expect(fails("/600x400?format=gif")).toThrow(BadRequest);
  });
});

describe("clamping", () => {
  it("keeps opacity, blur and weight in range", () => {
    expect(spec("/600x400?opacity=500").opacity).toBe(1);
    expect(spec("/600x400?opacity=-5").opacity).toBe(0);
    expect(spec("/600x400?blur=9999").blur).toBe(100);
    expect(spec("/600x400?weight=50").fontWeight).toBe(100);
  });

  it("rejects a number that is not one", () => {
    expect(fails("/600x400?opacity=lots")).toThrow(BadRequest);
  });
});
