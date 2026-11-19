/**
 * Hapn production security headers for Cloudflare.
 * Deploy this Worker and attach routes hapn.info/* and www.hapn.info/*.
 * GitHub Pages does not read a Netlify-style _headers file.
 */
const SCRIPT_SOURCES = [
  "'self'",
  "https://cdn.jsdelivr.net",
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://static.cloudflareinsights.com",
  "https://cdn.onesignal.com",
  "https://api.onesignal.com",
  "https://onesignal.com"
];

function createNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function buildCsp(nonce) {
  return [
    "default-src 'self'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https:",
    "upgrade-insecure-requests",
    "script-src " + SCRIPT_SOURCES.join(" ") + " 'nonce-" + nonce + "'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://xeablvxtlxdwuiiawsgq.supabase.co wss://xeablvxtlxdwuiiawsgq.supabase.co https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://onesignal.com https://*.onesignal.com https://*.onesignal.net https://*.os.tc",
    "frame-src https://accounts.google.com"
  ].join("; ");
}

export default {
  async fetch(request) {
    const upstream = await fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Strict-Transport-Security", "max-age=31536000");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.delete("X-Powered-By");

    const contentType = headers.get("content-type") || "";
    if (contentType.toLowerCase().includes("text/html") && upstream.body) {
      const nonce = createNonce();
      headers.set("Content-Security-Policy", buildCsp(nonce));
      const html = await upstream.text();
      const securedHtml = html.replace(/<script\b([^>]*)>/gi, (tag, attributes) => {
        if (/(?:^|\s)nonce\s*=/.test(attributes)) return tag;
        return "<script nonce=\"" + nonce + "\"" + attributes + ">";
      });
      return new Response(securedHtml, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
    }

    headers.set("Content-Security-Policy", buildCsp("static-response-no-inline"));
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }
};
