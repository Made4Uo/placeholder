/**
 * URL -> Spec.
 *
 * The whole request surface is here: one path segment for the size, and named
 * query parameters for everything else. Every value is clamped or rejected
 * before it reaches the renderer, and the renderer trusts a Spec completely.
 *
 * Colours are `?bg=` and `?color=` rather than extra path segments. Other
 * services put them in the path, and the result is that /600x400/0c6fd0/ffffff
 * makes you stop and work out which half is which every single time. A name on
 * every value costs eight characters and removes the question.
 */

import { autoForeground, DEFAULT_BG, parseColour, type Fill, type Gradient, type Paint } from "./colors";
import { BUNDLED_FONTS, GENERIC_DEFAULTS } from "./fonts.generated";
import { hasIcon, suggestIcons, TEMPLATE_ICON, TEMPLATES, type TemplateKey } from "./templates";

export class BadRequest extends Error {}

export type Format = "svg" | "png" | "webp";

export { TEMPLATES, type TemplateKey };

export interface Border {
  width: number;
  colour: Paint;
}

export interface Spec {
  w: number;
  h: number;
  /** A flat colour or a gradient. null means paint no background at all. */
  bg: Fill | null;
  fg: Paint;
  /** Already split into lines. An empty array means draw no caption. */
  lines: string[];
  /** A validated font-family list, safe to embed. */
  fontFamily: string;
  /** null means "size it to fit". */
  fontSize: number | null;
  fontWeight: number;
  /** Corner radius in px, already resolved from % and clamped. */
  radius: number;
  border: Border | null;
  /** 0..1 */
  opacity: number;
  blur: number;
  /** The `?type=` preset, which decides the accessible label and the default radius. */
  template: TemplateKey | null;
  /** The Lucide icon to draw, resolved from ?icon= or from the preset. */
  icon: string | null;
  /** Icon box edge in px. null means size it against the shorter side. */
  iconSize: number | null;
  format: Format;
  /** Raster pixel density. Always 1 for SVG. */
  scale: number;
  /** WebP quality, 1..100. */
  quality: number;
}

/** Hard ceiling on either axis. Generous, but stops a 1e9-pixel viewBox. */
export const MAX_DIM = 5000;
/** Raster is real CPU work in a Worker, so it gets a much tighter budget. */
export const MAX_RASTER_PIXELS = 4_000_000;
const MAX_TEXT = 300;
const MAX_LINES = 8;
const DEFAULT_RATIO_WIDTH = 1200;

/**
 * `?font=` values, built from the bundled set.
 *
 * Each stack names its bundled family FIRST, then the platform equivalents.
 * That ordering does two jobs: the renderer matches the bundled family by name
 * so PNG and WebP agree with SVG, while a viewer who does not have it
 * installed falls straight through to a native font and the image still looks
 * at home. Nothing is fetched at render time in either direction.
 *
 * Both the hyphenated key and the family's own name are accepted, so
 * `?font=noto-sans` and `?font=Noto Sans` are the same request.
 */
const FONT_STACKS: Record<string, string> = Object.fromEntries(
  BUNDLED_FONTS.flatMap((f) => [
    [f.key, f.stack],
    [f.family.toLowerCase(), f.stack],
  ]),
);

// The three generics resolve to whichever family the build marked as default.
for (const [generic, family] of Object.entries(GENERIC_DEFAULTS)) {
  const font = BUNDLED_FONTS.find((f) => f.family === family);
  if (font) FONT_STACKS[generic] = font.stack;
}

/** Everything `?font=` accepts, for the docs and the playground. */
export const FONT_KEYS = Object.keys(GENERIC_DEFAULTS);
export { BUNDLED_FONTS };

