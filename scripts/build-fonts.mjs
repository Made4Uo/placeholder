/**
 * Subsets the raster fonts into assets/fonts/, and generates the module that
 * ties them to the `?font=` values: src/fonts.generated.ts.
 *
 * The rendering server has no system fonts, so PNG and WebP output can only
 * draw text in whatever ships inside the bundle. Full Google Fonts TTFs run
 * 100KB to 340KB each and twenty-eight of them would be 4MB; subset to the
 * Latin range a placeholder caption actually uses, the whole set is a few
 * hundred KB.
 *
 *   npm run build:fonts
 *
 * BOTH OUTPUTS ARE COMMITTED, so a normal clone needs none of this. You only
 * need to run it to change the font set, and it needs Python with fonttools:
 *
 *   pip install fonttools
 *   npm install            # brings in the @expo-google-fonts sources
 *
 * To add a family: add a row to FAMILIES, `npm i -D @expo-google-fonts/<pkg>`,
 * and re-run. Nothing else in the codebase needs touching.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const OUT = "assets/fonts";
const MODULE = "src/fonts.generated.ts";

/**
 * The bundled families.
 *
 * `key` is what `?font=` accepts. `family` must match the name inside the TTF,
 * because that is what the renderer matches on and what the SVG font stack
 * names first. `generic` is the fallback tail of the stack, and marks which
 * three families answer to the bare `sans`, `serif` and `mono`.
 */
const FAMILIES = [
  { key: "inter", family: "Inter", generic: "sans", default: "sans", pkg: "inter", face: "Inter" },
  { key: "lato", family: "Lato", generic: "sans", pkg: "lato", face: "Lato" },
  { key: "montserrat", family: "Montserrat", generic: "sans", pkg: "montserrat", face: "Montserrat" },
  { key: "noto-sans", family: "Noto Sans", generic: "sans", pkg: "noto-sans", face: "NotoSans" },
  { key: "open-sans", family: "Open Sans", generic: "sans", pkg: "open-sans", face: "OpenSans" },
  { key: "oswald", family: "Oswald", generic: "sans", pkg: "oswald", face: "Oswald" },
  { key: "poppins", family: "Poppins", generic: "sans", pkg: "poppins", face: "Poppins" },
  { key: "pt-sans", family: "PT Sans", generic: "sans", pkg: "pt-sans", face: "PTSans" },
  { key: "raleway", family: "Raleway", generic: "sans", pkg: "raleway", face: "Raleway" },
  { key: "roboto", family: "Roboto", generic: "sans", pkg: "roboto", face: "Roboto" },
  { key: "source-sans", family: "Source Sans 3", generic: "sans", pkg: "source-sans-3", face: "SourceSans3" },
  { key: "lora", family: "Lora", generic: "serif", default: "serif", pkg: "lora", face: "Lora" },
  { key: "playfair", family: "Playfair Display", generic: "serif", pkg: "playfair-display", face: "PlayfairDisplay" },
  { key: "jetbrains-mono", family: "JetBrains Mono", generic: "mono", default: "mono", pkg: "jetbrains-mono", face: "JetBrainsMono" },
];

const WEIGHTS = [
  { suffix: "regular", face: "400Regular", weight: 400 },
  { suffix: "bold", face: "700Bold", weight: 700 },
];

/** The platform stack each generic falls through to when a family is missing. */
const GENERIC_TAIL = {
  sans: "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',Times,serif",
  mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
};

/**
 * What a placeholder caption can contain.
 *
 * Basic Latin and Latin-1 cover English and most of western Europe;
 * Latin Extended-A adds Polish, Czech, Turkish and the rest of central Europe
 * for about 4KB a face. The General Punctuation range matters more than it
 * looks: U+00D7 is the multiplication sign in the default "600x400" caption,
 * and curly quotes and the ellipsis are what people actually paste in.
 */
const UNICODES = [
  "U+0020-007E", // Basic Latin
  "U+00A0-00FF", // Latin-1 Supplement, including the multiplication sign
  "U+0100-017F", // Latin Extended-A
  "U+2010-2027", // dashes, quotes, bullet, ellipsis
  "U+2030,U+2039-203A", // per mille, guillemets
  "U+20A0-20BF", // currency
  "U+2122,U+2190-2193,U+2212", // trade mark, arrows, minus
].join(",");

/** Packages disagree on layout, so the face is found rather than assumed. */
function findFace(pkg, file) {
  const root = `node_modules/@expo-google-fonts/${pkg}`;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = walk(path);
        if (found) return found;
      } else if (entry.name === file) {
        return path;
      }
    }
    return null;
  };
  const found = walk(root);
  if (!found) throw new Error(`${file} not found in ${root}. Is the package installed?`);
  return found;
}

mkdirSync(OUT, { recursive: true });

try {
  execFileSync("python", ["-c", "import fontTools"], { stdio: "pipe" });
} catch {
  console.error(
    "This needs Python with fonttools installed:\n  pip install fonttools\n" +
      "The subsetted fonts are committed, so you only need this to change the font set.",
  );
  process.exit(1);
}

let before = 0;
let after = 0;
const blobs = [];
const imports = [];
const buffers = [];

