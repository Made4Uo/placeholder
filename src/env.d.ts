/// <reference types="@cloudflare/workers-types" />
/// <reference path="../node_modules/@jsquash/webp/emscripten-types.d.ts" />

/**
 * Wrangler turns a `.wasm` import into a compiled WebAssembly.Module. This is
 * the only way to get WebAssembly into a Worker: compiling from bytes at
 * runtime is blocked by the platform.
 */
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

/**
 * Font files come in as Data modules, which need the matching `rules` entry in
 * wrangler.jsonc to be picked up at all.
 */
declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}

/** The site icon comes in as a Text module, by the same `rules` mechanism. */
declare module "*.svg" {
  const text: string;
  export default text;
}
