/**
 * The playground's two-way binding and gradient stop list, against a DOM stub.
 *
 * The controls and the URL bar are two views of one state and either can be
 * edited, which is the kind of arrangement that quietly starts chasing its own
 * tail. The stop rows compound it by being built at runtime. A stub is enough
 * to catch both, costs no dependency, and runs the real shipped string rather
 * than a copy of it.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { clientScript, scriptJson } from "../src/client";
import { NAMED_HEX } from "../src/colors";
import { playground } from "../src/playground";
import { createDom } from "./dom-stub";

const ORIGIN = "https://x.test";

const SELECTS: Record<string, string[]> = {
  type: ["", "image", "avatar", "card", "product", "video", "text"],
  gradient: [
    "", "to-top", "to-right", "to-left", "to-bottom-right",
    "to-bottom-left", "to-top-right", "to-top-left", "45", "radial",
  ],
  font: ["sans", "serif", "mono"],
  fw: ["", "300", "400", "500", "700", "800", "900"],
  format: ["svg", "png", "webp"],
  scale: ["1", "2", "3", "4"],
};

/** Stands in for the real example gallery. Two is enough to prove the wiring. */
const EXAMPLES = ["/600x400", "/160?type=avatar&bg=6c5ce7"];

/** Every id the markup ships. Runtime-built stop rows register themselves. */
const IDS = [
  "size", "ratioW", "type", "icon", "iconsize", "text", "fg", "fgPick", "gradient", "radius",
  "borderW", "borderC", "opacity", "blur", "fs", "fw", "font", "format", "scale", "quality",
  "bgStops", "addStop", "gradPreview", "advanced", "advCount",
  // The wrapper of each control that can lock itself; it carries the tooltip
  // alongside the control, so the label is a hover target too.
  "sizerow",
  ...["ratioW", "iconsize", "borderC", "scale", "quality"].map((id) => "field-" + id),
  "url", "preview", "copy", "open", "iconlist", "iconCount", "copyLive",
  ...EXAMPLES.flatMap((_, i) => ["exCopy" + i, "copied" + i]),
];

/** The one value= attribute the real markup carries. */
const INITIAL = { size: "600x400" };


function mount(search = "", clipboard: { fails?: boolean } = {}) {
  const dom = createDom(IDS, SELECTS, INITIAL);
  const written: string[] = [];

  // The markup ships these hidden; the stub has no attributes to read.
  for (const id of ["copied0", "copied1", "exCopy0", "exCopy1", "gradPreview", "advCount"]) {
    dom.el(id).hidden = true;
  }

  // Passed in rather than set on globalThis: Node defines its own `navigator`
  // and `fetch`, and some of them refuse assignment.
  const run = new Function(
    "document", "location", "fetch", "navigator", "window",
    clientScript(ORIGIN, NAMED_HEX, EXAMPLES),
  );
  run(
    dom.document,
    { search },
    () => Promise.reject(new Error("no icon index in tests")),
    {
      clipboard: {
        writeText: (text: string) => {
          // Mirrors the real thing, which rejects outside a secure context or
          // a user gesture rather than throwing synchronously.
          if (clipboard.fails) return Promise.reject(new Error("denied"));
          written.push(text);
          return Promise.resolve();
        },
      },
    },
    { open: () => {} },
  );

  return {
    ...dom,
    /** Everything the page has put on the clipboard, oldest first. */
    clipboard: () => written,
    url: () => dom.el("url").value,
    /** Every background colour currently in the list. */
    stops: () => dom.el("bgStops").children.map((row) => row.children[1].value),
    /** Type into the URL bar the way a person does. */
    type(raw: string) {
      dom.el("url").value = raw;
      dom.el("url").fire("input");
    },
    /** Change a control the way a person does. */
    set(id: string, value: string) {
      dom.el(id).value = value;
      dom.el(id).fire("input");
    },
    click(id: string, event: Record<string, unknown> = {}) {
      dom.el(id).fire("click", { preventDefault: () => {}, button: 0, ...event });
    },
  };
}

type Ui = ReturnType<typeof mount>;

