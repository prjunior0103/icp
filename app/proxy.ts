import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting in-memory para rotas de autenticação
// Adequado para deploy single-instance em VPS
const RATE_LIMIT_MAX = 10;        // tentativas máximas
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // janela de 15 minutos

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

const AUTH_RATE_LIMITED_PATHS = [
  "/api/auth/signin",
  "/api/auth/callback/credentials",
];

export default auth(function middleware(req: NextRequest & { auth: unknown }) {
  const { pathname } = req.nextUrl;

  // Aplicar rate limiting nas rotas de autenticação
  if (AUTH_RATE_LIMITED_PATHS.some((p) => pathname.startsWith(p))) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Muitas tentativas. Aguarde 15 minutos." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "900",
          },
        }
      );
    }
  }

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth");

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
