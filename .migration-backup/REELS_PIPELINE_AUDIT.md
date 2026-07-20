# 🔴 REELS PIPELINE AUDIT REPORT

**Auditor:** Antigravity  
**Date:** February 22, 2026  
**Scope:** End-to-end reels upload pipeline → Database → Display (Zuru Pulse, Discover, Home)  
**Verdict:** ❌ PIPELINE IS FUNDAMENTALLY BROKEN — Reels upload but never appear anywhere

---

## Executive Summary

The reels pipeline has **critical breaks at multiple points**. Videos ARE being uploaded to Supabase Storage (20 .webm files found in the `reels` bucket), but **zero rows exist in the `reels` table** and **zero rows exist in the `experiences` table**. This means:

1. ✅ Storage bucket exists & is public — uploads work
2. ✅ Storage RLS policies are correct — authenticated users can upload
3. ❌ **Reel records are NOT being inserted into the `reels` table**
4. ❌ **Experience records are NOT being inserted into the `experiences` table**
5. ❌ **ALL display surfaces (Home, Discover, CityPulse) show NOTHING** because `useReels` hook returns empty

**Root Cause:** The INSERT into `reels` and `experiences` tables is failing silently, likely due to RLS policy constraints and/or the upload path architecture.

---

## 🔴 CRITICAL ISSUES (Pipeline Breakers)

### CRIT-1: Zero data in `reels` table — Videos uploaded but never recorded in DB
- **Evidence:** `SELECT * FROM reels LIMIT 10;` → returns `[]`
- **Evidence:** `SELECT id, name FROM storage.objects WHERE bucket_id = 'reels' LIMIT 20;` → returns **20 files**
- **Impact:** 100% of uploaded videos are orphaned in storage. Nothing displays anywhere.
- **Root Cause:** The INSERT into `reels` is guarded by RLS policy: 
  ```
  "Hosts can create reels for their experiences" → 
  auth.uid() = user_id AND EXISTS(SELECT 1 FROM experiences WHERE experiences.id = reels.experience_id AND experiences.user_id = auth.uid())
  ```
  This means a reel can ONLY be inserted if the `experience_id` points to a valid experience owned by the same user. If the experience insert fails or returns wrong data, the reel insert cascades to failure.

### CRIT-2: Zero data in `experiences` table
- **Evidence:** `SELECT * FROM experiences LIMIT 10;` → returns `[]`
- **Impact:** Even if reels were inserted, the `useReels` hook JOINs `experience:experiences(...)` and `host:profiles(...)` — empty experiences = empty joins = broken display.
- **Possible causes:**
  1. Experience insert failing silently (RLS requires `auth.uid() = user_id`)
  2. No real user has completed the full upload flow successfully
  3. Errors are caught but only logged to console (never surfaced properly)

### CRIT-3: Host Dashboard uses 100% MOCK DATA — never touches the database
- **File:** `frontend/src/pages/Host.tsx` line 8
  ```ts
  import { mockHostReels } from "@/data/mockHostData";
  ```
- The `useHostReels` hook **exists** but is **never imported or used** in Host.tsx
- Stats are calculated from `mockHostReels`, not from the database:
  ```ts
  const totalReels = mockHostReels.length;
  const totalViews = mockHostReels.reduce((acc, curr) => acc + curr.views, 0);
  const bookings = 12; // hardcoded
  ```

### CRIT-4: `AccommodationReelFlow.tsx` references undefined `galleryInputRef`
- **File:** `frontend/src/components/host/AccommodationReelFlow.tsx` line 404
  ```tsx
  ref={galleryInputRef}     // ← UNDEFINED — will crash at runtime
  onChange={handleFileSelect} // ← UNDEFINED — function doesn't exist
  ```
- The component declares `useRef` for `currentReelIdRef` but **never creates** `galleryInputRef`
- The `handleFileSelect` function is also **never defined** in this component
- **Impact:** If a host tries to upload from gallery in the accommodation flow, the app CRASHES

### CRIT-5: `useReels` search filter uses `.ilike('experience.title', ...)` — this is INVALID PostgREST syntax
- **File:** `frontend/src/hooks/useReels.ts` line 57
  ```ts
  query = query.ilike('experience.title', `%${search}%`);
  ```
- Supabase PostgREST **does not support** `.ilike()` on joined/embedded columns. This will silently return 0 results whenever a search query is entered on the Discover page.
- **Impact:** Search on Discover page is completely non-functional

