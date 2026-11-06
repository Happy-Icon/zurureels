# Comprehensive AI Production Audit Report: ZuruSasa Mobile

**Project**: ZuruSasa Mobile (`artifacts/zurusasa-mobile`)  
**Audit Date**: November 5, 2026  
**Auditor**: Teamwork Unified Audit Taskforce (Spec Miner, Explorer 1, Explorer 2, Report Worker)  
**Execution Mode**: Static Analysis, Repository Mining, Architecture Tracing & Live Edge Service Probing  
**Integrity Mode**: Read-Only / Zero Application Code Modifications  
**Target Deliverable**: `docs/ai_production_audit_report.md`  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [AI Feature Inventory](#2-ai-feature-inventory)
3. [Mock and Placeholder Findings](#3-mock-and-placeholder-findings)
4. [Intelligence and Response Quality Audit](#4-intelligence-and-response-quality-audit)
5. [Data Grounding and Authority Separation Audit](#5-data-grounding-and-authority-separation-audit)
6. [Technical, Architectural, and Security Findings](#6-technical-architectural-and-security-findings)
7. [Live End-to-End Test Results](#7-live-end-to-end-test-results)
8. [Prioritized Remediation Roadmap (P0–P3)](#8-prioritized-remediation-roadmap-p0p3)

---

## 1. Executive Summary

### 1.1 Overview & Production Readiness Assessment
A comprehensive, end-to-end audit was conducted across the ZuruSasa application codebase to evaluate every artificial intelligence (AI) feature, integration contract, data-grounding boundary, and conversational architecture. The investigation spanned mobile client interfaces (`app/ai/*`, `app/plan/*`, `components/ai/*`, `components/journey/*`), client services (`services/zuruAIService.ts`, `services/zuruPlanService.ts`, `services/searchService.ts`, `services/filterService.ts`), React hooks (`lib/zuruAI.ts`, `hooks/usePersonalizedFeed.ts`), Supabase Edge Functions (`supabase/functions/zuru-ai/*`, `supabase/functions/redis-cache/*`), and PostgreSQL migrations (`supabase/migrations/*`).

**Overall Readiness Status**: **NOT PRODUCTION-READY (DEGRADED / PARTIAL)**  
While the architectural foundation demonstrates exemplary data grounding and security isolation (zero client key leakage and strict separation of financial authority), the core AI layer is currently operating in an unannounced degraded state. The application relies heavily on deterministic heuristic fallbacks, hardcoded string templates, and pseudo-random slot filling, while presenting user interfaces branded as cutting-edge AI.

### 1.2 Scorecard & Key Metrics

| Dimension | Rating | Production Status | Core Finding |
| :--- | :---: | :---: | :--- |
| **Secret & Credential Isolation** | **10/10** | **PASS** | Zero AI provider secrets in client bundle. All credentials isolated server-side. |
| **Financial & Booking Authority** | **10/10** | **PASS** | AI model has 0% authority over pricing, quotes, availability, or payments. PostgreSQL RPCs and GiST exclusion constraints strictly govern state. |
| **Listing Data Grounding** | **9/10** | **PASS** | 100% of listing cards map to authentic database UUIDs in `public.reels` and `public.experiences`. AI only outputs search criteria. |
| **External AI Provider Contract** | **2/10** | **CRITICAL FAIL** | Model identifier `claude-fable-5-1` is unrecognized by Anthropic Messages API. Calls fail with HTTP 400 and silently fall back to regex parser. |
| **Conversational Intelligence** | **3/10** | **FAIL** | Operates on rule-based keyword matching. Spurious substring bug matches `ac` in words like "peaceful" to demand Air Conditioning. |
| **Itinerary Generation (ZuruPlan)** | **1/10** | **MOCKED** | Billed as AI, but generates itineraries via procedural modulo loops over categories. Single-day regeneration uses `Math.random()`. |
| **Conversation State Persistence** | **2/10** | **FAIL** | Ephemeral React `useState`. Navigating away or restarting app completely erases conversation history. Context window capped at 2–3 turns. |
| **Streaming UX Delivery** | **4/10** | **PARTIAL** | Server implements Server-Sent Events (SSE), but LLM call is non-streaming. Main chat client omits `onTextDelta`, freezing UI until completion. |

### 1.3 Major Risks Summary
1. **The "Fable 5.1" Model Discrepancy (P0)**: The Supabase Edge Function `zuru-ai` defaults to `FABLE_MODEL=claude-fable-5-1` calling `https://api.anthropic.com/v1/messages`. Because `claude-fable-5-1` is not a registered Anthropic model, all live requests throw errors. The system silently catches these errors and switches to a brittle regex parser (`fallbackIntentParser`), while the mobile UI displays a badge asserting `"FABLE 5.1"`.
2. **Context Loss & Volatility (P0)**: Travelers lose their ongoing conversation every time they navigate away from `/ai/chat` or `/plan/agent`. Furthermore, the client truncates history to only the last 4 messages (2 user turns), preventing any sustained travel planning dialogue.
3. **Conversational Disconnect in Trip Planning (P1)**: When a traveler plans a trip using the Zuru Agent in `app/plan/agent.tsx` and taps "Generate Full Itinerary", the agent extracts basic destination and duration values, completely discards all conversational preferences (dietary, pace, party details), and invokes a procedural slot filler with hardcoded default interests (`['beaches', 'dhow_cruises', 'seafood_dining']`).
4. **Deceptive AI Badging (P1)**: In `components/journey/JourneyCompanionSheet.tsx`, a card labeled "AI Travel Insights" with a sparkle icon displays static strings ("Recommended departure: 1:45 PM for a 3:00 PM check-in") and provides a "Save Offline" button that executes a dummy alert with zero persistence.

---

## 2. AI Feature Inventory

A comprehensive catalog of all 9 AI-powered and AI-labeled features across the client, backend, and database:

| # | Feature Name | Code Location | User-Facing Purpose | Model & Provider | Endpoint / Service | Data Sources | Operational Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Zuru Agent Chat** | `app/ai/chat.tsx:39–374`<br>`lib/zuruAI.ts:20–130`<br>`services/zuruAIService.ts:58–235`<br>`supabase/functions/zuru-ai/index.ts:523–662` | Conversational travel concierge for Kenyan stays, villas, coastal getaways, boat rides, and dining. Supports multi-turn dialogue, listing cards, and quick actions. | Fable 5.1 (`claude-fable-5-1` via Anthropic Messages API) | `POST /functions/v1/zuru-ai`<br>(`action: "discover"`) | `public.reels`, `public.experiences`, `public.profiles` | **Genuine Design / Degraded Runtime**: Backend AI tool-calling grounded in real database rows. Currently running on regex fallback due to unconfigured/invalid model ID. Streaming delta missing in client hook. |
| **2** | **Reel Concierge Pill** | `components/ReelCard.tsx:697–714` | Contextual pill badge (`✨ Ask Zuru Agent`) overlaid on video reels. Navigates directly into `/ai/chat` prefilled with listing details. | Contextual Pre-Prompting | Client router push: `/ai/chat?initialPrompt=...` | Active reel entity (`exp.title`, `exp.location`) | **Genuine**: Seamlessly bridges discovery feed to conversational assistant with verified entity context. |
| **3** | **Discover Natural Search** | `services/searchService.ts:37–102`<br>`app/(tabs)/discover.tsx:110–129` | Converts free-form search input (e.g., "diani beachfront villa under 20k") into structured search filters. | Fable 5.1 (`ExtractedSearchCriteria`) | `zuruAIService.discover` + `parseNaturalLanguageQuery` fallback | In-memory filter state + Supabase | **Genuine with Dual-Stage Fallback**: Executes synchronous regex parsing locally, then attempts async AI refinement against Edge Function. |
| **4** | **ZuruFlow Feed Personalization** | `supabase/functions/zuru-ai/index.ts:665–766`<br>`hooks/usePersonalizedFeed.ts:19–88`<br>`services/zuruAIService.ts:241–294` | Re-ranks video reels feed based on dynamic traveler affinity weights extracted from likes and saves. | Fable 5.1 (`PERSONALIZATION_TOOL`) | `POST /functions/v1/zuru-ai`<br>(`action: "personalize_feed"`) | `public.reel_likes`, `public.reel_saves`, Redis cache | **Genuine**: Analyzes up to 25 likes and 25 saves server-side. Falls back to normalized interaction frequency scoring if LLM fails. Cached in client memory for 1 hour. |
| **5** | **Zuru Agent Trip Planner** | `app/plan/agent.tsx:41–460` | Chat-based itinerary planning assistant ("Online Coastal Concierge"). Gathers trip details and generates candidate stays. | Fable 5.1 / Keyword Regex | `zuruAIService.discover` + `fetchCandidateExperiences` | Supabase `experiences` table | **Partial / Misleading**: Conversational chat connects to AI, but "Generate Full Itinerary" discards conversation context and triggers hardcoded procedural slot filler. |
| **6** | **ZuruPlan Guided Trip Builder** | `app/plan/builder.tsx:43–477`<br>`services/zuruPlanService.ts:249–438` | Step-by-step trip generator constructing multi-day schedules partitioned into morning, afternoon, and evening slots. | **None** (Procedural rule-based slot filler) | Local client service `zuruPlanService` | Supabase `experiences` table | **Mocked / Non-AI**: Branded as "AI-Powered", but operates purely on deterministic modulo array indexing over candidate categories. |
| **7** | **Single-Day Regenerator** | `app/plan/[id].tsx:124–137`<br>`services/zuruPlanService.ts:443–513` | "Regenerate Day" feature on itinerary cards to replace scheduled activities with alternative coastal experiences. | **None** (`Math.random()` shuffle) | Local client service `zuruPlanService` | Supabase `experiences` table | **Mocked / Non-AI**: Replaces activity items using `sort(() => 0.5 - Math.random())`. Zero AI reasoning, preference adaptation, or schedule conflict resolution. |
| **8** | **Agent Itinerary Modifier Sheet** | `components/plan/AgentItinerarySheet.tsx:31–308`<br>`app/plan/[id].tsx:166–204` | Bottom sheet modal allowing travelers to ask Zuru Agent for specific itinerary additions (e.g. "sunset dhow cruise"). | Fable 5.1 / Rule-based fallback | `zuruAIService.discover` + `fetchCandidateExperiences` | Supabase `experiences` table | **Partial / Flawed**: Discovers genuine listings via AI, but inserting into itinerary unconditionally hardcodes `timeSlot: 'afternoon'` at `02:30 PM` and rating `4.9`. |
| **9** | **Dead Preferences & Features** | `app/profile/translation.tsx:20–100`<br>`app/profile/privacy.tsx:356–380`<br>`components/journey/JourneyCompanionSheet.tsx:292–303`<br>`components/ZuruAgentChat.tsx:40–208` | Profile settings for automatic translation and AI data sharing; journey AI insights; discover modal chat. | **None** | Client components | Supabase `profiles` columns | **Nonfunctional / Mocked**: Automatic translation has zero translation code; AI privacy toggle is ignored by services; Journey Insights uses hardcoded strings; Discover modal chat is dead code. |

---

## 3. Mock and Placeholder Findings

A rigorous audit identified multiple instances across the mobile codebase where simulated logic, random shuffles, static templates, or silent fallbacks operate under the guise of artificial intelligence.

### 3.1 ZuruPlan: Procedural Heuristic Slot Filling Masquerading as AI Itinerary Generation
- **Files**: `services/zuruPlanService.ts` (lines 249–438), `app/plan/agent.tsx` (lines 248–258), `app/plan/builder.tsx` (lines 90–119).
- **Audit Observation**: Billed in marketing and UI as "Powered by ZuruPlan Intelligence", itinerary creation does not invoke any LLM or AI model. It fetches candidate experiences and partitions them into categories using simple string substring checks:
  ```typescript
  // services/zuruPlanService.ts:257-278
  const stays = candidateExperiences.filter((e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      cat.includes('stay') || cat.includes('villa') || cat.includes('resort') ||
      cat.includes('hotel') || cat.includes('cottage') || cat.includes('apartment') ||
      cat.includes('rentals')
    );
  });
  const diningAndEvents = candidateExperiences.filter((e) => {
    const cat = (e.category || '').toLowerCase();
    return (
      cat.includes('events') || cat.includes('drinks') || cat.includes('food') || cat.includes('dining')
    );
  });
  const activities = candidateExperiences.filter(
    (e) => !stays.includes(e) && !diningAndEvents.includes(e)
  );
  ```
  The itinerary schedule is then constructed using modulo arithmetic loops over the partitioned arrays:
  ```typescript
  // services/zuruPlanService.ts:327-330 & 378-382
  const morningExp = activities[activityIndex % Math.max(1, activities.length)] || ...;
  activityIndex++;

  const eveningExp = diningAndEvents[diningIndex % Math.max(1, diningAndEvents.length)] || ...;
  diningIndex++;
  ```
  Day themes and activity notes are static template strings hardcoded in TypeScript:
  ```typescript
  // services/zuruPlanService.ts:300-305 & 407
  let dayTheme = `Day ${day} in ${destinationConfig.name}`;
  if (day === 1) dayTheme = 'Arrival, Check-in & Sunset Coast';
  else if (day === prefs.durationDays) dayTheme = 'Morning Relaxation & Departure';
  else if (day === 2) dayTheme = 'Ocean Adventures & Marine Excursions';
  else if (day === 3) dayTheme = 'Swahili Heritage, Cuisine & Local Life';
  else dayTheme = `Coastal Discovery & Hidden Gems — Day ${day}`;

  notes: `Enjoy your ${dayTheme.toLowerCase()}. Remember sunblock and local shillings for tips.`
  ```
- **Disconnection from Conversational Dialogue**:
  In `app/plan/agent.tsx`, a traveler can chat with the agent about specific travel requirements (e.g., "traveling with an elderly parent who needs wheelchair access", "strict halal dining only"). However, when the user taps `Generate Full Itinerary` (`handleBuildFullItinerary`, lines 248–258), the function completely discards the conversation history:
  ```typescript
  // app/plan/agent.tsx:248-258
  const prefs: TripPreferences = {
    destinationId: currentDestination,
    destinationName: destDisplayName,
    durationDays: extractedDuration,
    adultsCount: extractedGuestCount,
    childrenCount: 0,
    budgetTier: 'comfort',
    interests: ['beaches', 'dhow_cruises', 'seafood_dining'], // HARDCODED INTERESTS!
  };
  const trip = await zuruPlanService.generateItineraryFromPreferences(prefs);
  ```
  All user nuances are wiped out and replaced with default interests and comfort tier.

### 3.2 Single-Day Itinerary Regeneration via Pseudo-Random Shuffling
- **File**: `services/zuruPlanService.ts` (lines 443–513)
- **Audit Observation**: Tapping "Regenerate Day" on an itinerary card claims to use AI to find smart alternative schedules. In reality, it performs a client-side array shuffle using `Math.random()`:
  ```typescript
  // services/zuruPlanService.ts:451-455
  const currentDay = trip.days[dayIndex];
  // Shuffle candidates to pick fresh ones
  const shuffled = [...candidateExperiences].sort(() => 0.5 - Math.random());
  const replacement1 = shuffled[0];
  const replacement2 = shuffled[1] || shuffled[0];
  ```
  Zero intelligence, weather checking, location clustering, or preference adaptation occurs.

### 3.3 Hardcoded "AI Travel Insights" in Journey Companion
- **File**: `components/journey/JourneyCompanionSheet.tsx` (lines 292–303, 342)
- **Audit Observation**: The Journey Companion bottom sheet displays a card with a creation sparkle icon titled "AI Travel Insights". The content is completely static:
  ```tsx
  // components/journey/JourneyCompanionSheet.tsx:292-303
  {/* ── AI TRAVEL INSIGHTS ───────────────────────────────── */}
  <View style={styles.insightCard}>
    <View style={styles.insightHeader}>
      <MaterialCommunityIcons name="creation" size={16} color={ORANGE} />
      <Text style={styles.insightTitle}>AI Travel Insights</Text>
    </View>
    <Text style={styles.insightBody}>
      • {trafficCond} traffic along the coastal highway. {trafficCond === 'Light' ? 'Great conditions for travel.' : 'Consider leaving 15 min early.'}
      {'\n'}• Route distance: {routeInfo?.distanceText || `${distanceKm} km`} via the main highway.
      {'\n'}• Recommended departure: 1:45 PM for a {checkInTime} check-in.
    </Text>
  </View>
  ```
  The departure time is fixed at "1:45 PM" for a "3:00 PM check-in" regardless of real distance, live traffic, or user schedule.
  Furthermore, line 342 provides a simulated offline save button:
  ```tsx
  // components/journey/JourneyCompanionSheet.tsx:342
  onPress={() => Alert.alert('Saved Offline 💾', 'Route and itinerary saved for offline access.')}
  ```
  This triggers an alert dialog but performs no offline caching or data storage.

### 3.4 Hardcoded Afternoon Slot Allocation in Agent Itinerary Sheet
- **File**: `components/plan/AgentItinerarySheet.tsx` (lines 95–115)
- **Audit Observation**: When adding an AI-recommended activity to an existing itinerary day, the time slot, time label, and rating are hardcoded:
  ```typescript
  // components/plan/AgentItinerarySheet.tsx:97-108
  const newItem: ItineraryItem = {
    id: `act-${exp.id}-agent-${Date.now()}`,
    timeSlot: 'afternoon',
    timeLabel: '02:30 PM',
    title: exp.title || 'Coastal Experience',
    description: exp.description || `Special experience added via Zuru Agent in ${trip.destination}.`,
    location: exp.location || undefined,
    type: 'activity',
    experienceId: exp.id,
    experienceTitle: exp.title,
    experienceImageUrl: exp.image_url,
    rating: 4.9, // Hardcoded fallback rating
    estimatedPriceKes: Number(exp.current_price || 0),
    isBookable: true,
  };
  ```
  Even if the traveler asked for a sunrise breakfast or late-night club, the item is unconditionally scheduled for 02:30 PM afternoon.

### 3.5 Silent Fallbacks Masking AI Errors in Conversational Plan Agent
- **File**: `app/plan/agent.tsx` (lines 206–223)
- **Audit Observation**: When an AI request fails or times out, the component catches the error, suppresses user notification, and injects a fake canned message:
  ```typescript
  // app/plan/agent.tsx:206-222
  } catch (err) {
    console.warn('AI discover error, using live candidate experiences fallback:', err);
    const fallbackExps = await zuruPlanService.fetchCandidateExperiences('Diani Beach');
    setCandidateExperiences(fallbackExps.slice(0, 3));
    setMessages((prev) =>
      prev.map((m) =>
        m.id === agentMsgId
          ? {
              ...m,
              text:
                m.text ||
                "I've searched our real coastal Kenya database for you! Here are verified stays and excursions:",
              suggestedExperiences: fallbackExps.slice(0, 3),
            }
          : m
      )
    );
  }
  ```
  The user is misled into believing the assistant successfully processed their prompt.

### 3.6 Fake Algorithmic Metrics in Filter Service
- **File**: `services/filterService.ts` (lines 285, 294–301)
- **Audit Observation**: The filter service implements "Popular" sort by ordering video reels by video duration in seconds:
  ```typescript
  // services/filterService.ts:294-295
  case 'popular':
    return (b.duration || 0) - (a.duration || 0);
  ```
  Longer videos are treated as "more popular". "Recommended" sort is a standard descending sort on rating (`ratingB - ratingA`). If rating metadata is missing, it falls back to a hardcoded `4.9` (line 285).

### 3.7 Hardcoded Listing Counts in Search Service
- **File**: `services/searchService.ts` (lines 13–19)
- **Audit Observation**: Popular destination listing metrics are static hardcoded strings:
  ```typescript
  export const POPULAR_DESTINATIONS = [
    { id: 'diani', name: 'Diani Beach', count: '142 stays', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400' },
    { id: 'mombasa', name: 'Mombasa City', count: '98 stays', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400' },
    { id: 'watamu', name: 'Watamu', count: '64 stays', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400' },
    { id: 'lamu', name: 'Lamu Island', count: '38 stays', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=400' },
    { id: 'nairobi', name: 'Nairobi', count: '210 stays', image: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=400' },
  ];
  ```
  These numbers do not reflect live inventory counts in the database.

### 3.8 Fallback Parser Substring Bugs & Fabricated Ratings
- **File**: `supabase/functions/zuru-ai/index.ts` (lines 259, 373–374, 447–448)
- **Audit Observation**:
  1. **Air Conditioning Substring Match**:
     ```typescript
     // supabase/functions/zuru-ai/index.ts:259
     if (q.includes('ac') || q.includes('air conditioning')) amenities.push('Air Conditioning');
     ```
     Because it checks `q.includes('ac')`, any English word containing the letters "ac" triggers an amenity filter for `Air Conditioning`. A query for "peaceful stay", "beach villa", or "coastal accommodation" silently requires air conditioning.
  2. **Fabricated Fallback Ratings**:
     ```typescript
     // supabase/functions/zuru-ai/index.ts:373-374 & 447-448
     const rating = typeof meta.rating === 'number' ? meta.rating : 4.9;
     const reviewCount = typeof meta.review_count === 'number' ? meta.review_count : 18;
     ```
     Any listing lacking explicit review metadata is displayed with a `4.9` star rating and `18 reviews`.

### 3.9 Dead Preferences and Unreachable Code
1. **Automatic Translation Settings (`app/profile/translation.tsx:20–100`)**: The profile toggle saves `auto_translate` to `profiles.translation_settings`, but no translation API, service, or integration exists anywhere in the repository.
2. **AI Improvement Privacy Toggle (`app/profile/privacy.tsx:356–380`)**: Toggles `profiles.privacy_settings.ai_improvement`, but neither client services nor Edge Functions inspect or honor this setting.
3. **Unreachable Discover Chat Modal (`app/(tabs)/discover.tsx:80, 485–489`)**: `<ZuruAgentChat visible={chatOpen} />` is embedded in the Discover screen, but `chatOpen` is initialized to `false` and has zero triggers that set it to `true`.

---

## 4. Intelligence and Response Quality Audit

### 4.1 Natural Language Understanding and Intent Extraction
The application was designed to use Fable 5.1 / Claude tool calling to extract structured travel parameters. However, in its active fallback state, the system relies on `fallbackIntentParser` (`supabase/functions/zuru-ai/index.ts:211–289`):
- **City Matching**: Limited to an 8-item array (`diani`, `mombasa`, `watamu`, `lamu`, `nairobi`, `naivasha`, `malindi`, `mara`). Any mention of Tsavo, Amboseli, Samburu, Kisumu, or Kilifi is unrecognized.
- **Budget Extraction**: Handled via regex `/(?:under|below|less than|max|<)\s*(?:kes|ksh)?\s*(\d+)(k)?/i`. Phrases like "cheap", "affordable", "luxury", or "budget-friendly" without a number yield `budget_max: null`.
- **Complex Colloquial Queries**: As demonstrated in live probing Test 2, a query like *"I'm looking for a chill spot to celebrate my anniversary with my wife next month, something peaceful with good sunset views"* extracts zero location, zero category, zero budget, and incorrectly extracts `amenities: ["Air Conditioning"]` due to the substring match on "peaceful".

### 4.2 Multi-Turn Context Retention and History Truncation
- **Client Truncation**: `lib/zuruAI.ts:60` passes only the last 4 messages to the API:
  ```typescript
  const history = messages.slice(-4).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));
  ```
- **Server Truncation**: `supabase/functions/zuru-ai/index.ts:534` further bounds history to 6 turns (`body.history.slice(-6)`).
- **Context Loss**: Any constraint expressed more than 2 user turns ago (e.g., party size, dates, budget ceiling) is discarded from the context window.

### 4.3 Missing Detail Elicitation & Clarification
- When a traveler provides incomplete requirements (e.g., "Find me a villa"), the system does not ask clarifying questions (such as desired location, travel dates, or guest count).
- Instead, the fallback parser immediately returns all experiences matching the keyword "villa" across Kenya, accompanied by static follow-up suggestions (`['Cheaper options', 'Near the beach', 'With a private pool', 'Under KES 10,000']`).

### 4.4 Preference Adaptation vs Hardcoded Presets
- The conversational planner in `app/plan/agent.tsx` asks users about destination and duration, but when generating the final itinerary, it overrides user intent with hardcoded presets:
  - `adultsCount`: derived from basic number regex, defaults to 2.
  - `childrenCount`: hardcoded to `0`.
  - `budgetTier`: hardcoded to `'comfort'`.
  - `interests`: hardcoded to `['beaches', 'dhow_cruises', 'seafood_dining']`.
- If the traveler explicitly stated they dislike seafood or wanted cultural walking tours, the generated itinerary still prioritizes seafood restaurants and dhow excursions.

### 4.5 Distinguishing Known vs Unknown Facts
- In genuine Fable 5.1 tool calling, the system prompt instructs:
  *"NEVER invent fake listings, fake prices, or fake property names. Real listings will be retrieved from the database."* (`supabase/functions/zuru-ai/index.ts:547–548`).
- When running under `fallbackIntentParser`, the response strings are fixed templates:
  - `"Here are the best options in ${location} under KES ${budget_max}."`
  - `"I've searched our verified ZuruSasa experiences for you."`
- The system correctly refuses to hallucinate facts outside the database, but this safety is achieved via template rigidity rather than epistemic reasoning.

---

## 5. Data Grounding and Authority Separation Audit

### 5.1 Traceability to Real Supabase Entities
The ZuruSasa AI architecture establishes complete entity grounding. At no point does an LLM or client mock generate synthetic listings, inventory records, or property details.

```
┌────────────────────────────────────────────────────────┐
│                      USER PROMPT                       │
│      "Beachfront villa in Diani under 20k for 4"       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            ZURU-AI EDGE FUNCTION EXTRACTION            │
│  Location: "Diani", Category: "villa", Budget: 20000   │
└──────────────────────────┬─────────────────────────────┘
                           │ (Criteria only, NO listings generated)
                           ▼
┌────────────────────────────────────────────────────────┐
│           fetchVerifiedListings() DATABASE QUERY       │
│  1. SELECT reels JOIN experiences JOIN profiles        │
│     WHERE status IN ('active', 'published')            │
│  2. SELECT experiences WHERE availability = 'available'│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 REAL DATABASE ENTITIES                 │
│  experiences.id = "490dc6c6-9c44-469b-8cf6-..."       │
│  reels.id = "982cf0b5-7798-46eb-a4f6-..."             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                 INTERACTIVE CARD ACTION                │
│  "Book Now" ──► Mounts BookingSheet with verified ID   │
└────────────────────────────────────────────────────────┘
```

1. **Reels-First Experience Matching (`supabase/functions/zuru-ai/index.ts:308–317`)**:
   Queries `public.reels` joined with `public.experiences` and `public.profiles`. Every returned card corresponds to a live database record with authentic Cloudinary video URLs and host metadata.
2. **Direct Experience Fallback (`supabase/functions/zuru-ai/index.ts:402–406`)**:
   If no matching video reels exist, queries `public.experiences` directly with `availability_status in ('available', 'instant_book')`.

### 5.2 Financial and Availability Authority Separation
The AI model has **zero authority** over financial transactions, quotes, availability, or payment settlements. The application strictly delegates authority to database-level constraints and secure server-side procedures.

| Domain | Authority Holder | Enforcement Mechanism | AI Role |
| :--- | :--- | :--- | :--- |
| **Listing Prices** | Database (`public.experiences`) | `current_price` column in PostgreSQL | Read-only search filter criteria (`budget_max`) |
| **Price Calculations & Quotes** | Database RPC (`create_booking_quote`) | Server-side calculation in `202608010001_secure_booking_foundation.sql:9–36` | **Zero Role**: AI cannot generate or alter quotes |
| **Calendar Availability** | PostgreSQL GiST Exclusion Constraint | `booking_quotes_active_dates_excl` (`202608010001_secure_booking_foundation.sql:49–54`) | **Zero Role**: Physical storage engine prevents double bookings |
| **Payment Settlement** | PostgreSQL Function (`settle_paystack_success`) | `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO service_role` (`202611020001:258–259`) | **Zero Role**: Double-entry ledger updates locked to server role |
| **Host Payouts** | PostgreSQL Function (`schedule_pending_host_payouts`) | Background escrow release logic | **Zero Role** |

- **Quote Calculation Verification**:
  In `hooks/useBookingCheckout.ts` (lines 477–484), when the user proceeds to book an AI-recommended card, the app calls `supabase.rpc('create_booking_quote')`. The RPC queries `experiences` directly, computes guest service fees and taxes, and creates a locked quote for 15 minutes.
- **GiST Exclusion Constraint**:
  ```sql
  -- supabase/migrations/202608010001_secure_booking_foundation.sql:49-54
  alter table public.booking_quotes
    add constraint booking_quotes_active_dates_excl
    exclude using gist (
      experience_id with =,
      tstzrange(check_in, check_out, '[)') with &&
    ) where (status in ('quote_locked', 'payment_pending', 'payment_succeeded'));
  ```
  PostgreSQL at the database engine level guarantees that two overlapping bookings cannot exist for the same experience. The AI model has no mechanism to bypass or modify this constraint.

---

## 6. Technical, Architectural, and Security Findings

### 6.1 Server-Side Key Isolation vs Client Bundle Security
A complete scan of the client repository (`.env`, `.env.example`, `app.json`, and all TypeScript code) was performed for API credentials.
- **Client Security (PASS)**:
  - Zero third-party LLM keys (OpenAI, Anthropic, Fable, Google, Groq) exist in the client repository.
  - Client `.env` contains strictly public Expo variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_PERSONA_TEMPLATE_ID`.
  - All AI requests are routed exclusively to `${SUPABASE_URL}/functions/v1/zuru-ai`.
- **Server Secrets (PASS)**:
  - `FABLE_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and `PAYSTACK_SECRET_KEY` are isolated server-side within Supabase Edge Function environment variables (`Deno.env`).

### 6.2 Fable 5.1 API Contract and Model Identifier Discrepancy
- **Contract Header Format (`supabase/functions/zuru-ai/index.ts:140–161`)**:
  - `Content-Type`: `application/json`
  - `x-api-key`: `Deno.env.get('FABLE_API_KEY')`
  - `anthropic-version`: `2023-06-01`
  - Endpoint: `https://api.anthropic.com/v1/messages` (configurable via `FABLE_BASE_URL`)
- **Critical Model Identifier Flaw**:
  The default model identifier in `supabase/functions/zuru-ai/index.ts:148` is `'claude-fable-5-1'`.
  When sent to `https://api.anthropic.com/v1/messages`, the Anthropic API rejects the request:
  `HTTP 400 invalid_request_error: model not found: claude-fable-5-1`.
  Because `callFable51` is wrapped in a silent `try/catch` (lines 584–586 and 639–641):
  ```typescript
  try {
    criteria = await callFable51(systemPrompt, messages, DISCOVER_TOOL, 'search_travel_experiences');
  } catch (err: any) {
    console.warn('[ZuruAI] Fable 5.1 call failed or key missing, using fallback parser:', err?.message);
    criteria = fallbackIntentParser(message, userLocation);
  }
  ```
  The function silently falls back to the deterministic regex parser without raising an alert or notifying the user.

### 6.3 Rate Limiting and Token Management
- **Rate Limiting Engine**:
  - Enforced via Upstash Redis REST: `checkRateLimit(request, 'zuru_ai', 30, 60, authUserId)` in `supabase/functions/zuru-ai/index.ts:506`.
  - Enforces 30 requests per 60-second window per user or IP address.
  - **Fail-Open Policy**: In `supabase/functions/_shared/rateLimiter.ts:54–56`, if Upstash Redis credentials are unset or unreachable, the rate limiter returns `{ allowed: true }`, ensuring high availability.
- **Token Limits**:
  - Max input message length: 500 characters (`zuru-ai/index.ts:530–531`). Longer payloads are rejected with HTTP 400.
  - Max output tokens: 1,024 (`zuru-ai/index.ts:156`).
  - History truncation: Max 6 turns sent to model (`zuru-ai/index.ts:534`).

### 6.4 Conversation Session Volatility
- **Client In-Memory Storage**:
  - `lib/zuruAI.ts:21`: `const [messages, setMessages] = useState<AIMessage[]>([]);`
  - `app/plan/agent.tsx:54`: `const [messages, setMessages] = useState<AgentChatMessage[]>([...]);`
- **Zero Database Persistence**:
  - Supabase contains no tables for AI chat history (`ai_sessions`, `ai_messages`).
  - The existing `conversations` and `messages` tables are strictly user-to-host peer messaging channels.
  - Navigating back from `/ai/chat` or restarting the application completely destroys conversation state.
  - The "History" button in `app/ai/index.tsx:90` has no `onPress` callback attached.

### 6.5 Streaming Architecture: SSE Event Structure and Client Delta Disconnect
- **Server Implementation**:
  `supabase/functions/zuru-ai/index.ts:564–632` implements Server-Sent Events (SSE) returning `text/event-stream`.
  Stream sequence: `event: status (understanding)` &rarr; `event: status (searching)` &rarr; `event: result` &rarr; `event: done`.
- **Pseudo-Streaming**:
  The underlying LLM call (`callFable51`) is non-streaming (`await res.json()`). The server emits lifecycle stages, but conversational text is delivered in a single final block.
- **Client Delta Disconnect**:
  In `services/zuruAIService.ts:189–193`, the service parses `event: delta` and invokes `onTextDelta?.(data.delta)`.
  However, in `lib/zuruAI.ts:65–73` (the hook powering `/ai/chat`), `onTextDelta` is **not supplied**:
  ```typescript
  const res: ZuruAIDiscoverResponse = await zuruAIService.discover(text, {
    history,
    stream: true,
    userLocation: options?.userLocation,
    signal: controller.signal,
    onStatusChange: (status) => {
      setStageStatus(status);
    },
    // onTextDelta is completely missing!
  });
  ```
  Consequently, in the main chat screen, the user sees only the typing indicator and stage status until the full response finishes, defeating the purpose of streaming.

### 6.6 Input Validation and Injection Defenses
- **Payload Boundaries**: Rejects empty strings (HTTP 400) and payloads exceeding 500 characters (HTTP 400).
- **IDOR Protection in Feed Personalization**: In `supabase/functions/zuru-ai/index.ts:668–677`, the function verifies that `body.userId` matches the verified JWT `authUserId`. Unauthenticated users receive empty default affinities; cross-user profile queries return HTTP 403.
- **Prompt Injection Defense**: Tool-calling schemas constrain output to structured JSON parameters. The model cannot execute arbitrary SQL or shell commands.
- **Output Sanitization Gap**: The assistant's `conversational_response` is rendered in a native React Native `Text` component (immune to HTML XSS), but lacks filtering against social engineering, unsolicited phone numbers, or fraudulent payment URLs.

---

## 7. Live End-to-End Test Results

### 7.1 Test Methodology
Live end-to-end tests were executed against the active Supabase Edge Function `zuru-ai` at `https://rjzgzxxdrltlteeshtuw.supabase.co/functions/v1/zuru-ai` using the project's public anon key. The test suite covered standard discovery, colloquial phrasing, edge boundary conditions, streaming SSE delivery, unauthenticated guests, IDOR attempts, and error handling.

### 7.2 Detailed Results Matrix

| Test ID | Scenario | Input Payload | Observed HTTP Status & Response Summary | Operational Outcome | Evidence & Exact Cause |
| :-: | :--- | :--- | :--- | :---: | :--- |
| **TEST-01** | Typical Valid Search | `{"action":"discover", "message":"beach villa in diani under 15k", "stream":false}` | **HTTP 200 OK**<br>Criteria: `location: "Diani"`, `category: "villa"`, `budget_max: 15000`, `amenities: ["Beach Front", "Air Conditioning"]`.<br>Cards: 10 authentic database records returned with real UUIDs. | **PASSED** (Heuristic fallback) | Successfully parsed by `fallbackIntentParser` (`zuru-ai/index.ts:211–289`). Real listings fetched via `fetchVerifiedListings`. |
| **TEST-02** | Complex Colloquial Query | `{"action":"discover", "message":"I'm looking for a chill spot to celebrate my anniversary with my wife next month, something peaceful with good sunset views", "stream":false}` | **HTTP 200 OK**<br>Criteria: `location: null`, `category: null`, `budget_max: null`, `guests: null`, `amenities: ["Air Conditioning"]`.<br>Text: `"I've searched our verified ZuruSasa experiences for you."` | **FAILED** (Intelligence Quality) | **Substring Bug**: `q.includes('ac')` in `zuru-ai/index.ts:259` matched inside the word "peaceful", demanding AC. Zero semantic intent was extracted. |
| **TEST-03** | Empty Message Validation | `{"action":"discover", "message":"   ", "stream":false}` | **HTTP 400 Bad Request**<br>`{"error":"Message is required"}` | **PASSED** (Validation) | Enforced by validation in `zuru-ai/index.ts:526–527`. |
| **TEST-04** | Length Limit Overflow | `{"action":"discover", "message":"<501 'a' characters>", "stream":false}` | **HTTP 400 Bad Request**<br>`{"error":"Message exceeds 500 character limit"}` | **PASSED** (Validation) | Enforced by validation in `zuru-ai/index.ts:530–531`. |
| **TEST-05** | Invalid Action Router | `{"action":"unknown_action_xyz"}` | **HTTP 400 Bad Request**<br>`{"error":"Unknown action: unknown_action_xyz"}` | **PASSED** (Error Handling) | Enforced by default action router in `zuru-ai/index.ts:768`. |
| **TEST-06** | Feed Personalization (Guest) | `{"action":"personalize_feed"}` | **HTTP 200 OK**<br>`{"categoryAffinities":{}, "locationAffinities":{}, "source":"default"}` | **PASSED** (Auth Safety) | Unauthenticated guests receive empty weights to preserve chronological feed order (`zuru-ai/index.ts:672–676`). |
| **TEST-07** | Feed Personalization (Forged ID) | `{"action":"personalize_feed", "userId":"00000000-0000-0000-0000-000000000000"}` without JWT | **HTTP 200 OK**<br>`{"categoryAffinities":{}, "locationAffinities":{}, "source":"default"}` | **PASSED** (IDOR Defense) | Server ignores client-supplied `userId` unless confirmed by verified JWT `authUserId` (`zuru-ai/index.ts:668–670`). |
| **TEST-08** | Server-Sent Events (SSE) Stream | `{"action":"discover", "message":"sunset dhow cruise in mombasa", "stream":true}` | **HTTP 200 OK** (`Content-Type: text/event-stream`)<br>Stream sequence: `event: status (understanding)` &rarr; `event: status (searching)` &rarr; `event: result` &rarr; `event: done`. | **PASSED** (Transport) | Stream generated in `zuru-ai/index.ts:565–632`. Real Mombasa experiences streamed in chunk payload. |
| **TEST-09** | Malformed JSON Payload | Invalid non-JSON raw body sent to endpoint | **HTTP 400 Bad Request**<br>`{"error":"Invalid JSON body"}` | **PASSED** (Error Recovery) | Caught by `try/catch` JSON parsing block in `zuru-ai/index.ts:512–516`. |
| **TEST-10** | Live Fable 5.1 LLM Invocation | Direct Anthropic Messages API call with `claude-fable-5-1` | **HTTP 400 Bad Request**<br>`{"type":"error","error":{"type":"invalid_request_error","message":"model not found: claude-fable-5-1"}}` | **BLOCKED / FAILED** | Anthropic public API does not recognize `claude-fable-5-1`. Edge function automatically falls back to regex parser. |
| **TEST-11** | Client UI Token Streaming | Full interaction flow in `app/ai/chat.tsx` | Message bubble appears all at once after typing spinner completes. | **PARTIALLY PASSED** | SSE stream received from server, but `lib/zuruAI.ts` omits `onTextDelta`, blocking incremental token rendering. |
| **TEST-12** | Client UI Voice & Image Inputs | Tapping microphone or camera icons in `AIInputBar` | No visual feedback or action taken. | **NOT TESTED / BLOCKED** | Icons rendered in `AIInputBar.tsx`, but no handler props (`onVoice`, `onImage`) are passed from `chat.tsx`. |

---

## 8. Prioritized Remediation Roadmap (P0–P3)

### 8.1 Master Remediation Table

| Priority | Issue ID | Affected Feature | Exact File & Line Range | User & Product Impact | Recommended Correction | Dependencies |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- |
| **P0** | **REM-01** | External AI Model Contract | `supabase/functions/zuru-ai/index.ts:147–149` | Fable 5.1 fails with HTTP 400 against Anthropic; app silently runs on regex fallback. | Update `FABLE_MODEL` default to a valid Anthropic model (e.g. `claude-3-5-sonnet-20241022` or `claude-3-haiku-20240307`), or route `FABLE_BASE_URL` to an active Fable 5.1 gateway. | Supabase Edge Function Secrets (`FABLE_API_KEY`, `FABLE_MODEL`) |
| **P0** | **REM-02** | Conversation Persistence | `lib/zuruAI.ts:21, 60–63`<br>`app/ai/chat.tsx:48` | Conversation wiped on screen exit or app restart. Context limited to 2 turns. | Persist conversations to `AsyncStorage` or Supabase `ai_conversations`/`ai_messages` tables; pass session ID and extend context window to 10+ turns. | Database migration for `ai_conversations` (optional if local storage used) |
| **P1** | **REM-03** | ZuruPlan Conversational Disconnect | `app/plan/agent.tsx:248–258`<br>`services/zuruPlanService.ts:249–438` | User constraints discussed with agent (dietary, pace, party) are wiped; itinerary generated via procedural slot filler with hardcoded interests. | Have the agent generate structured `TripPreferences` via LLM tool-calling that reflect full conversation constraints before building itinerary. | Fable 5.1 / LLM Tool Calling |
| **P1** | **REM-04** | Client Streaming Text Delta Disconnect | `lib/zuruAI.ts:65–73`<br>`app/ai/chat.tsx:39–374` | User sees frozen typing indicator; full response renders all at once without streaming effect. | Wire `onTextDelta` callback from `zuruAIService.discover` into `useZuruAI()` to update active message bubble incrementally. | None (Client code edit) |
| **P1** | **REM-05** | Deceptive "AI Travel Insights" Card | `components/journey/JourneyCompanionSheet.tsx:292–303, 342` | Displays hardcoded "1:45 PM departure" string branded as AI; dummy "Save Offline" alert does nothing. | Relabel card to "Route Details" or connect to Google Distance Matrix / LLM transit agent. Remove fake offline save alert. | Google Maps Directions API |
| **P1** | **REM-06** | Deceptive AI Badging on Fallback | `app/ai/chat.tsx:228`<br>`supabase/functions/zuru-ai/index.ts:585` | Chat header displays "FABLE 5.1" badge even when running on rule-based regex fallback. | Return execution engine metadata (`engine: 'fable_5_1' | 'heuristic_fallback'`) in response; display "OFFLINE / HEURISTIC" badge when degraded. | `zuru-ai` Edge Function |
| **P2** | **REM-07** | Substring Bug in Fallback Parser | `supabase/functions/zuru-ai/index.ts:259` | Words like "peaceful" or "beach" spuriously trigger mandatory Air Conditioning amenity requirement. | Replace `q.includes('ac')` with regex word boundaries `/\bac\b/i` or `/\bair\s*conditioning\b/i`. | `zuru-ai` Edge Function |
| **P2** | **REM-08** | Single-Day Pseudo-Regeneration | `services/zuruPlanService.ts:443–513` | Day regeneration uses `Math.random()` shuffle with zero intelligence or conflict checking. | Invoke `zuruAIService.discover` with single-day parameters to fetch context-aware alternatives fitting the day's theme. | `zuruAIService` |
| **P2** | **REM-09** | Hardcoded Slot Allocation in Itinerary Sheet | `components/plan/AgentItinerarySheet.tsx:97–108` | Added experiences unconditionally hardcoded to afternoon `02:30 PM` with fake `4.9` rating. | Parse requested time slot from prompt or allow user to select slot; retrieve authentic rating from experience metadata. | None |
| **P2** | **REM-10** | Silent Fallback in Plan Agent | `app/plan/agent.tsx:206–223` | Swallows AI failures silently and displays fake canned assistant message with Diani listings. | Present an explicit error state with a retry button instead of a misleading silent fallback. | None |
| **P2** | **REM-11** | Output Content Safety & Sanitization | `supabase/functions/zuru-ai/index.ts:600` | Conversational response lacks filtering against prompt-injected phishing, phone numbers, or payment scams. | Implement regex filter stripping unsolicited phone numbers, external URLs, and payment handles from generated response. | None |
| **P3** | **REM-12** | Dead Translation & Privacy Toggles | `app/profile/translation.tsx:20–100`<br>`app/profile/privacy.tsx:356–380` | Non-functional translation switch; disconnected AI improvement privacy toggle. | Implement genuine translation Edge Function or mark "Coming Soon"; honor `ai_improvement` opt-out flag in AI telemetry. | External Translation Provider (e.g. DeepL / Google) |
| **P3** | **REM-13** | Unreachable Discover Chat Modal | `app/(tabs)/discover.tsx:80, 485–489` | `<ZuruAgentChat />` embedded in Discover is dead code that can never be opened. | Remove dead modal component or wire a button in Discover to open it. | None |
| **P3** | **REM-14** | Fake Metrics in Filter & Search Services | `services/filterService.ts:294–295`<br>`services/searchService.ts:13–19` | "Popular" sort uses video length in seconds; popular destinations use hardcoded listing counts. | Update "Popular" sort to real view/save engagement metrics; aggregate destination counts dynamically from database. | Database analytics |

---

### 8.2 Detailed Implementation Specifications for Critical Items

#### REM-01: Fix Fable 5.1 Model Identifier & Endpoint Routing (P0)
- **Current Defect**: `supabase/functions/zuru-ai/index.ts:148` defines:
  ```typescript
  const model = Deno.env.get('FABLE_MODEL') || 'claude-fable-5-1';
  ```
  Calling Anthropic directly causes `invalid_request_error: model not found`.
- **Remediation Code Change**:
  ```typescript
  // Update default model to a standard Anthropic model
  const model = Deno.env.get('FABLE_MODEL') || 'claude-3-5-sonnet-20241022';
  ```
  Ensure `FABLE_API_KEY` is configured in Supabase secrets via:
  `supabase secrets set FABLE_API_KEY=sk-ant-... FABLE_MODEL=claude-3-5-sonnet-20241022`.

#### REM-02: Implement Client Conversation Persistence & Context Expansion (P0)
- **Current Defect**: In `lib/zuruAI.ts:21`, messages reside only in `useState`. In line 60, context is limited to 4 messages.
- **Remediation Specification**:
  1. Store messages in `AsyncStorage` under key `@zuru_ai_chat_history_<userId>`.
  2. Hydrate messages on hook mount (`useEffect`).
  3. Increase context slice from 4 to 12 turns (`messages.slice(-12)`).
  4. Wire the "History" button in `app/ai/index.tsx:90` to display a drawer with previous sessions.

#### REM-03: Connect Conversational Planning to Structured Itinerary Generation (P1)
- **Current Defect**: `app/plan/agent.tsx:248–258` discards chat dialogue and invokes `generateItineraryFromPreferences` with hardcoded interests.
- **Remediation Specification**:
  Define an itinerary planning tool in `zuru-ai` (`PLAN_TRIP_TOOL`) that accepts the full conversation history and outputs structured `TripPreferences` containing extracted user constraints (budget, pace, accessibility, dietary restrictions, party breakdown). Pass these extracted preferences into `zuruPlanService`.

#### REM-04: Wire Incremental Streaming Text Delta in `lib/zuruAI.ts` (P1)
- **Current Defect**: In `lib/zuruAI.ts:65–73`, `onTextDelta` is omitted.
- **Remediation Code Change**:
  ```typescript
  // lib/zuruAI.ts
  const aiMsgId = `ai-${Date.now()}`;
  let accumulatedText = '';

  const res: ZuruAIDiscoverResponse = await zuruAIService.discover(text, {
    history,
    stream: true,
    userLocation: options?.userLocation,
    signal: controller.signal,
    onStatusChange: (status) => setStageStatus(status),
    onTextDelta: (delta) => {
      accumulatedText += delta;
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === aiMsgId);
        if (existing) {
          return prev.map((m) => (m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
        }
        return [...prev, { id: aiMsgId, role: 'ai', text: accumulatedText, timestamp: new Date() }];
      });
    },
  });
  ```

#### REM-07: Fix Substring Match Bug in Fallback Intent Parser (P2)
- **Current Defect**: `supabase/functions/zuru-ai/index.ts:259`:
  ```typescript
  if (q.includes('ac') || q.includes('air conditioning')) amenities.push('Air Conditioning');
  ```
- **Remediation Code Change**:
  ```typescript
  if (/\bac\b/i.test(q) || /\bair\s*conditioning\b/i.test(q) || /\ba\/c\b/i.test(q)) {
    amenities.push('Air Conditioning');
  }
  ```

---

## 9. Conclusion

The ZuruSasa application demonstrates high architectural maturity in its data-grounding and security boundaries: API keys are completely protected from the client bundle, database listings are strictly tied to real PostgreSQL rows, and financial transactions are guarded by database-level RPCs and exclusion constraints.

However, the user-facing AI experience is currently compromised by an invalid model identifier that forces silent regex fallbacks, procedural heuristics that masquerade as AI itinerary planning, volatile in-memory chat state, and misleading UI marketing elements. Executing the prioritized remediation roadmap (P0–P3) detailed in this report will bridge the gap between marketing claims and true production-grade artificial intelligence.
