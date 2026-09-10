/**
 * The home page: a live playground and the whole reference in one document.
 *
 * It is a string rather than a build step because the service has exactly one
 * page, and a static-asset pipeline for one page is more moving parts than the
 * page is worth. Nothing here is user input, so nothing here needs escaping.
 */

import { clientScript, scriptJson } from "./client";
import { NAMED_COLOURS, NAMED_HEX } from "./colors";
import { ICONS } from "./icons.generated";
import { BUNDLED_FONTS, FONT_KEYS, MAX_DIM, TEMPLATES } from "./params";
import { themeScript } from "./theme";

export function playground(
  origin: string,
  repoUrl?: string,
  findable = false,
): string {
  const repo = repoUrl && repoUrl.trim() ? repoUrl.trim() : "";
  // Third-party licences live in NOTICE and in the repository, not here. The
  // page distributes rendered pixels, not the font or the icon set, so it owes
  // no attribution of its own; putting it in the footer was habit, not law.
  const source = repo
    ? `<a href="${amp(repo)}" rel="noopener">Source and licences on GitHub</a>.`
    : "";

  const examples: Array<[string, string]> = [
    ["The default", "/600x400"],
    ["Your colours", "/600x400?bg=0c6fd0&color=ffffff"],
    ["A caption", "/600x400?text=Hero+image"],
    ["Two lines", "/600x400?text=Drop+your%5CnHero+image+here"],
    ["Rounded", "/600x400?radius=24"],
    [
      "A dashed-looking rule",
      "/600x400?bg=transparent&border=2,cbd5e1&radius=16",
    ],
    ["16:9 from a width", "/16:9?w=800&bg=0f172a"],
    ["An avatar", "/160?type=avatar&bg=6c5ce7"],
    ["A product slot", "/400x400?type=product&bg=f1f5f9"],
    ["Any Lucide icon", "/400x400?icon=shopping-cart&bg=0c6fd0"],
    ["Icon plus caption", "/400x400?icon=credit-card&text=Payment&bg=f1f5f9"],
    ["A video slot", "/16:9?w=640&type=video&bg=0f172a"],
    ["A gradient", "/600x400?bg=0c6fd0,6c5ce7"],
    ["Gradient, left to right", "/600x400?bg=0ea5e9,10b981&gradient=to-right"],
    ["Radial", "/600x400?bg=6c5ce7,0f172a&gradient=radial"],
    ["Fading out", "/600x400?bg=0c6fd0,transparent&gradient=to-bottom"],
    ["Faded overlay stand-in", "/600x400?bg=0c6fd0&opacity=35"],
    ["Blurred backdrop", "/600x400?bg=0c6fd0&text=Loading&blur=6"],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Placeholder Image Generator: SVG, PNG and WebP from a URL</title>
<meta name="description" content="Free placeholder image generator. Put the size in a URL and get an image back: /600x400. Gradients, corner radius, borders, blur, aspect ratios, 2077 icons and 14 fonts. SVG, PNG or WebP, no signup, MIT licensed.">
<meta name="theme-color" content="#0c6fd0">
<meta name="format-detection" content="telephone=no">
${findable ? SEO(origin, repo) : ""}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/180?bg=0c6fd0&amp;color=ffffff&amp;text=P&amp;radius=40&amp;format=png">
<script>${themeScript()}</script>

<style>
:root{
  --bg:#f8fafc; --panel:#ffffff; --ink:#0f172a; --muted:#64748b;
  --line:#e2e8f0; --accent:#0c6fd0; --code:#f1f5f9; --radius:4px;
  color-scheme:light;
}
/* Light for everyone by default. Dark only when chosen with the switch, and
   color-scheme goes with it so selects, pickers and scrollbars match. */
:root[data-theme=dark]{
  --bg:#0b1220;--panel:#111a2e;--ink:#e6edf7;--muted:#93a4bd;--line:#1e2a44;--accent:#5aa9f5;--code:#0d1526;
  color-scheme:dark;
}
*{box-sizing:border-box}
/* Beats any class that sets display, so [hidden] always wins. */
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent)}
.wrap{max-width:1200px;margin:0 auto;padding:32px 20px 80px}
header h1{font-size:28px;margin:0 0 6px;letter-spacing:-.02em}
.masthead{display:flex;gap:20px;align-items:flex-start;justify-content:space-between}
.tools{flex:none;display:flex;gap:4px}
.iconbtn{flex:none;color:var(--muted);line-height:0;padding:6px;border-radius:10px;
  border:1px solid transparent;background:none}
