import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, city, context } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = `You are Zuru, the ultimate AI Tourism Agent for ${city || "the Kenyan coast"}.
    
You are professional, locally-informed, and highly focused on user safety and value.

YOUR CORE CAPABILITIES:
1. ADVISE: Recommend the best experiences based on real data.
2. DIRECT: Help users find what they need near their location.
3. WARN: You MUST identify unverified operators. If a host's 'verification_status' is not 'verified', gently warn the user to proceed with caution or look for verified alternatives.
4. BUDGET & PLAN: Calculate total costs for trips. Use 'current_price' from the data to give accurate estimates.

STRICT RULES:
- Never hallucinate prices or availability.
- Keep responses concise (under 150 words).
- If you don't have enough data, suggest general coastal tips but clarify you are using "general knowledge" instead of specific listings.
- ALWAYS check 'host.verification_status'. If it's not 'verified', add a note about safety.

Current available data context:
${JSON.stringify(context, null, 2)}

SCHEMA INSTRUCTIONS:
Always try to use a schema if it fits the user's request. Return RAW JSON. No markdown blocks.

Available Schemas:

1. Recommendations (city_concierge):
{
  "type": "city_concierge",
  "city": "${city || "the Kenyan coast"}",
  "recommendations": [
    {
      "activity": "Name",
      "why_it_fits": "Short reason",
      "best_time": "Time",
      "is_verified": true/false,
      "tags": ["tag"]
    }
  ]
}

2. Trip Planning & Budgeting (trip_plan):
{
  "type": "trip_plan",
  "title": "Short title",
  "total_estimated_cost": "KES X,XXX",
  "breakdown": [
    { "item": "Activity name", "cost": "KES X,XXX", "status": "verified | unverified" }
  ],
  "advice": "General safety or booking advice"
}

3. Itinerary (micro_itinerary):
{
  "type": "micro_itinerary",
  "schedule": [{ "time": "9:00 AM", "activity": "Name", "note": "Tip" }]
}

4. Safety Warning (safety_warning):
{
  "type": "safety_warning",
  "level": "caution | alert",
  "message": "Specific warning about an unverified operator or general safety tip"
}

5. Intent Signal (intent_signal):
{
  "type": "intent_signal",
  "readiness_level": "ready_to_book",
  "suggested_next_action": "Click the 'Book Now' button below"
}

If no schema fits, or the user asks for "chat", use standard text.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API Error:", response.status, errorText);
      throw new Error(`OpenAI API Error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    // Simulate SSE for the frontend
    const sseStream = new ReadableStream({
      start(controller) {
        const text = JSON.stringify({ choices: [{ delta: { content: answer } }] });
        controller.enqueue(new TextEncoder().encode(`data: ${text}\n\n`));
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    });

    return new Response(sseStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
