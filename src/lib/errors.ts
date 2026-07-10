export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}

export function getDatabaseErrorMessage(message: string) {
  if (message.includes("public.time_entries")) {
    return "Supabase is connected, but the time_entries table has not been created yet. Run supabase/schema.sql in the Supabase SQL editor.";
  }

  return message;
}
