// Sends a OneSignal push for a newly published, important event.
// Configure ONESIGNAL_REST_API_KEY as a Supabase Edge Function secret.
// Never put the OneSignal REST API key in browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_ID = "876e30fb-b69f-49da-a8aa-e90bf0240723";
const ALLOWED_ORIGINS = new Set(["https://hapn.info", "https://www.hapn.info"]);
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://hapn.info",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const headers = corsHeaders(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers });

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Authentication required" }, { status: 401, headers });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !oneSignalKey) {
    console.error("Missing required server secrets for send-event-push.");
    return Response.json({ error: "Push service is not configured" }, { status: 503, headers });
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "Invalid session" }, { status: 401, headers });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: adminRow, error: adminError } = await adminClient
    .from("admins").select("user_id,role").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
  if (adminError || !adminRow) return Response.json({ error: "Admin access required" }, { status: 403, headers });

  let eventId = "";
  try {
    const body = await req.json();
    eventId = String(body?.eventId || "");
  } catch (_) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400, headers });
  }

  const { data: event, error: eventError } = await adminClient
    .from("events")
    .select("id,title,category,short_description,description,is_published")
    .eq("id", eventId).maybeSingle();
  if (eventError || !event) return Response.json({ error: "Event not found" }, { status: 404, headers });
  if (!event.is_published) return Response.json({ skipped: true, reason: "Event is not published" }, { headers });

  const category = String(event.category || "");
  const title = String(event.title || "New Hapn event");
  const important = /workshop|hackathon|technical|fest/i.test(category + " " + title);
  if (!important) return Response.json({ skipped: true, reason: "Not an important event category" }, { headers });

  const response = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Authorization": "Key " + oneSignalKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: APP_ID,
      included_segments: ["Subscribed Users"],
      headings: { en: "New on Hapn: " + title },
      contents: { en: String(event.short_description || event.description || "Open Hapn to see event details.").slice(0, 180) },
      url: "https://hapn.info/event/?id=" + encodeURIComponent(event.id),
      target_channel: "push",
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("OneSignal send failed:", response.status, JSON.stringify(result));
    return Response.json({ error: "OneSignal could not send the notification" }, { status: 502, headers });
  }
  return Response.json({ sent: true, id: result.id || null }, { headers });
});
