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
import { profielenOpNaam, matchRosterToProfiles, roleId, roleLabel } from "../../../../../src/parseProfiles.js";

async function buildRosterCheck(id, rosterInfo, profileFiles) {
  const roster = await getRosterBuffer(id, rosterInfo);
  if (!roster) return null;

  let rosterRows;
  try {
    rosterRows = parseRoster(roster.buffer, roster.fileName);
  } catch (err) {
    return { error: err.message };
  }

  // De koppeling aan functieprofielen gaat op bestandsnaam: de bestanden zelf hoeven hier niet gelezen te
  // worden (bij 50 profielen scheelde dat ruim tien seconden per keer dat de pagina opent). Of een profiel
  // leesbaar is, blijkt bij de analyse.
  let matchedIds = new Set();
  try {
    const { matched } = matchRosterToProfiles(rosterRows, profielenOpNaam(profileFiles));
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
