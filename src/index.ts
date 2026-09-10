/**
 * The Worker.
 *
 * Every URL is a pure function of its own text: same URL, same bytes, forever.
 * That is what lets the whole thing be cached immutably at the edge and in the
 * browser, and it is why there is no storage, no database and no state here.
 */

import { BadRequest, parse, type Format } from "./params";
import { ICON_NAMES } from "./templates";
import { renderSvg } from "./svg";
import { playground } from "./playground";
import { discoveryEnabled, llmsTxt, robots, sitemap } from "./discovery";
// The site icon, bundled as text by the rule in wrangler.jsonc. Served from its
// own route rather than inlined into the page, because at nearly 200KB it would
// otherwise ride along with every page view.
import FAVICON from "../assets/favicon.svg";

interface Env {
  /** Repository to link from the playground footer. See wrangler.jsonc. */
  REPO_URL?: string;
  /** "on" to serve llms.txt, a sitemap and structured data. Off by default. See src/discovery.ts. */
  DISCOVERY?: string;
  /**
   * A per-address brake on PNG and WebP rendering. Optional: with no binding
   * (in a test, say) raster output is unthrottled. See wrangler.jsonc.
   */
  RASTER_LIMIT?: RateLimit;
}

const IMMUTABLE = "public, max-age=31536000, immutable";

/** Every spelling of the machine-readable reference that anyone actually tries. */
const LLMS_PATHS = new Set(["/llms.txt", "/llm.txt", "/llms-full.txt", "/.well-known/llms.txt"]);

/**
 * An SVG served from your own origin is a script execution context in every
 * browser that will render it as a document. We generate every byte and escape
 * the one free-form field, so this is belt and braces, but it costs nothing.
 */
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const CONTENT_TYPES: Record<Format, string> = {
  svg: "image/svg+xml; charset=utf-8",
  png: "image/png",
  webp: "image/webp",
};

/**
 * The playground page's headers.
 *
 * Not a full script policy: the page runs two inline scripts and an inline
 * stylesheet, and hashing those on every build is more machinery than a page
 * with no user input needs. What is here costs nothing and breaks nothing.
 * frame-ancestors is deliberately absent, so the page can still be embedded.
 */