export function parse(url: URL): Spec {
  const q = url.searchParams;
  const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);

  if (segments.length === 0) throw new BadRequest("Missing a size. Try /600x400");
  if (segments.length > 1) {
    throw new BadRequest(
      "The path holds the size and nothing else. Colours go in ?bg= and ?color=, " +
        "as in /600x400?bg=0c6fd0&color=ffffff",
    );
  }

  // A trailing .png / .svg / .webp sets the format, so a URL can end in a real
  // file extension for tools that insist on one.
  let extFormat: Format | null = null;
  let sizeSegment = segments[0];
  const dot = sizeSegment.lastIndexOf(".");
  if (dot > 0) {
    const ext = sizeSegment.slice(dot + 1).toLowerCase();
    if (ext === "svg" || ext === "png" || ext === "webp") {
      extFormat = ext;
      sizeSegment = sizeSegment.slice(0, dot);
    }
  }

  const format = readFormat(q.get("format") ?? q.get("f")) ?? extFormat ?? "svg";
  const { w, h } = readSize(sizeSegment, q);

  const scale = clampInt(num(q.get("scale") ?? q.get("dpr"), 1), 1, 4, "scale");
  if (format !== "svg" && w * h * scale * scale > MAX_RASTER_PIXELS) {
    throw new BadRequest(
      `${format.toUpperCase()} output is capped at ${MAX_RASTER_PIXELS} pixels ` +
        `(${w}x${h} at scale ${scale} is ${w * h * scale * scale}). ` +
        `Ask for SVG, or a smaller size.`,
    );
  }

  const bg = readBackground(q.get("bg") ?? q.get("background"), q.get("gradient"));
  // Left unset, the foreground is derived from the background rather than
  // fixed, so a dark ?bg= never lands dark text on a dark plate.
  const colourRaw = q.get("color") ?? q.get("colour") ?? q.get("fg");
  const fg = colourRaw != null ? (readPaint(colourRaw, null) ?? autoForeground(bg)) : autoForeground(bg);

  const template = readTemplate(q.get("type"));
  // An explicit ?icon= beats the preset's glyph, but leaves the rest of the
  // preset alone, so ?type=avatar&icon=cat is still round.
  const icon = readIcon(q.get("icon")) ?? (template ? TEMPLATE_ICON[template] : null);
  const lines = readText(q, { w, h }, icon);
  const min = Math.min(w, h);

  return {
    w,
    h,
    bg,
    fg,
    lines,
    fontFamily: readFontFamily(q.get("font")),
    fontSize:
      q.has("fs") || q.has("fontsize")
        ? clampInt(num(q.get("fs") ?? q.get("fontsize"), 0), 4, 400, "fs")
        : null,
    fontWeight: clampInt(num(q.get("fw") ?? q.get("weight"), 600), 100, 900, "weight"),
    radius: readRadius(q.get("radius") ?? q.get("r"), min, template),
    border: readBorder(q.get("border") ?? q.get("b"), min, fg),
    opacity: clampInt(num(q.get("opacity") ?? q.get("o"), 100), 0, 100, "opacity") / 100,
    blur: clampInt(num(q.get("blur"), 0), 0, 100, "blur"),
    template,
    icon,
    iconSize: readIconSize(q.get("iconsize") ?? q.get("is"), min),
    format,
    scale: format === "svg" ? 1 : scale,
    quality: clampInt(num(q.get("q") ?? q.get("quality"), 82), 1, 100, "quality"),
  };
}

/**
 * `600x400`, `600` (square), or `16:9` (ratio). A ratio takes its scale from
 * ?w= or ?h=, so callers never have to do the division themselves, which is
 * the only reason ratios are worth supporting at all.
 */
function readSize(seg: string, q: URLSearchParams): { w: number; h: number } {
  const s = seg.toLowerCase().replace(/×/g, "x");

  const ratio = s.match(/^(\d{1,4}(?:\.\d+)?)[:_](\d{1,4}(?:\.\d+)?)$/);
  if (ratio) {
    const rw = parseFloat(ratio[1]);
    const rh = parseFloat(ratio[2]);
    if (!(rw > 0) || !(rh > 0)) {
      throw new BadRequest(`Bad aspect ratio "${seg}". Both sides must be above zero.`);
    }

    const wq = q.get("w") ?? q.get("width");
    const hq = q.get("h") ?? q.get("height");
    if (wq != null) {
      const w = dim(wq, "w");
      return { w, h: clampDim(Math.round((w * rh) / rw), "h") };
    }
    if (hq != null) {
      const h = dim(hq, "h");
      return { w: clampDim(Math.round((h * rw) / rh), "w"), h };
    }
    return { w: DEFAULT_RATIO_WIDTH, h: clampDim(Math.round((DEFAULT_RATIO_WIDTH * rh) / rw), "h") };
  }

  const pair = s.match(/^(\d{1,5})x(\d{1,5})$/);
  if (pair) return { w: dim(pair[1], "width"), h: dim(pair[2], "height") };

  const square = s.match(/^(\d{1,5})$/);
  if (square) {
    const n = dim(square[1], "size");
    return { w: n, h: n };
  }

  throw new BadRequest(
    `Could not read "${seg}" as a size. Use 600x400, 600, or a ratio like 16:9 with ?w=800.`,
  );
}

/**
 * A malformed %-escape is the caller's mistake, so it is a 400. Left to throw,
 * decodeURIComponent's URIError would surface as a 500 and an error log line.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new BadRequest(`"${segment}" is not valid percent-encoding.`);
  }
}

function dim(raw: string, label: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) throw new BadRequest(`${label} must be at least 1.`);
  if (n > MAX_DIM) throw new BadRequest(`${label} is capped at ${MAX_DIM}px.`);
  return Math.round(n);
}

/** The derived side of a ratio: clamped rather than rejected. */
function clampDim(n: number, label: string): number {
  if (n > MAX_DIM) throw new BadRequest(`That ratio puts ${label} past the ${MAX_DIM}px cap.`);
  return Math.max(1, n);
}

