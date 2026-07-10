export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export function getDatabaseErrorMessage(message: string) {
  if (message.includes("public.time_entries")) {
    return "Supabase is connected, but the time_entries table has not been created yet. Run supabase/schema.sql in the Supabase SQL editor.";
  }

  if (message.toLowerCase().includes("bucket not found")) {
    return "Supabase Storage is connected, but the time-tracker-photos bucket has not been created yet. Run the storage bucket section in supabase/schema.sql, or create a public bucket named time-tracker-photos.";
  }

  return message;
}
