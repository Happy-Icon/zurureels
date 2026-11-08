-- =============================================================================
-- Migration: 202611090001_personal_data_access_requests.sql
-- Description: Schema, Private Storage, RLS, and Audit Logging for
--              Personal Data Access Requests (Kenya DPA 2019 / GDPR compliant).
-- =============================================================================

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.personal_data_request_status AS ENUM (
    'pending_verification',
    'processing',
    'completed',
    'failed',
    'expired',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.personal_data_export_format AS ENUM (
    'json',
    'pdf',
    'both'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Private Storage Bucket ────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personal-data-exports',
  'personal-data-exports',
  false,
  52428800, -- 50 MB limit
  ARRAY['application/json', 'application/pdf', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Strict storage policies: Only service_role can write/delete. Users access via signed URLs only.
DROP POLICY IF EXISTS "Deny public access to personal data exports" ON storage.objects;
CREATE POLICY "Deny public access to personal data exports"
  ON storage.objects FOR ALL
  TO public
  USING (false);

-- ── 3. Table: personal_data_requests ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.personal_data_request_status NOT NULL DEFAULT 'pending_verification',
  format public.personal_data_export_format NOT NULL DEFAULT 'both',
  
  -- Security & Verification
  otp_hash TEXT,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_max_attempts INTEGER NOT NULL DEFAULT 3,
  otp_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  
  -- Generated Artifacts & Integrity
  json_storage_path TEXT,
  pdf_storage_path TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  
  -- Expiration & Failure Metadata
  expires_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdr_user_status
  ON public.personal_data_requests (user_id, status);

CREATE INDEX IF NOT EXISTS idx_pdr_cleanup_due
  ON public.personal_data_requests (status, expires_at)
  WHERE status = 'completed';

-- ── 4. Table: personal_data_audit_logs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_data_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.personal_data_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  ip_address TEXT,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pdal_user_created
  ON public.personal_data_audit_logs (user_id, created_at DESC);

-- ── 5. Row Level Security (RLS) ──────────────────────────────────────────────

ALTER TABLE public.personal_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_data_audit_logs ENABLE ROW LEVEL SECURITY;

-- personal_data_requests policies:
DROP POLICY IF EXISTS "Users can view own data requests" ON public.personal_data_requests;
CREATE POLICY "Users can view own data requests"
  ON public.personal_data_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own data requests" ON public.personal_data_requests;
CREATE POLICY "Users can insert own data requests"
  ON public.personal_data_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Direct client updates/deletes are blocked; all updates occur via service_role or RPC
DROP POLICY IF EXISTS "Deny direct updates by users" ON public.personal_data_requests;
CREATE POLICY "Deny direct updates by users"
  ON public.personal_data_requests FOR UPDATE
  TO authenticated
  USING (false);

-- personal_data_audit_logs policies:
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.personal_data_audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON public.personal_data_audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Immutable audit ledger: no client modifications allowed
DROP POLICY IF EXISTS "Users cannot modify audit logs" ON public.personal_data_audit_logs;
CREATE POLICY "Users cannot modify audit logs"
  ON public.personal_data_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ── 6. Helper RPCs for Request Lifecycle ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_personal_data_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_req
  FROM public.personal_data_requests
  WHERE id = p_request_id AND user_id = v_calling_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING errcode = 'P0002';
  END IF;

  IF v_req.status NOT IN ('pending_verification', 'processing') THEN
    RAISE EXCEPTION 'Cannot cancel request in status: %', v_req.status USING errcode = '22023';
  END IF;

  UPDATE public.personal_data_requests
  SET status = 'cancelled', updated_at = clock_timestamp()
  WHERE id = p_request_id;

  INSERT INTO public.personal_data_audit_logs (request_id, user_id, event_type, actor_role, details)
  VALUES (p_request_id, v_calling_user_id, 'request_cancelled_by_user', 'user', '{}'::jsonb);

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_personal_data_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_personal_data_request(UUID) TO authenticated;
