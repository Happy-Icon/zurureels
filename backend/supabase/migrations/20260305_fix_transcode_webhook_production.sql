-- Production webhook trigger for transcode-video edge function
-- Replaces the localhost URL with the actual production Supabase edge function URL

-- Enable the pg_net extension
create extension if not exists pg_net;

-- Replace trigger function with production URL
create or replace function public.handle_video_upload()
returns trigger
language plpgsql
security definer
as $$
declare
  project_url text := 'https://ibesxkfvjgkfsqhsrxvm.supabase.co';
  service_key text;
begin
  -- Get service role key from Vault (set via `supabase secrets set`)
  -- Falls back gracefully if not available
  begin
    service_key := current_setting('app.settings.service_role_key', true);
  exception when others then
    service_key := '';
  end;

  -- Only fire if processing_status is 'processing' and we have a cloudinary video
  -- This avoids double-triggering on status updates
  if NEW.processing_status = 'processing' and NEW.video_url ilike '%cloudinary.com%' then
    perform
      net.http_post(
        url := project_url || '/functions/v1/transcode-video',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  end if;

  return NEW;
end;
$$;

-- Recreate the trigger (fires on INSERT only)
drop trigger if exists on_video_upload on public.reels;
create trigger on_video_upload
  after insert on public.reels
  for each row
  execute function public.handle_video_upload();
