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

// Redis REST Command Helper
async function redisRestCommand(url: string, token: string, command: (string | number)[]) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.error('Upstash Redis REST error:', err);
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://rjzgzxxdrltlteeshtuw.supabase.co';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL') || 'https://boss-arachnid-175826.upstash.io';
  const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';

  const supabase = createClient(supabaseUrl, anonKey);

  let body: { action?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action || 'get_reels_feed';

  // Enforce Rate Limiting per IP/Action (60 req/min for feed, 10 req/min for invalidation)
  const maxReq = action === 'invalidate_reels_feed' ? 10 : 60;
  const rl = await checkRateLimit(request, `redis_${action}`, maxReq, 60);
  if (!rl.allowed) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429);
  }

  // 1. Get Reels Feed (sub-10ms Redis Cache with DB Fallback)
  if (action === 'get_reels_feed') {
    const cacheKey = 'reels_feed_active_v1';
    if (redisUrl && redisToken) {
      const cached = await redisRestCommand(redisUrl, redisToken, ['GET', cacheKey]);
      if (cached) {
        try {
          return json({ data: JSON.parse(cached), cached: true });
        } catch {
          // ignore parse error
        }
      }
    }

    // Cache Miss or Redis error -> Query Supabase PostgreSQL
    const { data, error } = await supabase
      .from('reels')
      .select(
        `*,
        experience:experiences(id, title, description, location, current_price, price_unit, availability_status, metadata),
        host:profiles!reels_user_id_profiles_fkey(full_name, verification_status, metadata)`
      )
      .in('status', ['active', 'published'])
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return json({ error: error.message }, 500);

    // Save to Redis (300s TTL)
    if (redisUrl && redisToken && data) {
      redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 300, JSON.stringify(data)]).catch(() => null);
    }

    return json({ data, cached: false });
  }

  // 2. Invalidate Reels Feed Cache
  if (action === 'invalidate_reels_feed') {
    if (redisUrl && redisToken) {
      await redisRestCommand(redisUrl, redisToken, ['DEL', 'reels_feed_active_v1']);
    }
    return json({ success: true });
  }

  // 3. Get Experiences Feed by Category
  if (action === 'get_experiences') {
    const category = body.category || 'all';
    const cacheKey = `experiences_cat_${category}`;

    if (redisUrl && redisToken) {
      const cached = await redisRestCommand(redisUrl, redisToken, ['GET', cacheKey]);
      if (cached) {
        try {
          return json({ data: JSON.parse(cached), cached: true });
        } catch {
          // ignore parse error
        }
      }
    }

    let query = supabase
      .from('experiences')
      .select(
        'id, title, description, location, current_price, price_unit, entity_name, category, availability_status, metadata'
      )
      .limit(50);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    if (redisUrl && redisToken && data) {
      redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 300, JSON.stringify(data)]).catch(() => null);
    }

    return json({ data, cached: false });
  }

  return json({ error: 'Unknown action' }, 400);
});