const MAX_STOPS = 6;

/**
 * The background: one colour, or two to six for a gradient.
 *
 * The direction lives in ?gradient= rather than at the front of ?bg=, because
 * a bare number is ambiguous with hex. "180" is both half a turn and a valid
 * three-digit hex, and there is no reading of `bg=180,0c6fd0` that is right
 * more than half the time. A second parameter has no such problem.
 */
function readBackground(raw: string | null, direction: string | null): Fill | null {
  const parts = (raw ?? "").split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length <= 1) {
    if (direction != null) {
      throw new BadRequest(
        "?gradient= needs at least two colours in ?bg=, as in bg=0c6fd0,6c5ce7",
      );
    }
    return readPaint(raw, DEFAULT_BG);
  }

  if (parts.length > MAX_STOPS) {
    throw new BadRequest(`A gradient takes at most ${MAX_STOPS} colours, not ${parts.length}.`);
  }

  const stops = parts.map((p) => {
    const v = p.toLowerCase();
    // A transparent stop keeps its neighbour's hue, resolved below. Until
    // then it is marked by an alpha of zero rather than dropped, so the
    // gradient keeps its position in the run.
    if (v === "transparent" || v === "none") return { hex: "#000000", alpha: 0 };
    const paint = parseColour(v);
    if (!paint) throw new BadRequest(`"${p}" is not a colour. Use a hex value like 0f172a, or a name.`);
    return paint;
  });

  return { ...readDirection(direction), stops: resolveTransparentStops(stops) };
}

/**
 * A fully transparent stop takes the hue of its nearest visible neighbour.
 *
 * Fading blue to `transparent` means fading blue to nothing, not fading blue
 * to transparent BLACK. SVG interpolates stop colour and stop opacity
 * independently, so the naive reading puts a grey bruise through the middle of
 * every fade. Every renderer has this trap and every design tool hides it.
 */
function resolveTransparentStops(stops: Paint[]): Paint[] {
  const visible = stops.map((s, i) => (s.alpha > 0 ? i : -1)).filter((i) => i >= 0);
  if (visible.length === 0 || visible.length === stops.length) return stops;

  return stops.map((stop, i) => {
    if (stop.alpha > 0) return stop;
    const nearest = visible.reduce((a, b) => (Math.abs(b - i) < Math.abs(a - i) ? b : a));
    return { hex: stops[nearest].hex, alpha: 0 };
  });
}

const DIRECTIONS: Record<string, number> = {
  "to-top": 0,
  "to-top-right": 45,
  "to-right": 90,
  "to-bottom-right": 135,
  "to-bottom": 180,
  "to-bottom-left": 225,
  "to-left": 270,
  "to-top-left": 315,
};

function readDirection(raw: string | null): Pick<Gradient, "kind" | "angle"> {
  if (raw == null || raw.trim() === "") return { kind: "linear", angle: 180 };

  const v = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (v === "radial") return { kind: "radial", angle: 0 };
  if (v in DIRECTIONS) return { kind: "linear", angle: DIRECTIONS[v] };

  const deg = Number(v.replace(/deg$/, ""));
  if (Number.isFinite(deg)) return { kind: "linear", angle: ((deg % 360) + 360) % 360 };

  throw new BadRequest(
    `"${raw}" is not a gradient direction. Use degrees like 90, a keyword like ` +
      `${Object.keys(DIRECTIONS).join(", ")}, or radial.`,
  );
}

function readPaint(raw: string | null | undefined, fallback: Paint | null): Paint | null {
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "transparent" || v === "none") return null;
  const p = parseColour(v);
  if (!p) throw new BadRequest(`"${raw}" is not a colour. Use a hex value like 0f172a, or a name.`);
  // A colour that is fully transparent is the same instruction as omitting
  // the paint, and saying so here keeps the renderer free of alpha checks.
  return p.alpha === 0 ? null : p;
}

function readFormat(raw: string | null): Format | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "svg" || v === "png" || v === "webp") return v;
  throw new BadRequest(`Unknown format "${raw}". Pick svg, png or webp.`);
}

function readTemplate(raw: string | null): TemplateKey | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase() as TemplateKey;
  if (TEMPLATES.includes(v)) return v;
  throw new BadRequest(
    `Unknown type "${raw}". Pick one of: ${TEMPLATES.join(", ")}. ` +
      `For anything else, ?icon= takes any Lucide name.`,
  );
}

