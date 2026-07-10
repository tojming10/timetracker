# Time Tracker

A simple Clockify-style tracker built for Irish time (`Europe/Dublin`) with task timing, notes, links, pasted screenshots, and Excel export.

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
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_DRIVE_SCREENSHOT_FOLDER_ID`

The service role key is used only by server API routes. Do not expose it in browser code.

For Google Drive screenshot uploads, share the destination Drive folder with the service account email. The default
folder ID is `1s_Qd4eiBOyDnPtTGfCFuWHbI385IH8ff`.

## Export Columns

The Excel export includes:

- Date
- Start Time
- End Time
- Event
- Description
- Duration
- Link
- Screenshot
