import { NextResponse } from "next/server";
import {
  getClientMeta,
  readAnswers,
  getRosterBuffer,
  getProfileBuffers,
  writeResults,
} from "@/lib/clientStore";
import { parseRoster } from "../../../../../../src/parseRoster.js";
import { parseProfileFiles, matchRosterToProfiles, roleLabel } from "../../../../../../src/parseProfiles.js";
import { analyzeProfile } from "../../../../../../src/analyzeTasks.js";
import {
  calculateRole,
  calculateOrganisatie,
  calculateSubtotalenPerAfdeling,
} from "../../../../../../src/calculate.js";
import { analyzeCompetencies } from "../../../../../../src/analyzeCompetencies.js";
import { calculateCompetentieTop5 } from "../../../../../../src/competencyTop5.js";
import { calculateCompetentieProfiel } from "../../../../../../src/competencyProfile.js";

export const maxDuration = 60;

// Eerste stap van de analyse (rollen + competenties). Los van de aanbevelingen-stap
// (zie analyze-aanbevelingen/route.js) omdat samen te veel Claude-calls na elkaar
// de 60s-limiet van een Vercel serverless functie overschrijden.
export async function POST(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const roster = await getRosterBuffer(id);
  if (!roster) return NextResponse.json({ error: "Geen roster geüpload voor deze klant" }, { status: 400 });

  let rosterRows, profiles;
  try {
    rosterRows = parseRoster(roster.buffer, roster.fileName);
    const profileFiles = await getProfileBuffers(id);
    profiles = await parseProfileFiles(profileFiles);
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

  let roleResults;
  try {
    roleResults = await Promise.all(
      matched.map(async (row) => {
        const label = roleLabel(row);
        let taken, waardetype, waardetypeToelichting;
        try {
          ({ taken, waardetype, waardetypeToelichting } = await analyzeProfile(label, row.profile.text));
        } catch (err) {
          throw new Error(`Taakanalyse mislukt voor "${label}": ${err.message}`);
        }
        const roleResult = calculateRole({ ...row, taken });
        roleResult.waardetype = waardetype;
        roleResult.waardetypeToelichting = waardetypeToelichting;

        let competentieAnalyse;
        try {
          competentieAnalyse = await analyzeCompetencies(
            label,
            row.profile.text,
            roleResult.scenarios.realistisch.taken,
            row.rolnaam
          );
        } catch (err) {
          throw new Error(`Competentie-analyse mislukt voor "${label}": ${err.message}`);
        }

        roleResult.competentieLijst = competentieAnalyse.competentieLijst;
        roleResult.taakCompetenties = competentieAnalyse.taakCompetenties;
        roleResult.nieuweCompetenties = competentieAnalyse.nieuweCompetenties;
        roleResult.competentieMeta = competentieAnalyse.competentieMeta;
        roleResult.beroepsmatch = competentieAnalyse.beroepsmatch;
        roleResult.ongematchteTaken = competentieAnalyse.ongematchteTaken;
        roleResult.competentieTop5 = calculateCompetentieTop5(
          roleResult.scenarios.realistisch.taken,
          roleResult.taakCompetenties
        );
        roleResult.competentieProfiel = calculateCompetentieProfiel(
          roleResult.scenarios.realistisch.taken,
          roleResult.taakCompetenties,
          roleResult.nieuweCompetenties,
          roleResult.competentieMeta
        );

        return roleResult;
      })
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  const orgTotals = calculateOrganisatie(roleResults);
  const subtotalenPerAfdeling = calculateSubtotalenPerAfdeling(roleResults);

  const answers = await readAnswers(id);
  const scope = answers.scope ?? "bedrijf";
  const scopeLabel = answers.scopeLabel ?? "";

  const results = {
    bedrijfsnaam: meta.naam,
    scope,
    scopeLabel,
    gegenereerdOp: new Date().toISOString(),
    missingProfiles: missing,
    organisatieTotaal: orgTotals,
    subtotalenPerAfdeling,
    rollen: roleResults,
    sectorAnalyse: null,
    aanbevelingen: null,
  };

  await writeResults(id, results);
  return NextResponse.json(results);
}
