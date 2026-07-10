import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDatabaseErrorMessage, getErrorMessage } from "@/lib/errors";
import { getSupabase, TimeEntryRow } from "@/lib/supabase";
import { entryDuration, formatDuration, formatIrishDate, formatIrishTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const headers = ["Date", "Start Time", "End Time", "Event", "Description", "Duration", "Link", "Screenshot"];

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      return NextResponse.json({ message: getDatabaseErrorMessage(error.message) }, { status: 500 });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Time Tracker";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Time Entries", {
      views: [{ state: "frozen", ySplit: 1 }],
      properties: { defaultRowHeight: 22 },
    });

    worksheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Start Time", key: "startTime", width: 14 },
      { header: "End Time", key: "endTime", width: 14 },
      { header: "Event", key: "event", width: 24 },
      { header: "Description", key: "description", width: 44 },
      { header: "Duration", key: "duration", width: 14 },
      { header: "Link", key: "link", width: 34 },
      { header: "Screenshot", key: "screenshot", width: 34 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.values = headers;
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF245C4F" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB9B09F" } },
        left: { style: "thin", color: { argb: "FFB9B09F" } },
        bottom: { style: "thin", color: { argb: "FFB9B09F" } },
        right: { style: "thin", color: { argb: "FFB9B09F" } },
      };
    });

    (data as TimeEntryRow[]).forEach((entry) => {
      const row = worksheet.addRow({
        date: formatIrishDate(entry.start_time),
        startTime: formatIrishTime(entry.start_time),
        endTime: entry.end_time ? formatIrishTime(entry.end_time) : "",
        event: entry.event,
        description: entry.description ?? "",
        duration: formatDuration(entryDuration(entry.start_time, entry.end_time)),
        link: entry.link ?? "",
        screenshot: entry.photo_path ?? "",
      });

      if (entry.link) {
        row.getCell("link").value = { text: entry.link, hyperlink: entry.link };
      }
      if (entry.photo_path) {
        row.getCell("screenshot").value = { text: "Open screenshot", hyperlink: entry.photo_path };
      }
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.height = 34;
      }

      row.eachCell((cell, columnNumber) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFECE7DC" } },
          left: { style: "thin", color: { argb: "FFECE7DC" } },
          bottom: { style: "thin", color: { argb: "FFECE7DC" } },
          right: { style: "thin", color: { argb: "FFECE7DC" } },
        };

        if (rowNumber > 1 && (columnNumber === 7 || columnNumber === 8) && cell.value) {
          cell.font = { color: { argb: "FF245C4F" }, underline: true };
        }
      });
    });

    worksheet.getColumn("duration").alignment = { horizontal: "center", vertical: "top" };
    worksheet.getColumn("date").alignment = { horizontal: "center", vertical: "top" };
    worksheet.getColumn("startTime").alignment = { horizontal: "center", vertical: "top" };
    worksheet.getColumn("endTime").alignment = { horizontal: "center", vertical: "top" };

    const buffer = await workbook.xlsx.writeBuffer();

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
