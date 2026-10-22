import { NextResponse } from "next/server";
import { getClientMeta } from "@/lib/clientStore";
import { zoekLink, markeerGebruikt } from "@/lib/linkStore";
import { lijstInbox, zetInInbox, verwijderUitInbox } from "@/lib/inboxStore";
import { meldStoring } from "@/lib/alert";
import { parseRoster } from "../../../../../src/parseRoster.js";
import { controleerBestand, inhoudKlopt, BESTAND_SOORTEN, UPLOAD_LIMIETEN } from "../../../../../src/links.js";

// Publieke API voor de aanleverlink. Bestanden komen in een inbox en worden pas door de adviseur
// overgenomen; de link kan dus nooit een bestaand roster of profiel overschrijven en start geen
// analyse. Alles wordt gecontroleerd op soort, grootte en inhoud.

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const ONGELDIG = () => NextResponse.json({ error: "Deze link is niet (meer) geldig." }, { status: 404, headers: HEADERS });
const fout = (bericht, status = 400) => NextResponse.json({ error: bericht }, { status, headers: HEADERS });

export async function GET(request, { params }) {
  const { token } = await params;
  const gevonden = await zoekLink(token, "aanlever");
  if (!gevonden) return ONGELDIG();
  const meta = await getClientMeta(gevonden.klantId);
  if (!meta) return ONGELDIG();

  return NextResponse.json(
    {
      organisatie: meta.naam,
      bestanden: await lijstInbox(gevonden.klantId),
      soorten: Object.fromEntries(Object.entries(BESTAND_SOORTEN).map(([k, v]) => [k, { extensies: v.extensies, omschrijving: v.omschrijving, max: v.max }])),
      maxMB: Math.floor(UPLOAD_LIMIETEN.maxBytesPerBestand / 1024 / 1024),
      verlooptOp: gevonden.link.verlooptOp,
    },
    { headers: HEADERS }
  );
}

export async function POST(request, { params }) {
  const { token } = await params;
  const gevonden = await zoekLink(token, "aanlever");
  if (!gevonden) return ONGELDIG();

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return fout("De aanvraag kon niet worden gelezen.");
  }
  const soort = formData.get("soort");
  const bestand = formData.get("file");
  if (!bestand || typeof bestand === "string") return fout("Geen bestand ontvangen.");

  const controle = controleerBestand({ soort, naam: bestand.name, bytes: bestand.size });
  if (!controle.ok) return fout(controle.fout);

  const buffer = Buffer.from(await bestand.arrayBuffer());
  if (!inhoudKlopt(controle.naam, buffer)) return fout("De inhoud van het bestand past niet bij het bestandstype.");

  let rijen = null;
  if (soort === "roster") {
    try {
      rijen = parseRoster(buffer, controle.naam).length;
    } catch (err) {
      return fout(`Het functieoverzicht kon niet worden gelezen: ${err.message}`);
    }
  }

  try {
    const uit = await zetInInbox(gevonden.klantId, soort, controle.naam, buffer);
    if (!uit.ok) return fout(uit.fout);
    await markeerGebruikt(gevonden.klantId, gevonden.link.id);
  } catch (err) {
    meldStoring("Bestand aanleveren mislukt", { klantId: gevonden.klantId, fout: err.message });
    return fout("Het bestand kon niet worden opgeslagen. Probeer het zo nog eens.", 502);
  }
  return NextResponse.json({ ok: true, naam: controle.naam, soort, rijen }, { headers: HEADERS });
}

// Een eigen, nog niet overgenomen bestand weer weghalen.
export async function DELETE(request, { params }) {
  const { token } = await params;
  const gevonden = await zoekLink(token, "aanlever");
  if (!gevonden) return ONGELDIG();
  const { soort, naam } = await request.json().catch(() => ({}));
  try {
    const gelukt = await verwijderUitInbox(gevonden.klantId, soort, naam);
    if (!gelukt) return fout("Bestand niet gevonden.", 404);
  } catch (err) {
    meldStoring("Bestand verwijderen via aanleverlink mislukt", { klantId: gevonden.klantId, fout: err.message });
    return fout("Het bestand kon niet worden verwijderd.", 502);
  }
  return NextResponse.json({ ok: true }, { headers: HEADERS });
}
