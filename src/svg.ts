/**
 * Spec -> SVG document.
 *
 * Nothing in here validates: params.ts already did that, and this file assumes
 * every colour is a normalised hex and every number is in range. The only
 * escaping that happens here is on caption text, which is the one value that
 * survives as free-form user input.
 *
 * Structure, in paint order:
 *
 *   <g opacity> <g clip radius>  background plate                 </g> </g>
 *               <g clip radius>  <g filter> icon, caption </g>    </g>
 *   <rect>                       the border
 *
 * Two details there are deliberate. The blur wraps only the content, so the
 * plate keeps a hard edge: blurring the plate too would pull transparency in
 * from outside the frame and fade the image out at its own borders, which
 * reads as a rendering bug rather than as a blur. And the border sits outside
 * everything, because clipping a stroke centred on the clip edge would halve
 * it, and a blurred border is nobody's idea of a border.
 */

import { isGradient, type Gradient, type Paint } from "./colors";
import type { Spec } from "./params";
import { renderIcon, TEMPLATE_LABEL } from "./templates";

const NS = "http://www.w3.org/2000/svg";

/**
 * Rough average glyph advance as a fraction of the font size. Real metrics
 * would need the font, which we do not have at render time, so captions are
 * fitted from this estimate and deliberately err small.
 */
const AVG_ADVANCE = 0.56;
const LINE_HEIGHT = 1.3;
/**
 * Cap height as a fraction of the font size. Centring on the em box puts
 * text visibly high, because the descender space below the baseline is empty
 * for most captions. Centring on the cap box is what the eye reads as centred.
 */
const CAP_HEIGHT = 0.71;

export function renderSvg(spec: Spec): string {
  const { w, h } = spec;
  const uid = hash(JSON.stringify(spec));

  // Default icon size tracks the shorter side, so one drawing reads the same
  // on a 64px avatar and a 1200px banner. ?iconsize= overrides it outright.
  const iconSize = spec.icon ? (spec.iconSize ?? clamp(Math.min(w, h) * 0.3, 18, 260)) : 0;
  const gap = iconSize * 0.24;

  const fontSize = spec.lines.length ? resolveFontSize(spec, iconSize) : 0;
  const textH = spec.lines.length
    ? (spec.lines.length - 1) * fontSize * LINE_HEIGHT + fontSize * CAP_HEIGHT
    : 0;

  const blockH = iconSize + (iconSize && textH ? gap : 0) + textH;
  const top = (h - blockH) / 2;

  const defs: string[] = [];

  // The background paint, which may need a gradient definition of its own.
  let plateFill = "";
  if (spec.bg) {
    if (isGradient(spec.bg)) {
      defs.push(gradientDef(spec.bg, `g${uid}`, w, h));
      plateFill = `fill="url(#g${uid})"`;
    } else {
      plateFill = fill(spec.bg);
    }
  }

  // One clip, reused by the plate and the content, so a rounded corner cuts
  // both without the document carrying two identical paths.
  let clip = "";
  if (spec.radius > 0) {
    defs.push(
      `<clipPath id="c${uid}"><rect x="0" y="0" width="${n(w)}" height="${n(h)}" ` +
        `rx="${n(spec.radius)}" ry="${n(spec.radius)}"/></clipPath>`,
    );
    clip = ` clip-path="url(#c${uid})"`;
  }

  const content: string[] = [];
  if (spec.icon) {
    content.push(renderIcon(spec.icon, (w - iconSize) / 2, top, iconSize, spec.fg.hex));
  }
  if (spec.lines.length) {
    content.push(renderText(spec, fontSize, top + iconSize + (iconSize ? gap : 0)));
  }

  let filter = "";
  if (spec.blur > 0 && content.length) {
    // A generous filter region: the default -10%/120% visibly clips a wide
    // blur, and the clip above tidies up whatever spills past the corners.
    defs.push(
      `<filter id="b${uid}" x="-25%" y="-25%" width="150%" height="150%" ` +
        `color-interpolation-filters="sRGB">` +
        `<feGaussianBlur stdDeviation="${n(spec.blur)}"/></filter>`,
    );
    filter = ` filter="url(#b${uid})"`;
  }

  let group = "";
  if (plateFill) group += `<g${clip}>${rect(0, 0, w, h, spec.radius, plateFill)}</g>`;
  if (content.length) group += `<g${clip}${filter}>${content.join("")}</g>`;

  if (spec.opacity < 1) group = `<g opacity="${n(spec.opacity, 3)}">${group}</g>`;

  const border = spec.border ? renderBorder(spec, spec.border.width, spec.border.colour) : "";

  return (
    `<svg xmlns="${NS}" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}" ` +
    `role="img" aria-label="${esc(label(spec))}">` +
    `<title>${esc(label(spec))}</title>` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    group +
    border +
    `</svg>`
  );
}

/** The accessible name: the caption if there is one, else the template, else the size. */
function label(spec: Spec): string {
  if (spec.lines.length) return spec.lines.join(" ");
  if (spec.template) return TEMPLATE_LABEL[spec.template];
  if (spec.icon) return `${spec.icon.replace(/-/g, " ")} placeholder`;
  return `${spec.w} by ${spec.h} placeholder`;
}