---

## 🟡 MAJOR ISSUES (Hardcoded / Wrong Data)

### MAJ-1: Category mismatches between upload and display
| Surface | Categories Available | Mismatch Notes |
|---------|---------------------|----------------|
| **Host Upload** (`hostConstants.ts`) | hotel, villa, apartment, boats, food, drinks, rentals, adventure, parks_camps, tours, events | ✅ Full set |
| **CityPulse categories** | all, boats, food, nightlife, bikes, drinks | ❌ Missing: hotel, villa, apartment, adventure, tours, events, parks_camps, rentals. Added: nightlife, bikes (don't exist in upload!) |
| **Discover categories** | all, hotel, villa, apartment, boats, food | ❌ Missing: drinks, rentals, adventure, parks_camps, tours, events |
| **ReelCard interface** | hotel, villa, boat, tour, event, apartment, food, drinks, rentals, adventure, camps | ❌ Uses `boat` (singular) but upload uses `boats` (plural). Uses `camps` but upload uses `parks_camps` |
| **Reel Specifications** (`reelSpecifications.ts`) | boats, food, drinks, rentals, adventure, parks_camps, tours, events | ❌ Missing: hotel, villa, apartment (accommodation categories have NO spec!) |

**Bottom line:** A host could upload a `tours` reel but it would NEVER appear on CityPulse or Discover because those pages don't filter for `tours`.

### MAJ-2: `mockReels.ts` still exists with 20 hardcoded reels — but is NOT imported anywhere
- **File:** `frontend/src/data/mockReels.ts` — 407 lines of hardcoded fake data
- All `videoUrl` fields are **empty strings** `""` — so even if they were used, videos wouldn't play
- The file is imported nowhere currently (good), but its existence is technical debt

### MAJ-3: `useReels` hook doesn't re-fetch when `search` changes
- **File:** `frontend/src/hooks/useReels.ts` line 97
  ```ts
  }, [category, experienceId]);  // ← `search` is NOT in dependency array!
  ```
- If user types a search query, the hook never re-fetches — data goes stale

### MAJ-4: Price shows `$` instead of `KES` in ReelCard
- **File:** `frontend/src/components/reels/ReelCard.tsx` line 289
  ```tsx
  ${reel.price}
  ```
- Discover page correctly shows `KES {reel.price.toLocaleString()}` but the reels feed (Home page and CityPulse) show `$` prefix instead
- This is a Kenyan-market app — wrong currency symbol everywhere on the main feed

### MAJ-5: Likes/saved are completely fake — purely client-side state
- **File:** `frontend/src/hooks/useReels.ts` lines 77-78
  ```ts
  likes: 0, // "In production, this would come from a 'likes' table or counter"
  saved: false, // "In production, this would be checked against user's saved items"
  ```
- `ReelCard` toggles likes/saves in local React state — NOTHING is persisted to database
- There is no `likes` table, no `saved_reels` table, no RPC

### MAJ-6: Host avatar falls back to dicebear — no real avatar system
- **File:** `frontend/src/hooks/useReels.ts` line 80
  ```ts
  hostAvatar: item.host?.metadata?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.id
  ```

### MAJ-7: The `useReels` hook joins on `host:profiles(...)` using an implicit FK on `user_id`
- The Supabase table `reels` has `user_id` referencing `auth.users`, NOT `profiles`
- The PostgREST join `host:profiles(...)` uses the foreign key between `reels.user_id` and `profiles.id`
- This ONLY works if `profiles.id` matches `auth.users.id` — verify this FK exists

### MAJ-8: `MiniVideoEditor.tsx` has a DUPLICATE import that would cause build error
- **File:** `frontend/src/components/video-editor/MiniVideoEditor.tsx` lines 10 and 18
  ```ts
  import { ReelScorePreview, ScoreBreakdown, calculateOverallScore } from "./ReelScorePreview"; // line 10
  import { ScoreBreakdown } from "@/types/host"; // line 18 — DUPLICATE name!
  ```
- `ScoreBreakdown` is imported from TWO different sources — TypeScript will error or shadow

### MAJ-9: No file size limit or MIME type restriction on `reels` storage bucket
- **Evidence:** `file_size_limit: null, allowed_mime_types: null`
- Anyone can upload any file type of any size to the reels bucket
- Should be restricted to `video/mp4, video/webm` and something like 100MB max

---

## 🟡 MINOR ISSUES

### MIN-1: `reelExpiry.ts` exists in TWO locations
- `frontend/src/utils/reelExpiry.ts`
- `src/utils/reelExpiry.ts`
- Duplicate files — which one is canonical?

### MIN-2: Multiple hooks/data files duplicated between `src/` and `frontend/src/`
- `src/hooks/useReels.ts` AND `frontend/src/hooks/useReels.ts`
- `src/data/mockReels.ts` AND `frontend/src/data/mockReels.ts`
- `src/components/reels/ReelCard.tsx` AND `frontend/src/components/reels/ReelCard.tsx`
- This is confusing and error-prone

### MIN-3: `CreateReelDialog` non-accommodation flow hardcodes fallback values
- **File:** `CreateReelDialog.tsx` lines 141-142
  ```ts
  entity_name: "Local Experience",  // hardcoded
  title: title || "New Coastal Activity",  // bad default
  location: location || "diani",  // hardcoded default
  ```

### MIN-4: No upload progress indicator
- Video files can be large (20s of video = 5-30MB)
- No progress feedback during upload — user has no idea if it's working

### MIN-5: `ReelsFeed` has no empty state
- If `reels` array is empty, the feed shows absolutely nothing — no message, no CTA

### MIN-6: `handleFileSelect` in `AccommodationReelFlow` doesn't exist
- Referenced on line 405 but never declared as a function

---

## 📊 DATA FLOW DIAGRAM (How it SHOULD work vs. How it ACTUALLY works)

### Expected Flow:
```
Host selects category → Fills details → Records/uploads video
  → Video uploaded to Supabase Storage ✅
  → Experience row INSERT ❌ (0 rows exist)
  → Reel row INSERT ❌ (0 rows exist, blocked by RLS if experience fails)
  → useReels() fetches from reels table ❌ (empty)
  → Home/Discover/CityPulse display reels ❌ (nothing to show)
```

### Actual State:
```
Storage: 20 .webm files uploaded ✅
experiences table: 0 rows ❌
reels table: 0 rows ❌
Home page: Empty spinner → no reels
CityPulse: "No live reels for this category yet"
Discover: "No experiences found"
Host Dashboard: Shows FAKE mock data, not real data
```

---

## 🔧 FIX PRIORITY ORDER

### Phase 1: Make the pipeline actually WORK (Day 1)
1. **FIX AccommodationReelFlow.tsx** — Add missing `galleryInputRef` and `handleFileSelect`
2. **FIX MiniVideoEditor.tsx** — Remove duplicate `ScoreBreakdown` import
3. **FIX Host.tsx** — Replace `mockHostReels` with `useHostReels` hook
4. **DEBUG & FIX experience/reel INSERT** — The INSERT chain is failing. Add proper error surfacing.
5. **FIX useReels dependency array** — Add `search` to deps
6. **FIX category alignment** — Standardize categories across all surfaces

### Phase 2: Make it robust (Day 2)
7. **Fix price display** — KES not $ in ReelCard
8. **Fix search** — Replace `.ilike('experience.title', ...)` with a proper RPC or filter
9. **Add storage restrictions** — File size limit + MIME type filter
10. **Remove `mockReels.ts`** — Dead code
11. **Add upload progress indicator**
12. **Add empty states** to ReelsFeed and Host dashboard

### Phase 3: Polish (Day 3)
13. Clean up duplicate files between `src/` and `frontend/src/`
14. Add proper likes/saved persistence (DB tables + hooks)
15. Add real avatar system
16. Add thumbnail generation from video frames

---

## 🗄️ DATABASE STATE SUMMARY

| Table | Row Count | Status |
|-------|-----------|--------|
| `reels` | 0 | ❌ Empty |
| `experiences` | 0 | ❌ Empty |
| `profiles` | ? | Unchecked |
| Storage `reels` bucket | 20 files (.webm) | ✅ Has data |

### RLS Policies (Correct but cascading failure):
- `experiences`: INSERT requires `auth.uid() = user_id` ✅ (correct)
- `reels`: INSERT requires `auth.uid() = user_id` AND experience must exist and be owned by user ✅ (correct, but cascading)
- Storage `reels`: Authenticated users can upload ✅ (working)
- Storage `reels`: Public read access ✅ (working)

---

**This pipeline needs emergency fixes. Nothing uploaded by hosts is making it to the database, and even the Host Dashboard is showing fake data. The display surfaces are correctly wired to `useReels` (which queries the database), but since the database is empty, users see nothing.**