/** Lets the click handler's promise chain settle. One tick is not enough. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the gradient stop list", () => {
  let ui: Ui;
  beforeEach(() => {
    ui = mount();
  });

  it("starts as one empty stop, which is a flat default background", () => {
    expect(ui.stops()).toEqual([""]);
    expect(ui.url()).toBe(`${ORIGIN}/600x400`);
  });

  it("offers no remove button while there is only one colour", () => {
    expect(ui.has("bgDrop0")).toBe(false);
  });

  it("adds a colour you can actually see, rather than a blank row", () => {
    ui.click("addStop");
    expect(ui.stops()).toHaveLength(2);
    expect(ui.stops()[1]).not.toBe("");
  });

  it("spells out the default when it becomes one end of a gradient", () => {
    // A blank first stop means "the default", which cannot be half a gradient:
    // sending one colour would quietly give a flat fill instead.
    expect(ui.stops()[0]).toBe("");
    ui.click("addStop");
    expect(ui.stops()[0]).toBe("e2e8f0");
    expect(new URL(ui.url()).searchParams.get("bg")).toMatch(/^e2e8f0,/);
  });

  it("builds a gradient from the stops, in order", () => {
    ui.set("bgStop0", "0c6fd0");
    ui.click("addStop");
    ui.set("bgStop1", "6c5ce7");
    expect(new URL(ui.url()).searchParams.get("bg")).toBe("0c6fd0,6c5ce7");
  });

  it("takes up to six colours and no more", () => {
    for (let i = 0; i < 10; i++) ui.click("addStop");
    expect(ui.stops()).toHaveLength(6);
    expect(ui.el("addStop").disabled).toBe(true);
  });

  it("removes the stop you asked for, not the last one", () => {
    ui.set("bgStop0", "aaaaaa");
    ui.click("addStop");
    ui.set("bgStop1", "bbbbbb");
    ui.click("addStop");
    ui.set("bgStop2", "cccccc");

    ui.click("bgDrop1");
    expect(ui.stops()).toEqual(["aaaaaa", "cccccc"]);
  });

  it("falls back to a flat fill once only one colour is left", () => {
    ui.set("bgStop0", "0c6fd0");
    ui.click("addStop");
    ui.click("bgDrop1");

    expect(new URL(ui.url()).searchParams.get("bg")).toBe("0c6fd0");
    expect(ui.url()).not.toContain("gradient=");
    expect(ui.el("gradient").disabled).toBe(true);
  });

  it("ignores blank stops rather than sending an empty one", () => {
    ui.set("bgStop0", "0c6fd0");
    ui.click("addStop");
    ui.set("bgStop1", "");
    expect(new URL(ui.url()).searchParams.get("bg")).toBe("0c6fd0");
  });

  it("only sends a direction once two colours exist to point at", () => {
    ui.set("gradient", "radial");
    expect(ui.url()).not.toContain("gradient=");

    ui.click("addStop");
    ui.set("gradient", "radial");
    expect(ui.url()).toContain("gradient=radial");
  });

  it("keeps the colour picker in step with the text field", () => {
    ui.set("bgStop0", "0c6fd0");
    expect(ui.el("bgPick0").value).toBe("#0c6fd0");
  });

  it("resolves a name to a swatch, on our scale rather than the CSS one", () => {
    ui.set("bgStop0", "blue");
    expect(ui.el("bgPick0").value).toBe("#3b82f6");
  });

  it("lets the picker write back into the text field", () => {
    ui.el("bgPick0").value = "#123456";
    ui.el("bgPick0").fire("input");
    expect(ui.stops()).toEqual(["123456"]);
  });
});

describe("the gradient preview", () => {
  let ui: Ui;
  beforeEach(() => {
    ui = mount();
  });

  const css = () => ui.el("gradPreview").style.backgroundImage ?? "";

  it("stays hidden until there is a gradient to show", () => {
    expect(ui.el("gradPreview").hidden).toBe(true);
    ui.click("addStop");
    expect(ui.el("gradPreview").hidden).toBe(false);
  });

  it("draws the same direction the server will", () => {
    ui.set("bgStop0", "0c6fd0");
    ui.click("addStop");
    ui.set("bgStop1", "6c5ce7");

    expect(css()).toContain("linear-gradient(180deg");
    ui.set("gradient", "to-right");
    expect(css()).toContain("linear-gradient(90deg");
    ui.set("gradient", "radial");
    expect(css()).toContain("radial-gradient(ellipse at center");
  });

  it("uses our colour names, not the browser's", () => {
    // CSS `blue` is #0000ff, ours is Tailwind's #3b82f6. Handing the raw name
    // to CSS would preview a colour the image never comes back with.
    ui.set("bgStop0", "blue");
    ui.click("addStop");
    expect(css()).toContain("#3b82f6");
    expect(css()).not.toMatch(/[ (]blue[,)]/);
  });

  it("mirrors the transparent-stop rule instead of fading through black", () => {
    ui.set("bgStop0", "0c6fd0");
    ui.click("addStop");
    ui.set("bgStop1", "transparent");
    expect(css()).toContain("#0c6fd000");
    expect(css()).not.toContain("#00000000");
  });
});

describe("controls to URL", () => {
  let ui: Ui;
  beforeEach(() => {
    ui = mount();
  });

  it("starts on the bare default, with nothing redundant in the query", () => {
    expect(ui.url()).toBe(`${ORIGIN}/600x400`);
  });

  it("disables the controls that cannot bite", () => {
    expect(ui.el("gradient").disabled).toBe(true);
    expect(ui.el("scale").disabled).toBe(true);
    expect(ui.el("ratioW").disabled).toBe(true);

    ui.click("addStop");
    ui.set("format", "png");
    ui.set("size", "16:9");

    expect(ui.el("gradient").disabled).toBe(false);
    expect(ui.el("scale").disabled).toBe(false);
    expect(ui.el("ratioW").disabled).toBe(false);
  });

  it("disables the icon size until something is drawing an icon", () => {
    expect(ui.el("iconsize").disabled).toBe(true);
    ui.set("icon", "cat");
    expect(ui.el("iconsize").disabled).toBe(false);
    ui.set("icon", "");
    ui.set("type", "avatar");
    expect(ui.el("iconsize").disabled).toBe(false);
  });

  it("carries the icon size into the URL and back", () => {
    ui.set("icon", "cat");
    ui.set("iconsize", "40%");
    expect(new URL(ui.url()).searchParams.get("iconsize")).toBe("40%");

    const fresh = mount();
    fresh.type(`${ORIGIN}/400?icon=cat&iconsize=120`);
    expect(fresh.el("iconsize").value).toBe("120");
  });

  it("keeps the preview pointed at the URL", () => {
    ui.set("text", "Hello");
    expect(ui.el("preview").src).toBe(ui.url());
  });
});

describe("controls that only appear when they apply", () => {
  let ui: Ui;
  beforeEach(() => {
    ui = mount();
  });

  /** Each control, and the thing that brings it into existence. */
  const cases: Array<[string, (u: Ui) => void]> = [
    ["ratioW", (u) => u.set("size", "16:9")],
    ["gradient", (u) => u.click("addStop")],
    ["iconsize", (u) => u.set("icon", "cat")],
    ["borderC", (u) => u.set("borderW", "2")],
    ["scale", (u) => u.set("format", "png")],
    ["quality", (u) => u.set("format", "webp")],
  ];

  /** The wrapper carries the label, so that is what gets hidden. */
  const box = (ui: Ui, id: string) => (ui.has("field-" + id) ? ui.el("field-" + id) : ui.el(id));

  it.each(cases)("hides %s until something makes it mean anything", (id, unlock) => {
    expect(box(ui, id).hidden).toBe(true);
    unlock(ui);
    expect(box(ui, id).hidden).toBe(false);
  });

  it.each(cases)("keeps %s disabled while it is hidden", (id, unlock) => {
    // Hidden is not enough on its own: build() reads values straight off the
    // controls, so a hidden one must not smuggle a stale value into the URL.
    expect(ui.el(id).disabled).toBe(true);
    unlock(ui);
    expect(ui.el(id).disabled).toBe(false);
  });

  it("drops a value typed before the control went away", () => {
    ui.set("icon", "cat");
    ui.set("iconsize", "80");
    expect(new URL(ui.url()).searchParams.get("iconsize")).toBe("80");

    ui.set("icon", "");
    expect(box(ui, "iconsize").hidden).toBe(true);
    expect(ui.url()).not.toContain("iconsize");
  });

  it("gives the size field the whole row once the ratio width goes", () => {
    expect(ui.el("sizerow").className).toContain("solo");
    ui.set("size", "16:9");
    expect(ui.el("sizerow").className).not.toContain("solo");
  });

  it("hides the border colour again when the width returns to zero", () => {
    ui.set("borderW", "2");
    expect(box(ui, "borderC").hidden).toBe(false);
    ui.set("borderW", "0");
    expect(box(ui, "borderC").hidden).toBe(true);
  });

  it("shows the icon size for a template as well as for a named icon", () => {
    ui.set("type", "avatar");
    expect(box(ui, "iconsize").hidden).toBe(false);
  });

  it("hides again after a pasted URL takes the reason away", () => {
    ui.set("format", "webp");
    expect(box(ui, "quality").hidden).toBe(false);
    ui.type(`${ORIGIN}/600x400`);
    expect(box(ui, "quality").hidden).toBe(true);
  });

  it("reveals what a pasted URL is using", () => {
    ui.type(`${ORIGIN}/16:9?w=800&bg=0c6fd0,6c5ce7&gradient=radial&format=webp&q=50`);
    for (const id of ["ratioW", "gradient", "quality", "scale"]) {
      expect(box(ui, id).hidden).toBe(false);
    }
  });
});

