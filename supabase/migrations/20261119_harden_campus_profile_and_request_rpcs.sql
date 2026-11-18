-- Harden Campus Board RPCs without changing their caller/owner authorization model.
-- Empty search_path prevents untrusted object shadowing in SECURITY DEFINER functions.
-- Explicit NULL checks close SQL three-valued-logic validation gaps.
CREATE OR REPLACE FUNCTION public.update_campus_member_profile(
  p_full_name text, p_academic_year text, p_whatsapp_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_college uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.' USING errcode = '42501';
  END IF;
  SELECT cm.college_id INTO v_college
  FROM public.campus_members cm WHERE cm.user_id = v_uid;
  IF v_college IS NULL THEN
    RAISE EXCEPTION 'Verified campus membership is required.' USING errcode = '42501';
  END IF;
  IF pg_catalog.length(pg_catalog.trim(pg_catalog.coalesce(p_full_name, ''))) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Enter a valid display name.';
  END IF;
  IF p_academic_year IS NULL OR p_academic_year NOT IN
    ('1st Year','2nd Year','3rd Year','4th Year','Postgraduate') THEN
    RAISE EXCEPTION 'Choose a valid academic year.';
  END IF;
  IF pg_catalog.coalesce(p_whatsapp_phone, '') <> ''
     AND p_whatsapp_phone !~ '^[+]?[0-9][0-9 -]{6,15}$' THEN
    RAISE EXCEPTION 'Enter a valid WhatsApp number.';
  END IF;
  UPDATE public.campus_members
  SET full_name = pg_catalog.trim(p_full_name),
      academic_year = p_academic_year,
      updated_at = pg_catalog.now()
  WHERE user_id = v_uid;
  INSERT INTO public.campus_member_private(user_id, college_id, whatsapp_phone, updated_at)
  VALUES (v_uid, v_college, pg_catalog.nullif(pg_catalog.trim(p_whatsapp_phone), ''), pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE
  SET whatsapp_phone = EXCLUDED.whatsapp_phone, updated_at = EXCLUDED.updated_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_campus_connect_request(
  p_request_id uuid, p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  r public.campus_connect_requests%rowtype;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.' USING errcode = '42501';
  END IF;
  IF p_request_id IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'A valid request and response are required.';
  END IF;
  SELECT * INTO r FROM public.campus_connect_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR r.owner_id <> v_uid THEN
    RAISE EXCEPTION 'Request not found or not yours to respond to.' USING errcode = '42501';
  END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request has already been answered.';
  END IF;
  IF p_approve THEN
    SELECT whatsapp_phone INTO v_phone
    FROM public.campus_member_private WHERE user_id = v_uid;
    IF pg_catalog.coalesce(v_phone, '') = '' THEN
      RAISE EXCEPTION 'Add your WhatsApp number in Settings first.';
    END IF;
  END IF;
  UPDATE public.campus_connect_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
      responded_at = pg_catalog.now()
  WHERE id = p_request_id;
  INSERT INTO public.campus_notifications(
    user_id, college_id, notification_type, message, post_id, request_id
  ) VALUES (
    r.requester_id, r.college_id,
    CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
    CASE WHEN p_approve
      THEN r.owner_name || ' accepted your request. You can now message them on WhatsApp.'
      ELSE r.owner_name || ' declined your connection request.' END,
    r.post_id, r.id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_campus_member_profile(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_campus_member_profile(text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_to_campus_connect_request(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_campus_connect_request(uuid,boolean) TO authenticated;
