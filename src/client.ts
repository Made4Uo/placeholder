/**
 * The playground's client script, as a string.
 *
 * Kept out of playground.ts so the markup stays readable, and written by hand
 * rather than pulled from a framework so the page stays one request.
 *
 * Two pieces of state that are easy to get wrong:
 *
 *  - The controls and the URL bar are two views of the same thing, and either
 *    can be edited. build() goes controls -> URL, adopt() goes URL -> controls,
 *    and one re-entrancy guard stops them chasing each other round.
 *
 *  - The background is a LIST of colours, not a field. Rows are built here
 *    rather than in the markup because there can be one to six of them, and a
 *    gradient you cannot add a third stop to is not really a gradient control.
 */

import { DEFAULT_BG } from "./colors";

const BACKSLASH = String.fromCharCode(92);

/**
 * JSON that is safe to put inside a <script> element.
 *
 * JSON.stringify leaves "<" alone, so a "</script>" inside any string value
 * would end the element early. Every "<" becomes the six characters backslash,
 * u, 0, 0, 3, c, which JavaScript and JSON both read back as "<".
 *
 * The backslash is built rather than typed as an escape. Typed, the escape is
 * easy to get wrong in a way that still compiles: the previous guard on the
 * page's structured data decoded to a bare "<" and replaced "<" with itself.
 */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, BACKSLASH + "u003c");
}