describe("the advanced fold", () => {
  let ui: Ui;
  beforeEach(() => {
    ui = mount();
  });

  it("starts closed and unbadged, since nothing advanced is set", () => {
    expect(ui.el("advanced").open).toBe(false);
    expect(ui.el("advCount").hidden).toBe(true);
  });

  it("counts the advanced settings that are actually doing something", () => {
    ui.set("radius", "24");
    expect(ui.el("advCount").hidden).toBe(false);
    expect(ui.el("advCount").textContent).toBe("1");

    ui.set("blur", "6");
    expect(ui.el("advCount").textContent).toBe("2");

    ui.set("radius", "");
    expect(ui.el("advCount").textContent).toBe("1");
  });

  it("does not count a control that cannot bite", () => {
    // Quality only applies to WebP, and the field is disabled until then.
    ui.set("quality", "50");
    expect(ui.el("advCount").hidden).toBe(true);
    ui.set("format", "webp");
    expect(ui.el("advCount").textContent).toBe("1");
  });

  it("does not count a select sitting on its default", () => {
    ui.set("font", "sans");
    ui.set("scale", "1");
    expect(ui.el("advCount").hidden).toBe(true);
  });

  it("opens itself when a pasted URL touches something inside it", () => {
    expect(ui.el("advanced").open).toBe(false);
    ui.type(`${ORIGIN}/600x400?blur=6`);
    expect(ui.el("advanced").open).toBe(true);
    expect(ui.el("advCount").textContent).toBe("1");
  });

  it("stays shut for a URL that only uses the basics", () => {
    ui.type(`${ORIGIN}/600x400?bg=0c6fd0&text=Hi`);
    expect(ui.el("advanced").open).toBe(false);
  });
});

