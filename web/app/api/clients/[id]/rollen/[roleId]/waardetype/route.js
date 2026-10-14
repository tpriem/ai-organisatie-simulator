import { NextResponse } from "next/server";
import { readResults, writeResults } from "@/lib/clientStore";
import { getWaardetype } from "../../../../../../../../src/config.js";
import { stelWaardetypeIn, herstelWaardetype } from "../../../../../../../../src/waardetype.js";

// Het waardetype van een rol bijsturen, of terugzetten op de inschatting van Claude.
//
// Het waardetype bepaalt waar de vrijgekomen capaciteit naartoe gaat. Claude leidt het af
// uit het functieprofiel, maar wat een organisatie met die capaciteit wil is haar keuze.
// Dit is de plek waar een adviseur die keuze vastlegt.
//
// Body: { waardetype: "kostenreductie" | "capaciteitsgroei" | "kwaliteitsverbetering", reden?: string }
//       { waardetype: null }   -> terug naar de inschatting van Claude
export async function PATCH(request, { params }) {
  const { id, roleId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }
  const { waardetype, reden } = body ?? {};

  if (waardetype !== null && !getWaardetype(waardetype)) {
    return NextResponse.json({ error: "Onbekend waardetype" }, { status: 400 });
  }

  const results = await readResults(id);
  if (!results) {
    return NextResponse.json({ error: "Geen analyse gevonden voor deze klant" }, { status: 404 });
  }

  const idx = results.rollen.findIndex((r) => (r.roleId ?? r.rolnaam) === roleId);
  if (idx === -1) {
    return NextResponse.json({ error: "Rol niet gevonden" }, { status: 404 });
  }

  const rol = results.rollen[idx];
  const label = rol.roleLabel ?? rol.rolnaam;

  results.rollen[idx] = waardetype === null ? herstelWaardetype(rol) : stelWaardetypeIn(rol, waardetype, { reden });

  // Het waardetype raakt de scenario's niet (die komen uit de taken), dus er is niets
  // door te rekenen. Alles wat het veld leest — app, rapporten, bestemmingsverdeling —
  // klopt vanzelf.
  await writeResults(id, results, {
    reden:
      waardetype === null
        ? `waardetype van ${label} teruggezet op de inschatting`
        : `waardetype van ${label} handmatig bepaald: ${getWaardetype(waardetype).label.toLowerCase()}`,
  });

  return NextResponse.json(results);
}
