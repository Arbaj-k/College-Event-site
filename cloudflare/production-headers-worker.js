/**
 * Hapn production security headers for Cloudflare.
 * Deploy this Worker and attach routes hapn.info/* and www.hapn.info/*.
 * GitHub Pages does not read a Netlify-style _headers file.
 */
const CSP = [
  "default-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https:",
  "upgrade-insecure-requests",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://cdn.onesignal.com https://api.onesignal.com https://onesignal.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://xeablvxtlxdwuiiawsgq.supabase.co wss://xeablvxtlxdwuiiawsgq.supabase.co https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com https://onesignal.com https://*.onesignal.com https://*.onesignal.net https://*.os.tc",
  "frame-src https://accounts.google.com"
].join("; ");

export default {
  async fetch(request) {
    const upstream = await fetch(request);
    const headers = new Headers(upstream.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Strict-Transport-Security", "max-age=31536000");
    headers.set("Content-Security-Policy", CSP);
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.delete("X-Powered-By");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  }
};
