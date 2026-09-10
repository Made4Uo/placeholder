# placeholder

Placeholder images generated from the URL. No storage, no account, no build step
in the page that uses it.

```html
<img src="https://your-domain/600x400" alt="">
<img src="https://your-domain/16:9?w=800&bg=0c6fd0&color=ffffff&text=Hero+image" alt="">
<img src="https://your-domain/160?type=avatar&bg=6c5ce7" alt="">
<img src="https://your-domain/400x400?icon=shopping-cart&bg=0c6fd0" alt="">
<img src="https://your-domain/600x400?bg=0c6fd0,6c5ce7&gradient=to-right" alt="">
```

Output is SVG by default, which is a few hundred bytes, stays sharp at any zoom
and costs the server no pixel work. PNG and WebP are one parameter away when you
need real pixels.

## Why this exists rather than placehold.co

The basics are the same, and the basics were never the problem. What is missing
from the usual services is everything you need for the image to sit inside a
real design rather than next to one:

| | |
|---|---|
| **Corner radius and borders** | `?radius=12&border=2,cbd5e1`. A placeholder that matches the radius token of the component around it stops looking like a placeholder. |
| **Aspect ratios** | `/16:9?w=800`. No arithmetic, and changing the width keeps the ratio. |
| **Every Lucide icon** | `?icon=shopping-cart`. All 2077 of them, bundled rather than fetched. An icon says what a slot is for, which "600x400" cannot do when a wireframe has a dozen boxes on it. |
| **Presets** | `?type=avatar`, `?type=video`. An icon plus behaviour a bare name cannot carry: an avatar rounds itself. |
| **Gradients** | `?bg=0c6fd0,6c5ce7`. Up to six stops, any angle, or radial. A `transparent` stop fades out properly instead of through grey. |
| **14 real fonts** | `?font=poppins`. Bundled and subset, so `?font=` means the same thing in PNG and WebP as it does in SVG. |
| **Opacity and blur** | `?opacity=35`, `?blur=6`. For testing an overlay, or standing in for a loading state. |
| **Format switching** | `?format=png`, `?format=webp`, or a `.png` on the end of the path. |

## The URL

| Form | Gives you |
|---|---|
| `/600x400` | An explicit size. |
| `/600` | A square. |
| `/16:9?w=800` | A ratio scaled to a width. `?h=` scales from the height instead. With neither, the width is 1200. |
| `/600x400.png` | Format as a file extension, for tools that insist on one. |
| `/icons.json` | Every icon name, for building a picker of your own. |

The path holds the size and nothing else. Colours are `?bg=` and `?color=`,
because other services put them in the path and the result is that
`/600x400/0c6fd0/ffffff` makes you stop and work out which half is which every
single time. A name on every value costs eight characters and removes the
question.

Both have defaults, so neither is required: the background is slate 200, and
the text colour is derived from whatever background you set.

## Parameters

