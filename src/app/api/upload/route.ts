import path from "node:path";
import { NextResponse } from "next/server";
import { getSupabase, PHOTO_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const supabase = getSupabase();
  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Photo file is required." }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ message: "Please upload a PNG, JPG, WebP, or GIF image." }, { status: 400 });
  }

  const extension = path.extname(file.name) || ".png";
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const storagePath = `screenshots/${filename}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);

  return NextResponse.json({ path: data.publicUrl });
}
