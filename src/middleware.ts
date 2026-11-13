import { NextResponse, type NextRequest } from "next/server";
import { canHost, readRole } from "@/lib/account";
import { readSession } from "@/lib/supabase/middleware";

// Everything the people taking the quiz need stays open. Everything that
// creates a quiz, controls a round, or shows answers and results needs a
// signed-in host.
function isHostOnly(pathname: string) {
  if (pathname === "/dashboard" || pathname.startsWith("/host")) return true;

  if (
    pathname === "/api/results" ||
    pathname === "/api/network" ||
    pathname === "/api/sample-release" ||
    pathname === "/api/modules" ||
    pathname.startsWith("/api/modules/")
  ) {
    return true;
  }

  // /api/sessions and /api/sessions/<id> are host controls, but the nested
  // /api/sessions/<id>/players, /play and /answers belong to the players.
  if (pathname === "/api/sessions") return true;
  if (/^\/api\/sessions\/[^/]+$/.test(pathname)) return true;

  return false;
}

// Only an admin may change what other people are allowed to do.
function isAdminOnly(pathname: string) {
  return pathname === "/host/people" || pathname === "/api/people";
}

const OPEN = [
  "/host/login",
  "/host/register",
  "/api/account/login",
  "/api/account/register",
  "/api/account/logout",
];

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // This runs on open paths too, because the sign-in token has to be
  // refreshed while somebody is using the app.
  const { response, user } = await readSession(request);

  if (OPEN.includes(pathname)) return response;
  if (!isHostOnly(pathname) && !isAdminOnly(pathname)) return response;

  const role = user ? await readRole(user.id) : undefined;
  const allowed = isAdminOnly(pathname) ? role === "admin" : canHost(role);

  if (allowed) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: user
          ? "Your account is not a host yet. Ask an admin to switch you to host."
          : "Please sign in first.",
      },
      { status: user ? 403 : 401 },
    );
  }

  if (user) {
    // Signed in, but not allowed here: send them where they can go.
    return NextResponse.redirect(new URL("/library", request.url));
  }

  const loginUrl = new URL("/host/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/host/:path*", "/dashboard", "/api/:path*"],
};
