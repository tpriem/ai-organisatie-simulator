import { NextResponse } from "next/server";
import { getClientMeta, updateClientMeta } from "@/lib/clientStore";

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const { sector, impact, readiness, scope, scopeLabel } = await request.json();
  await updateClientMeta(id, {
    sector: sector ?? null,
    impact: impact ?? {},
    readiness: readiness ?? {},
    scope: scope ?? "bedrijf",
    scopeLabel: scopeLabel ?? "",
  });

  return NextResponse.json({ ok: true });
}
