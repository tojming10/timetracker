import { NextResponse } from "next/server";
import { authCookieName, authMaxAgeSeconds, authSessionValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

const username = "Minggay";
const password = "Maehara1994!";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (body?.username !== username || body?.password !== password) {
    return NextResponse.json({ message: "Incorrect username or password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(authCookieName, authSessionValue, {
    httpOnly: true,
    maxAge: authMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
