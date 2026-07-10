import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getErrorMessage } from "@/lib/errors";
import { getSupabase, TimeEntryRow } from "@/lib/supabase";
import { entryDuration, formatDuration, formatIrishDate, formatIrishTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const rows = (data as TimeEntryRow[]).map((entry) => ({
      Date: formatIrishDate(entry.start_time),
      "Start Time": formatIrishTime(entry.start_time),
      "End Time": entry.end_time ? formatIrishTime(entry.end_time) : "",
      Event: entry.event,
      Description: entry.description ?? "",
      Duration: formatDuration(entryDuration(entry.start_time, entry.end_time)),
      Link: entry.link ?? "",
      Photo: entry.photo_path ?? "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ["Date", "Start Time", "End Time", "Event", "Description", "Duration", "Link", "Photo"],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Time Entries");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="irish-time-tracker.xlsx"',
      },
    });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
