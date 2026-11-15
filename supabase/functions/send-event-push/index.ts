// Sends a OneSignal push for a newly published, important event.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID = "876e30fb-b69f-49da-a8aa-e90bf0240723";
const ALLOWED_ORIGINS = new Set(["https://hapn.info", "https://www.hapn.info"]);
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    "Content-Type": "application/json",
    "Vary": "Origin",
    "X-Request-ID": requestId,
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info, x-request-id";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), { status, headers });
  const fail = (code: string, status = 500) => {
    console.error("[send-event-push]", requestId, code);
    return json({ error: "The request could not be completed. Please try again.", code: "REQUEST_FAILED" }, status);
  };

  if (req.method === "OPTIONS") return new Response(null, { status: ALLOWED_ORIGINS.has(origin) ? 204 : 403, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const oneSignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !oneSignalKey) return fail("missing_server_configuration");

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminRow, error: adminError } = await adminClient
      .from("admins").select("user_id,role").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
    if (adminError) return fail("admin_authorization_lookup_failed");
    if (!adminRow) return json({ error: "Admin access required" }, 403);

    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request body" }, 400);
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    const eventId = String(body.eventId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      return json({ error: "Invalid event ID" }, 400);
    }

    const { data: event, error: eventError } = await adminClient.from("events")
      .select("id,title,category,short_description,description,is_published")
      .eq("id", eventId).maybeSingle();
    if (eventError) return fail("event_lookup_failed");
    if (!event) return json({ error: "Event not found" }, 404);
    if (!event.is_published) return json({ skipped: true, reason: "Event is not published" });
    const category = String(event.category || "");
    const title = String(event.title || "New Hapn event");
    if (!/workshop|hackathon|technical|fest/i.test(category + " " + title)) {
      return json({ skipped: true, reason: "Not an important event category" });
    }

    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Authorization": "Key " + oneSignalKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: APP_ID,
        included_segments: ["Subscribed Users"],
        headings: { en: "New on Hapn: " + title },
        contents: { en: String(event.short_description || event.description || "Open Hapn to see event details.").slice(0, 180) },
        url: "https://hapn.info/event/?id=" + encodeURIComponent(event.id),
        target_channel: "push",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return fail("onesignal_delivery_failed", 502);
    return json({ sent: true, id: result.id || null });
  } catch (_) {
    return fail("unexpected_handler_error");
  }
});
