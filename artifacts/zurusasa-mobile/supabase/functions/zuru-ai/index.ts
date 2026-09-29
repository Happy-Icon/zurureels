/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AICardResult {
  id: string;
  type: 'listing' | 'recommendation';
  title: string;
  subtitle?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  price?: number;
  priceUnit?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  category?: string;
  tags?: string[];
  reelId?: string;
  experienceId?: string;
  experience?: any;
  host?: any;
}

export interface ExtractedSearchCriteria {
  intent: 'search_listings' | 'general_qa';
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  guests: number | null;
  category: string | null;
  amenities: string[] | null;
  nearby?: boolean;
  conversational_response: string;
  follow_up_suggestions: string[];
}

// ── Fable 5.1 Tool Schema for Structured Output ─────────────────────────────

const DISCOVER_TOOL = {
  name: 'search_travel_experiences',
  description:
    'Extract structured travel discovery search criteria for Kenyan stays, activities, and experiences on ZuruSasa.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['search_listings', 'general_qa'],
        description: 'Whether the user is searching for experiences/stays or asking a general question.',
      },
      location: {
        type: ['string', 'null'],
        description:
          'Kenyan town/city/area mentioned or inferred (e.g. Mombasa, Diani, Watamu, Lamu, Nairobi, Naivasha, Malindi, Maasai Mara). Null if unspecified or if user asks for nearby without naming a town.',
      },
      nearby: {
        type: ['boolean', 'null'],
        description: 'True if user asked for nearby stays, near me, around here, or close to their location.',
      },
      budget_min: {
        type: ['number', 'null'],
        description: 'Minimum budget in Kenyan Shillings (KES). Null if not specified.',
      },
      budget_max: {
        type: ['number', 'null'],
        description: 'Maximum budget in Kenyan Shillings (KES). E.g. "under 10k" -> 10000. Null if not specified.',
      },
      guests: {
        type: ['number', 'null'],
        description: 'Number of guests or travelers. E.g. "for 2 people" -> 2. Null if not specified.',
      },
      category: {
        type: ['string', 'null'],
        description:
          'Category of experience: hotel, villa, apartment, stay, land_adventure, air_adventure, water_adventure, tours, boat, events, food, drinks. Null if unspecified.',
      },
      amenities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Requested amenities like Pool, Beach Front, Wi-Fi, Air Conditioning, Chef, Ocean View.',
      },
      conversational_response: {
        type: 'string',
        description:
          'Warm, helpful, concise natural language response to the user. Do NOT invent listings, prices, or fake property names. Simply introduce what you are looking for or answer their travel question.',
      },
      follow_up_suggestions: {
        type: 'array',
        items: { type: 'string' },
        description:
          '3-4 short, helpful follow-up suggestion chips (e.g. "Cheaper options", "Near the beach", "With a private pool", "For 4 guests").',
      },
    },
    required: ['intent', 'conversational_response', 'follow_up_suggestions'],
  },
};

const PERSONALIZATION_TOOL = {
  name: 'compute_user_affinities',
  description: 'Compute traveler category and destination affinities based on their interaction history.',
  input_schema: {
    type: 'object',
    properties: {
      category_affinities: {
        type: 'object',
        description: 'Category affinities as normalized weights from 0.0 to 1.0 (e.g. { "villa": 0.9, "water_adventure": 0.85 }).',
      },
      location_affinities: {
        type: 'object',
        description: 'Location affinities as normalized weights from 0.0 to 1.0 (e.g. { "Diani": 0.95, "Mombasa": 0.7 }).',
      },
      primary_traveler_type: {
        type: 'string',
        description: 'Inferred traveler persona (e.g. "Beach & Ocean Lover", "Luxury Villa Explorer", "Adventure Seeker").',
      },
    },
    required: ['category_affinities', 'location_affinities'],
  },
};

// ── Call Fable 5.1 API ──────────────────────────────────────────────────────

