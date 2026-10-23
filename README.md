# SwapStay frontend

Standalone Next.js frontend for the SwapStay API (`hackerwrath3.0`). It uses the same-origin `/api` path, proxied to `BACKEND_URL` by `next.config.mjs`.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

Set `BACKEND_URL` to the backend URL and use the same Supabase project values as the backend:

```env
BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Optional Supabase Storage buckets are configured with `NEXT_PUBLIC_SUPABASE_PHOTO_BUCKET`, `NEXT_PUBLIC_SUPABASE_VERIFICATION_BUCKET`, `NEXT_PUBLIC_SUPABASE_PROPERTY_VERIFICATION_BUCKET`, and `NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET`.

### Authentication and verification

Supabase handles signup, email confirmation, login, sessions, token refresh, and password reset. The browser only uses the public URL and anon key; the backend uses `SUPABASE_SERVICE_ROLE_KEY` server-side to validate tokens and perform protected operations.

Verification is a manual server-controlled process:

1. A new member starts as `unverified` with zero credits.
2. The member completes their profile and submits an ID document, plus optional property-authority proof.
3. The backend stores a `verification_submissions` record and changes the profile to `pending`.
4. An admin reviews the private submission and marks it `verified` or `rejected` with an audit entry.
5. Only verified members can list homes, request credit stays, or propose/accept direct swaps.

Submitting documents never grants the badge automatically. Apply the backend verification migration and configure the private `verification` Supabase Storage bucket before accepting real documents.

### Property verification and media

Member verification and property verification are separate:

1. The host opens **My homes → Verification** for a listing.
2. They generate a one-time physical code, write it on a card, place it inside the home, and photograph it.
3. They upload an ownership document or a lease/rental agreement, plus the code photo.
4. The submission enters the admin **Home verification** queue with short-lived signed links to the private evidence.
5. An admin marks it `verified` or `rejected` with notes. Verified homes become `active` and show a **Verified home** badge in search and on the property page.

Listing media:

- Photos upload to the public `property-photos` bucket and are attached to the listing.
- One short walkthrough video (MP4/MOV/WebM, ≤100 MB, ≤60 seconds) uploads to the private `property-videos` bucket and streams through signed URLs.
- Ownership evidence and code photos live in the private `property-verification` bucket. They are never public.

Apply `00005_property_verification_media.sql` to create the tables, property verification columns, and storage buckets/policies.

## Demo mode

Demo mode is available from the sign-in page and works without backend or Supabase keys. It provides seeded homes, members, swaps, bookings, wallet activity, reports, and an admin verification queue. Changes are stored only in this browser. Use **Reset demo** in the banner to restore the seed data, or **Exit demo** to return to real authentication.

`NEXT_PUBLIC_DEMO_MODE=true` makes demo mode the default; it can still be exited in the UI.

## Checks

```bash
npm run typecheck
npm run build
```

The client displays server/API errors and treats server responses as authoritative for verification, availability, credit balances, bookings, and swaps.

## Backend notes

- The frontend relies on the Next rewrite because the backend does not provide browser CORS handling.
- The production admin console reads `/api/admin/verification` and `/api/admin/property-verification`; the demo includes local seeded equivalents.
- Photo, video, and verification uploads require the corresponding Supabase Storage buckets and are handled gracefully when storage is not configured.
- Messaging is backed by the companion `hackerwrath3.0` API using `/api/conversations` and `/api/conversations/:id/messages`.
- Apply `supabase/migrations/00002_messaging.sql` through `00005_property_verification_media.sql` in order. They are idempotent, so re-running a migration is safe.
