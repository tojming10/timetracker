import { createClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "time-tracker-photos";

export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type TimeEntryRow = {
  id: string;
  start_time: string;
  end_time: string | null;
  event: string;
  description: string | null;
  link: string | null;
  photo_path: string | null;
  created_at: string;
  updated_at: string;
};

export function toTimeEntry(row: TimeEntryRow) {
  return {
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    event: row.event,
    description: row.description,
    link: row.link,
    photoPath: row.photo_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
