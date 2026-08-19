import { NextResponse } from "next/server";
import { LOCALES } from "@/lib/i18n";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const locale = LOCALES.includes(searchParams.get("locale")) ? searchParams.get("locale") : "nl";
  const redirectPath = searchParams.get("redirect") ?? "/";
  const safeRedirect = redirectPath.startsWith("/") ? redirectPath : "/";

  const res = NextResponse.redirect(new URL(safeRedirect, origin));
  res.cookies.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
