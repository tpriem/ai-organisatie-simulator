import { NextResponse } from "next/server";
import { getClientMeta, updateClientMeta } from "@/lib/clientStore";

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  // Alleen de scope. Eerder opgeslagen positioneringsantwoorden (sector, impact, readiness)
  // blijven ongemoeid in de database staan; de tool gebruikt ze niet meer.
  const { scope, scopeLabel } = await request.json();
  await updateClientMeta(id, {
    scope: scope ?? "bedrijf",
    scopeLabel: scopeLabel ?? "",
  });

  return NextResponse.json({ ok: true });
}
