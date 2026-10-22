import { NextResponse } from "next/server";
import { getClientMeta } from "@/lib/clientStore";
import { readMaturiteit, saveHuidigeMeting, leggMetingVast } from "@/lib/maturiteitStore";
import { meldStoring } from "@/lib/alert";
import { schoonInvoer, maakSnapshot, berekenProfiel } from "../../../../../../src/aiMaturity.js";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  return NextResponse.json(await readMaturiteit(id));
}

// Het werkdocument: wordt bij elke wijziging opgeslagen.
export async function PUT(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const huidig = schoonInvoer(await request.json());
  try {
    await saveHuidigeMeting(id, huidig);
  } catch (err) {
    meldStoring("Volwassenheidsmeting opslaan mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Opslaan mislukt." }, { status: 502 });
  }
  return NextResponse.json({ huidig });
}

// Een meting vastleggen als moment in de tijd, zodat een herhaalmeting kan vergelijken.
export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const { huidig } = await readMaturiteit(id);
  if (berekenProfiel(huidig).gemeten === 0) {
    return NextResponse.json({ error: "Er zijn nog geen antwoorden om vast te leggen." }, { status: 400 });
  }

  try {
    const metingen = await leggMetingVast(id, maakSnapshot(huidig));
    return NextResponse.json({ metingen });
  } catch (err) {
    meldStoring("Volwassenheidsmeting vastleggen mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Vastleggen mislukt." }, { status: 502 });
  }
}
