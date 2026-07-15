import { NextRequest, NextResponse } from "next/server";
import { authCookieName, authSessionValue } from "@/lib/auth";

const publicApiPaths = new Set(["/api/login", "/api/session"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/") || publicApiPaths.has(pathname)) {
    return NextResponse.next();
  }

  if (request.cookies.get(authCookieName)?.value === authSessionValue) {
    return NextResponse.next();
  }

  return NextResponse.json({ message: "Please log in first." }, { status: 401 });
}

export const config = {
  matcher: ["/api/:path*"],
};
