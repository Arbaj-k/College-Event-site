const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function main() {
  const workerPath = path.join(__dirname, "..", "cloudflare", "production-headers-worker.js");
  const source = fs.readFileSync(workerPath, "utf8");
  const sandbox = {
    module: { exports: {} },
    fetch: async () => new Response("origin-body", {
      status: 202,
      headers: {
        "content-type": "text/plain",
        "x-powered-by": "origin"
      }
    }),
    Headers,
    Response
  };

  vm.runInNewContext(source.replace("export default", "module.exports ="), sandbox, {
    filename: workerPath
  });

  const worker = sandbox.module.exports;
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

  console.log("Cloudflare Worker smoke test passed.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
