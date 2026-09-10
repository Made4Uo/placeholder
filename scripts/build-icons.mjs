/**
 * Turns the lucide-static package into src/icons.generated.ts.
 *
 * The generated file is COMMITTED, so a fresh clone builds and deploys without
 * lucide-static installed at all. That is why lucide-static is a
 * devDependency: it exists to regenerate this file when Lucide ships new
 * icons, and never ends up in the deployed Worker.
 *
 *   npm run build:icons
 *
 * Each icon is stored as the inner markup of its SVG, whitespace collapsed,
 * with the wrapper element dropped. src/svg.ts supplies the wrapper, because
 * the wrapper is where the size, the colour and the stroke weight are decided,
 * and those are per-request.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const SOURCE = "node_modules/lucide-static/icons";
const TARGET = "src/icons.generated.ts";

/**
 * The `?type=` presets, and the icon each one resolves to. Asserted below, so
 * a Lucide rename breaks the build rather than a deployed URL.
 */
const PRESETS = {
  image: "image",
  avatar: "user-round",
  card: "layout-template",
  product: "package",
  video: "circle-play",
  text: "text",
};

const files = readdirSync(SOURCE).filter((f) => f.endsWith(".svg")).sort();
if (files.length < 500) {
  throw new Error(`Only ${files.length} icons found in ${SOURCE}. Is lucide-static installed?`);
}

const icons = new Map();
for (const file of files) {
  const raw = readFileSync(join(SOURCE, file), "utf8");
  const open = raw.indexOf("<svg");
  const inner = raw.slice(raw.indexOf(">", open) + 1, raw.lastIndexOf("</svg>"));

  const markup = inner
    .replace(/\s*\n\s*/g, "")
    .replace(/\s+\/>/g, "/>")
    .trim();

  if (!markup) throw new Error(`${file} has no geometry`);
  // Every value lands inside an SVG document, so anything that could close an
  // element or open a new kind of one has no business being here.
  if (/<(?!path|circle|rect|line|polyline|polygon|ellipse|g[ >/])/i.test(markup)) {
    throw new Error(`${file} contains unexpected markup: ${markup.slice(0, 80)}`);
  }
  if (markup.includes("</script") || markup.includes("on=") || /\son\w+=/i.test(markup)) {
    throw new Error(`${file} contains an event handler or script`);
  }

  icons.set(file.slice(0, -4), markup);
}

for (const [preset, icon] of Object.entries(PRESETS)) {
  if (!icons.has(icon)) {
    throw new Error(`Preset "${preset}" points at "${icon}", which Lucide no longer ships.`);
  }
}

const version = JSON.parse(readFileSync("node_modules/lucide-static/package.json", "utf8")).version;

const body = [...icons]
  .map(([name, markup]) => `  ${JSON.stringify(name)}: ${JSON.stringify(markup)},`)
  .join("\n");

const out = `// GENERATED FILE. Do not edit by hand.
// Run \`npm run build:icons\` to rebuild from lucide-static.
//
// Icons from Lucide ${version} (https://lucide.dev), ISC licensed. See NOTICE.
// The markup here is the inner geometry only: src/svg.ts supplies the wrapper,
// because size, colour and stroke weight are decided per request.

/** Lucide icon name -> inner SVG geometry. ${icons.size} entries. */
export const ICONS: Record<string, string> = {
${body}
};

export const ICON_NAMES: string[] = Object.keys(ICONS);
`;

writeFileSync(TARGET, out);

const gz = gzipSync(Buffer.from(out)).length;
console.log(
  `${TARGET}: ${icons.size} icons from lucide-static ${version}, ` +
    `${(out.length / 1024).toFixed(0)} KiB (${(gz / 1024).toFixed(0)} KiB gzipped)`,
);
