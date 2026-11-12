import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientMeta, readResults, writeResults } from "@/lib/clientStore";
import { logActie } from "@/lib/logboek";
import { meldStoring } from "@/lib/alert";
import { bewerkAanbevelingen } from "../../../../../../src/aanbevelingen.js";

// De bevindingen en aanbevelingen bewerken en goedkeuren. Wat het taalmodel opstelt is een concept;
// pas na goedkeuring door de adviseur gaat de tekst mee in een rapport. Bewerken zonder goedkeuren
// maakt er weer een concept van.
export async function PUT(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const results = await readResults(id);
  if (!results?.rollen?.length) return NextResponse.json({ error: "Er is nog geen analyse." }, { status: 400 });

  const goedkeuren = body?.goedkeuren === true;
  const sessie = await auth();
  const aanbevelingen = bewerkAanbevelingen(body?.aanbevelingen, { goedkeuren, door: sessie?.user?.email ?? null });
  if (goedkeuren && !aanbevelingen.bevindingenSamenvatting && aanbevelingen.aanbevelingen.length === 0) {
    return NextResponse.json({ error: "Er is niets om goed te keuren: de tekst is leeg." }, { status: 400 });
  }

  const updated = { ...results, aanbevelingen };
  try {
    // Geen nieuwe versie in de geschiedenis per bewerking: die is voor analyses, niet voor tekstwijzigingen.
    await writeResults(id, updated, { archiveer: false });
  } catch (err) {
    meldStoring("Aanbevelingen opslaan mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Opslaan mislukt." }, { status: 502 });
  }
  await logActie(id, goedkeuren ? "aanbevelingen_goedgekeurd" : "aanbevelingen_bewerkt");
  return NextResponse.json(updated);
}
