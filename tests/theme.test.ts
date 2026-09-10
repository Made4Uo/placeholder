/**
 * The light and dark switch, against a stub.
 *
 * Small, but it has three ways to go wrong that nobody notices on their own
 * machine: a saved choice applied too late (a flash of the wrong theme on every
 * load), storage that throws instead of returning null, and a default that
 * quietly follows the operating system when it is meant to be light.
 */

import { describe, expect, it } from "vitest";
import { playground } from "../src/playground";
import { THEME_KEY, themeScript } from "../src/theme";
import { StubElement } from "./dom-stub";

interface Options {
  saved?: string;
  /** What the operating system prefers. The page is meant to ignore it. */
  systemDark?: boolean;
  /** "throws" is what a browser with site data blocked does. */
  storage?: "works" | "throws";
}

function mount({ saved, systemDark = false, storage = "works" }: Options = {}) {
  const registry = new Map<string, StubElement>();
  const root = new StubElement(registry);
  const button = new StubElement(registry);
  button.id = "theme";
  button.hidden = true;

  const store = new Map<string, string>();
  if (saved != null) store.set(THEME_KEY, saved);
  const localStorage = {
    getItem(key: string) {
      if (storage === "throws") throw new Error("blocked");
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (storage === "throws") throw new Error("blocked");
      store.set(key, value);
    },
  };

  const ready: Array<() => void> = [];
  const document = {
    documentElement: root,
    getElementById: (id: string) => registry.get(id) ?? null,
    addEventListener: (type: string, fn: () => void) => {
      if (type === "DOMContentLoaded") ready.push(fn);
    },
  };

  new Function("document", "window", "localStorage", themeScript())(
    document,
    { matchMedia: () => ({ matches: systemDark, addEventListener: () => {} }) },
    localStorage,
  );

  return {
    button,
    store,
    theme: () => root.getAttribute("data-theme"),
    label: () => button.getAttribute("aria-label"),
    /** The rest of the page arriving, after the head script has already run. */
    load: () => ready.forEach((fn) => fn()),
    click: () => button.fire("click"),
  };
}

describe("the theme switch", () => {
  it("applies a saved choice before the rest of the page exists", () => {
    // Before load(), because anything later is a flash of the wrong theme.
    const ui = mount({ saved: "dark" });
    expect(ui.theme()).toBe("dark");
  });

  it("starts light when nothing is saved", () => {
    const ui = mount();
    ui.load();
    expect(ui.theme()).toBeNull();
    expect(ui.label()).toBe("Switch to dark theme");
    expect(ui.button.getAttribute("data-current")).toBe("light");
  });

  it("starts light even when the system prefers dark", () => {
    const ui = mount({ systemDark: true });
    ui.load();
    expect(ui.button.getAttribute("data-current")).toBe("light");
    ui.click();
    expect(ui.theme()).toBe("dark");
  });

  it("ignores a saved value it does not recognise", () => {
    const ui = mount({ saved: "purple" });
    ui.load();
    expect(ui.theme()).toBeNull();
    expect(ui.button.getAttribute("data-current")).toBe("light");
  });

  it("flips back and forth and remembers the last choice", () => {
    const ui = mount();
    ui.load();
    ui.click();
    expect(ui.theme()).toBe("dark");
    expect(ui.store.get(THEME_KEY)).toBe("dark");
    expect(ui.label()).toBe("Switch to light theme");
    ui.click();
    expect(ui.theme()).toBe("light");
    expect(ui.store.get(THEME_KEY)).toBe("light");
  });

  it("tells the CSS which theme is showing, so it can pick the icon", () => {
    const ui = mount({ saved: "dark" });
    ui.load();
    expect(ui.button.getAttribute("data-current")).toBe("dark");
    ui.click();
    expect(ui.button.getAttribute("data-current")).toBe("light");
  });

  it("only reveals the button once there is script to run it", () => {
    const ui = mount();
    expect(ui.button.hidden).toBe(true);
    ui.load();
    expect(ui.button.hidden).toBe(false);
  });

  it("still switches when storage is blocked", () => {
    let ui!: ReturnType<typeof mount>;
    expect(() => {
      ui = mount({ storage: "throws" });
    }).not.toThrow();
    ui.load();
    expect(() => ui.click()).not.toThrow();
    expect(ui.theme()).toBe("dark");
  });
});

describe("the theme switch on the page", () => {
  const html = playground("https://x.test", "", false);

  it("runs in the head, so a saved theme lands before first paint", () => {
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(themeScript().trim());
  });

  it("ships the button hidden, for the script to reveal", () => {
    expect(html).toMatch(/<button[^>]*id="theme"[^>]*hidden/);
  });

  it("does not follow the operating system, so light is the default", () => {
    expect(html).not.toContain("prefers-color-scheme");
    expect(html).toContain(":root[data-theme=dark]");
  });
});
