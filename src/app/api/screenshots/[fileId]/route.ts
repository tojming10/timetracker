import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { getDriveClient } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    fileId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;

    if (!/^[\w-]+$/.test(fileId)) {
      return NextResponse.json({ message: "Invalid screenshot file ID." }, { status: 400 });
    }

    const drive = getDriveClient();
    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" },
    );

    const stream = response.data as Readable;
    const headers = new Headers({
      "Cache-Control": "private, max-age=300",
      "Content-Type": String(response.headers["content-type"] ?? "image/png"),
    });

    return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
  } catch (error) {
    return NextResponse.json({ message: getErrorMessage(error) }, { status: 500 });
  }
}
