import { NextResponse } from "next/server";
import { getClientMeta, readAnswers, readResults, writeResults } from "@/lib/clientStore";
import { meldStoring } from "@/lib/alert";
import { generateAanbevelingen } from "../../../../../../src/generateAanbevelingen.js";

export const maxDuration = 60;

// Tweede stap van de analyse: aanbevelingen genereren op basis van de rollen die
// analyze-roles/route.js al heeft opgeslagen. Los getrokken van die stap om binnen
// de 60s-limiet van een Vercel serverless functie te blijven.
export async function POST(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const results = await readResults(id);
  if (!results || !results.rollen?.length) {
    return NextResponse.json(
      { error: "Nog geen rol-analyse beschikbaar. Analyseer eerst de rollen." },
      { status: 400 }
    );
  }

  const answers = await readAnswers(id);

  const scope = results.scope ?? answers.scope ?? "bedrijf";
  const scopeLabel = results.scopeLabel ?? answers.scopeLabel ?? "";
  const analyseContextNaam =
    scope === "afdeling" && scopeLabel ? `${meta.naam} (business unit/afdeling: ${scopeLabel})` : meta.naam;

  let aanbevelingen;
  try {
    aanbevelingen = await generateAanbevelingen(analyseContextNaam, results.rollen);
  } catch (err) {
    meldStoring("Aanbevelingen genereren mislukt", { klant: meta.naam, klantId: id, fout: err.message });
    return NextResponse.json({ error: `Aanbevelingen genereren mislukt: ${err.message}` }, { status: 502 });
  }

  // De sectoranalyse bestaat niet meer; oude resultaten nemen haar niet mee de nieuwe versie in.
  const { sectorAnalyse: _oudeSectorAnalyse, ...zonderSector } = results;
  const updated = { ...zonderSector, aanbevelingen };
  await writeResults(id, updated, { reden: "aanbevelingen gegenereerd" });
  return NextResponse.json(updated);
}
