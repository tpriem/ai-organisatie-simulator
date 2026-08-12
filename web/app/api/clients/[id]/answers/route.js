import { NextResponse } from "next/server";
import { getClientMeta, updateClientMeta, writeAnswers } from "@/lib/clientStore";

export async function POST(request, { params }) {
  const { id } = await params;
  if (!getClientMeta(id)) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const { sector, impact, readiness } = await request.json();
  writeAnswers(id, { sector: sector ?? null, impact: impact ?? {}, readiness: readiness ?? {} });
  updateClientMeta(id, { sector: sector ?? null });

  return NextResponse.json({ ok: true });
}
