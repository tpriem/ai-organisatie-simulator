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
import { roleId } from "../../../../../../src/roleIdentity.js";
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

// Herkansingen bij de competentie-analyse kosten elk zo'n tien seconden. Om te
// voorkomen dat de functie halverwege wordt afgekapt — waarbij álles verloren gaat —
// slaan we herkansingen over zodra deze grens gepasseerd is. Ruim onder de 60s, zodat
// er tijd overblijft om de resultaten weg te schrijven.
const COMPETENTIE_HERKANSING_LIMIET_MS = 40_000;

// Eerste stap van de analyse (rollen + competenties). Los van de aanbevelingen-stap
// (zie analyze-aanbevelingen/route.js) omdat samen te veel Claude-calls na elkaar
// de 60s-limiet van een Vercel serverless functie overschrijden.
export async function POST(request, { params }) {
  const competentieDeadline = Date.now() + COMPETENTIE_HERKANSING_LIMIET_MS;
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

  // Rollen falen onafhankelijk van elkaar. Eén mislukte rol mocht vroeger de hele
  // analyse omgooien, waardoor ook al het geslaagde werk verloren ging — bij een klant
  // met tientallen rollen betekende dat opnieuw beginnen om één rol.
  const uitkomsten = await Promise.all(
    matched.map(async (row) => {
      const label = roleLabel(row);
      try {
        const { taken, waardetype, waardetypeToelichting } = await analyzeProfile(label, row.profile.text);
        const roleResult = calculateRole({ ...row, taken });
        roleResult.waardetype = waardetype;
        roleResult.waardetypeToelichting = waardetypeToelichting;

        const competentieAnalyse = await analyzeCompetencies(
          label,
          row.profile.text,
          roleResult.scenarios.realistisch.taken,
          row.rolnaam,
          { deadline: competentieDeadline }
        );

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

        return { ok: true, roleResult };
      } catch (err) {
        return {
          ok: false,
          mislukt: { roleId: roleId(row), roleLabel: label, rolnaam: row.rolnaam, afdeling: row.afdeling ?? null, fout: err.message },
        };
      }
    })
  );

  const roleResults = uitkomsten.filter((u) => u.ok).map((u) => u.roleResult);
  const mislukteRollen = uitkomsten.filter((u) => !u.ok).map((u) => u.mislukt);

  // Alleen als er niets bruikbaars is overgebleven, is er echt niets te tonen.
  if (roleResults.length === 0) {
    return NextResponse.json(
      { error: mislukteRollen[0]?.fout ?? "Analyse mislukt voor alle rollen.", mislukteRollen },
      { status: 502 }
    );
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
    mislukteRollen,
    organisatieTotaal: orgTotals,
    subtotalenPerAfdeling,
    rollen: roleResults,
    sectorAnalyse: null,
    aanbevelingen: null,
  };

  await writeResults(id, results);
  return NextResponse.json(results);
}
