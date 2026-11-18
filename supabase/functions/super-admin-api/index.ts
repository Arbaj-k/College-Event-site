import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    ...SECURITY_HEADERS, "Content-Type": "application/json", "Vary": "Origin", "X-Request-ID": requestId,
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type, x-request-id";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  }
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), { status, headers });
  const fail = (code: string, status = 500) => {
    console.error("[super-admin-api]", requestId, code);
    return json({ error: "The request could not be completed. Please try again.", code: "REQUEST_FAILED" }, status);
  };
  if (req.method === "OPTIONS") return new Response(null, { status: ALLOWED_ORIGINS.has(origin) ? 204 : 403, headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return fail("missing_server_configuration");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { const value = await req.json(); if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "Invalid request body" }, 400); body = value; }
  catch { return json({ error: "Invalid request body" }, 400); }

  try {
    if (body.action === "finalize_admin_activation") {
      const email = String(userData.user.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim().slice(0, 80);

      // Invitation activation is only for a new admin profile. Never let an invite
      // overwrite an existing Super Admin (or silently demote any existing role).
      const { data: existingProfile, error: existingProfileErr } = await admin
        .from("profiles")
        .select("role,is_active")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (existingProfileErr) return fail("activation_profile_lookup_failed");
      if (existingProfile?.role === "super_admin") {
        return json({ error: "A Super Admin account cannot be activated through a College Admin invitation." }, 403);
      }
      if (existingProfile) {
        return json({ error: "This account already has an admin profile. Ask a Super Admin to manage its role." }, 409);
      }

      const { data: invitation, error: inviteErr } = await admin.from("admin_invitations").select("id,email,college_id,status,expires_at")
        .eq("email", email).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (inviteErr) return fail("invitation_lookup_failed");
      if (!invitation) return json({ error: "No valid pending invitation was found for this email." }, 403);
      const { data: college, error: collegeErr } = await admin.from("colleges").select("id,is_active").eq("id", invitation.college_id).maybeSingle();
      if (collegeErr) return fail("college_lookup_failed");
      if (!college?.is_active) return json({ error: "The assigned college is no longer active." }, 403);
      const { error: profileErr } = await admin.from("profiles").insert({ user_id: userData.user.id, email, full_name: fullName || null, role: "college_admin", college_id: invitation.college_id, is_active: true });
      if (profileErr) {
        // INSERT is intentionally used instead of UPSERT: the database's unique
        // constraint is the final race-safe guard against overwriting any role.
        if (profileErr.code === "23505") return json({ error: "This account already has an admin profile. Ask a Super Admin to manage its role." }, 409);
        return fail("profile_activation_failed");
      }
      const { data: acceptedInvitation, error: acceptErr } = await admin
        .from("admin_invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", invitation.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (acceptErr || !acceptedInvitation) {
        // Roll back the profile created by this activation attempt if the
        // invitation was consumed or changed concurrently.
        await admin.from("profiles").delete().eq("user_id", userData.user.id).eq("role", "college_admin");
        if (acceptErr) return fail("invitation_accept_failed");
        return json({ error: "This invitation has already been used or is no longer pending." }, 409);
      }
      return json({ ok: true, message: "College Admin account activated." });
    }

    const { data: profile, error: profileErr } = await admin.from("profiles").select("role,is_active").eq("user_id", userData.user.id).maybeSingle();
    if (profileErr) return fail("admin_profile_lookup_failed");
    if (profile?.role !== "super_admin" || profile?.is_active !== true) return json({ error: "Super Admin access required" }, 403);
    if (body.action === "invite_college_admin") {
      const email = String(body.email ?? "").trim().toLowerCase(), collegeId = String(body.college_id ?? ""), fullName = String(body.full_name ?? "").trim().slice(0, 80);
      if (!/^\S+@\S+\.\S+$/.test(email) || !collegeId) return json({ error: "Valid email and college are required" }, 400);
      const { data: college, error: collegeErr } = await admin.from("colleges").select("id,name,is_active").eq("id", collegeId).maybeSingle();
      if (collegeErr) return fail("invite_college_lookup_failed");
      if (!college?.is_active) return json({ error: "Choose an active college" }, 400);
      const { data: existing, error: existingErr } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      if (existingErr) return fail("existing_admin_lookup_failed");
      if (existing) return json({ error: "This email already has an account. Reassign or deactivate the existing admin instead." }, 409);
      const { data: invitation, error: createErr } = await admin.from("admin_invitations").insert({ email, college_id: collegeId, invited_by: userData.user.id, status: "pending", expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).select("id").single();
      if (createErr) return fail("invitation_create_failed");
      const redirectTo = Deno.env.get("ADMIN_INVITE_REDIRECT") ?? "https://hapn.info/admin/accept-invite.html";
      if (!redirectTo.startsWith("https://hapn.info/")) { await admin.from("admin_invitations").delete().eq("id", invitation.id); return fail("invalid_invite_redirect_configuration"); }
      const { data: invited, error: sendErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { full_name: fullName, college_id: collegeId, invitation_id: invitation.id } });
      if (sendErr) { await admin.from("admin_invitations").delete().eq("id", invitation.id); return fail("auth_invitation_send_failed"); }
      return json({ ok: true, message: "Invitation sent", user_id: invited.user?.id });
    }
    if (body.action === "revoke_invitation") {
      const id = String(body.invitation_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Invalid invitation" }, 400);
      const { error } = await admin.from("admin_invitations").update({ status: "revoked" }).eq("id", id).eq("status", "pending");
      if (error) return fail("invitation_revoke_failed");
      return json({ ok: true });
    }
    if (body.action === "reassign_admin") {
      const userId = String(body.user_id ?? ""), collegeId = String(body.college_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(collegeId)) return json({ error: "Invalid admin or college" }, 400);
      const { data: college, error: collegeErr } = await admin.from("colleges").select("id,is_active").eq("id", collegeId).maybeSingle();
      if (collegeErr) return fail("reassign_college_lookup_failed");
      if (!college?.is_active) return json({ error: "Choose an active college" }, 400);
      const { data, error } = await admin.from("profiles").update({ college_id: collegeId }).eq("user_id", userId).eq("role", "college_admin").select("user_id").maybeSingle();
      if (error) return fail("admin_reassignment_failed");
      if (!data) return json({ error: "College Admin not found" }, 404);
      return json({ ok: true });
    }
    if (body.action === "delete_college_admin") {
      const userId = String(body.user_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid admin" }, 400);
      const { data: target, error: targetErr } = await admin.from("profiles").select("user_id,role").eq("user_id", userId).maybeSingle();
      if (targetErr) return fail("delete_admin_lookup_failed");
      if (!target || target.role !== "college_admin") return json({ error: "College Admin not found" }, 404);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return fail("admin_deletion_failed");
      return json({ ok: true });
    }
    if (body.action === "set_admin_status") {
      const userId = String(body.user_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Invalid admin" }, 400);
      const { data, error } = await admin.from("profiles").update({ is_active: body.is_active === true }).eq("user_id", userId).eq("role", "college_admin").select("user_id").maybeSingle();
      if (error) return fail("admin_status_update_failed");
      if (!data) return json({ error: "College Admin not found" }, 404);
      return json({ ok: true });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (_) { return fail("unexpected_handler_error"); }
});
