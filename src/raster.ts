/**
 * SVG -> PNG / WebP, entirely inside the Worker.
 *
 * Two WebAssembly modules do the work: resvg renders the SVG to RGBA pixels,
 * and libwebp encodes those pixels when WebP is asked for. Both are
 * instantiated from statically imported .wasm modules, which is the only form
 * Workers allows (compiling from bytes at runtime is blocked), and both are
 * initialised lazily so an SVG-only request never pays for them.
 *
 * The renderer has no system fonts, so raster text can only be drawn in what
 * ships inside the bundle. Fourteen families do, subset to Latin by
 * scripts/build-fonts.mjs, and every one of them is a `?font=` value: those
 * render the same in PNG and WebP as they do in SVG. Any OTHER `?font=` value
 * still works in SVG, where the viewer's own machine resolves it, and falls
 * back to a generic here because there is nothing else to fall back to.
 */

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import webpEncoderFactory from "@jsquash/webp/codec/enc/webp_enc_simd.js";
import webpWasm from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";
import { initEmscriptenModule } from "@jsquash/webp/utils.js";
import { FONT_BUFFERS, GENERIC_DEFAULTS } from "./fonts.generated";

interface WebPModule {
  encode(data: BufferSource, width: number, height: number, options: Record<string, number>): Uint8Array | null;
}

let resvgReady: Promise<void> | null = null;
let webpReady: Promise<WebPModule> | null = null;

function ensureResvg(): Promise<void> {
  // Assigned before the await so two concurrent requests share one init.
  if (!resvgReady) resvgReady = initWasm(resvgWasm);
  return resvgReady;
}

function ensureWebp(): Promise<WebPModule> {
  if (!webpReady) {
    webpReady = initEmscriptenModule(webpEncoderFactory as never, webpWasm) as unknown as Promise<WebPModule>;
  }
  return webpReady;
}

export interface Raster {
  body: Uint8Array;
  contentType: string;
}

export async function rasterise(
  svg: string,
  format: "png" | "webp",
  scale: number,
  quality: number,
): Promise<Raster> {
  await ensureResvg();

  const resvg = new Resvg(svg, {
    fitTo: scale === 1 ? { mode: "original" } : { mode: "zoom", value: scale },
    font: {
      fontBuffers: FONT_BUFFERS.map((b) => new Uint8Array(b)),
      // Only reached when a stack falls all the way through to its generic,
      // which is the case for a ?font= naming something nobody bundled.
      defaultFontFamily: GENERIC_DEFAULTS.sans,
      sansSerifFamily: GENERIC_DEFAULTS.sans,
      serifFamily: GENERIC_DEFAULTS.serif,
      monospaceFamily: GENERIC_DEFAULTS.mono,
      cursiveFamily: GENERIC_DEFAULTS.serif,
      fantasyFamily: GENERIC_DEFAULTS.sans,
    },
  });

  const rendered = resvg.render();

  try {
    if (format === "png") {
      return { body: rendered.asPng(), contentType: "image/png" };
    }

    const module = await ensureWebp();
    // Copied out of wasm memory: `pixels` is a view into the resvg heap, and
    // freeing the render below would leave the encoder reading a dead buffer.
    const pixels = new Uint8Array(rendered.pixels);
    const encoded = module.encode(pixels, rendered.width, rendered.height, {
      ...WEBP_DEFAULTS,
      quality,
    });
    if (!encoded) throw new Error("WebP encoding failed");
    return { body: new Uint8Array(encoded), contentType: "image/webp" };
  } finally {
    rendered.free();
    resvg.free();
  }
}

/**
 * libwebp's config struct has no defaults of its own, so every field has to be
 * supplied. These are Squoosh's defaults; only `quality` is exposed, because
 * the rest are knobs nobody tuning a placeholder image needs.
 */
const WEBP_DEFAULTS: Record<string, number> = {
  quality: 82,
  target_size: 0,
  target_PSNR: 0,
  method: 4,
  sns_strength: 50,
  filter_strength: 60,
  filter_sharpness: 0,
  filter_type: 1,
  partitions: 0,
  segments: 4,
  pass: 1,
  show_compressed: 0,
  preprocessing: 0,
  autofilter: 0,
  partition_limit: 0,
  alpha_compression: 1,
  alpha_filtering: 1,
  alpha_quality: 100,
  lossless: 0,
  exact: 0,
  image_hint: 0,
  emulate_jpeg_size: 0,
  thread_level: 0,
  low_memory: 0,
  near_lossless: 100,
  use_delta_palette: 0,
  use_sharp_yuv: 0,
};
