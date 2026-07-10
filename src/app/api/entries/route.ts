import { NextResponse } from "next/server";
import { getDatabaseErrorMessage, getErrorMessage } from "@/lib/errors";
import { getSupabase, toTimeEntry, TimeEntryRow } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("start_time", { ascending: false });

    if (error) {
      return NextResponse.json({ message: getDatabaseErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json((data as TimeEntryRow[]).map(toTimeEntry));
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const startTime = body.startTime ? new Date(body.startTime) : new Date();
    const endTime = body.endTime ? new Date(body.endTime) : null;

    if (!body.event || typeof body.event !== "string") {
      return NextResponse.json({ message: "Event is required." }, { status: 400 });
    }

    if (Number.isNaN(startTime.getTime()) || (endTime && Number.isNaN(endTime.getTime()))) {
      return NextResponse.json({ message: "Invalid start or end time." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        start_time: startTime.toISOString(),
        end_time: endTime?.toISOString() ?? null,
        event: body.event.trim(),
        description: body.description?.trim() || null,
        link: body.link?.trim() || null,
        photo_path: body.photoPath || null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ message: getDatabaseErrorMessage(error.message) }, { status: 500 });
    }

    return NextResponse.json(toTimeEntry(data as TimeEntryRow), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
