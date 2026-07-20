---
name: ZuruSasa mobile Supabase wiring
description: How the Expo app reaches the shared Supabase backend and auth choice
---

- The Expo app talks to Supabase directly (no api-server). Supabase env vars are mapped in the artifact's package.json dev/build scripts: `EXPO_PUBLIC_SUPABASE_URL=$VITE_SUPABASE_URL EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY` — Metro only exposes EXPO_PUBLIC_* vars, and this avoids ever reading secret values.
- **Why:** the same Supabase project backs web and mobile; the publishable key is public by design so shell-level mapping is safe.
- Mobile auth uses email OTP (signInWithOtp + verifyOtp type 'email') because web-style OAuth redirects and phone OTP flows are web-oriented; sessions persist via AsyncStorage.
- Reels query relies on the FK alias `profiles!reels_user_id_profiles_fkey` — keep in sync with the web app's useReels if the schema changes.
