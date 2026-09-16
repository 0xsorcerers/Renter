# Renter — PRD

## Original problem statement
Build "Renter", an Uber-like app for housing with a GenZ, colourful, glassmorphic UI. Homeowners post listing offers; tenants post acceptable offers beneath each listing. Google Maps to locate homes. Profiles for both roles with bio, phone and WhatsApp. Listing prices in the homeowner's local currency (Nigeria → ₦, China → ¥, US → $), priced per Week / Month / Year with the period emphasised beside the price. Tenants can review a place / homeowner; homeowners and other tenants can reply.

## User choices
- Auth: Email+password (JWT) **and** Emergent-managed Google login
- Listing photos: yes, via Emergent Object Storage
- Map: react-native-maps native + address autocomplete (Google Places → OSM/Photon fallback because the provided Google key has no billing enabled)
- Offers: view-only for homeowners, contact via WhatsApp / phone
- Currency: auto from listing country with manual override
- Reviews with free replies from homeowners and other tenants

## Architecture
- **Backend** FastAPI + MongoDB (`/app/backend/server.py`), all routes under `/api`
  - Auth: bcrypt + JWT (30 d) for password users; Emergent session tokens for Google users; `Authorization: Bearer`
  - Collections: users, user_sessions, listings, offers, reviews, review_replies, files (all soft-delete via `deleted_at`, uuid string ids, `_id` never returned)
  - Object storage proxy: `POST /api/upload`, `GET /api/files/{path}`
  - Places: `GET /api/places/search?q=` (Google Text Search → Photon fallback) returns lat/lng/country_code + detected currency
  - Currency map: ~55 currencies, country→currency table
  - Seed: demo homeowner/tenant + 5 listings (NG, CN, US, UK) on first start
- **Frontend** Expo Router (SDK 57)
  - `app/_layout.tsx` auth gate (loading → login / role / tabs), fonts (Plus Jakarta Sans), providers
  - `(auth)/login|register|role`, `(tabs)/index (Explore)|activity|profile`, `listing/[id]`, `listing/create`, `user/[id]`, `profile/edit`
  - `src/components`: glass, ui (Button/Field/Chip/Avatar…), price-tag, listing-card, app-map(.web), reviews, contact-buttons, toast, role-picker
  - NativeTabs on iOS 26+, glass JS tabs elsewhere

## Test accounts
See `/app/memory/test_credentials.md` (owner@renter.app / tenant@renter.app, Password123!).

## Implemented (2026-06)
- [x] Email/password + Google auth, role onboarding
- [x] Explore: map with price pins (native), glass search pill, period chips, carousel of glass cards, list toggle
- [x] Smart filters: price range, bedrooms, property type, "Near me" (expo-location, 25 km, haversine + distance_km)
- [x] Saved homes: heart toggle (cards + detail), Saved tab
- [x] Offer responses: owner Accept/Decline, status badges for tenant (15s polling)
- [x] Responsive: `useResponsive()` font scaling (`r.ms`) in all stylesheets, content max width 680 on tablets
- [x] Custom Renter logo as app icon / splash / login
- [x] Listing detail: photo carousel, price + period badge, mini map, owner card, WhatsApp/Call sticky glass bar, tenant offers, reviews + threaded replies
- [x] Create listing: photo upload, address autocomplete, auto currency + override, period segmented control, sticky publish
- [x] Profiles (own + public) with bio, phone, WhatsApp, stats, reviews; edit profile with avatar upload
- [x] Activity: homeowner listings / tenant offers
- [x] In-app chat (conversations/messages, polling, unread badges; tenant needs accepted offer, owner can message any offerer)
- [x] Mark as rented / relist (hidden from Explore, pending offers closed, offers blocked)
- [x] Virtual tour video (≤60s / 50MB via object storage, expo-video player)
- [x] Share listing (native share sheet; wa.me fallback on web)
- [x] AI-generated line-art exhibition backdrops (assets/images/art, generated with Gemini via gen_art.py)
- [x] Tested end-to-end by testing agent (iterations 1–3: all pass)

## Known constraints
- Google key has **no billing** → Places/Geocoding denied; backend falls back to OpenStreetMap. Enable billing + "Places API" + "Geocoding API" in Google Cloud to use Google results.
- Interactive map is native-only (react-native-maps); web preview shows a pin-list fallback.
- Google login only testable on device / real browser flow.

## Backlog
- P2: Featured listings / paid boost (user deferred — needs payment provider decision)
- P2: Listing availability calendar
- P2: Push notifications for new messages/offers (on request only)
