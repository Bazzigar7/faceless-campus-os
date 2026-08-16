import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders Faceless Campus OS onboarding", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Faceless Campus OS<\/title>/i);
  assert.match(html, /FACELESS CAMPUS OS/);
  assert.match(html, /CHOOSE YOUR CAMPUS USERNAME/);
  assert.match(html, /Ethereum and Solana wallets through Privy/);
  assert.doesNotMatch(html, /codex-preview|Building your site/);
});

test("profile registration verifies signed Privy identity data", async () => {
  const [route, verifier, client, environment] = await Promise.all([
    readFile(new URL("../app/api/profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/privy-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/OnchainLab.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(route, /privy-id-token/);
  assert.match(route, /PRIVY_VERIFICATION_KEY/);
  assert.match(verifier, /jwtVerify/);
  assert.match(verifier, /issuer:\s*"privy\.io"/);
  assert.match(verifier, /audience:\s*appId/);
  assert.match(verifier, /linked_accounts/);
  assert.match(client, /useIdentityToken/);
  assert.match(client, /campus_pending_username/);
  assert.doesNotMatch(environment, /PRIVY_APP_SECRET/);
});
