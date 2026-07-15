import { NextResponse } from "next/server";
import { getDatabaseErrorMessage, getErrorMessage } from "@/lib/errors";
import { deleteDriveFileByUrl } from "@/lib/google-drive";
import { getSupabase, toTimeEntry, TimeEntryRow } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = getSupabase();
    const { id } = await context.params;
    const body = await request.json();
    const updates: Record<string, string | null> = {};

    if ("startTime" in body) {
      const startTime = new Date(body.startTime);
      if (Number.isNaN(startTime.getTime())) {
        return NextResponse.json({ message: "Invalid start time." }, { status: 400 });
      }
      updates.start_time = startTime.toISOString();
    }

    if ("endTime" in body) {
      if (body.endTime) {
        const endTime = new Date(body.endTime);
        if (Number.isNaN(endTime.getTime())) {
          return NextResponse.json({ message: "Invalid end time." }, { status: 400 });
        }
        updates.end_time = endTime.toISOString();
      } else {
        updates.end_time = null;
      }
    }

    if ("event" in body) {
      updates.event = body.event?.trim?.() || "";
    }
    if ("description" in body) {
      updates.description = body.description?.trim?.() || null;
    }
    if ("link" in body) {
      updates.link = body.link?.trim?.() || null;
    }
    if ("photoPath" in body) {
      updates.photo_path = body.photoPath || null;
    }

    let previousPhotoPath: string | null = null;

    if ("photoPath" in body) {
      const { data: existingEntry, error: existingError } = await supabase
        .from("time_entries")
        .select("photo_path")
        .eq("id", id)
        .single();

      if (existingError) {
        return NextResponse.json({ message: getDatabaseErrorMessage(existingError.message) }, { status: 500 });
      }

      previousPhotoPath = existingEntry?.photo_path ?? null;
    }

    const { data, error } = await supabase
      .from("time_entries")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ message: getDatabaseErrorMessage(error.message) }, { status: 500 });
    }

    if ("photoPath" in body && previousPhotoPath && previousPhotoPath !== updates.photo_path) {
      await deleteDriveFileByUrl(previousPhotoPath);
    }

    return NextResponse.json(toTimeEntry(data as TimeEntryRow));
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const supabase = getSupabase();
    const { id } = await context.params;

    const { data: existingEntry, error: existingError } = await supabase
      .from("time_entries")
      .select("photo_path")
      .eq("id", id)
      .single();

    if (existingError) {
      return NextResponse.json({ message: getDatabaseErrorMessage(existingError.message) }, { status: 500 });
    }

    const { error } = await supabase.from("time_entries").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ message: getDatabaseErrorMessage(error.message) }, { status: 500 });
    }

    if (existingEntry?.photo_path) {
      await deleteDriveFileByUrl(existingEntry.photo_path);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
