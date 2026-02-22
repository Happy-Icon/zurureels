-- Reel Likes, Saves, Follows + Profiles RLS fix

-- 1. REEL LIKES
create table if not exists reel_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  reel_id uuid references reels(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique(user_id, reel_id)
);

alter table reel_likes enable row level security;

create policy "Anyone can view likes" on reel_likes
for select to authenticated using (true);

create policy "Users can like reels" on reel_likes
for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can unlike reels" on reel_likes
for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_reel_likes_reel_id on reel_likes(reel_id);
create index if not exists idx_reel_likes_user_id on reel_likes(user_id);

-- 2. REEL SAVES (Bookmarks)
create table if not exists reel_saves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  reel_id uuid references reels(id) on delete cascade not null,
  created_at timestamp with time zone default now() not null,
  unique(user_id, reel_id)
);

alter table reel_saves enable row level security;

create policy "Users can view own saves" on reel_saves
for select to authenticated using (auth.uid() = user_id);

create policy "Users can save reels" on reel_saves
for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can unsave reels" on reel_saves
for delete to authenticated using (auth.uid() = user_id);

create index if not exists idx_reel_saves_reel_id on reel_saves(reel_id);
create index if not exists idx_reel_saves_user_id on reel_saves(user_id);

-- 3. USER FOLLOWS
create table if not exists user_follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references auth.users(id) not null,
  following_id uuid references auth.users(id) not null,
  created_at timestamp with time zone default now() not null,
  unique(follower_id, following_id),
  check (follower_id != following_id)
);

alter table user_follows enable row level security;

create policy "Anyone can view follows" on user_follows
for select to authenticated using (true);

create policy "Users can follow" on user_follows
for insert to authenticated with check (auth.uid() = follower_id);

create policy "Users can unfollow" on user_follows
for delete to authenticated using (auth.uid() = follower_id);

create index if not exists idx_user_follows_follower on user_follows(follower_id);
create index if not exists idx_user_follows_following on user_follows(following_id);

-- 4. FIX PROFILES RLS: Allow public viewing of profiles (for host avatar/name on reels)
drop policy if exists "Public can view profiles" on profiles;
create policy "Public can view profiles" on profiles
for select to anon, authenticated using (true);