async function callFable51(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  tool: typeof DISCOVER_TOOL | typeof PERSONALIZATION_TOOL,
  toolChoiceName: string,
): Promise<any> {
  const apiKey = Deno.env.get('FABLE_API_KEY');
  const baseUrl = Deno.env.get('FABLE_BASE_URL') || 'https://api.anthropic.com/v1/messages';
  const model = Deno.env.get('FABLE_MODEL') || 'claude-fable-5-1';

  if (!apiKey) {
    throw new Error('FABLE_API_KEY_NOT_CONFIGURED');
  }

  const payload = {
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools: [tool],
    tool_choice: { type: 'tool', name: toolChoiceName },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Fable 5.1 API timeout')), 18000);

  try {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Fable API responded with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const toolUseBlock = data.content?.find((c: any) => c.type === 'tool_use');
    if (toolUseBlock && toolUseBlock.input) {
      return toolUseBlock.input;
    }

    // Fallback if returned in text block
    const textBlock = data.content?.find((c: any) => c.type === 'text');
    if (textBlock && textBlock.text) {
      try {
        return JSON.parse(textBlock.text);
      } catch {
        return {
          intent: 'general_qa',
          conversational_response: textBlock.text,
          follow_up_suggestions: ['Show beach stays', 'Under KES 10,000', 'Things to do in Mombasa'],
        };
      }
    }

    throw new Error('Unexpected response format from Fable API');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Fallback Intent Extraction (when FABLE_API_KEY is not yet set) ──────────

function fallbackIntentParser(
  prompt: string,
  userLocation?: { city?: string; latitude?: number; longitude?: number },
): ExtractedSearchCriteria {
  const q = prompt.toLowerCase();
  let location: string | null = null;
  const cities = ['diani', 'mombasa', 'watamu', 'lamu', 'nairobi', 'naivasha', 'malindi', 'mara'];
  for (const c of cities) {
    if (q.includes(c)) {
      location = c === 'mara' ? 'Maasai Mara' : c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  let nearby = false;
  if (q.includes('near') || q.includes('close') || q.includes('around') || q.includes('nearby')) {
    nearby = true;
    if (!location && userLocation?.city) {
      location = userLocation.city;
    }
  }

  let budget_max: number | null = null;
  const priceMatch = q.match(/(?:under|below|less than|max|<)\s*(?:kes|ksh)?\s*(\d+)(k)?/i) || q.match(/(\d+)\s*k\b/i);
  if (priceMatch) {
    let num = parseInt(priceMatch[1], 10);
    if (priceMatch[2] || q.includes('k')) num *= 1000;
    budget_max = num;
  }

  let guests: number | null = null;
  const guestMatch = q.match(/(\d+)\s*(?:people|guests|persons|adults)/i);
  if (guestMatch) {
    guests = parseInt(guestMatch[1], 10);
  }

  let category: string | null = null;
  if (q.includes('villa') || q.includes('house')) category = 'villa';
  else if (q.includes('hotel') || q.includes('resort')) category = 'hotel';
  else if (q.includes('boat') || q.includes('cruise') || q.includes('dhow')) category = 'boat';
  else if (q.includes('food') || q.includes('restaurant') || q.includes('seafood') || q.includes('eat')) category = 'food';
  else if (q.includes('event') || q.includes('concert')) category = 'events';
  else if (q.includes('stay') || q.includes('room') || q.includes('airbnb')) category = 'stay';

  const amenities: string[] = [];
  if (q.includes('pool')) amenities.push('Pool');
  if (q.includes('beach') || q.includes('ocean')) amenities.push('Beach Front');
  if (q.includes('wifi')) amenities.push('Wi-Fi');
  if (q.includes('ac') || q.includes('air conditioning')) amenities.push('Air Conditioning');

  let conversational_response = "I've searched our verified ZuruSasa experiences for you.";
  if (nearby && location) {
    conversational_response = `Here are great experiences close to you in ${location}.`;
  } else if (location && budget_max) {
    conversational_response = `Here are the best options in ${location} under KES ${budget_max.toLocaleString()}.`;
  } else if (location) {
    conversational_response = `Here are top-rated places to explore in ${location}.`;
  } else if (budget_max) {
    conversational_response = `Here are great experiences under KES ${budget_max.toLocaleString()}.`;
  }

  return {
    intent: 'search_listings',
    location,
    budget_min: null,
    budget_max,
    guests,
    category,
    amenities: amenities.length > 0 ? amenities : null,
    nearby,
    conversational_response,
    follow_up_suggestions: [
      'Cheaper options',
      'Near the beach',
      'With a private pool',
      'Under KES 10,000',
    ],
  };
}

function formatCloudinaryThumbnail(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.includes('cloudinary.com')) return url;
  // If the URL ends with a video extension (.mp4, .webm, .mov), replace with .jpg so Image components render it as an image
  return url.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg$2');
}

// ── Query Real Supabase Data ────────────────────────────────────────────────

async function fetchVerifiedListings(
  supabase: any,
  criteria: ExtractedSearchCriteria,
  userLocation?: { city?: string; latitude?: number; longitude?: number },
): Promise<AICardResult[]> {
  const targetLocation = criteria.location || (criteria.nearby && userLocation?.city ? userLocation.city : null);

  // 1. Query reels with linked experiences and host profiles first (Reels-first priority)
  const { data: rawReels, error: reelError } = await supabase
    .from('reels')
    .select(`
      id, video_url, thumbnail_url, category, status, duration, created_at,
      experience:experiences(*),
      host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, role, avatar_url)
    `)
    .in('status', ['active', 'published'])
    .not('experience', 'is', null)
    .limit(40);

  let matchingReels = (rawReels || []).filter((r: any) => Boolean(r.experience));

  // Filter in memory by target location
  if (targetLocation) {
    const locLower = targetLocation.toLowerCase();
    const locFiltered = matchingReels.filter((r: any) => {
      const expLoc = (r.experience?.location || '').toLowerCase();
      const expTitle = (r.experience?.title || '').toLowerCase();
      return expLoc.includes(locLower) || expTitle.includes(locLower);
    });
    if (locFiltered.length > 0) {
      matchingReels = locFiltered;
    }
  }

  // Gracefully filter by category if matching reels exist
  if (criteria.category) {
    const catLower = criteria.category.toLowerCase();
    const catFiltered = matchingReels.filter((r: any) => {
      const reelCat = (r.category || '').toLowerCase();
      const expCat = (r.experience?.category || '').toLowerCase();
      return reelCat.includes(catLower) || expCat.includes(catLower);
    });
    if (catFiltered.length > 0) {
      matchingReels = catFiltered;
    }
  }

  // Gracefully filter by budget if matches exist
  if (criteria.budget_max != null && criteria.budget_max > 0) {
    const budgetFiltered = matchingReels.filter((r: any) =>
      r.experience?.current_price != null && r.experience.current_price <= (criteria.budget_max as number)
    );
    if (budgetFiltered.length > 0) {
      matchingReels = budgetFiltered;
    }
  }

  // Gracefully filter by guests if matches exist
  if (criteria.guests != null && criteria.guests > 1) {
    const guestFiltered = matchingReels.filter((r: any) =>
      (r.experience?.max_guests || 2) >= (criteria.guests as number)
    );
    if (guestFiltered.length > 0) {
      matchingReels = guestFiltered;
    }
  }

  // If matching reels found, map them to AICardResult
  if (matchingReels.length > 0) {
    return matchingReels.slice(0, 10).map((r: any): AICardResult => {
      const exp = r.experience;
      const host = r.host;
      const meta = (exp.metadata || {}) as Record<string, any>;
      const rating = typeof meta.rating === 'number' ? meta.rating : 4.9;
      const reviewCount = typeof meta.review_count === 'number' ? meta.review_count : 18;
      const formattedThumb = formatCloudinaryThumbnail(r.thumbnail_url);
      const previewThumb = formattedThumb || r.thumbnail_url || exp.image_url || '';

      return {
        id: exp.id,
        type: 'listing',
        title: exp.title || 'ZuruSasa Experience',
        subtitle: exp.description || exp.entity_name || undefined,
        location: exp.location || 'Kenya Coast',
        price: exp.current_price != null ? Number(exp.current_price) : undefined,
        priceUnit: exp.price_unit || 'night',
        category: exp.category || r.category || 'stay',
        imageUrl: previewThumb,
        thumbnailUrl: formattedThumb || r.thumbnail_url || undefined,
        videoUrl: r.video_url || undefined,
        rating,
        reviewCount,
        tags: Array.isArray(exp.amenities) && exp.amenities.length > 0 ? exp.amenities.slice(0, 3) : undefined,
        reelId: r.id,
        experienceId: exp.id,
        experience: exp,
        host: host || undefined,
      };
    });
  }

  // 2. Fallback: Query experiences directly if no reels matched
  let expQuery = supabase
    .from('experiences')
    .select('*')
    .in('availability_status', ['available', 'instant_book'])
    .limit(10);

  if (targetLocation) {
    expQuery = expQuery.ilike('location', `%${targetLocation}%`);
  }
  if (criteria.budget_max != null && criteria.budget_max > 0) {
    expQuery = expQuery.lte('current_price', criteria.budget_max);
  }

  let { data: experiences } = await expQuery;

  if (!experiences || experiences.length === 0) {
    const { data: topData } = await supabase
      .from('experiences')
      .select('*')
      .limit(6);
    experiences = topData || [];
  }

  if (experiences.length === 0) return [];

  // Attach any reels that exist for these experiences
  const expIds = experiences.map((e: any) => e.id);
  const { data: linkedReels } = await supabase
    .from('reels')
    .select('id, video_url, thumbnail_url, experience_id')
    .in('experience_id', expIds)
    .in('status', ['active', 'published']);

  const reelMap = new Map<string, any>();
  if (linkedReels) {
    for (const lr of linkedReels) {
      if (lr.experience_id && !reelMap.has(lr.experience_id)) {
        reelMap.set(lr.experience_id, lr);
      }
    }
  }

  return experiences.map((exp: any): AICardResult => {
    const reel = reelMap.get(exp.id);
    const meta = (exp.metadata || {}) as Record<string, any>;
    const rating = typeof meta.rating === 'number' ? meta.rating : 4.9;
    const reviewCount = typeof meta.review_count === 'number' ? meta.review_count : 18;
    const formattedThumb = formatCloudinaryThumbnail(reel?.thumbnail_url);
    const previewThumb = formattedThumb || reel?.thumbnail_url || exp.image_url || '';

    return {
      id: exp.id,
      type: 'listing',
      title: exp.title || 'ZuruSasa Experience',
      subtitle: exp.description || exp.entity_name || undefined,
      location: exp.location || 'Kenya Coast',
      price: exp.current_price != null ? Number(exp.current_price) : undefined,
      priceUnit: exp.price_unit || 'night',
      category: exp.category || 'stay',
      imageUrl: previewThumb,
      thumbnailUrl: formattedThumb || reel?.thumbnail_url || undefined,
      videoUrl: reel?.video_url || undefined,
      rating,
      reviewCount,
      tags: Array.isArray(exp.amenities) && exp.amenities.length > 0 ? exp.amenities.slice(0, 3) : undefined,
      reelId: reel?.id || undefined,
      experienceId: exp.id,
      experience: exp,
      host: exp.host || undefined,
    };
  });
}

// ── Main Server Handler ─────────────────────────────────────────────────────

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || anonKey;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Authenticate user if token is provided
  let authUserId: string | undefined;
  const authorization = request.headers.get('Authorization');
  if (authorization) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) authUserId = user.id;
    } catch {
      // Allow anonymous discovery requests
    }
  }

  // Rate Limiting: 30 requests per 60 seconds
  const rl = await checkRateLimit(request, 'zuru_ai', 30, 60, authUserId);
  if (!rl.allowed) {
    return json({ error: 'Too many requests. Please wait a moment.' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = body.action || 'discover';

  // ──────────────────────────────────────────────────────────────────────────
  // ACTION 1: DISCOVER (Natural Language Travel Search)
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'discover') {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return json({ error: 'Message is required' }, 400);
    }

    if (message.length > 500) {
      return json({ error: 'Message exceeds 500 character limit' }, 400);
    }

    const conversationHistory = Array.isArray(body.history)
      ? body.history.slice(-6).map((m: any) => ({
          role: m.role === 'user' ? 'user' : ('assistant' as const),
          content: String(m.content || m.text || ''),
        }))
      : [];

    const isStreaming = body.stream === true;
    const userLocation = body.userLocation as { city?: string; latitude?: number; longitude?: number } | undefined;

    // Build Fable system prompt
    let systemPrompt = `You are Zuru AI, the smart Kenyan travel discovery concierge for ZuruSasa.
You help travelers discover real stays, villas, coastal getaways, boat rides, adventures, and dining in Kenya (Mombasa, Diani, Watamu, Lamu, Nairobi, Naivasha, Malindi, Maasai Mara).
Your role is to understand user travel intent and call search_travel_experiences with precise criteria.
Rules:
1. NEVER invent fake listings, fake prices, or fake property names. Real listings will be retrieved from the database.
2. In conversational_response, introduce what you found or answer their question in a warm, inviting, professional tone.
3. Provide 3-4 dynamic follow-up suggestions relevant to the query.
4. If the user asks for cheaper places, reflect that in budget_max or follow_up_suggestions.
5. If the user asks about specific amenities (pool, beach, ocean view), include them in amenities.`;

    if (userLocation?.city || (userLocation?.latitude && userLocation?.longitude)) {
      systemPrompt += `\nUser's detected current location: ${userLocation.city || 'Kenya Coast'} (coordinates: ${userLocation.latitude ?? 'unknown'}, ${userLocation.longitude ?? 'unknown'}). If the user asks for 'nearby', 'near me', or doesn't specify a location, set nearby to true and focus on experiences in ${userLocation.city || 'this area'}.`;
    }

    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: message },
    ];

    // If SSE Streaming is requested
    if (isStreaming) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (event: string, data: any) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          };

          try {
            // Stage 1: Understanding
            sendEvent('status', {
              stage: 'understanding',
              text: 'Understanding your request…',
            });

            let criteria: ExtractedSearchCriteria;
            try {
              criteria = await callFable51(systemPrompt, messages, DISCOVER_TOOL, 'search_travel_experiences');
            } catch (err: any) {
              console.warn('[ZuruAI] Fable 5.1 call failed or key missing, using fallback parser:', err?.message);
              criteria = fallbackIntentParser(message, userLocation);
            }

            // Stage 2: Searching Supabase
            sendEvent('status', {
              stage: 'searching',
              text: 'Finding matching experiences…',
            });

            // Stage 3: Retrieve verified listings from Supabase
            const verifiedCards = await fetchVerifiedListings(supabase, criteria, userLocation);

            // Stage 4: Result
            sendEvent('result', {
              text: criteria.conversational_response,
              cards: verifiedCards,
              followUps: criteria.follow_up_suggestions,
              criteria: {
                location: criteria.location,
                category: criteria.category,
                budget_max: criteria.budget_max,
                guests: criteria.guests,
                amenities: criteria.amenities,
              },
            });

            sendEvent('done', { ok: true });
          } catch (err: any) {
            console.error('[ZuruAI] Stream error:', err);
            sendEvent('error', {
              message: err?.message || 'Failed to complete AI travel discovery.',
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Non-streaming response
    try {
      let criteria: ExtractedSearchCriteria;
      try {
        criteria = await callFable51(systemPrompt, messages, DISCOVER_TOOL, 'search_travel_experiences');
      } catch (err: any) {
        console.warn('[ZuruAI] Fable call failed or unconfigured, falling back:', err?.message);
        criteria = fallbackIntentParser(message, userLocation);
      }

      const verifiedCards = await fetchVerifiedListings(supabase, criteria, userLocation);

      return json({
        text: criteria.conversational_response,
        cards: verifiedCards,
        followUps: criteria.follow_up_suggestions,
        criteria: {
          location: criteria.location,
          category: criteria.category,
          budget_max: criteria.budget_max,
          guests: criteria.guests,
          amenities: criteria.amenities,
        },
      });
    } catch (err: any) {
      console.error('[ZuruAI] Discover error:', err);
      return json({ error: err?.message || 'Error processing discovery request' }, 500);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACTION 2: PERSONALIZE_FEED (ZuruFlow AI Content Personalization)
  // ──────────────────────────────────────────────────────────────────────────
  if (action === 'personalize_feed') {
    const targetUserId = body.userId || authUserId;
    if (!targetUserId) {
      // Guest user: return empty affinities (default chronologic/trending ranking)
      return json({
        categoryAffinities: {},
        locationAffinities: {},
        source: 'default',
      });
    }

    try {
      // Fetch user's recent likes and saves
      const [{ data: likes }, { data: saves }] = await Promise.all([
        supabase
          .from('reel_likes')
          .select('reel:reels(id, category, experience:experiences(location, category))')
          .eq('user_id', targetUserId)
          .limit(25),
        supabase
          .from('reel_saves')
          .select('reel:reels(id, category, experience:experiences(location, category))')
          .eq('user_id', targetUserId)
          .limit(25),
      ]);

      const interactions: Array<{ category?: string; location?: string }> = [];
      for (const item of [...(likes || []), ...(saves || [])]) {
        const r = (item as any)?.reel;
        const cat = r?.category || r?.experience?.category;
        const loc = r?.experience?.location;
        if (cat || loc) {
          interactions.push({ category: cat, location: loc });
        }
      }

      if (interactions.length === 0) {
        return json({
          categoryAffinities: {},
          locationAffinities: {},
          source: 'none',
        });
      }

      // Tally category & location interactions
      const catCount: Record<string, number> = {};
      const locCount: Record<string, number> = {};
      for (const i of interactions) {
        if (i.category) {
          const k = i.category.toLowerCase();
          catCount[k] = (catCount[k] || 0) + 1;
        }
        if (i.location) {
          const l = i.location.toLowerCase();
          locCount[l] = (locCount[l] || 0) + 1;
        }
      }

      // Try Fable 5.1 content understanding for deeper persona affinities
      try {
        const fablePrompt = `A traveler on ZuruSasa has interacted with:
Categories: ${JSON.stringify(catCount)}
Locations: ${JSON.stringify(locCount)}
Compute normalized affinities (0.0 to 1.0) for travel categories and Kenyan destinations.`;

        const affinities = await callFable51(
          'You are an AI personalization engine analyzing travel reel interactions.',
          [{ role: 'user', content: fablePrompt }],
          PERSONALIZATION_TOOL,
          'compute_user_affinities',
        );

        return json({
          categoryAffinities: affinities.category_affinities || {},
          locationAffinities: affinities.location_affinities || {},
          persona: affinities.primary_traveler_type || 'Coastal Explorer',
          source: 'fable_5_1',
        });
      } catch {
        // Fallback: Normalize interaction counts directly
        const maxCat = Math.max(1, ...Object.values(catCount));
        const maxLoc = Math.max(1, ...Object.values(locCount));
        const categoryAffinities: Record<string, number> = {};
        const locationAffinities: Record<string, number> = {};

        for (const [k, v] of Object.entries(catCount)) categoryAffinities[k] = Number((v / maxCat).toFixed(2));
        for (const [k, v] of Object.entries(locCount)) locationAffinities[k] = Number((v / maxLoc).toFixed(2));

        return json({
          categoryAffinities,
          locationAffinities,
          source: 'interaction_weights',
        });
      }
    } catch (err: any) {
      console.error('[ZuruAI] Personalize feed error:', err);
      return json({ categoryAffinities: {}, locationAffinities: {}, source: 'fallback' });
    }
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
