# ZuruSasa

A travel-booking platform that lets users discover and book coastal Kenya experiences through TikTok-style video reels. Hosts create listings (hotels, villas, boats, tours, events); guests browse vertical reel feeds, save favorites, and book or enquire.

## Stack

- **Frontend**: React 18 + Vite + TypeScript, ported from Vercel → Replit pnpm workspace
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Payments**: Paystack (KES payments), Stripe (additional payment support)
- **Media**: Cloudinary (video/image uploads), HLS.js (adaptive video playback), @ffmpeg (client-side trimming)
- **UI**: Tailwind CSS v3, Radix UI, Shadcn components

## Artifact

- `artifacts/zurusasa/` — main web app (`@workspace/zurusasa`)
  - Preview path: `/`
  - Workflow: `artifacts/zurusasa: web`

## Environment Secrets Required

| Key | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name for media uploads |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset |

## Key Routes

| Path | Page |
|------|------|
| `/` | CityPulse (reel feed home) |
| `/discover` | Discover listings |
| `/home` | Home |
| `/bookings` | User bookings |
| `/saved` | Saved listings |
| `/profile` | User profile |
| `/host` | Host dashboard |
| `/host/listings` | Host listings management |
| `/host/bookings` | Host booking management |
| `/host/payouts` | Host payout settings |
| `/admin` | Admin dashboard |
| `/auth` | Login / signup |

## User Preferences

- Preserve original app features and visual design — orange brand (#E86817), warm neutrals, Instrument Serif + DM Sans fonts
- No Next.js — this is a Vite + React app