.iconbtn:hover{color:var(--ink);border-color:var(--line)}
.iconbtn svg{width:26px;height:26px;display:block}
.themebtn svg{width:22px;height:22px;margin:2px}
/* The icon is the theme a click gives: a moon while light, a sun while dark. */
.themebtn[data-current=light] .sun,.themebtn[data-current=dark] .moon{display:none}
header p{margin:0 0 28px;color:var(--muted);}
.app{display:grid;grid-template-columns:400px 1fr;gap:20px;align-items:start}
@media (max-width:860px){.app{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.field{margin-bottom:12px}
.field label{display:block;font-size:12px;font-weight:600;color:var(--muted);
  text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
input,select{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:8px;
  background:var(--bg);color:var(--ink);font:inherit;font-size:14px}
input[type=color]{padding:2px;height:34px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.swatch{display:grid;grid-template-columns:34px 1fr;gap:6px}
.stage{background:
    repeating-conic-gradient(var(--line) 0% 25%, transparent 0% 50%) 50%/18px 18px;
  border:1px solid var(--line);border-radius: var(--radius);padding:20px;
  display:flex;align-items:center;justify-content:center;min-height:340px;overflow:auto}
.stage img{max-width:100%;height:auto;display:block}
.urlbar{display:flex;gap:8px;margin-top:14px}
.urlbar input{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
button{padding:7px 14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);
  color:var(--ink);font:inherit;font-weight:600;cursor:pointer;white-space:nowrap}
button:hover{border-color:var(--accent);color:var(--accent)}
h2{font-size:19px;margin:44px 0 10px;letter-spacing:-.01em}
p.lede{color:var(--muted);margin:0 0 16px;max-width:70ch}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.gallery .example{margin:0;padding:2px}
.gallery .shot{position:relative}
.gallery img{width:100%;height:auto;display:block}
/* Copy and View sit over the image, out of sight until the pointer or the
   keyboard arrives. The overlay ignores the pointer, so right-clicking the
   image still offers the browser's own image menu. */
.gallery .actions{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  gap:8px;background:rgba(15,23,42,.45);opacity:0;transition:opacity .12s;pointer-events:none}
.gallery .shot:hover .actions,.gallery .shot:focus-within .actions{opacity:1}
/* Touch screens have no hover, so the buttons stay out, tucked in a corner. */
@media (hover:none){.gallery .actions{opacity:1;background:none;inset:auto 8px 8px auto}}
/* Fixed colours rather than tokens: they sit on arbitrary images, not the page. */
.gallery .action{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;
  border:1px solid transparent;background:#fff;color:#0f172a;font:inherit;font-size:13px;
  font-weight:600;text-decoration:none;cursor:pointer;pointer-events:auto;
  box-shadow:0 1px 6px rgba(0,0,0,.25)}
.gallery .action:hover{background:#f1f5f9;color:#0f172a;border-color:transparent}
.gallery .action:focus-visible{outline:2px solid #fff;outline-offset:2px}
.gallery .action svg{width:15px;height:15px;display:block}
.gallery .path{display:block;font-size:12px;color:var(--muted);margin-top:6px;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all}
.gallery .example:hover .path{color:var(--ink)}
.copied{position:absolute;top:10px;right:10px;background:var(--accent);color:#fff;
  font-size:11px;font-weight:600;letter-spacing:.02em;padding:3px 10px;border-radius:999px;
  pointer-events:none;box-shadow:0 1px 6px rgba(0,0,0,.25)}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);white-space:nowrap;border:0}
table{width:100%;border-collapse:collapse;font-size:14px;display:block;overflow-x:auto;white-space:nowrap}
th,td{text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
code,kbd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;
  background:var(--code);padding:1px 5px;border-radius:5px}
p.hint{margin:8px 2px 0;font-size:12.5px;color:var(--muted)}
.muted{font-weight:400;text-transform:none;letter-spacing:0;opacity:.8}
.iconrow{grid-template-columns:1fr 118px}
.sizerow{grid-template-columns:1fr 108px}
.sizerow.solo{grid-template-columns:1fr}
.advanced{margin-top:4px;border-top:1px solid var(--line);padding-top:12px}
.advanced summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;
  font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;
  letter-spacing:.04em;padding:4px 0;user-select:none}
.advanced summary::-webkit-details-marker{display:none}
.advanced summary::before{content:"";border:solid currentColor;border-width:0 1.5px 1.5px 0;
  padding:2.5px;transform:rotate(-45deg);transition:transform .15s;margin-left:2px}
.advanced[open] summary::before{transform:rotate(45deg)}
.advanced summary:hover{color:var(--ink)}
.advbody{padding-top:12px}
.badge{background:var(--accent);color:#fff;border-radius:999px;padding:1px 7px;
  font-size:11px;letter-spacing:0}
input:disabled,select:disabled{opacity:.45;cursor:not-allowed}
.stops{display:grid;gap:6px}
.stop{display:grid;grid-template-columns:34px 1fr 30px;gap:6px;align-items:center}
.stop.solo{grid-template-columns:34px 1fr}
.stop button{padding:0;height:32px;font-size:17px;line-height:1;color:var(--muted)}
.stop button:hover{color:#ef4444;border-color:#ef4444}
.stopbar{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:8px}
.stopbar button{padding:6px 12px;font-size:13px;font-weight:600}
.stopbar button[disabled]{opacity:.45;cursor:not-allowed}
.gradpreview{height:28px;border-radius:8px;border:1px solid var(--line);margin-top:8px;
  background-image:repeating-conic-gradient(var(--line) 0% 25%, transparent 0% 50%);
  background-size:12px 12px}
.urlbar input:focus{outline:2px solid var(--accent);outline-offset:1px}
.urlbar input.bad{border-color:#ef4444}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
.note{background:var(--code);border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 8px 8px 0;
  margin:16px 0;color:var(--muted);font-size:14px}
</style>
</head>
<body>
<div class="wrap">

<header>
  <div class="masthead">
    <div>
      <h1>Placeholder images, built from the URL</h1>
      <p>Ask for a size, get an image: <code>/600x400</code>. No account, no upload,
         nothing to install. Output is SVG by default, so it renders instantly and
         stays sharp at any zoom. PNG and WebP are one parameter away when you need
         real pixels.</p>
    </div>
    <div class="tools">
      <button type="button" class="iconbtn themebtn" id="theme" hidden>${lucide("sun")}${lucide("moon")}</button>
      ${
        repo
          ? `<a class="iconbtn" href="${amp(repo)}" rel="noopener" title="Source on GitHub" aria-label="Source on GitHub" target="_blank">${GITHUB_MARK}</a>`
          : ""
      }
    </div>
  </div>
</header>

<div class="app">
  <form class="panel" id="controls" onsubmit="return false">
    <div class="row sizerow" id="sizerow">
      <div class="field">
        <label for="size">Size or ratio</label>
        <input id="size" value="600x400" placeholder="600x400, 600, or 16:9">
      </div>
      ${lockable(
        "ratioW",
        "Ratio width",
        `<input id="ratioW" type="number" min="1" max="${MAX_DIM}" placeholder="for 16:9">`,
      )}
    </div>

    <div class="field">
      <label for="text">Caption</label>
      <input id="text" placeholder="defaults to the size">
    </div>

    <div class="field">
      <label for="bgStop0">Background <span class="muted">one colour, or up to six for a gradient</span></label>
      <div id="bgStops" class="stops"></div>
      <div class="stopbar">
        <button type="button" id="addStop">Add colour</button>
        <select id="gradient" aria-label="Gradient direction">
          <option value="">to bottom</option>
          <option value="to-top">to top</option>
          <option value="to-right">to right</option>
          <option value="to-left">to left</option>
          <option value="to-bottom-right">to bottom right</option>
          <option value="to-bottom-left">to bottom left</option>
          <option value="to-top-right">to top right</option>
          <option value="to-top-left">to top left</option>
          <option value="45">45 degrees</option>
          <option value="radial">radial</option>
        </select>
      </div>
      <div id="gradPreview" class="gradpreview" hidden></div>
    </div>

    <div class="field">
      <label for="fg">Foreground</label>
      <div class="swatch">
        <input type="color" id="fgPick" value="#475569" aria-label="Foreground colour picker">
        <input id="fg" placeholder="auto, picked to stay readable">
      </div>
    </div>

    <div class="row iconrow">
      <div class="field">
        <label for="icon">Icon <span id="iconCount" class="muted"></span></label>
        <input id="icon" list="iconlist" autocomplete="off" placeholder="any Lucide name">
        <datalist id="iconlist"></datalist>
      </div>
      <div class="field">
        <label for="type">Template</label>
        <select id="type">
          <option value="">none</option>
          ${TEMPLATES.map((t) => `<option value="${t}">${t}</option>`).join("")}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="format">Format</label>
      <select id="format">
        <option value="svg">SVG (sharp at any size, smallest)</option>
        <option value="png">PNG (real pixels)</option>
        <option value="webp">WebP (real pixels, smaller)</option>
      </select>
    </div>

    <details id="advanced" class="advanced">
      <summary>
        <span>Advanced</span>
        <span class="badge" id="advCount" hidden></span>
      </summary>

      <div class="advbody">
        <div class="row3">
          <div class="field">
            <label for="radius">Radius</label>
            <input id="radius" placeholder="0">
          </div>
          <div class="field">
            <label for="borderW">Border</label>
            <input id="borderW" type="number" min="0" max="40" placeholder="0">
          </div>
          ${lockable("borderC", "Border colour", `<input id="borderC" placeholder="auto">`)}
        </div>

        <div class="row3">
          <div class="field">
            <label for="opacity">Opacity %</label>
            <input id="opacity" type="number" min="0" max="100" placeholder="100">
          </div>
          <div class="field">
            <label for="blur">Blur</label>
            <input id="blur" type="number" min="0" max="100" placeholder="0">
          </div>
          ${lockable("iconsize", "Icon size", `<input id="iconsize" placeholder="auto">`)}
        </div>

        <div class="field">
          <label for="font">Font</label>
          <select id="font">
            ${["sans", "serif", "mono"]
              .map(
                (generic) =>
                  `<optgroup label="${generic}">` +
                  `<option value="${generic}">${generic} (default)</option>` +
                  BUNDLED_FONTS.filter((f) => f.generic === generic)
                    .map((f) => `<option value="${f.key}">${f.family}</option>`)
                    .join("") +
                  `</optgroup>`,
              )
              .join("")}
          </select>
        </div>

        <div class="row3">
          <div class="field">
            <label for="fs">Font size</label>
            <input id="fs" type="number" min="4" max="400" placeholder="auto">
          </div>
          <div class="field">
            <label for="fw">Weight</label>
            <select id="fw">
              ${[
                ["", "600 (default)"],
                ["300", "300"],
                ["400", "400"],
                ["500", "500"],
                ["700", "700"],
                ["800", "800"],
                ["900", "900"],
              ]
                .map(([v, l]) => `<option value="${v}">${l}</option>`)
                .join("")}
            </select>
          </div>
          ${lockable(
            "scale",
            "Scale",
            `<select id="scale">` +
              `<option value="1">1x</option><option value="2">2x</option>` +
              `<option value="3">3x</option><option value="4">4x</option></select>`,
          )}
        </div>

        ${lockable(
          "quality",
          `WebP quality <span class="muted">1 to 100</span>`,
          `<input id="quality" type="number" min="1" max="100" placeholder="82">`,
        )}
      </div>
    </details>
  </form>

  <div>
    <div class="stage"><img id="preview" alt="Live preview of the placeholder image"></div>
    <div class="urlbar">
      <input id="url" spellcheck="false" aria-label="Image URL. Edit it and the controls follow.">
      <button type="button" id="copy">Copy</button>
      <button type="button" id="open">Open</button>
    </div>
    <p class="hint">Edit the URL and the controls follow it. Paste one in from anywhere.</p>
  </div>
</div>

<h2 id="examples">Examples</h2>
<p class="lede">Every image below is the URL under it. Hover one to copy the URL or view the image.</p>
<div class="gallery">
${examples
  .map(
    ([caption, path], i) =>
      // View is a real link, so it works with no script and the browser's own
      // "copy link address" is on it too. Copy needs the clipboard, so it
      // ships hidden and src/client.ts reveals it.
      `<figure class="example">` +
      `<div class="shot">` +
      `<img loading="lazy" src="${amp(path)}" alt="${caption}">` +
      `<div class="actions">` +
      `<button type="button" class="action" id="exCopy${i}" ` +
      `aria-label="Copy the URL for ${caption}" hidden>${lucide("copy")}Copy</button>` +
      `<a class="action" id="exView${i}" href="${amp(path)}" target="_blank" rel="noopener" ` +
      `aria-label="View ${caption} in a new tab">${lucide("external-link")}View</a>` +
      `</div>` +
      `<span class="copied" id="copied${i}" hidden>Copied</span>` +
      `</div>` +
      `<figcaption class="path">${amp(path)}</figcaption></figure>`,
  )
  .join("\n")}
</div>
<p class="sr-only" id="copyLive" role="status" aria-live="polite"></p>

<h2 id="url-grammar">The URL</h2>
<table>
<tr><th>Form</th><th>Gives you</th></tr>
<tr><td><code>/600x400</code></td><td>An explicit size.</td></tr>
<tr><td><code>/600</code></td><td>A square.</td></tr>
<tr><td><code>/16:9?w=800</code></td><td>A ratio scaled to a width. Use <code>?h=</code> to scale from the height instead. With neither, the width is 1200.</td></tr>
<tr><td><code>/600x400.png</code></td><td>Format as a file extension, for tools that insist on one.</td></tr>
</table>
<p class="lede">The path holds the size and nothing else. Everything else is a named
   parameter, so you never have to remember which of two colours came first.</p>
</table>

<h2 id="parameters">Parameters</h2>
<table>
<tr><th>Parameter</th><th>Values</th><th>Default</th></tr>
<tr><td><code>text</code>, <code>t</code></td><td>Any text. <code>\\n</code> starts a new line, up to 8. <code>text=</code> leaves it blank.</td><td>the size</td></tr>
<tr><td><code>bg</code></td><td>Hex with or without the <code>#</code>, a name, or <code>transparent</code>.</td><td><code>e2e8f0</code></td></tr>
<tr><td><code>color</code>, <code>fg</code></td><td>Same, for the text and iconography. Left out, it picks whichever of four inks clears WCAG AA against your background.</td><td>auto</td></tr>
<tr><td><code>icon</code></td><td>Any <a href="https://lucide.dev/icons" rel="noopener">Lucide</a> name, e.g. <code>shopping-cart</code>. The full list is at <a href="/icons.json">/icons.json</a>.</td><td>none</td></tr>
<tr><td><code>iconsize</code>, <code>is</code></td><td>Pixels, or a percentage of the shorter side (<code>40%</code>). Capped at the shorter side.</td><td>30% of the shorter side</td></tr>
<tr><td><code>type</code></td><td>${TEMPLATES.join(", ")}. Presets: an icon, plus behaviour a bare icon name cannot carry (<code>avatar</code> rounds itself).</td><td>none</td></tr>
<tr><td><code>radius</code>, <code>r</code></td><td>Pixels, <code>50%</code> of the shorter side, or <code>full</code>.</td><td><code>0</code>, or <code>full</code> for <code>type=avatar</code></td></tr>
<tr><td><code>border</code>, <code>b</code></td><td><code>2</code>, <code>2,cbd5e1</code>, or a bare colour for a 1px rule.</td><td>none</td></tr>
<tr><td><code>opacity</code>, <code>o</code></td><td>0 to 100, as a percentage of the whole image.</td><td><code>100</code></td></tr>
<tr><td><code>blur</code></td><td>0 to 100. Gaussian, clipped to the corner radius.</td><td><code>0</code></td></tr>
<tr><td><code>font</code></td><td><code>${FONT_KEYS.join("</code>, <code>")}</code>, or any of the ${BUNDLED_FONTS.length} bundled families by name: ${BUNDLED_FONTS.map((f) => `<code>${f.key}</code>`).join(", ")}. Any other family works in SVG if the viewer has it.</td><td><code>sans</code></td></tr>
<tr><td><code>fs</code>, <code>fontsize</code></td><td>Pixels.</td><td>fitted to the box</td></tr>
<tr><td><code>fw</code>, <code>weight</code></td><td>100 to 900.</td><td><code>600</code></td></tr>
<tr><td><code>format</code>, <code>f</code></td><td><code>svg</code>, <code>png</code>, <code>webp</code>.</td><td><code>svg</code></td></tr>
<tr><td><code>scale</code>, <code>dpr</code></td><td>1 to 4. Raster only.</td><td><code>1</code></td></tr>
<tr><td><code>q</code>, <code>quality</code></td><td>1 to 100. WebP only.</td><td><code>82</code></td></tr>
</table>

<div class="note">
  Colour names use the Tailwind 500 scale, not the CSS one, because CSS <code>red</code> is
  #ff0000 and nobody wants that behind a caption. Available:
  ${NAMED_COLOURS.map((c) => `<code>${c}</code>`).join(" ")}.
</div>

<h2 id="notes">Notes worth reading once</h2>
<ul>
  <li><strong>SVG is the default on purpose.</strong> It is a few hundred bytes, stays sharp
      at every zoom, and costs the server no pixel work.</li>
  <li><strong>${BUNDLED_FONTS.length} fonts are bundled for PNG and WebP</strong>, subset to Latin,
      so <code>?font=</code> means the same thing in every format. The renderer has no
      system fonts to fall back on, so a family that is not on that list still works in
      SVG, where the viewer's own machine resolves it, and falls back to a generic in
      raster.</li>
  <li><strong>A transparent gradient stop keeps its neighbour's colour.</strong> Fading
      blue to <code>transparent</code> fades blue to nothing, not to transparent black,
      which is the grey bruise you get from the naive reading.</li>
  <li><strong>The icon set is all of Lucide</strong>, ISC licensed, bundled rather than
      fetched. A name that does not exist is a 400 listing near misses, not a blank
      image.</li>
  <li><strong>Every URL is immutable.</strong> Same URL, same bytes, cached for a year.
      Change a parameter to get a different image.</li>
  <li><strong>Sizes are capped</strong> at ${MAX_DIM}px per side, and raster output at
      4 million pixels after scaling.</li>
  <li><strong>Nothing is stored and nothing is tracked.</strong> There is no database
      and no account, because a URL is the whole input.</li>
  <li><strong>CORS is open</strong> and <code>Cross-Origin-Resource-Policy</code> is set, so
      you can draw these into a <code>&lt;canvas&gt;</code> without tainting it.</li>
</ul>

<footer>
  MIT licensed, and free to use.
  ${source}
  <br>
  Reading this as a machine? Every icon name is at
  <a href="/icons.json">/icons.json</a>${
    findable
      ? `, and the whole reference at <a href="/llms.txt">/llms.txt</a>`
      : ""
  }.
</footer>

</div>

<script>
${clientScript(
  origin,
  NAMED_HEX,
  examples.map(([, path]) => path),
)}
</script>
</body>
</html>`;
}

/**
 * A Lucide icon as a standalone inline SVG, from the set the service already
 * bundles. The class is the icon's name, which is what the theme switch's CSS
 * uses to show one of its two.
 */
function lucide(name: string): string {
  return (
    `<svg class="${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
  );
}

/**
 * The GitHub mark, inline so the page stays one request and needs no icon font.
 * Official mark, used unmodified to link to a repository, which is what it is for.
 */
const GITHUB_MARK =
  `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">` +
  `<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 ` +
  `0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 ` +
  `1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 ` +
  `0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 ` +
  `2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 ` +
  `1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 ` +
  `2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`;

/**
 * Everything that exists only to be indexed or quoted.
 *
 * Off unless DISCOVERY="on". With it off, the page still has a title, a
 * description and a favicon, which is ordinary HTML rather than an attempt to
 * rank. See src/discovery.ts.
 */
function SEO(origin: string, repo: string): string {
  return `<link rel="canonical" href="${origin}/">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Placeholder">
<meta property="og:url" content="${origin}/">
<meta property="og:title" content="Placeholder Image Generator: SVG, PNG and WebP from a URL">
<meta property="og:description" content="Put the size in a URL and get an image back. Gradients, corner radius, borders, blur, aspect ratios, 2077 icons and 14 fonts. No signup, MIT licensed.">
<meta property="og:image" content="${origin}/1200x630?bg=0c6fd0,6c5ce7&amp;color=ffffff&amp;text=Placeholder%5Cimages+from+a+URL&amp;format=png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="A blue to violet gradient reading: Placeholder images from a URL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Placeholder Image Generator: SVG, PNG and WebP from a URL">
<meta name="twitter:description" content="Put the size in a URL and get an image back. Gradients, radius, borders, blur, ratios, 2077 icons, 14 fonts. No signup, MIT licensed.">
<meta name="twitter:image" content="${origin}/1200x630?bg=0c6fd0,6c5ce7&amp;color=ffffff&amp;text=Placeholder%5Cimages+from+a+URL&amp;format=png">

<link rel="alternate" type="text/plain" href="/llms.txt" title="Reference for language models">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">

${structuredData(origin, repo)}`;
}

/**
 * JSON-LD, so a search engine and an answer engine both get told what this is
 * in a form they parse rather than infer. The FAQ entries are the questions
 * people actually type, answered in the words they type them in, which is what
 * a language model quotes back when someone asks it for a placeholder service.
 */
function structuredData(origin: string, repo: string): string {
  const graph = [
    {
      "@type": "WebApplication",
      "@id": origin + "/#app",
      name: "Placeholder",
      alternateName: "Placeholder Image Generator",
      url: origin + "/",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      description:
        "Generates placeholder images from a URL. Ask for a size and get an SVG, " +
        "PNG or WebP back, with gradients, corner radius, borders, opacity, blur, " +
        "aspect ratios, 2077 icons and 14 bundled fonts.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      ...(repo ? { codeRepository: repo } : {}),
      featureList: [
        "Placeholder images sized from the URL path",
        "Aspect ratios such as 16:9 scaled from a width",
        "Linear and radial gradients with up to six colour stops",
        "Corner radius and borders",
        "Opacity and blur",
        "SVG, PNG and WebP output",
        "2077 Lucide icons",
        "14 bundled fonts",
        "No account needed, and SVG output is never rate limited",
      ],
    },
    {
      "@type": "HowTo",
      "@id": origin + "/#howto",
      name: "How to generate a placeholder image",
      description:
        "Put the size in a URL and use it as an image source. No account, no " +
        "upload, and nothing to install.",
      totalTime: "PT1M",
      tool: [{ "@type": "HowToTool", name: "A web browser or any HTML page" }],
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Ask for a size",
          text: "Put the width and height in the path: " + origin + "/600x400",
          url: origin + "/#url-grammar",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Add colours or a caption",
          text:
            "Append ?bg= for the background, ?color= for the text and ?text= for " +
            "the caption: " +
            origin +
            "/600x400?bg=0c6fd0&color=ffffff&text=Hero",
          url: origin + "/#parameters",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Use it",
          text:
            "Drop the URL straight into an img tag. Ask for ?format=png or " +
            "?format=webp when you need real pixels rather than SVG.",
          url: origin + "/#examples",
        },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": origin + "/#faq",
      mainEntity: [
        [
          "How do I get a placeholder image?",
          "Put the size in the URL. " +
            origin +
            "/600x400 returns a 600 by 400 image. " +
            "Use it straight in an img tag; there is nothing to sign up for.",
        ],
        [
          "How do I set the colours?",
          "Use ?bg= for the background and ?color= for the text, as hex or as a name: " +
            origin +
            "/600x400?bg=0c6fd0&color=ffffff. Two to six comma-separated colours in " +
            "?bg= make a gradient.",
        ],
        [
          "Can I get a PNG instead of an SVG?",
          "Yes. Add ?format=png or ?format=webp, or end the path in .png. SVG is the " +
            "default because it is smaller and stays sharp at any zoom.",
        ],
        [
          "How do I make a placeholder with a specific aspect ratio?",
          "Ask for the ratio and a width: " +
            origin +
            "/16:9?w=800 returns 800 by 450. " +
            "Use ?h= to scale from the height instead.",
        ],
        [
          "Is it free?",
          "Yes. There is no account to create and nothing to pay.",
        ],
      ].map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    `<script type="application/ld+json">` +
    // No user input reaches this today, but a lone "</script>" inside a JSON
    // string would still close the element early. See scriptJson.
    scriptJson({
      "@context": "https://schema.org",
      "@graph": graph,
    }) +
    `</script>`
  );
}

/**
 * A control that switches itself off, with the reason attached.
 *
 * The reason rides on `title` rather than sitting under the field. Six visible
 * explanations in a three-column panel is more text than control, and the two
 * that landed in narrow columns wrapped into their neighbours. A tooltip on
 * both the field and the input keeps the answer one hover away without the
 * panel paying for it every render. src/client.ts sets and clears it, so an
 * editable control never carries a stale reason.
 */
function lockable(id: string, label: string, control: string): string {
  return (
    `<div class="field" id="field-${id}">` +
    `<label for="${id}">${label}</label>` +
    control +
    `</div>`
  );
}

/** A bare `&` in an attribute is invalid HTML, however forgiving browsers are. */
function amp(s: string): string {
  return s.replace(/&/g, "&amp;");
}
