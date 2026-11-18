-- Add covering indexes for the foreign keys reported by Supabase Performance Advisor.
-- These indexes do not alter data or Row Level Security policies.
CREATE INDEX IF NOT EXISTS admin_invitations_invited_by_idx ON public.admin_invitations (invited_by);
CREATE INDEX IF NOT EXISTS campus_connect_requests_college_id_idx ON public.campus_connect_requests (college_id);
CREATE INDEX IF NOT EXISTS campus_connect_requests_owner_id_idx ON public.campus_connect_requests (owner_id);
CREATE INDEX IF NOT EXISTS campus_connect_requests_requester_id_idx ON public.campus_connect_requests (requester_id);
CREATE INDEX IF NOT EXISTS campus_member_private_college_id_idx ON public.campus_member_private (college_id);
CREATE INDEX IF NOT EXISTS campus_notifications_college_id_idx ON public.campus_notifications (college_id);
CREATE INDEX IF NOT EXISTS campus_notifications_post_id_idx ON public.campus_notifications (post_id);
CREATE INDEX IF NOT EXISTS campus_notifications_request_id_idx ON public.campus_notifications (request_id);
CREATE INDEX IF NOT EXISTS campus_notifications_user_id_idx ON public.campus_notifications (user_id);
CREATE INDEX IF NOT EXISTS campus_post_reports_college_id_idx ON public.campus_post_reports (college_id);
CREATE INDEX IF NOT EXISTS campus_post_reports_post_id_idx ON public.campus_post_reports (post_id);
CREATE INDEX IF NOT EXISTS campus_post_saves_post_id_idx ON public.campus_post_saves (post_id);
CREATE INDEX IF NOT EXISTS chat_match_queue_matched_user_id_idx ON public.chat_match_queue (matched_user_id);
CREATE INDEX IF NOT EXISTS chat_messages_reply_to_id_idx ON public.chat_messages (reply_to_id);
CREATE INDEX IF NOT EXISTS chat_private_conversations_user_a_idx ON public.chat_private_conversations (user_a);
CREATE INDEX IF NOT EXISTS chat_private_conversations_user_b_idx ON public.chat_private_conversations (user_b);
CREATE INDEX IF NOT EXISTS chat_private_messages_conversation_id_idx ON public.chat_private_messages (conversation_id);
CREATE INDEX IF NOT EXISTS chat_private_messages_sender_id_idx ON public.chat_private_messages (sender_id);
CREATE INDEX IF NOT EXISTS chat_private_reports_message_id_idx ON public.chat_private_reports (message_id);
CREATE INDEX IF NOT EXISTS chat_private_reports_reporter_id_idx ON public.chat_private_reports (reporter_id);
CREATE INDEX IF NOT EXISTS chat_reports_message_id_idx ON public.chat_reports (message_id);
