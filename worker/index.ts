/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SITE_PASSWORD?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const ACCESS_COOKIE = "faceless_campus_gate";

function safeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

async function passwordToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function loginPage(error = false): Response {
  const errorMessage = error ? '<p class="error" role="alert">That password is not correct.</p>' : "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Enter Faceless Campus OS</title>
    <style>
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 70% 15%, #40279a 0, transparent 31rem), #10101b; color: #f8f7ff; padding: 24px; }
      main { width: min(100%, 430px); border: 1px solid rgba(255,255,255,.14); border-radius: 28px; padding: 38px; background: rgba(24,23,41,.92); box-shadow: 0 28px 90px rgba(0,0,0,.42); }
      .mark { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 15px; background: #6540f4; font-size: 24px; margin-bottom: 32px; }
      small { color: #bfff55; font-weight: 800; letter-spacing: .16em; }
      h1 { margin: 12px 0 10px; font-size: clamp(34px, 8vw, 48px); line-height: .98; letter-spacing: -.05em; }
      p { color: #aaa8bb; line-height: 1.55; margin: 0 0 28px; }
      label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 9px; }
      input { width: 100%; height: 54px; border: 1px solid #444158; border-radius: 13px; background: #12111e; color: white; padding: 0 16px; font: inherit; outline: none; }
      input:focus { border-color: #8269ff; box-shadow: 0 0 0 3px rgba(101,64,244,.22); }
      button { width: 100%; height: 54px; margin-top: 14px; border: 0; border-radius: 13px; background: #bfff55; color: #111119; font-weight: 850; cursor: pointer; }
      .error { margin: 12px 0 0; color: #ff9aa8; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">◐</div>
      <small>FACELESS CAMPUS OS</small>
      <h1>Private build.</h1>
      <p>Enter the access password to continue.</p>
      <form method="post" action="/login">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
        <button type="submit">Enter Campus OS</button>
        ${errorMessage}
      </form>
    </main>
  </body>
</html>`;

  return new Response(html, {
    status: error ? 401 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}

async function enforceSitePassword(request: Request, password: string): Promise<Response | null> {
  const url = new URL(request.url);
  const expectedToken = await passwordToken(password);

  if (url.pathname === "/login") {
    if (request.method === "GET") return loginPage();

    if (request.method === "POST") {
      const form = await request.formData();
      const submittedPassword = form.get("password");
      if (typeof submittedPassword === "string" && safeEqual(submittedPassword, password)) {
        return new Response(null, {
          status: 303,
          headers: {
            location: "/",
            "set-cookie": `${ACCESS_COOKIE}=${expectedToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`,
            "cache-control": "no-store",
          },
        });
      }

      return loginPage(true);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_COOKIE}=`))
    ?.slice(ACCESS_COOKIE.length + 1);

  if (cookieToken && safeEqual(cookieToken, expectedToken)) return null;

  const acceptsHtml = (request.headers.get("accept") ?? "").includes("text/html");
  if (request.method === "GET" && acceptsHtml) {
    return new Response(null, { status: 302, headers: { location: "/login", "cache-control": "no-store" } });
  }

  return Response.json({ error: "Authentication required" }, { status: 401, headers: { "cache-control": "no-store" } });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (env.SITE_PASSWORD) {
      const accessResponse = await enforceSitePassword(request, env.SITE_PASSWORD);
      if (accessResponse) return accessResponse;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