for (const family of FAMILIES) {
  for (const weight of WEIGHTS) {
    const source = findFace(family.pkg, `${family.face}_${weight.face}.ttf`);
    const file = `${family.key}-${weight.suffix}.ttf`;
    const target = `${OUT}/${file}`;

    execFileSync(
      "python",
      [
        "-m",
        "fontTools.subset",
        source,
        `--unicodes=${UNICODES}`,
        // Placeholder captions are a single run of plain text: no ligature
        // shaping to preserve, and no hinting worth keeping when the renderer
        // draws at 200px rather than at 12.
        "--layout-features=",
        "--no-hinting",
        "--desubroutinize",
        `--output-file=${target}`,
      ],
      { stdio: "pipe" },
    );

    before += statSync(source).size;
    after += statSync(target).size;
    blobs.push(readFileSync(target));

    const binding = camel(family.key) + weight.weight;
    imports.push(`import ${binding} from "../${OUT}/${file}";`);
    buffers.push(binding);
  }
}

const gz = gzipSync(Buffer.concat(blobs), { level: 9 }).length;

// --- the module -------------------------------------------------------------

const rows = FAMILIES.map((f) => {
  const stack = `'${f.family}',${GENERIC_TAIL[f.generic]}`;
  return (
    `  { key: ${JSON.stringify(f.key)}, family: ${JSON.stringify(f.family)}, ` +
    `generic: ${JSON.stringify(f.generic)}, stack: ${JSON.stringify(stack)} },`
  );
}).join("\n");

const defaults = Object.fromEntries(
  FAMILIES.filter((f) => f.default).map((f) => [f.default, f.family]),
);
for (const generic of Object.keys(GENERIC_TAIL)) {
  if (!defaults[generic]) throw new Error(`No family marked as the default for "${generic}"`);
}

writeFileSync(
  MODULE,
  `// GENERATED FILE. Do not edit by hand.
// Run \`npm run build:fonts\` to rebuild from the @expo-google-fonts packages.
//
// ${FAMILIES.length} families, ${FAMILIES.length * WEIGHTS.length} faces, subset to Latin.
// Each is OFL-1.1 or Apache-2.0; see NOTICE and assets/fonts/OFL.txt.

${imports.join("\n")}

/** Every face, in the order the renderer should consider them. */
export const FONT_BUFFERS: ArrayBuffer[] = [${buffers.join(", ")}];

export interface BundledFont {
  /** What \`?font=\` accepts. */
  key: string;
  /** The family name inside the TTF. The renderer matches on this. */
  family: string;
  generic: "sans" | "serif" | "mono";
  /** The full CSS font-family list, bundled family first. */
  stack: string;
}

export const BUNDLED_FONTS: BundledFont[] = [
${rows}
];

/**
 * The family each generic resolves to when a stack falls all the way through.
 * The renderer needs these because it has no system fonts behind them.
 */
export const GENERIC_DEFAULTS = ${JSON.stringify(defaults, null, 2)} as const;
`,
);

// --- the licence and the readme ---------------------------------------------

const licences = [...new Set(FAMILIES.map((f) => f.pkg))].map((pkg) => {
  const text = readFileSync(`node_modules/@expo-google-fonts/${pkg}/LICENSE_FONT`, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.trim().toLowerCase().startsWith("copyright"));
  return { pkg, line: line ? line.trim() : null, text };
});

const ofl = licences.find((l) => l.text.includes("SIL OPEN FONT LICENSE"));
const copyrights = licences.map((l) => "  " + l.line).sort();

writeFileSync(
  `${OUT}/OFL.txt`,
  `The fonts in this directory are licensed under the SIL Open Font License,
Version 1.1, except where a family's own licence says otherwise (Roboto ships
under Apache-2.0). They carry separate copyrights:

${copyrights.join("\n")}

The SIL Open Font License text below applies to all of the OFL families.

${ofl.text.slice(ofl.text.indexOf("This Font Software is licensed"))}`,
);

writeFileSync(
  `${OUT}/README.md`,
  `# Bundled raster fonts

Generated by \`npm run build:fonts\`. Do not edit these by hand, and do not add
one without adding it to \`scripts/build-fonts.mjs\` as well.

The rendering server has no system fonts, so PNG and WebP output can only draw
text in what ships here. These are subset to the Latin ranges a placeholder
caption uses, which is what keeps ${FAMILIES.length * WEIGHTS.length} faces to ${(after / 1024).toFixed(0)} KB
instead of ${(before / 1024 / 1024).toFixed(1)} MB.

SVG output does not use these at all. It names font families and the viewer's
own machine resolves them.

| \`?font=\` | Family | Generic |
|---|---|---|
${FAMILIES.map((f) => `| \`${f.key}\` | ${f.family} | ${f.generic}${f.default ? " (the default)" : ""} |`).join("\n")}

Licences: [OFL.txt](OFL.txt), and [../../NOTICE](../../NOTICE).
`,
);

console.log(
  `${FAMILIES.length} families, ${FAMILIES.length * WEIGHTS.length} faces: ` +
    `${(before / 1024 / 1024).toFixed(2)} MB -> ${(after / 1024).toFixed(0)} KB ` +
    `(${(gz / 1024).toFixed(0)} KB gzipped)\n${MODULE} written`,
);

function camel(key) {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
