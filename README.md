# Time Tracker

A simple Clockify-style tracker built for Irish time (`Europe/Dublin`) with task timing, notes, links, screenshot/photo uploads, and Excel export.

## Setup

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Run the app:

```bash
npm install
npm run dev
```

## Vercel

Add the same environment variables in Vercel before deploying:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service role key is used only by server API routes. Do not expose it in browser code.

## Export Columns

The Excel export includes:

- Date
- Start Time
- End Time
- Event
- Description
- Duration
- Link
- Photo
