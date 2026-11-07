/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const REEL_VALIDITY_DAYS = 15;

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

function getReelExpiryCutoffIso(days = REEL_VALIDITY_DAYS): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

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

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
  const anonKey = (Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim();
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Supabase environment is not configured' }, 503);
  }

  const redisUrl = (Deno.env.get('UPSTASH_REDIS_REST_URL') ?? '').trim();
  const redisToken = (Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? '').trim();

  const supabase = createClient(supabaseUrl, anonKey);

  let body: { action?: string; category?: string; excludeExpired?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action || 'get_reels_feed';

  const maxReq = action === 'invalidate_reels_feed' ? 10 : 60;
  const rl = await checkRateLimit(request, `redis_${action}`, maxReq, 60);
  if (!rl.allowed) {
    return json({ error: 'Rate limit exceeded. Please slow down.' }, 429);
  }

  // 1. Get Reels Feed (sub-10ms Redis Cache with DB Fallback)
  if (action === 'get_reels_feed') {
    const excludeExpired = body.excludeExpired === true;
    const cacheKey = excludeExpired ? 'reels_feed_active_v3_fresh' : 'reels_feed_active_v3';
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
      .from('reels')
      .select(
        `*,
        experience:experiences(id, title, entity_name, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, availability_status, image_url, max_guests, min_stay_nights, max_stay_nights, check_in_time, check_out_time, booking_mode, cancellation_policy, house_rules, arrival_instructions, checkout_instructions, amenities, metadata),
        host:profiles!reels_user_id_profiles_fkey(id, full_name, email, verification_status, is_verified, metadata, created_at, bio, role)`,
      )
      .in('status', ['active', 'published']);

    if (excludeExpired) {
      query = query.gte('created_at', getReelExpiryCutoffIso());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return json({ error: error.message }, 500);

    if (redisUrl && redisToken && data) {
      redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 300, JSON.stringify(data)]).catch(() => null);
    }

    return json({ data, cached: false });
  }

  // 2. Invalidate Reels Feed Cache
  if (action === 'invalidate_reels_feed') {
    if (redisUrl && redisToken) {
      await redisRestCommand(redisUrl, redisToken, [
        'DEL',
        'reels_feed_active_v1',
        'reels_feed_active_v2',
        'reels_feed_active_v2_fresh',
        'reels_feed_active_v3',
        'reels_feed_active_v3_fresh',
      ]);
    }
    return json({ success: true });
  }

  // 3. Get Experiences Feed by Category
  if (action === 'get_experiences') {
    const category = body.category || 'all';
    const cacheKey = `experiences_cat_v2_${category}`;

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
        'id, title, description, location, city, formatted_address, country_code, display_latitude, display_longitude, location_precision, current_price, price_unit, entity_name, category, availability_status, image_url, metadata',
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