export function clientScript(
  origin: string,
  namedColours: Record<string, string>,
  examples: string[],
): string {
  return `
const ORIGIN = ${scriptJson(origin)};
const NAMED = ${scriptJson(namedColours)};
const DEFAULT_BG = ${scriptJson(DEFAULT_BG.hex.slice(1))};
const EXAMPLES = ${scriptJson(examples)};
const MAX_STOPS = 6;

const $ = (id) => document.getElementById(id);
const IDS = ['size','ratioW','type','icon','iconsize','text','fg','gradient','radius',
             'borderW','borderC','opacity','blur','fs','fw','font','format','scale','quality'];

/**
 * The controls behind the Advanced fold, and how to tell whether each is doing
 * anything. Used for the count on the summary and for deciding whether a
 * pasted URL should spring the fold open, so nothing it changed stays hidden.
 */
const ADVANCED = ['radius','borderW','borderC','opacity','blur','iconsize','fs','fw','font','scale','quality'];

/**
 * Controls that switch themselves off, and when.
 *
 * Each entry owns one control's disabled state, its padlock and the line that
 * says what would turn it back on. Keeping the three together is the point: a
 * greyed-out box whose reason lives somewhere else is how a UI ends up with a
 * lock nobody can explain.
 */
/**
 * Controls that only exist once something makes them mean anything.
 *
 * Each says when it APPLIES. A control that does not is hidden outright rather
 * than greyed out: a disabled box is a question the panel refuses to answer,
 * and six of them turned the advanced section into a field of dead ends. Set a
 * border width and the colour appears; name an icon and its size appears. The
 * control shows up at the moment it starts to matter, which is also the moment
 * you are looking for it.
 *
 * Every parameter is still listed in the reference below the panel, so nothing
 * becomes undiscoverable by being hidden here.
 */
const APPLIES = {
  ratioW: () => isRatio($('size').value),
  gradient: () => filled().length > 1,
  iconsize: () => Boolean($('icon').value.trim() || $('type').value),
  borderC: () => Number($('borderW').value) > 0,
  scale: () => $('format').value !== 'svg',
  quality: () => $('format').value === 'webp',
};

function updateAvailability() {
  for (const id of Object.keys(APPLIES)) {
    const applies = APPLIES[id]();
    // Still disabled as well as hidden, because build() reads values straight
    // off the controls and a hidden one must not smuggle a stale value into
    // the URL.
    $(id).disabled = !applies;
    // The wrapper where there is one, so the label goes with the box.
    ($('field-' + id) || $(id)).hidden = !applies;
  }

  // With the ratio width gone the size field takes the whole row, rather than
  // sitting in a narrow column beside a gap.
  $('sizerow').className = APPLIES.ratioW() ? 'row sizerow' : 'row sizerow solo';
}

/** Set while one side is writing the other, so the write does not echo back. */
let syncing = false;

/** The background colours, in order. One entry is a flat fill, two or more a gradient. */
let stops = [''];

/**
 * Colours offered when you add a stop. Picked so the first thing you see after
 * clicking Add is an actual gradient: a blank stop would look like the button
 * had done nothing.
 */
const SUGGESTIONS = ['6c5ce7', '0ea5e9', '10b981', 'f59e0b', 'f43f5e'];

/** Direction keyword to CSS degrees, for the preview strip. */
const DEGREES = {
  '': 180,
  'to-top': 0,
  'to-top-right': 45,
  'to-right': 90,
  'to-bottom-right': 135,
  'to-bottom': 180,
  'to-bottom-left': 225,
  'to-left': 270,
  'to-top-left': 315,
};

// ------------------------------------------------------------ the stop list

function filled() {
  return stops.map((s) => s.trim()).filter(Boolean);
}

function renderStops() {
  const rows = stops.map((value, i) => stopRow(value, i));
  $('bgStops').replaceChildren(...rows);
  $('addStop').disabled = stops.length >= MAX_STOPS;
}

function stopRow(value, i) {
  const row = document.createElement('div');
  row.className = stops.length > 1 ? 'stop' : 'stop solo';

  const pick = document.createElement('input');
  pick.type = 'color';
  pick.id = 'bgPick' + i;
  pick.setAttribute('aria-label', 'Colour ' + (i + 1) + ' picker');
  pick.value = asHex(value) || (i === 0 ? '#' + DEFAULT_BG : '#6c5ce7');

  const text = document.createElement('input');
  text.id = 'bgStop' + i;
  text.value = value;
  text.placeholder = i === 0 ? DEFAULT_BG : 'hex, name, or transparent';
  text.setAttribute('aria-label', 'Colour ' + (i + 1));

  // The text field stays the source of truth: it can hold 'transparent' or a
  // name, and a colour picker cannot.
  pick.addEventListener('input', () => {
    stops[i] = pick.value.slice(1);
    text.value = stops[i];
    sync();
  });
  text.addEventListener('input', () => {
    stops[i] = text.value.trim();
    const hex = asHex(stops[i]);
    if (hex) pick.value = hex;
    sync();
  });

  row.append(pick, text);

  if (stops.length > 1) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.id = 'bgDrop' + i;
    remove.textContent = '\\u00d7';
    remove.title = 'Remove this colour';
    remove.setAttribute('aria-label', 'Remove colour ' + (i + 1));
    remove.addEventListener('click', () => {
      stops.splice(i, 1);
      renderStops();
      sync();
    });
    row.append(remove);
  }

  return row;
}

$('addStop').addEventListener('click', () => {
  if (stops.length >= MAX_STOPS) return;
  // An empty first stop means "the default", which is fine on its own but
  // cannot be one end of a gradient: leaving it blank would send a single
  // colour and quietly produce a flat fill. Spell it out instead.
  if (!stops[0].trim()) stops[0] = DEFAULT_BG;
  const taken = new Set(filled());
  stops.push(SUGGESTIONS.find((c) => !taken.has(c)) || SUGGESTIONS[0]);
  renderStops();
  sync();
});

// ---------------------------------------------------------------- preview strip

/**
 * The gradient, drawn in CSS so you can see it without waiting on a request.
 *
 * It has to agree with the server, which is why NAMED is shipped down: our
 * names are on the Tailwind scale, so handing 'blue' straight to CSS would
 * paint a different colour here than the image comes back with. The
 * transparent-stop rule is mirrored for the same reason.
 */
function updatePreview() {
  const list = filled();
  const box = $('gradPreview');

  if (list.length < 2) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  const colours = list.map((c, i) => cssColour(c, list, i)).join(', ');
  const direction = $('gradient').value;
  const gradient =
    direction === 'radial'
      ? 'radial-gradient(ellipse at center, ' + colours + ')'
      : 'linear-gradient(' + (DEGREES[direction] ?? (Number(direction) || 0)) + 'deg, ' + colours + ')';

  // Layered over the checkerboard the stylesheet supplies, so a transparent
  // stop reads as transparent rather than as whatever is behind the panel.
  box.style.backgroundImage =
    gradient + ', repeating-conic-gradient(var(--line) 0% 25%, transparent 0% 50%)';
}

/** A stop as CSS, with a transparent one taking its neighbour's colour. */
function cssColour(value, list, i) {
  const v = value.toLowerCase();
  if (v === 'transparent' || v === 'none') {
    const near = list
      .map((c, j) => [j, c.toLowerCase()])
      .filter(([, c]) => c !== 'transparent' && c !== 'none')
      .sort((a, b) => Math.abs(a[0] - i) - Math.abs(b[0] - i))[0];
    return near ? (asHex(near[1]) || '#000000') + '00' : 'transparent';
  }
  return asHex(v) || v;
}

/** '#rrggbb' for anything a colour picker can show, else null. */
function asHex(value) {
  const v = String(value).trim().toLowerCase().replace(/^#/, '');
  const named = NAMED[v];
  const body = (named || v).replace(/^#/, '');
  if (/^[0-9a-f]{6}$/.test(body) || /^[0-9a-f]{8}$/.test(body)) return '#' + body.slice(0, 6);
  if (/^[0-9a-f]{3,4}$/.test(body)) return '#' + body.slice(0, 3).split('').map((c) => c + c).join('');
  return null;
}

// ---------------------------------------------------------------- controls -> URL

function build() {
  const size = ($('size').value || '600x400').trim();
  const q = new URLSearchParams();
  const put = (k, v) => { if (v !== '' && v != null) q.set(k, v); };
  // A control that does not currently apply contributes nothing, whatever it
  // still has typed in it. One rule instead of a guard at each call site.
  const val = (id) => ($(id).disabled ? '' : String($(id).value).trim());

  put('w', val('ratioW'));
  put('bg', filled().join(','));
  put('gradient', val('gradient'));

  put('color', $('fg').value.trim());
  put('text', $('text').value);
  put('type', $('type').value);
  put('icon', $('icon').value.trim());
  put('iconsize', val('iconsize'));
  put('radius', $('radius').value.trim());
  put('opacity', $('opacity').value);
  put('blur', $('blur').value);
  put('fs', $('fs').value);

  const bw = $('borderW').value;
  const bc = val('borderC');
  if (bw && Number(bw) > 0) put('border', bc ? bw + ',' + bc : bw);

  put('fw', $('fw').value);
  put('q', val('quality'));
  if ($('font').value !== 'sans') put('font', $('font').value);
  if ($('format').value !== 'svg') put('format', $('format').value);
  if (val('scale') !== '1') put('scale', val('scale'));

  const qs = q.toString();
  return ORIGIN + '/' + encodeURIComponent(size) + (qs ? '?' + qs : '');
}

function sync() {
  if (syncing) return;

  // FIRST, because build() decides what to send by reading the disabled flag
  // off each control, and this is what sets it. Building before this ran would
  // use last render's answer and put a stale parameter in the URL.
  updateAvailability();

  const url = build();
  syncing = true;
  $('url').value = url;
  $('url').classList.remove('bad');
  syncing = false;

  $('preview').src = url;
  updatePreview();
  updateAdvanced();
}

/**
 * How many advanced controls are actually set, shown on the closed fold.
 *
 * Without it, a collapsed section is a place for settings to go and be
 * forgotten: the image looks wrong and nothing on screen says why.
 */
function activeAdvanced() {
  return ADVANCED.filter((id) => {
    const el = $(id);
    if (el.disabled) return false;
    const v = String(el.value).trim();
    if (!v) return false;
    // A select sitting on its first option is at its default, not set.
    return !(el.tagName === 'SELECT' && v === el.options[0].value);
  });
}

function updateAdvanced() {
  const count = activeAdvanced().length;
  const badge = $('advCount');
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

// ---------------------------------------------------------------- URL -> controls

/**
 * Read a URL back into the controls.
 *
 * Anything the URL does not mention is reset to its default, so pasting a
 * short URL clears whatever the form was carrying rather than silently mixing
 * the two. The host is ignored: a URL copied from a deployed instance should
 * work here.
 */
function adopt(raw) {
  let url;
  try {
    url = new URL(raw.trim(), ORIGIN);
  } catch {
    return false;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return false;

  const q = url.searchParams;
  const get = (...keys) => {
    for (const k of keys) if (q.has(k)) return q.get(k);
    return '';
  };

  let size = decodeURIComponent(segments[0]);
  let format = get('format', 'f');
  const dot = size.lastIndexOf('.');
  if (dot > 0 && ['svg', 'png', 'webp'].includes(size.slice(dot + 1).toLowerCase())) {
    if (!format) format = size.slice(dot + 1).toLowerCase();
    size = size.slice(0, dot);
  }

  const colours = get('bg', 'background').split(',').map((c) => c.trim()).filter(Boolean);
  stops = colours.length ? colours.slice(0, MAX_STOPS) : [''];
  renderStops();

  const border = get('border', 'b').split(',').map((c) => c.trim()).filter(Boolean);
  const numeric = border.length > 0 && /^[0-9.]+$/.test(border[0]);

  set('size', size);
  set('ratioW', get('w', 'width'));
  set('type', get('type'));
  set('icon', get('icon'));
  set('iconsize', get('iconsize', 'is'));
  set('text', q.has('text') ? q.get('text') : (q.has('t') ? q.get('t') : ''));
  set('gradient', get('gradient'));
  set('fg', get('color', 'colour', 'fg'));
  set('radius', get('radius', 'r'));
  set('borderW', numeric ? border[0] : (border.length ? '1' : ''));
  set('borderC', numeric ? (border[1] || '') : (border[0] || ''));
  set('opacity', get('opacity', 'o'));
  set('blur', get('blur'));
  set('fs', get('fs', 'fontsize'));
  set('fw', get('fw', 'weight'));
  set('quality', get('q', 'quality'));
  set('font', get('font') || 'sans');
  set('format', format || 'svg');
  set('scale', get('scale', 'dpr') || '1');

  syncPicker();
  updatePreview();

  // sync() is suppressed while the URL bar is being typed into, so both of
  // these are refreshed here rather than left a keystroke behind. Availability
  // first: the count skips disabled controls and this is what disables them.
  updateAvailability();
  updateAdvanced();

  // A URL that touches an advanced setting opens the fold, so the thing it
  // changed is never hidden behind a collapsed section the reader did not open.
  if (activeAdvanced().length) $('advanced').open = true;

  return true;
}

/** A <select> given a value it has no option for falls back to its first. */
function set(id, value) {
  const el = $(id);
  if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === value)) {
    el.value = el.options[0].value;
    return;
  }
  el.value = value;
}

// ------------------------------------------------------------------- wiring

function isRatio(size) {
  return /[:_]/.test(size);
}

IDS.forEach((id) => {
  const el = $(id);
  el.addEventListener('input', sync);
  el.addEventListener('change', sync);
});

$('url').addEventListener('input', () => {
  if (syncing) return;
  syncing = true;
  const ok = adopt($('url').value);
  syncing = false;
  $('url').classList.toggle('bad', !ok);
  // A URL that parsed is worth previewing before the controls catch up, so a
  // half-typed one does not blank the stage.
  if (ok) $('preview').src = $('url').value.trim();
});

// Leaving the field, or pressing Enter, normalises whatever was typed back
// into the canonical form the controls produce.
$('url').addEventListener('change', sync);
$('url').addEventListener('keydown', (e) => { if (e.key === 'Enter') sync(); });

function syncPicker() {
  const v = $('fg').value.trim().replace(/^#/, '');
  const hex = asHex(v);
  if (hex) $('fgPick').value = hex;
}

$('fgPick').addEventListener('input', () => { $('fg').value = $('fgPick').value.slice(1); sync(); });
$('fg').addEventListener('input', syncPicker);

/**
 * Copy, and say so.
 *
 * navigator.clipboard needs a secure context and a real user gesture, and
 * refuses outside both, so every caller has to handle failing. Returns whether
 * it worked rather than throwing, because what to do about it differs: the URL
 * bar can select its own text as a fallback, a gallery tile cannot.
 */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

$('copy').addEventListener('click', async () => {
  const btn = $('copy');
  if (await copyText($('url').value)) {
    btn.textContent = 'Copied';
  } else {
    $('url').select();
    btn.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
});

/**
 * The Copy button on each example.
 *
 * View beside it is a plain link and needs nothing from here. Copy needs the
 * clipboard, so it ships hidden and is revealed here: with no script the tile
 * still has View, and the browser's own "copy link address" on it.
 *
 * The absolute URL goes to the clipboard even though the tile shows the path,
 * since what you paste into an HTML file has to include the origin.
 */
EXAMPLES.forEach((path, i) => {
  const btn = $('exCopy' + i);
  if (!btn) return;
  btn.hidden = false;

  btn.addEventListener('click', async () => {
    const url = ORIGIN + path;
    const flag = $('copied' + i);

    if (await copyText(url)) {
      flag.hidden = false;
      clearTimeout(flag.timer);
      flag.timer = setTimeout(() => { flag.hidden = true; }, 1400);
      $('copyLive').textContent = 'Copied ' + url;
    } else {
      // Nowhere to select on a tile, so the URL bar becomes the fallback: it
      // holds the text and selects it, ready for a manual copy.
      $('copyLive').textContent = 'Copy failed. The URL is in the box above.';
      $('url').value = url;
      $('url').select();
    }
  });
});

$('open').addEventListener('click', () => window.open($('url').value, '_blank', 'noopener'));

// The icon index is 2000-odd names, which is too many to put in the DOM at
// once, so the datalist is refilled with the best few dozen matches as you
// type. Failing to load it leaves the field as free text, which still works.
let iconNames = [];
fetch('/icons.json')
  .then((r) => r.json())
  .then((d) => {
    iconNames = d.icons;
    $('iconCount').textContent = '(' + d.count + ' available)';
    fillIcons('');
  })
  .catch(() => {});

function fillIcons(q) {
  q = q.toLowerCase();
  const starts = [], contains = [];
  for (const name of iconNames) {
    if (!q || name.startsWith(q)) starts.push(name);
    else if (name.includes(q)) contains.push(name);
    if (starts.length >= 40) break;
  }
  $('iconlist').replaceChildren(...starts.concat(contains).slice(0, 40).map((n) => {
    const o = document.createElement('option');
    o.value = n;
    return o;
  }));
}

$('icon').addEventListener('input', () => fillIcons($('icon').value.trim()));

// A URL in the address bar wins over the defaults, so a link into the
// playground can arrive prefilled.
const seed = new URLSearchParams(location.search).get('u');
renderStops();
if (seed) adopt(seed);
sync();
`;
}
