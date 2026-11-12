import { NextResponse } from "next/server";
import { getClientMeta } from "@/lib/clientStore";
import { leesLogboek } from "@/lib/logboek";

// Het logboek van een klant: wie deed wat en wanneer. Alleen voor ingelogde adviseurs.
export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  return NextResponse.json({ regels: await leesLogboek(id) }, { headers: { "Cache-Control": "no-store" } });
}