| Parameter | Values | Default |
|---|---|---|
| `text`, `t` | Any text. `\n` starts a new line, up to 8. `text=` on its own leaves it blank. | the size |
| `bg`, `background` | Hex with or without the `#`, a name, or `transparent`. Two to six comma-separated colours make a gradient. | `e2e8f0` |
| `gradient` | Degrees (`90`), a keyword (`to-right`, `to-bottom-left`), or `radial`. Needs two or more colours in `bg`. | `to-bottom` |
| `color`, `fg` | Same, for the text and iconography. Left out, it picks whichever of four inks clears WCAG AA against your background. | auto |
| `icon` | Any [Lucide](https://lucide.dev/icons) name, `shopping-cart` and so on. The full list is at `/icons.json`. | none |
| `iconsize`, `is` | Pixels, or a percentage of the shorter side (`40%`). Capped at the shorter side. | 30% of the shorter side |
| `type` | `image`, `avatar`, `card`, `product`, `video`, `text`. Each is an icon plus a preset; `avatar` also rounds itself. | none |
| `radius`, `r` | Pixels, `50%` of the shorter side, or `full`. | `0`, or `full` for `type=avatar` |
| `border`, `b` | `2`, `2,cbd5e1`, or a bare colour for a 1px rule. | none |
| `opacity`, `o` | 0 to 100, as a percentage of the whole image. | `100` |
| `blur` | 0 to 100. Gaussian, applied to the content and not to the plate behind it. | `0` |
| `font` | `sans`, `serif`, `mono`, or a bundled family by name (see below). Any other family works in SVG if the viewer has it. | `sans` |
| `fs`, `fontsize` | Pixels. | fitted to the box |
| `fw`, `weight` | 100 to 900. | `600` |
| `format`, `f` | `svg`, `png`, `webp`. | `svg` |
| `scale`, `dpr` | 1 to 4. Raster only. | `1` |
| `q`, `quality` | 1 to 100. WebP only. | `82` |

Anything unparseable is a 400 with a sentence saying what was wrong, not a
silently wrong image. An icon name that does not exist gets its near misses
listed, because `cart` not being the name of the cart icon is the single most
likely way to get this wrong.

Both `?icon=` and `?type=` can appear together: the icon name wins for the
glyph, and the preset keeps everything else, so `?type=avatar&icon=cat` is a
round cat.

### Gradients

```
?bg=0c6fd0,6c5ce7                        top to bottom, the CSS default
?bg=0c6fd0,6c5ce7&gradient=to-right      or to-top, to-bottom-left, and so on
?bg=0c6fd0,6c5ce7&gradient=45            or any angle in degrees
?bg=6c5ce7,0f172a&gradient=radial        from the centre out
?bg=f43f5e,f59e0b,10b981                 up to six stops, spread evenly
?bg=0c6fd0,transparent                   a clean fade to nothing
```

The direction lives in `?gradient=` rather than at the front of `?bg=` because a
bare number is ambiguous with hex: `180` is both half a turn and a valid
three-digit colour, and there is no reading of `bg=180,0c6fd0` that is right more
than half the time.

A `transparent` stop takes the colour of its nearest visible neighbour, so
`0c6fd0,transparent` fades blue to nothing rather than to transparent black.
SVG interpolates stop colour and stop opacity independently, and the naive
reading puts a grey bruise through the middle of every fade.

### Fonts

Fourteen families are bundled, so `?font=` renders the same in PNG and WebP as
it does in SVG:

| `?font=` | Family | | `?font=` | Family |
|---|---|---|---|---|
| `inter` | Inter (the `sans` default) | | `roboto` | Roboto |
| `lato` | Lato | | `source-sans` | Source Sans 3 |
| `montserrat` | Montserrat | | `lora` | Lora (the `serif` default) |
| `noto-sans` | Noto Sans | | `playfair` | Playfair Display |
| `open-sans` | Open Sans | | `jetbrains-mono` | JetBrains Mono (the `mono` default) |
| `oswald` | Oswald | | | |
| `poppins` | Poppins | | | |
| `pt-sans` | PT Sans | | | |
| `raleway` | Raleway | | | |

Each answers to its key or to its own name, so `?font=noto-sans` and
`?font=Noto%20Sans` are the same request. Any other family name still works in
SVG, where the viewer's own machine resolves it, and falls back to a generic in
raster output.

### Colour names

Hex is always accepted. The names below are on the **Tailwind 500 scale**, not
the CSS one, because CSS `red` is `#ff0000` and nobody wants that behind a
caption:

```
transparent white black slate gray grey zinc stone red orange amber yellow
lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose
navy brown silver light dark
```

Eight-digit hex works too, so `bg=0c6fd080` is the blue at 50% alpha.

## Limits

- 5000px per side.
- 4 million pixels for PNG and WebP, after `scale` is applied. SVG has no such
  cap, because there are no pixels to render.
- 300 characters of caption, across at most 8 lines.
- 60 PNG or WebP renders a minute per address, counted per Cloudflare data
  centre. Past that, the answer is a 429 with `Retry-After: 60`. SVG is never
  limited, and an image already in the edge cache does not count.

## Licence

MIT. See [LICENSE](LICENSE).

This repository ships the actual font files and the actual icon geometry, so
the third-party obligations attach to it. They are met by [NOTICE](NOTICE) and
[`assets/fonts/OFL.txt`](assets/fonts/OFL.txt).

Third-party components keep their own licences, listed in [NOTICE](NOTICE):
Lucide under ISC, thirteen of the fourteen fonts under OFL-1.1 and Roboto under
Apache-2.0, resvg under MPL-2.0, and the libwebp bindings under Apache-2.0.
