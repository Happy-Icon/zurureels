-- Create a webhook to trigger the transcode-video edge function
-- Note: This requires the function to be deployed and reachable.
-- In a local environment, this is for documentation/setup purposes.

-- Enable the pg_net extension if not already enabled
create extension if not exists pg_net;

-- Create the trigger function
create or replace function public.handle_video_upload()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Trigger the edge function
  -- In production, the URL would be https://<project_id>.supabase.co/functions/v1/transcode-video
  perform
    net.http_post(
      url := 'http://localhost:54321/functions/v1/transcode-video',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
  return new;
end;
$$;

-- Create the trigger
drop trigger if exists on_video_upload on public.reels;
create trigger on_video_upload
  after insert on public.reels
  for each row
  execute function public.handle_video_upload();
