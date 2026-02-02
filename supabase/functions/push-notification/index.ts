import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: any;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { record } = await req.json() as { record: NotificationRecord }

    if (!record) {
      throw new Error("No record found in payload")
    }

    console.log(`Sending notification to user ${record.user_id}: ${record.title}`)

    // Fetch the target user's device tokens
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");

    // Create a Supabase client with the Admin key (needed to access user_devices if RLS is strict, or just use service role)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: devices } = await supabaseAdmin
      .from("user_devices")
      .select("device_token")
      .eq("user_id", record.user_id);

    const playerIds = devices?.map(d => d.device_token) || [];

    if (playerIds.length === 0) {
      console.log(`No devices found for user ${record.user_id}`);
      return new Response(JSON.stringify({ message: "No devices registered" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ONE_SIGNAL_APP_ID = Deno.env.get('ONE_SIGNAL_APP_ID')
    const ONE_SIGNAL_API_KEY = Deno.env.get('ONE_SIGNAL_API_KEY')

    if (ONE_SIGNAL_APP_ID && ONE_SIGNAL_API_KEY) {
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${ONE_SIGNAL_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONE_SIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: record.title },
          contents: { en: record.body },
          data: record.data
        }),
      });
      const result = await response.json();
      console.log("OneSignal Result:", result);
    }

    return new Response(JSON.stringify({ success: true, message: "Notification processed" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Error processing notification:", error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
