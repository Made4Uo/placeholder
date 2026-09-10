/**
 * Colour parsing.
 *
 * Everything that reaches the SVG has to come out of here. The output of a
 * request is an SVG document served from our own origin, so an unvalidated
 * colour string is an injection hole: `bg=red"/><script>` would otherwise land
 * inside an attribute. parseColour only ever returns a normalised `#rrggbb`
 * plus a separate alpha, or null. Nothing else is embeddable.
 */

export interface Paint {
  /** Normalised `#rrggbb`. Always exactly 7 chars, always safe to embed. */
  hex: string;
  /** 0..1. Kept separate from the hex so output stays SVG 1.1 compatible. */
  alpha: number;
}

export interface Gradient {
  kind: "linear" | "radial";
  /** CSS degrees: 0 points up, 90 points right. Ignored when radial. */
  angle: number;
  /** Two to six stops, spread evenly along the gradient line. */
  stops: Paint[];
}

/** Anything that can paint an area. */
export type Fill = Paint | Gradient;

export function isGradient(fill: Fill): fill is Gradient {
  return "stops" in fill;
}

/**
 * Named colours, on the Tailwind 500 scale rather than the CSS one.
 *
 * CSS `red` is #ff0000, which is not a colour anyone wants behind placeholder
 * text. The audience for this service already reads colour names as Tailwind
 * names, so those are the values. Documented in the README so it is a choice,
 * not a surprise. Anything not in this list has to be a hex value.
 */
export const NAMED_HEX: Record<string, string> = {
  transparent: "#00000000",
  white: "#ffffff",
  black: "#000000",
  slate: "#64748b",
  gray: "#6b7280",
  grey: "#6b7280",
  zinc: "#71717a",
  stone: "#78716c",
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  fuchsia: "#d946ef",
  pink: "#ec4899",
  rose: "#f43f5e",
  navy: "#1e3a8a",
  brown: "#78350f",
  silver: "#cbd5e1",
  light: "#e2e8f0",
  dark: "#0f172a",
};

export const NAMED_COLOURS = Object.keys(NAMED_HEX);

/** Slate 200: light enough to read dark text on, dark enough to see on white. */
export const DEFAULT_BG: Paint = { hex: "#e2e8f0", alpha: 1 };

const HEX = /^[0-9a-f]+$/;

/**
 * Accepts `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (the `#` optional, since a
 * hash cannot travel in a URL path) or one of NAMED. Returns null only when
 * the value is not a colour at all. A fully transparent colour comes back as
 * a Paint with alpha 0, so callers can tell "invalid" from "invisible".
 */
export function parseColour(raw: string | null | undefined): Paint | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;

  const named = NAMED_HEX[v];
  const body = (named ?? v).replace(/^#/, "");

  if (!HEX.test(body)) return null;

  let hex: string;
  let alpha = 1;

  if (body.length === 3 || body.length === 4) {
    hex = "#" + body.slice(0, 3).split("").map((c) => c + c).join("");
    if (body.length === 4) alpha = parseInt(body[3] + body[3], 16) / 255;
  } else if (body.length === 6 || body.length === 8) {
    hex = "#" + body.slice(0, 6);
    if (body.length === 8) alpha = parseInt(body.slice(6, 8), 16) / 255;
  } else {
    return null;
  }

  return { hex, alpha: round(alpha, 3) };
}

/** Relative luminance per WCAG 2.x. Used only to pick a readable text colour. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Default foreground for a given background: the most readable of a soft ink
 * and a soft paper, escalating to pure black or white when neither clears
 * WCAG AA at 4.5:1. A placeholder whose label you cannot read is a broken
 * placeholder, so this is a correctness rule, not a nicety.
 *
 * Over a gradient a candidate is scored by its WORST stop, not by the average
 * of them. Averaging picks a colour that reads well against the middle and
 * disappears at one end, which is exactly where a caption usually sits. Some
 * gradients have no readable flat answer at all (black to white is the honest
 * example), and for those this returns the least bad one rather than pretending.
 */
export function autoForeground(bg: Fill | null): Paint {
  if (!bg) return { hex: "#475569", alpha: 1 };

  const against = isGradient(bg) ? bg.stops.map((s) => s.hex) : [bg.hex];
  const candidates = ["#475569", "#f8fafc", "#000000", "#ffffff"];

  let best = candidates[0];
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = Math.min(...against.map((hex) => contrastRatio(hex, candidate)));
    if (score >= 4.5) return { hex: candidate, alpha: 1 };
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return { hex: best, alpha: 1 };
}

function round(n: number, places: number): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}