describe("weight and quality", () => {
  it("carries the caption weight both ways", () => {
    const ui = mount();
    ui.set("fw", "300");
    expect(new URL(ui.url()).searchParams.get("fw")).toBe("300");

    const fresh = mount();
    fresh.type(`${ORIGIN}/600x400?weight=800`);
    expect(fresh.el("fw").value).toBe("800");
  });

  it("only sends quality for webp, since it means nothing elsewhere", () => {
    const ui = mount();
    ui.set("format", "png");
    ui.set("quality", "50");
    expect(ui.url()).not.toContain("q=");

    ui.set("format", "webp");
    expect(new URL(ui.url()).searchParams.get("q")).toBe("50");
  });
});

describe("URL to controls", () => {
  it("fills the controls from a typed URL", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/16:9?w=800&bg=0c6fd0&color=ffffff&text=Hero&radius=24&border=2,cbd5e1&font=mono`);

    expect(ui.el("size").value).toBe("16:9");
    expect(ui.el("ratioW").value).toBe("800");
    expect(ui.stops()).toEqual(["0c6fd0"]);
    expect(ui.el("fg").value).toBe("ffffff");
    expect(ui.el("text").value).toBe("Hero");
    expect(ui.el("radius").value).toBe("24");
    expect(ui.el("borderW").value).toBe("2");
    expect(ui.el("borderC").value).toBe("cbd5e1");
    expect(ui.el("font").value).toBe("mono");
  });

  it("rebuilds the stop list from a gradient URL", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400?bg=f43f5e,f59e0b,10b981&gradient=to-right`);
    expect(ui.stops()).toEqual(["f43f5e", "f59e0b", "10b981"]);
    expect(ui.el("gradient").value).toBe("to-right");
    expect(ui.has("bgDrop2")).toBe(true);
  });

  it("shrinks the stop list back down again", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400?bg=f43f5e,f59e0b,10b981`);
    ui.type(`${ORIGIN}/600x400?bg=0c6fd0`);
    expect(ui.stops()).toEqual(["0c6fd0"]);
    // The removed rows must stop answering to their ids, or a stale one lingers.
    expect(ui.has("bgStop1")).toBe(false);
  });

  it("ignores stops past the maximum rather than choking", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400?bg=a1,b2,c3,d4,e5,f6,a7,b8`);
    expect(ui.stops()).toHaveLength(6);
  });

  it("moves a file extension into the format control", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400.png`);
    expect(ui.el("size").value).toBe("600x400");
    expect(ui.el("format").value).toBe("png");
  });

  it("accepts a URL from another host, since that is what gets pasted", () => {
    const ui = mount();
    ui.type("https://someone-elses-deploy.example/240?bg=f00");
    expect(ui.el("size").value).toBe("240");
    expect(ui.stops()).toEqual(["f00"]);
  });

  it("accepts a bare path", () => {
    const ui = mount();
    ui.type("/240?bg=f00");
    expect(ui.el("size").value).toBe("240");
  });

  it("clears what the new URL does not mention", () => {
    const ui = mount();
    ui.set("text", "Left over");
    ui.set("blur", "8");
    ui.type(`${ORIGIN}/600x400`);
    expect(ui.el("text").value).toBe("");
    expect(ui.el("blur").value).toBe("");
    expect(ui.stops()).toEqual([""]);
  });

  it("resets a select given a value it has no option for", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400?font=Comic+Sans`);
    expect(ui.el("font").value).toBe("sans");
  });

  it("leaves the URL alone while it is being typed into", () => {
    // Rewriting the field mid-keystroke moves the caret and is maddening.
    const ui = mount();
    const typed = `${ORIGIN}/600x400?text=Half+way`;
    ui.type(typed);
    expect(ui.url()).toBe(typed);
  });

  it("normalises on Enter", () => {
    const ui = mount();
    ui.type(`${ORIGIN}/600x400?t=Short+alias`);
    ui.el("url").fire("change");
    expect(ui.url()).toBe(`${ORIGIN}/600x400?text=Short+alias`);
  });

  it("survives nonsense without throwing", () => {
    const ui = mount();
    expect(() => ui.type("not a url at all")).not.toThrow();
    expect(() => ui.type(`${ORIGIN}/a/b/c`)).not.toThrow();
  });
});

