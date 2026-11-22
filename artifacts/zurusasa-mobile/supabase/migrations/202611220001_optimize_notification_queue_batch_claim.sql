-- =============================================================================
-- Migration: 202611220001_optimize_notification_queue_batch_claim.sql
-- Purpose:
--   Eliminate the 60-round-trip sequential claim loop in process-notification-queue
--   (identified via k6 stress testing as HTTP 546 WORKER_LIMIT / 60s timeout):
--     1. Add partial queue index on public.notification_deliveries
--     2. Create atomic public.claim_notification_deliveries(p_limit, p_stale_minutes)
--        RPC using FOR UPDATE SKIP LOCKED in a single SQL statement.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_due_queue
  ON public.notification_deliveries (next_retry_at ASC, created_at ASC)
  WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.claim_notification_deliveries(
  p_limit integer DEFAULT 60,
  p_stale_minutes integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  notification_id uuid,
  user_id uuid,
  channel text,
  template_key text,
  priority text,
  dedupe_key text,
  payload jsonb,
  status text,
  attempt_count integer,
  max_attempts integer,
  expo_ticket_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 60), 1), 200);
  v_stale_interval interval := make_interval(mins => GREATEST(COALESCE(p_stale_minutes, 10), 1));
  v_now timestamptz := now();
BEGIN
  -- 1. Recover any stale deliveries stuck in 'processing' past the stale threshold
  UPDATE public.notification_deliveries nd
  SET status = 'failed',
      next_retry_at = v_now,
      last_error = 'Recovered from stale processing state',
      updated_at = v_now
  WHERE nd.status = 'processing'
    AND nd.updated_at <= (v_now - v_stale_interval);

  -- 2. Atomically claim up to v_limit due deliveries without lock contention
  RETURN QUERY
  WITH due AS (
    SELECT nd.id
    FROM public.notification_deliveries nd
    WHERE nd.status IN ('pending', 'failed')
      AND nd.next_retry_at <= v_now
    ORDER BY nd.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_deliveries nd
  SET status = 'processing',
      updated_at = v_now
  FROM due
  WHERE nd.id = due.id
  RETURNING
    nd.id,
    nd.notification_id,
    nd.user_id,
    nd.channel,
    nd.template_key,
    nd.priority,
    nd.dedupe_key,
    nd.payload,
    nd.status,
    nd.attempt_count,
    nd.max_attempts,
    nd.expo_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_deliveries(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_deliveries(integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