const PAGE_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "base-uri 'none'; object-src 'none'",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return text("Only GET, HEAD and OPTIONS are supported.", 405, { Allow: "GET, HEAD, OPTIONS" });
    }

    const url = new URL(request.url);
    const findable = discoveryEnabled(env.DISCOVERY);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(playground(url.origin, env.REPO_URL, findable), { headers: PAGE_HEADERS });
    }

    // The icon index, for the playground's autocomplete and for anyone
    // building a picker of their own. Immutable, since the set only changes
    // when the Worker is redeployed.
    if (url.pathname === "/icons.json") {
      return new Response(JSON.stringify({ count: ICON_NAMES.length, icons: ICON_NAMES }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": IMMUTABLE,
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // The files that make the service findable. See src/discovery.ts for why
    // everything except robots.txt is off unless a deployment asks for it.
    if (url.pathname === "/robots.txt") {
      return text(robots(url.origin, findable), 200, { "Cache-Control": "public, max-age=86400" });
    }

    // Checked whether or not discovery is on, so a switched-off path answers
    // 404 rather than falling through to the image parser and complaining that
    // "sitemap.xml" is not a valid size.
    if (url.pathname === "/sitemap.xml") {
      if (!findable) return notPublished(url.pathname);
      return new Response(sitemap(url.origin), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // /llms.txt is the convention (llmstxt.org). The other two are the names
    // people and crawlers guess at, and a 404 on a guess helps nobody when the
    // answer is one line of routing.
    if (LLMS_PATHS.has(url.pathname)) {
      if (!findable) return notPublished(url.pathname);
      return text(llmsTxt(url.origin, env.REPO_URL ?? ""), 200, {
        "Cache-Control": "public, max-age=3600",
      });
    }

    // The site icon. Cached for a week rather than marked immutable like the
    // images: this URL never changes, so a year-long cache would keep a
    // replaced icon in browsers for a year. The CSP matches the images' except
    // that it lets the SVG draw its own embedded data: images.
    if (url.pathname === "/favicon.svg") {
      return new Response(request.method === "HEAD" ? null : FAVICON, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=604800",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy":
            "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        },
      });
    }

    // A .ico request has nowhere useful to go: the site icon is /favicon.svg,
    // and 204 stops browsers from retrying on every page view.
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });

    try {
      const spec = parse(url);
      const contentType = CONTENT_TYPES[spec.format];
      const etag = `"${hash(url.pathname + url.search)}"`;

      // Before any rendering: the ETag is a hash of the URL, so a browser
      // revalidating an image it already holds costs nothing at all.
      if (request.headers.get("If-None-Match") === etag) {
        return new Response(null, { status: 304, headers: imageHeaders(contentType, etag) });
      }

      // The edge cache. Workers run in front of Cloudflare's cache, so the
      // immutable Cache-Control below helps browsers but never stops a repeat
      // request from rendering again here; only the Cache API does. Keyed on a
      // bare GET of the URL, so HEAD shares the entry and no request header can
      // split it. The cache is per data centre, and Cloudflare documents it for
      // custom domains, so on workers.dev expect every request to render.
      const key = new Request(url.toString(), { method: "GET" });
      const cache = caches.default;
      const hit = await cache.match(key);
      if (hit) return request.method === "HEAD" ? new Response(null, hit) : hit;

      // Only a miss that needs pixels spends the limit: SVG is a string
      // template, and a cached PNG costs nothing to serve again.
      if (spec.format !== "svg" && env.RASTER_LIMIT) {
        const { success } = await env.RASTER_LIMIT.limit({
          key: request.headers.get("CF-Connecting-IP") ?? "unknown",
        });
        if (!success) {
          return text(
            "Too many PNG and WebP renders from this address. Wait a minute and try again, " +
              "or ask for SVG (the default), which is not limited.",
            429,
            { "Retry-After": "60" },
          );
        }
      }

      const svg = renderSvg(spec);
      let body: BodyInit = svg;
      if (spec.format !== "svg") {
        // Imported lazily: the two wasm modules behind this are the bulk of the
        // bundle, and an SVG request should never touch them.
        const { rasterise } = await import("./raster");
        body = (await rasterise(svg, spec.format, spec.scale, spec.quality)).body;
      }

      const response = new Response(body, { headers: imageHeaders(contentType, etag) });
      // A failed write only costs the next request a render, so it is not
      // allowed to fail this one.
      ctx.waitUntil(cache.put(key, response.clone()).catch(() => {}));
      return request.method === "HEAD" ? new Response(null, response) : response;
    } catch (err) {
      if (err instanceof BadRequest) return text(err.message, 400);

      console.error("render failed", url.pathname + url.search, err);
      return text("Could not render that image. If the URL looks right, please open an issue.", 500);
    }
  },
} satisfies ExportedHandler<Env>;

function imageHeaders(contentType: string, etag: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Cache-Control": IMMUTABLE,
    ETag: etag,
    // Both of these are what make the output usable from a <canvas> without
    // tainting it, which is half the reason anyone reaches for a raster format.
    "Access-Control-Allow-Origin": "*",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": SVG_CSP,
  };
}

/**
 * A real route that this deployment has chosen not to serve.
 *
 * Says which knob turns it on, because the person most likely to hit this is
 * running their own copy and wondering where the file went.
 */
function notPublished(path: string): Response {
  return text(
    `${path} is not published by this instance. It is served when DISCOVERY is set to "on".`,
    404,
  );
}

/**
 * Plain text, for errors and the small reference files. Error messages quote
 * the request back, so nosniff keeps a browser from ever reading one as HTML.
 */
function text(body: string, status: number, extra: Record<string, string> = {}): Response {
  return new Response(body + "\n", {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
