import { NextResponse } from "next/server";
import {
  getClientMeta,
  updateClientMeta,
  deleteClient,
  readAnswers,
  getRosterBuffer,
  getRosterInfo,
  getProfileBuffers,
  listProfileFiles,
  readResults,
} from "@/lib/clientStore";
import { parseRoster } from "../../../../../src/parseRoster.js";
import { parseProfileFiles, matchRosterToProfiles, roleId, roleLabel } from "../../../../../src/parseProfiles.js";

async function buildRosterCheck(id) {
  const roster = await getRosterBuffer(id);
  if (!roster) return null;

  let rosterRows;
  try {
    rosterRows = parseRoster(roster.buffer, roster.fileName);
  } catch (err) {
    return { error: err.message };
  }

  // Matching met functieprofielen is optioneel op dit punt — nog geen (leesbare)
  // profielen geüpload mag de roster-tabel zelf niet blokkeren.
  let matchedIds = new Set();
  try {
    const profileFiles = await getProfileBuffers(id);
    const profiles = await parseProfileFiles(profileFiles);
    const { matched } = matchRosterToProfiles(rosterRows, profiles);
    matchedIds = new Set(matched.map((r) => roleId(r)));
  } catch {
    // stil negeren — rollen tonen dan als "nog niet gekoppeld"
  }

  const rollen = rosterRows.map((r) => ({
    roleId: roleId(r),
    rolnaam: r.rolnaam,
    roleLabel: roleLabel(r),
    afdeling: r.afdeling ?? "",
    fte: r.fte,
    urenPerWeek: r.urenPerWeek,
    kostenPerUur: r.kostenPerUur,
    loonkostenPerJaar: r.fte * r.urenPerWeek * r.kostenPerUur * 52,
    gekoppeld: matchedIds.has(roleId(r)),
  }));

  const totaalFte = rosterRows.reduce((s, r) => s + r.fte, 0);
  const totaalUrenPerWeek = rosterRows.reduce((s, r) => s + r.fte * r.urenPerWeek, 0);
  const totaalLoonPerWeek = rosterRows.reduce((s, r) => s + r.fte * r.urenPerWeek * r.kostenPerUur, 0);

  const afdelingGroups = new Map();
  for (const r of rosterRows) {
    const key = r.afdeling?.trim() || "";
    if (!afdelingGroups.has(key)) afdelingGroups.set(key, []);
    afdelingGroups.get(key).push(r);
  }

  const heeftAfdelingen = [...afdelingGroups.keys()].some((k) => k !== "");
  const subtotalenPerAfdeling = heeftAfdelingen
    ? [...afdelingGroups.entries()].map(([afdeling, rows]) => {
        const fte = rows.reduce((s, r) => s + r.fte, 0);
        const urenWeek = rows.reduce((s, r) => s + r.fte * r.urenPerWeek, 0);
        const loonWeek = rows.reduce((s, r) => s + r.fte * r.urenPerWeek * r.kostenPerUur, 0);
        return {
          afdeling: afdeling || "Geen afdeling",
          aantalRollen: rows.length,
          totaalFte: fte,
          gewogenUrenPerWeek: fte > 0 ? urenWeek / fte : 0,
          gewogenKostenPerUur: urenWeek > 0 ? loonWeek / urenWeek : 0,
          totaalLoonkostenPerJaar: loonWeek * 52,
        };
      })
    : [];

  return {
    totaalRollen: rosterRows.length,
    gekoppeld: matchedIds.size,
    rollen,
    subtotalenPerAfdeling,
    totalen: {
      totaalFte,
      gewogenUrenPerWeek: totaalFte > 0 ? totaalUrenPerWeek / totaalFte : 0,
      gewogenKostenPerUur: totaalUrenPerWeek > 0 ? totaalLoonPerWeek / totaalUrenPerWeek : 0,
      totaalLoonkostenPerJaar: totaalLoonPerWeek * 52,
    },
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const rosterInfo = await getRosterInfo(id);

  return NextResponse.json({
    ...meta,
    answers: await readAnswers(id),
    rosterFileName: rosterInfo?.fileName ?? null,
    profileFiles: await listProfileFiles(id),
    results: await readResults(id),
    rosterCheck: await buildRosterCheck(id),
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
