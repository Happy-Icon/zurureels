---
name: ZuruSasa Vercel → Replit port
description: Key decisions and quirks from porting this Supabase-backed Vite app from Vercel to Replit
---

# ZuruSasa Port Notes

## App type
- Already Vite + React (NOT Next.js) — no routing conversion needed
- Uses react-router-dom with BrowserRouter (not wouter)
- Uses Supabase for all backend (auth, DB, storage, edge functions)
- No Replit API server needed for core features

## Source layout quirk
- The fullstack-detect.sh found CLIENT_DIR=src (root src/) but the complete app is in `.migration-backup/frontend/`
- Root src/ is an older/incomplete version; `frontend/` has the full routing, admin pages, host dashboard, etc.
- Solution: ran copy script (got root src/), then `cp -r .migration-backup/frontend/src/* artifacts/zurusasa/src/` to overwrite with the complete version

## Tailwind v3 setup
- Uses Tailwind v3 (not v4/tailwindcss-vite)
- vite.config.ts uses `css.postcss.plugins` with tailwindcss + autoprefixer (not @tailwindcss/vite plugin)
- tailwind.config.ts content: `["./src/**/*.{ts,tsx}", "./index.html"]`

## Dependencies added beyond scaffold
- hls.js, react-infinite-scroll-component, react-paystack, react-router-dom, @supabase/supabase-js, @stripe/react-stripe-js, @stripe/stripe-js, @ffmpeg/ffmpeg, @ffmpeg/util, @capacitor/core + plugins

## Secrets required
- VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (for Supabase)
- VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET (for media uploads)

**Why:** Record so future agents know the complete source was in frontend/ not root src/, and that tailwind v3 postcss setup is correct.