/**
 * Any Lucide icon name. An unknown one is a 400 rather than a blank image,
 * with near misses listed, because "cart" not being the name of the cart icon
 * is the single most likely way to get this wrong.
 */
function readIcon(raw: string | null): string | null {
  if (raw == null || raw.trim() === "") return null;
  const v = raw.trim().toLowerCase();
  if (hasIcon(v)) return v;

  const near = suggestIcons(v);
  throw new BadRequest(
    `No Lucide icon called "${raw}".` +
      (near.length ? ` Did you mean: ${near.join(", ")}?` : "") +
      ` The full list is at /icons.json, or browse them at https://lucide.dev/icons`,
  );
}

/**
 * Family keyword, or a custom name sanitised down to letters, digits, spaces
 * and hyphens before it is quoted into the stack. A custom name only renders
 * if the viewer has that font, so it is a hint rather than a promise, and it
 * never applies to PNG or WebP (see raster.ts).
 */
function readFontFamily(raw: string | null): string {
  if (raw == null) return FONT_STACKS.sans;
  const v = raw.trim().toLowerCase();
  if (FONT_STACKS[v]) return FONT_STACKS[v];

  const clean = raw.trim().replace(/[^A-Za-z0-9 -]/g, "").trim().slice(0, 40);
  if (!clean) return FONT_STACKS.sans;
  return `'${clean}',${FONT_STACKS.sans}`;
}

function readText(
  q: URLSearchParams,
  size: { w: number; h: number },
  icon: string | null,
): string[] {
  const raw = q.get("text") ?? q.get("t");

  // No ?text at all: the dimensions are the caption, unless an icon is already
  // drawing something, in which case the icon speaks for itself.
  if (raw == null) return icon ? [] : [`${size.w}×${size.h}`];
  if (raw === "") return [];

  return raw
    .slice(0, MAX_TEXT)
    .replace(/\\n/g, "\n")
    .split("\n")
    .slice(0, MAX_LINES)
    .map((l) => l.trim());
}

/**
 * Icon size: px, or `N%` of the shorter side.
 *
 * Capped at the shorter side, since an icon larger than the box it sits in is
 * a cropped icon rather than a big one. Ignored, not rejected, when nothing is
 * drawing an icon, the same way ?fs= is ignored when there is no caption.
 */
function readIconSize(raw: string | null, min: number): number | null {
  if (raw == null || raw.trim() === "") return null;

  const v = raw.trim().toLowerCase();
  const pct = v.match(/^(\d{1,3}(?:\.\d+)?)%$/);
  if (pct) return clampInt((parseFloat(pct[1]) / 100) * min, 4, min, "iconsize");

  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequest(`"${raw}" is not an icon size. Use 120 or 40%.`);
  }
  return clampInt(n, 4, min, "iconsize");
}

/** px, `N%` of the shorter side, or `full`/`pill`/`circle` for a stadium. */
function readRadius(raw: string | null, min: number, template: TemplateKey | null): number {
  const cap = min / 2;
  if (raw == null) return template === "avatar" ? cap : 0;

  const v = raw.trim().toLowerCase();
  if (v === "full" || v === "pill" || v === "circle") return cap;

  const pct = v.match(/^(\d{1,3}(?:\.\d+)?)%$/);
  if (pct) return Math.min(cap, (parseFloat(pct[1]) / 100) * min);

  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequest(`"${raw}" is not a radius. Use 12, 50% or full.`);
  }
  return Math.min(cap, n);
}

/** `2`, `2,ccc`, or a bare colour for a 1px rule. */
function readBorder(raw: string | null, min: number, fg: Paint): Border | null {
  if (raw == null || raw.trim() === "") return null;

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 2) {
    throw new BadRequest(`"${raw}" is not a border. Use 2 or 2,cccccc.`);
  }

  let width = 1;
  let colourRaw: string | null = null;

  if (/^\d+(?:\.\d+)?$/.test(parts[0])) {
    width = parseFloat(parts[0]);
    colourRaw = parts[1] ?? null;
  } else if (parts.length === 1) {
    colourRaw = parts[0];
  } else {
    throw new BadRequest(`"${raw}" is not a border. The width comes first, as in 2,cccccc.`);
  }

  if (width <= 0) return null;
  width = Math.min(width, min / 2);

  const colour = colourRaw == null ? fg : readPaint(colourRaw, fg);
  if (!colour) return null;
  return { width, colour };
}

function num(raw: string | null, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  return Number(raw);
}

function clampInt(n: number, lo: number, hi: number, label: string): number {
  if (!Number.isFinite(n)) throw new BadRequest(`${label} must be a number.`);
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
