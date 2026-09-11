import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), {
    // 303 so the browser follows with a GET rather than re-POSTing.
    status: 303,
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
