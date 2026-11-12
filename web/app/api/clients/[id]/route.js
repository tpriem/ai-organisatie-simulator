import { NextResponse } from "next/server";
import {
  getClientMeta,
  updateClientMeta,
  deleteClient,
  readAnswers,
  getRosterBuffer,
  getRosterInfo,
  listProfileFiles,
  readResults,
} from "@/lib/clientStore";
import { parseRoster } from "../../../../../src/parseRoster.js";
import { bouwRosterCheck } from "../../../../../src/klantOverzicht.js";

async function buildRosterCheck(id, rosterInfo, profileFiles) {
  const roster = await getRosterBuffer(id, rosterInfo);
  if (!roster) return null;
  try {
    return bouwRosterCheck(parseRoster(roster.buffer, roster.fileName), profileFiles);
  } catch (err) {
    return { error: err.message };
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  // Alles wat niet van elkaar afhangt tegelijk ophalen: elke aanroep naar de opslag of database kost een
  // rondje naar Supabase, en achter elkaar werd dat opgeteld.
  const [rosterInfo, answers, profileFiles, results] = await Promise.all([
    getRosterInfo(id),
    readAnswers(id),
    listProfileFiles(id),
    readResults(id),
  ]);
  const rosterCheck = await buildRosterCheck(id, rosterInfo, profileFiles);

  return NextResponse.json({
    ...meta,
    answers,
    rosterFileName: rosterInfo?.fileName ?? null,
    profileFiles,
    results,
    rosterCheck,
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const patch = await request.json();
  const updated = await updateClientMeta(id, patch);
  if (!updated) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  await deleteClient(id);
  return NextResponse.json({ ok: true });
}