describe("round trip", () => {
  const urls = [
    "/600x400",
    "/600x400?bg=0c6fd0%2C6c5ce7&gradient=radial&text=Hi",
    "/600x400?bg=f43f5e%2Cf59e0b%2C10b981&gradient=45",
    "/16%3A9?w=800&bg=0f172a&type=avatar&radius=full",
    "/240?icon=shopping-cart&format=png&scale=2",
  ];

  it.each(urls)("survives %s unchanged", (path) => {
    const ui = mount();
    ui.type(ORIGIN + path);
    ui.el("url").fire("change");
    expect(new URL(ui.url()).pathname).toBe(new URL(ORIGIN + path).pathname);
    expect([...new URL(ui.url()).searchParams].sort()).toEqual(
      [...new URL(ORIGIN + path).searchParams].sort(),
    );
  });
});

describe("copying an example", () => {
  it("reveals the Copy buttons, which ship hidden because they need script", () => {
    const ui = mount();
    expect(ui.el("exCopy0").hidden).toBe(false);
    expect(ui.el("exCopy1").hidden).toBe(false);
  });

  it("puts the absolute URL on the clipboard, not the path it shows", async () => {
    // The tile shows /600x400 because that is readable. What you paste into
    // an HTML file has to carry the origin.
    const ui = mount();
    ui.click("exCopy0");
    await flush();
    expect(ui.clipboard()).toEqual([ORIGIN + "/600x400"]);
  });

  it("copies the tile whose button was clicked", async () => {
    const ui = mount();
    ui.click("exCopy1");
    await flush();
    expect(ui.clipboard()).toEqual([ORIGIN + "/160?type=avatar&bg=6c5ce7"]);
  });

  it("confirms it, on screen and to a screen reader", async () => {
    const ui = mount();
    expect(ui.el("copied0").hidden).toBe(true);

    ui.click("exCopy0");
    await flush();

    expect(ui.el("copied0").hidden).toBe(false);
    expect(ui.el("copyLive").textContent).toBe("Copied " + ORIGIN + "/600x400");
  });

  it("falls back to the URL bar when the clipboard refuses", async () => {
    // navigator.clipboard needs a secure context and a user gesture, and there
    // is nothing on a tile to select, so the box above becomes the fallback.
    const ui = mount("", { fails: true });
    ui.click("exCopy0");
    await flush();

    expect(ui.el("copied0").hidden).toBe(true);
    expect(ui.url()).toBe(ORIGIN + "/600x400");
    expect(ui.el("copyLive").textContent).toContain("Copy failed");
  });

  it("copies the URL bar from the Copy button too", async () => {
    const ui = mount();
    ui.set("text", "Hello");
    ui.click("copy");
    await flush();
    expect(ui.clipboard()).toEqual([ui.url()]);
  });
});

