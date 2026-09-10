/**
 * Iconography, and the `?type=` presets on top of it.
 *
 * The icons themselves are the whole Lucide set, generated into
 * icons.generated.ts by scripts/build-icons.mjs. Every one is drawn in a 24x24
 * box at a stroke weight of 2, which is why src/svg.ts can scale any of them
 * to any size and have a 64px avatar and a 1200px banner look like the same
 * drawing.
 *
 * `?type=` stays for the half-dozen slots people actually reach for, and it
 * carries preset behaviour that a bare icon name cannot: `avatar` rounds
 * itself, because an avatar that is not round is not an avatar.
 */

import { ICONS, ICON_NAMES } from "./icons.generated";

export { ICONS, ICON_NAMES };

export type TemplateKey = "image" | "avatar" | "card" | "product" | "video" | "text";
export const TEMPLATES: TemplateKey[] = ["image", "avatar", "card", "product", "video", "text"];

/** Preset -> the Lucide icon it draws. Verified at build time by build-icons.mjs. */
export const TEMPLATE_ICON: Record<TemplateKey, string> = {
  image: "image",
  avatar: "user-round",
  card: "layout-template",
  product: "package",
  video: "circle-play",
  text: "text",
};

/** A short human label, used for the accessible name when there is no caption. */
export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  image: "Image placeholder",
  avatar: "Avatar placeholder",
  card: "Card placeholder",
  product: "Product placeholder",
  video: "Video placeholder",
  text: "Text placeholder",
};

export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}

/**
 * Names close enough to be worth putting in a 400. Lucide names are
 * hyphenated compounds, so a substring match catches the overwhelming majority
 * of near misses ("cart" -> "shopping-cart") without an edit-distance pass
 * over two thousand strings on every bad request.
 */
export function suggestIcons(input: string, limit = 6): string[] {
  const q = input.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (q.length < 2) return [];

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of ICON_NAMES) {
    if (name === q) continue;
    if (name.startsWith(q)) starts.push(name);
    else if (name.includes(q)) contains.push(name);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * One icon, wrapped in the transform that places it. `x`/`y` is the top-left
 * of the box, `size` the box edge in real pixels.
 *
 * Stroke weight is proportional rather than fixed: 1.75 in the 24-box, so it
 * scales with the icon. Slightly lighter than Lucide's own 2, because these
 * are drawn at placeholder sizes rather than at toolbar sizes.
 */
export function renderIcon(name: string, x: number, y: number, size: number, colour: string): string {
  const geometry = ICONS[name];
  if (!geometry) return "";

  const k = size / 24;
  return (
    `<g transform="translate(${n(x)} ${n(y)}) scale(${n(k, 4)})" ` +
    `fill="none" stroke="${colour}" stroke-width="1.75" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    geometry +
    "</g>"
  );
}

function n(v: number, places = 2): string {
  return String(Number(v.toFixed(places)));
}
