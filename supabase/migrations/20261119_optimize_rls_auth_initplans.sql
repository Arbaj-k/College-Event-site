
-- Optimize auth lookups in RLS predicates by evaluating stable JWT/session
-- values once per statement. Predicate semantics and role scope are preserved.

DROP POLICY IF EXISTS "Admins can review submissions" ON public.event_submissions;
CREATE POLICY "Admins can review submissions" ON public.event_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Anonymous sessions read recent chat" ON public.chat_messages;
CREATE POLICY "Anonymous sessions read recent chat" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (((SELECT auth.jwt()) ->> 'is_anonymous') = 'true' AND deleted_at IS NULL AND created_at > (now() - interval '24 hours'));

DROP POLICY IF EXISTS "Anonymous sessions insert own chat messages" ON public.chat_messages;
CREATE POLICY "Anonymous sessions insert own chat messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.jwt()) ->> 'is_anonymous') = 'true'
    AND (SELECT auth.uid()) = user_id AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.chat_rooms r WHERE r.id = chat_messages.room_id AND r.is_open));

DROP POLICY IF EXISTS "Anonymous sessions read own reports" ON public.chat_reports;
CREATE POLICY "Anonymous sessions read own reports" ON public.chat_reports
  FOR SELECT TO authenticated
  USING (((SELECT auth.jwt()) ->> 'is_anonymous') = 'true' AND (SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS "Anonymous sessions report chat messages" ON public.chat_reports;
CREATE POLICY "Anonymous sessions report chat messages" ON public.chat_reports
  FOR INSERT TO authenticated
  WITH CHECK (((SELECT auth.jwt()) ->> 'is_anonymous') = 'true'
    AND (SELECT auth.uid()) = reporter_id
    AND EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.id = chat_reports.message_id AND m.deleted_at IS NULL));

DROP POLICY IF EXISTS chat_private_participant_read ON public.chat_private_conversations;
CREATE POLICY chat_private_participant_read ON public.chat_private_conversations
  FOR SELECT TO authenticated
  USING (((SELECT auth.uid()) = user_a OR (SELECT auth.uid()) = user_b) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS chat_private_messages_participant_read ON public.chat_private_messages;
CREATE POLICY chat_private_messages_participant_read ON public.chat_private_messages
  FOR SELECT TO authenticated
  USING (((deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.chat_private_conversations c
    WHERE c.id = chat_private_messages.conversation_id
      AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
  )) OR (SELECT public.is_admin())));

DROP POLICY IF EXISTS chat_private_messages_participant_insert ON public.chat_private_messages;
CREATE POLICY chat_private_messages_participant_insert ON public.chat_private_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) ->> 'is_anonymous') = 'true'
    AND EXISTS (
      SELECT 1 FROM public.chat_private_conversations c
      WHERE c.id = chat_private_messages.conversation_id AND c.ended_at IS NULL
        AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
    ));

DROP POLICY IF EXISTS chat_match_queue_own_read ON public.chat_match_queue;
CREATE POLICY chat_match_queue_own_read ON public.chat_match_queue
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS chat_private_reports_own_or_admin_read ON public.chat_private_reports;
CREATE POLICY chat_private_reports_own_or_admin_read ON public.chat_private_reports
  FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS chat_private_reports_participant_insert ON public.chat_private_reports;
CREATE POLICY chat_private_reports_participant_insert ON public.chat_private_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) ->> 'is_anonymous') = 'true'
    AND EXISTS (
      SELECT 1 FROM public.chat_private_messages m
      JOIN public.chat_private_conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_private_reports.message_id
        AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
    ));

DROP POLICY IF EXISTS "users can create community posts" ON public.chat_community_posts;
CREATE POLICY "users can create community posts" ON public.chat_community_posts
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = author_id);

DROP POLICY IF EXISTS "users can comment on community posts" ON public.chat_community_comments;
CREATE POLICY "users can comment on community posts" ON public.chat_community_comments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id
    AND EXISTS (SELECT 1 FROM public.chat_community_posts p
      WHERE p.id = chat_community_comments.post_id AND p.deleted_at IS NULL));