describe("the example tiles in the markup", () => {
  const html = playground(ORIGIN, "", false);
  const tiles = html.match(/<figure class="example">[\s\S]*?<\/figure>/g) ?? [];

  it("gives every tile a Copy button and a View link", () => {
    expect(tiles.length).toBeGreaterThan(0);
    tiles.forEach((tile, i) => {
      expect(tile).toMatch(new RegExp(`<button[^>]*id="exCopy${i}"[^>]*hidden`));
      expect(tile).toMatch(new RegExp(`<a[^>]*id="exView${i}"[^>]*target="_blank"`));
    });
  });

  it("points View at the same image the tile shows, so it works with no script", () => {
    for (const tile of tiles) {
      const src = tile.match(/<img[^>]*src="([^"]+)"/)?.[1];
      const href = tile.match(/<a[^>]*href="([^"]+)"/)?.[1];
      expect(href).toBe(src);
    }
  });

  it("puts no button inside a link, which HTML does not allow", () => {
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
  });
});

describe("JSON inside a script element", () => {
  const nasty = "a</script><script>alert(1)</script>b";

  it("never lets a closing script tag through", () => {
    expect(scriptJson(nasty)).not.toContain("</script>");
    expect(scriptJson({ nested: [nasty] })).not.toContain("<");
  });

  it("still reads back as the same value, as JSON and as JavaScript", () => {
    expect(JSON.parse(scriptJson(nasty))).toBe(nasty);
    expect(new Function("return " + scriptJson({ s: nasty }))().s).toBe(nasty);
  });

  it("guards every value the client script embeds", () => {
    const script = clientScript("https://x.test/</script><b>", NAMED_HEX, ["/1?text=</script>"]);
    expect(script).not.toContain("</script>");
  });
});

describe("seeding", () => {
  it("adopts a ?u= URL from the address bar", () => {
    const ui = mount("?u=" + encodeURIComponent("/300x300?bg=f43f5e&text=Seeded"));
    expect(ui.el("size").value).toBe("300x300");
    expect(ui.el("text").value).toBe("Seeded");
    expect(ui.stops()).toEqual(["f43f5e"]);
  });
});
