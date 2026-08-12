import { NextResponse } from "next/server";
import {
  getClientMeta,
  updateClientMeta,
  deleteClient,
  readAnswers,
  rosterPath,
  listProfileFiles,
  readResults,
} from "@/lib/clientStore";
import path from "node:path";

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const roster = rosterPath(id);

  return NextResponse.json({
    ...meta,
    answers: readAnswers(id),
    rosterFileName: roster ? path.basename(roster) : null,
    profileFiles: listProfileFiles(id),
    results: readResults(id),
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const patch = await request.json();
  const updated = updateClientMeta(id, patch);
  if (!updated) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  deleteClient(id);
  return NextResponse.json({ ok: true });
}
