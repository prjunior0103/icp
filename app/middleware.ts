import { auth } from "@/app/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
});

export const config = {
  matcher: ["/api/((?!auth).*)"],
};
