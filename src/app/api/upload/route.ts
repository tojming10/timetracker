import { NextResponse } from "next/server";
import { getDatabaseErrorMessage, getErrorMessage } from "@/lib/errors";
import { uploadScreenshotToDrive } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Photo file is required." }, { status: 400 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ message: "Please upload a PNG, JPG, WebP, or GIF image." }, { status: 400 });
    }

    const path = await uploadScreenshotToDrive(file);

    return NextResponse.json({ path });
  } catch (error) {
    return NextResponse.json({ message: getDatabaseErrorMessage(getErrorMessage(error)) }, { status: 500 });
  }
}
