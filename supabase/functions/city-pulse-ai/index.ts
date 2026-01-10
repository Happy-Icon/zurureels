import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, city, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Zuru, an AI assistant inside a reels-based travel booking platform for ${city || "the Kenyan coast"}.

You must:
- Be concise and practical
- Never hallucinate prices or availability
- Recommend activities, not exact businesses unless they're in the provided data
- Output only valid JSON when asked for recommendations or mood-based suggestions
- Keep responses under 120 words
- Use local terminology when appropriate (dawa cocktail, dhow, etc.)

Current available data:
${JSON.stringify(context, null, 2)}

When asked for activity recommendations, respond with this exact JSON schema:
{
  "type": "city_concierge",
  "city": "${city || "the Kenyan coast"}",
  "recommendations": [
    {
      "activity": "activity name",
      "why_it_fits": "brief reason matching user mood/budget",
      "best_time": "suggested time today",
      "tags": ["reel-worthy", "scenic", etc]
    }
  ]
}

When asked about mood-based suggestions or "I'm feeling..." type questions, respond with this JSON schema:
{
  "type": "mood_discovery",
  "mood": "detected mood",
  "suggested_tags": ["tag1", "tag2", "tag3"],
  "description": "brief friendly explanation of why these categories match"
}

When asked to generate a reel caption, CTA, or content for an activity/listing, respond with this JSON schema:
{
  "type": "reel_caption",
  "caption": "engaging short caption for the reel",
  "cta": "call-to-action text",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}

When asked to summarize customer reviews, respond with this JSON schema:
{
  "type": "review_summary",
  "summary": "one trust-building sentence summarizing the reviews",
  "highlight": "a single standout phrase or keyword from the reviews"
}

When asked to create an itinerary or plan a schedule from activities, respond with this JSON schema:
{
  "type": "micro_itinerary",
  "schedule": [
    {
      "time": "suggested time (e.g., 9:00 AM)",
      "activity": "activity name",
      "note": "brief tip or context"
    }
  ]
}

When asked for a safety note, expectation note, or tips for first-time visitors to an activity/location, respond with this JSON schema:
{
  "type": "safety_note",
  "note": "a short, friendly paragraph covering key safety tips and what to expect"
}

Prioritize experiences suitable for reels content (photogenic, unique, shareable).
If asked about something not in the data, suggest similar alternatives from what's available.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("City Pulse AI error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