/**
 * Fit the caption to the box.
 *
 * The size a caption WANTS to be is a fraction of the shorter side, which is
 * what keeps a 64px avatar and a 1200px banner looking like the same design.
 * The other two terms only ever shrink that: one so a long line does not run
 * off the edge, one so eight lines do not run off the bottom.
 */
function resolveFontSize(spec: Spec, iconSize: number): number {
  if (spec.fontSize != null) return spec.fontSize;

  const longest = spec.lines.reduce((m, l) => Math.max(m, [...l].length), 1);
  const byBox = Math.min(spec.w, spec.h) * (iconSize ? 0.1 : 0.18);
  const byWidth = (spec.w * 0.86) / (longest * AVG_ADVANCE);
  const availableH = (spec.h - iconSize) * (iconSize ? 0.5 : 0.8);
  const byHeight = availableH / (spec.lines.length * LINE_HEIGHT);

  return clamp(Math.min(byBox, byWidth, byHeight), 6, 400);
}

function renderText(spec: Spec, size: number, top: number): string {
  const x = n(spec.w / 2);
  const lineHeight = size * LINE_HEIGHT;
  const first = top + size * CAP_HEIGHT;

  const tspans = spec.lines
    .map((line, i) => `<tspan x="${x}" y="${n(first + i * lineHeight)}">${esc(line)}</tspan>`)
    .join("");

  return (
    `<text x="${x}" y="${n(first)}" text-anchor="middle" ` +
    `font-family="${spec.fontFamily}" font-size="${n(size)}" font-weight="${spec.fontWeight}" ` +
    fill(spec.fg) +
    `>${tspans}</text>`
  );
}

/**
 * The border is inset by half its width so the stroke lands entirely inside
 * the image. Its radius shrinks by the same amount, which is what keeps a
 * rounded border concentric with the corner it traces.
 */
function renderBorder(spec: Spec, width: number, colour: Paint): string {
  const inset = width / 2;
  const r = Math.max(0, spec.radius - inset);
  return (
    `<rect x="${n(inset)}" y="${n(inset)}" ` +
    `width="${n(spec.w - width)}" height="${n(spec.h - width)}" ` +
    (r > 0 ? `rx="${n(r)}" ry="${n(r)}" ` : "") +
    `fill="none" stroke="${colour.hex}" stroke-width="${n(width)}"` +
    (colour.alpha < 1 ? ` stroke-opacity="${n(colour.alpha, 3)}"` : "") +
    `/>`
  );
}

function rect(x: number, y: number, w: number, h: number, r: number, fillAttr: string): string {
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"` +
    (r > 0 ? ` rx="${n(r)}" ry="${n(r)}"` : "") +
    ` ${fillAttr}/>`
  );
}

/**
 * A gradient definition, in the units that suit its shape.
 *
 * Linear uses userSpaceOnUse and the CSS gradient-line formula, so an angle
 * means the same thing here as it does in a stylesheet: the line runs through
 * the centre, and its half-length (|dx|w + |dy|h) / 2 is what makes the last
 * stop land exactly on the far corners rather than short of them.
 *
 * Radial uses objectBoundingBox instead, where a radius of half the unit
 * diagonal reaches the corners, and the box's own aspect stretches the circle
 * into the ellipse that CSS `radial-gradient` draws by default.
 */
function gradientDef(g: Gradient, id: string, w: number, h: number): string {
  const last = g.stops.length - 1;
  const stops = g.stops
    .map((stop, i) => {
      const offset = last === 0 ? 0 : i / last;
      return (
        `<stop offset="${n(offset, 4)}" stop-color="${stop.hex}"` +
        (stop.alpha < 1 ? ` stop-opacity="${n(stop.alpha, 3)}"` : "") +
        `/>`
      );
    })
    .join("");

  if (g.kind === "radial") {
    return `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.7072">${stops}</radialGradient>`;
  }

  // CSS angles: 0 points up, and they run clockwise. SVG's y axis points down,
  // which is the sign flip on dy.
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(dx) * w + Math.abs(dy) * h) / 2;

  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ` +
    `x1="${n(w / 2 - dx * half)}" y1="${n(h / 2 - dy * half)}" ` +
    `x2="${n(w / 2 + dx * half)}" y2="${n(h / 2 + dy * half)}">` +
    stops +
    `</linearGradient>`
  );
}

function fill(paint: Paint): string {
  return `fill="${paint.hex}"` + (paint.alpha < 1 ? ` fill-opacity="${n(paint.alpha, 3)}"` : "");
}

/**
 * SVG served from our own origin is a script execution context, so caption
 * text is escaped for both element content and attribute content, and C0
 * controls are dropped rather than escaped.
 */
export function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function n(v: number, places = 2): string {
  return String(Number(v.toFixed(places)));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** djb2, base36. Only used to keep element ids unique when SVGs are inlined. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
