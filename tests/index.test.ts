/**
 * The Worker's request handling: the edge cache, the raster rate limit, and
 * the headers on what it returns.
 *
 * Runs in Node rather than the Workers runtime, with the Cache API and the
 * rate limit binding stubbed. Nothing here asks for real PNG or WebP pixels,
 * because the raster path needs WebAssembly the test runner does not load:
 * wherever a raster request appears, it is answered before rendering starts
 * (from the cache, or by the limit), which is exactly the behaviour under test.
 */

import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index";

const ORIGIN = "https://x.test";

/** A Map-backed stand-in for caches.default that counts what it is asked. */
function stubCache() {
  const store = new Map<string, Response>();
  const calls = { match: 0, put: 0 };
  const cache = {
    async match(request: Request) {
      calls.match++;
      return store.get(request.url)?.clone();
    },
    async put(request: Request, response: Response) {
      calls.put++;
      if (request.method !== "GET") throw new Error("Cache API only stores GET");
      store.set(request.url, response);
    },
  };
  (globalThis as unknown as { caches: unknown }).caches = { default: cache };
  return { store, calls };
}

/** A rate limit binding that answers as told and records the keys it saw. */
function stubLimit(allow: boolean) {
  const keys: string[] = [];
  return {
    keys,
    binding: {
      async limit({ key }: { key: string }) {
        keys.push(key);
        return { success: allow };
      },
    },
  };
}

function ctx() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    value: { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException: () => {} },
  };
}

async function call(path: string, init: RequestInit = {}, env: Record<string, unknown> = {}) {
  const c = ctx();
  const response = await worker.fetch(
    new Request(ORIGIN + path, init) as never,
    env as never,
    c.value as never,
  );
  await Promise.all(c.pending);
  return response;
}

let cache: ReturnType<typeof stubCache>;
beforeEach(() => {
  cache = stubCache();
});

describe("the edge cache", () => {
  it("stores a rendered image under its URL", async () => {
    const res = await call("/600x400");
    expect(res.status).toBe(200);
    expect(cache.calls.put).toBe(1);
    expect(cache.store.has(ORIGIN + "/600x400")).toBe(true);
  });

  it("answers a repeat request from the cache instead of rendering again", async () => {
    // A sentinel no renderer would produce, so a match proves nothing rendered.
    cache.store.set(ORIGIN + "/600x400", new Response("from the cache"));
    const res = await call("/600x400");
    expect(await res.text()).toBe("from the cache");
    expect(cache.calls.put).toBe(0);
  });

  it("lets HEAD share the entry GET stored, with no body", async () => {
    await call("/600x400");
    const res = await call("/600x400", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(res.body).toBeNull();
    expect(cache.calls.put).toBe(1);
  });

  it("stores the entry under GET even when HEAD asked first", async () => {
    // cache.put refuses anything but GET, so the key has to be a GET.
    const res = await call("/600x400", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(cache.store.has(ORIGIN + "/600x400")).toBe(true);
  });

  it("answers a matching If-None-Match with 304 before touching the cache", async () => {
    const etag = (await call("/600x400")).headers.get("ETag")!;
    const before = cache.calls.match;

    const res = await call("/600x400", { headers: { "If-None-Match": etag } });
    expect(res.status).toBe(304);
    expect(cache.calls.match).toBe(before);
  });

  it("never caches an error", async () => {
    expect((await call("/banana")).status).toBe(400);
    expect(cache.calls.put).toBe(0);
  });

  it("still answers when the cache write fails", async () => {
    (globalThis as unknown as { caches: unknown }).caches = {
      default: {
        match: async () => undefined,
        put: async () => {
          throw new Error("no cache here");
        },
      },
    };
    expect((await call("/600x400")).status).toBe(200);
  });
});

describe("the raster rate limit", () => {
  const ip = { headers: { "CF-Connecting-IP": "203.0.113.7" } };

  it("turns away PNG and WebP once an address is over the limit", async () => {
    const limit = stubLimit(false);
    for (const path of ["/600x400?format=png", "/600x400.webp"]) {
      const res = await call(path, ip, { RASTER_LIMIT: limit.binding });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("60");
      expect(await res.text()).toContain("SVG");
    }
  });

  it("counts by the connecting address", async () => {
    const limit = stubLimit(false);
    await call("/600x400?format=png", ip, { RASTER_LIMIT: limit.binding });
    expect(limit.keys).toEqual(["203.0.113.7"]);
  });

  it("never limits SVG", async () => {
    const limit = stubLimit(false);
    const res = await call("/600x400", ip, { RASTER_LIMIT: limit.binding });
    expect(res.status).toBe(200);
    expect(limit.keys).toEqual([]);
  });

  it("does not spend the limit on a raster image already in the cache", async () => {
    const limit = stubLimit(false);
    cache.store.set(ORIGIN + "/600x400?format=png", new Response("cached png"));
    const res = await call("/600x400?format=png", ip, { RASTER_LIMIT: limit.binding });
    expect(res.status).toBe(200);
    expect(limit.keys).toEqual([]);
  });

  it("does not spend the limit on a request that is invalid anyway", async () => {
    const limit = stubLimit(false);
    const res = await call("/600x400?format=png&bg=nope", ip, { RASTER_LIMIT: limit.binding });
    expect(res.status).toBe(400);
    expect(limit.keys).toEqual([]);
  });

  it("serves normally with no binding configured", async () => {
    expect((await call("/600x400")).status).toBe(200);
  });
});

describe("headers", () => {
  it("returns 400, not 500, for malformed percent-encoding", async () => {
    const res = await call("/%E0%A4%A");
    expect(res.status).toBe(400);
  });

  it("marks every text response nosniff, since errors quote the request back", async () => {
    const res = await call("/abc%3Cb%3E");
    expect(res.status).toBe(400);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sends the page with nosniff, a referrer policy and a baseline CSP", async () => {
    const res = await call("/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toContain("base-uri 'none'");
    expect(res.headers.get("Content-Security-Policy")).toContain("object-src 'none'");
  });

  it("keeps the image CSP and nosniff on images", async () => {
    const res = await call("/600x400");
    expect(res.headers.get("Content-Security-Policy")).toContain("sandbox");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
