import { NextResponse } from "next/server";
import { getClientMeta, listResultsVersions, restoreResultsVersion } from "@/lib/clientStore";
import { meldStoring } from "@/lib/alert";

// Bewaarde versies van de analyseresultaten, zodat een overschreven analyse terug te
// halen is. Zonder deze terugweg was één druk op "Analyseer" genoeg om een goed rapport
// definitief kwijt te raken.
export async function GET(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  try {
    return NextResponse.json({ versies: await listResultsVersions(id) });
  } catch (err) {
    meldStoring("Versiehistorie ophalen mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Kon de versiehistorie niet ophalen." }, { status: 502 });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { versieId } = await request.json();
  if (!versieId) return NextResponse.json({ error: "Geen versie opgegeven" }, { status: 400 });

  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  try {
    const results = await restoreResultsVersion(id, versieId);
    if (!results) return NextResponse.json({ error: "Versie niet gevonden" }, { status: 404 });
    return NextResponse.json(results);
  } catch (err) {
    meldStoring("Versie terugzetten mislukt", { klantId: id, versieId, fout: err.message });
    return NextResponse.json({ error: `Terugzetten mislukt: ${err.message}` }, { status: 502 });
  }
}
