import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://hapn.info",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ error: "Server function is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role,is_active").eq("user_id", userData.user.id).maybeSingle();
  if (profileError || profile?.role !== "super_admin" || profile?.is_active !== true) {
    return json({ error: "Super Admin access required" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (body.action === "invite_college_admin") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const collegeId = String(body.college_id ?? "");
    const fullName = String(body.full_name ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !collegeId) return json({ error: "Valid email and college are required" }, 400);
    const { data: college, error: collegeError } = await admin.from("colleges").select("id,name,is_active").eq("id", collegeId).maybeSingle();
    if (collegeError || !college || !college.is_active) return json({ error: "Choose an active college" }, 400);
    const { data: existing } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
    if (existing) return json({ error: "This email already has an account. Reassign or deactivate the existing admin instead." }, 409);

    const { data: invitation, error: inviteRowError } = await admin.from("admin_invitations").insert({
      email, college_id: collegeId, invited_by: userData.user.id, status: "pending",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }).select("id").single();
    if (inviteRowError) return json({ error: inviteRowError.message }, 400);

    const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT") ?? "https://hapn.info/admin/accept-invite.html";
    const { data: invited, error: authInviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName, college_id: collegeId, invitation_id: invitation.id },
    });
    if (authInviteError) {
      await admin.from("admin_invitations").delete().eq("id", invitation.id);
      return json({ error: authInviteError.message }, 400);
    }
    return json({ ok: true, message: "Invitation sent", user_id: invited.user?.id });
  }

  if (body.action === "revoke_invitation") {
    const id = String(body.invitation_id ?? "");
    const { error } = await admin.from("admin_invitations").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "set_admin_status") {
    const userId = String(body.user_id ?? "");
    const active = body.is_active === true;
    const { data, error } = await admin.from("profiles").update({ is_active: active })
      .eq("user_id", userId).eq("role", "college_admin").select("user_id").maybeSingle();
    if (error || !data) return json({ error: error?.message ?? "College Admin not found" }, 400);
    return json({ ok: true });
  }
  return json({ error: "Unsupported action" }, 400);
});
