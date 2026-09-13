// Runs before every page request (Next.js 16 renamed `middleware` to `proxy`).
//
// This is an optimistic gate only: it checks the signed session cookie and
// redirects to /login when it is absent or invalid. Server actions and pages
// re-check for themselves via src/lib/session.ts, because a POST can reach an
// action without passing through here.

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = await verifySessionToken(token);

  if (!signedIn && !isPublic) {
    const url = new URL("/login", request.nextUrl);
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (signedIn && isPublic) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next.js internals and static assets, otherwise the redirect above
  // would also block the CSS and JS the login page itself needs.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
