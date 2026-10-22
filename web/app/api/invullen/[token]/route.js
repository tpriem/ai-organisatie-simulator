import { NextResponse } from "next/server";
import { getClientMeta } from "@/lib/clientStore";
import { zoekLink, markeerGebruikt } from "@/lib/linkStore";
import { leesInvullerBestand, schrijfInvullerBestand } from "@/lib/maturiteitStore";
import { meldStoring } from "@/lib/alert";
import { schoneAntwoorden, ROLLEN } from "../../../../../src/volwassenheid.js";

// Publieke API voor de invullink. Staat bewust buiten /api/clients en dus buiten de login: elke
// aanvraag wordt zelf gecontroleerd op het token. Een link geeft alleen toegang tot het invullen
// van de vragenlijst van één invuller bij één klant. Geen resultaten, geen andere gegevens.

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const MAX_BODY = 60_000; // ruim boven de 100 antwoorden
const ONGELDIG = () => NextResponse.json({ error: "Deze link is niet (meer) geldig." }, { status: 404, headers: HEADERS });

export async function GET(request, { params }) {
  const { token } = await params;
  const gevonden = await zoekLink(token, "invuller");
  if (!gevonden) return ONGELDIG();

  const [meta, bestand] = await Promise.all([getClientMeta(gevonden.klantId), leesInvullerBestand(gevonden.klantId, gevonden.link.invullerId)]);
  if (!meta) return ONGELDIG();

  return NextResponse.json(
    {
      organisatie: meta.naam,
      rol: gevonden.link.rol,
      rolNaam: ROLLEN.find((r) => r.id === gevonden.link.rol)?.naam ?? "",
      label: gevonden.link.label,
      status: bestand?.status ?? "nieuw",
      antwoorden: bestand?.antwoorden ?? {},
      ingediendOp: bestand?.ingediendOp ?? null,
      verlooptOp: gevonden.link.verlooptOp,
    },
    { headers: HEADERS }
  );
}

export async function PUT(request, { params }) {
  const { token } = await params;
  const gevonden = await zoekLink(token, "invuller");
  if (!gevonden) return ONGELDIG();

  const tekst = await request.text();
  if (tekst.length > MAX_BODY) return NextResponse.json({ error: "De aanvraag is te groot." }, { status: 413, headers: HEADERS });
  let body;
  try {
    body = JSON.parse(tekst);
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400, headers: HEADERS });
  }

  const nu = new Date().toISOString();
  const vorig = await leesInvullerBestand(gevonden.klantId, gevonden.link.invullerId);
  // Wie al heeft verstuurd en daarna nog iets aanpast, blijft verstuurd: de wijziging telt direct.
  const status = body.status === "ingediend" || vorig?.status === "ingediend" ? "ingediend" : "bezig";

  try {
    await schrijfInvullerBestand(gevonden.klantId, gevonden.link.invullerId, {
      antwoorden: schoneAntwoorden(body.antwoorden),
      status,
      bijgewerktOp: nu,
      ingediendOp: body.status === "ingediend" ? nu : (vorig?.ingediendOp ?? null),
    });
    if (status === "ingediend") await markeerGebruikt(gevonden.klantId, gevonden.link.id);
  } catch (err) {
    meldStoring("Antwoorden van een invuller opslaan mislukt", { klantId: gevonden.klantId, fout: err.message });
    return NextResponse.json({ error: "Opslaan mislukt. Probeer het zo nog eens." }, { status: 502, headers: HEADERS });
  }
  return NextResponse.json({ status, bijgewerktOp: nu }, { headers: HEADERS });
}
