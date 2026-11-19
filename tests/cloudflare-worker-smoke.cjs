const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto").webcrypto;

async function loadWorker(contentType) {
  const workerPath = path.join(__dirname, "..", "cloudflare", "production-headers-worker.js");
  const source = fs.readFileSync(workerPath, "utf8");
  const sandbox = {
    module: { exports: {} },
    fetch: async () => new Response(contentType === "text/html"
      ? '<!doctype html><script nonce="origin-stale-nonce">window.inlineAllowed = true;</script><script src="/app.js"></script>'
      : "origin-body", {
        status: 202,
        headers: {
          "content-type": contentType,
          "x-powered-by": "origin"
        }
      }),
    Headers,
    Response,
    Uint8Array,
    crypto
  };

  vm.runInNewContext(source.replace("export default", "module.exports ="), sandbox, {
    filename: workerPath
  });
  return sandbox.module.exports;
}

async function main() {
  const worker = await loadWorker("text/plain");
  assert.equal(typeof worker.fetch, "function", "Worker must export fetch()");
  const response = await worker.fetch({ url: "https://hapn.info/" });

  assert.equal(response.status, 202, "Worker must preserve the origin status");
  assert.equal(await response.text(), "origin-body", "Worker must preserve the origin body");
  assert.equal(response.headers.get("content-type"), "text/plain", "Worker must preserve origin headers");
  assert.equal(response.headers.get("x-powered-by"), null, "Worker must remove X-Powered-By");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");

  const csp = response.headers.get("content-security-policy") || "";
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "https://cdn.jsdelivr.net",
    "https://cdn.onesignal.com",
    "https://static.cloudflareinsights.com",
    "https://xeablvxtlxdwuiiawsgq.supabase.co"
  ]) {
    assert.ok(csp.includes(directive), "CSP must include " + directive);
  }
  assert.ok(!csp.includes("'unsafe-inline'"), "script policy must not allow unsafe-inline");

  const htmlWorker = await loadWorker("text/html; charset=utf-8");
  const htmlResponse = await htmlWorker.fetch({ url: "https://hapn.info/" });
  const htmlCsp = htmlResponse.headers.get("content-security-policy") || "";
  const html = await htmlResponse.text();
  const nonce = htmlCsp.match(/'nonce-([^']+)'/);
  assert.ok(nonce, "HTML CSP must include a fresh nonce");
  assert.ok(html.includes('nonce="' + nonce[1] + '"'), "inline and external scripts must receive the CSP nonce");
  assert.ok(html.includes("<script nonce="), "script tags must be nonce-rewritten");
  assert.ok(!html.includes('nonce="origin-stale-nonce"'), "origin-provided nonce must be replaced");
  const scriptNonces = [...html.matchAll(/<script\\b[^>]*\\bnonce="([^"]+)"/gi)].map(match => match[1]);
  assert.equal(scriptNonces.length, 2, "every script tag must carry a nonce");
  assert.ok(scriptNonces.every(value => value === nonce[1]), "all script nonces must match the response CSP");
  assert.ok(!htmlCsp.includes("'unsafe-inline'"), "HTML script policy must not allow unsafe-inline");

  console.log("Cloudflare Worker smoke test passed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
