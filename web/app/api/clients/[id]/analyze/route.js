import { NextResponse } from "next/server";
import {
  getClientMeta,
  readAnswers,
  rosterPath,
  profilesDir,
  writeResults,
} from "@/lib/clientStore";
import { calculateSectorAnalyse } from "@/lib/scoring";
import { parseRoster } from "../../../../../../src/parseRoster.js";
import { parseProfilesDir, matchRosterToProfiles } from "../../../../../../src/parseProfiles.js";
import { analyzeProfile } from "../../../../../../src/analyzeTasks.js";
import { calculateRole, calculateOrganisatie } from "../../../../../../src/calculate.js";
import { analyzeCompetencies } from "../../../../../../src/analyzeCompetencies.js";
import { generateAanbevelingen } from "../../../../../../src/generateAanbevelingen.js";

export async function POST(request, { params }) {
  const { id } = await params;
  const meta = getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const roster = rosterPath(id);
  if (!roster) return NextResponse.json({ error: "Geen roster geüpload voor deze klant" }, { status: 400 });

  const pDir = profilesDir(id);
  let rosterRows, profiles;
  try {
    rosterRows = parseRoster(roster);
    profiles = await parseProfilesDir(pDir);
  } catch (err) {
    return NextResponse.json({ error: `Kon input niet lezen: ${err.message}` }, { status: 400 });
  }

  const { matched, missing } = matchRosterToProfiles(rosterRows, profiles);
  if (matched.length === 0) {
    return NextResponse.json(
      { error: "Geen enkele rol uit het roster kon aan een functieprofiel gekoppeld worden." },
      { status: 400 }
    );
  }

  const roleResults = [];
  for (const row of matched) {
    let taken;
    try {
      taken = await analyzeProfile(row.rolnaam, row.profile.text);
    } catch (err) {
      return NextResponse.json({ error: `Taakanalyse mislukt voor "${row.rolnaam}": ${err.message}` }, { status: 502 });
    }
    const roleResult = calculateRole({ ...row, taken });

    try {
      roleResult.competenties = await analyzeCompetencies(row.rolnaam, row.profile.text, roleResult.scenarios.realistisch.taken);
    } catch (err) {
      return NextResponse.json(
        { error: `Competentie-analyse mislukt voor "${row.rolnaam}": ${err.message}` },
        { status: 502 }
      );
    }

    roleResults.push(roleResult);
  }

  const orgTotals = calculateOrganisatie(roleResults);

  const answers = readAnswers(id);
  const sectorAnalyse = answers.sector
    ? calculateSectorAnalyse(answers.sector, answers.impact, answers.readiness)
    : null;

  let aanbevelingen;
  try {
    aanbevelingen = await generateAanbevelingen(meta.naam, roleResults, sectorAnalyse);
  } catch (err) {
    return NextResponse.json({ error: `Aanbevelingen genereren mislukt: ${err.message}` }, { status: 502 });
  }

  const results = {
    bedrijfsnaam: meta.naam,
    gegenereerdOp: new Date().toISOString(),
    missingProfiles: missing,
    organisatieTotaal: orgTotals,
    rollen: roleResults,
    sectorAnalyse,
    aanbevelingen,
  };

  writeResults(id, results);
  return NextResponse.json(results);
}
