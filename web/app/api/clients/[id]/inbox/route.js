import { NextResponse } from "next/server";
import { getClientMeta, uploadRoster, uploadProfiles } from "@/lib/clientStore";
import { lijstInbox, leesUitInbox, verwijderUitInbox } from "@/lib/inboxStore";
import { meldStoring } from "@/lib/alert";

// De inbox met bestanden die klanten via de aanleverlink hebben aangeleverd. De adviseur neemt
// ze over naar het echte roster of de functieprofielen, of verwijdert ze. Een analyse start
// nooit vanzelf: die kost aanroepen aan Claude en hoort bij een bewuste keuze.

export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  return NextResponse.json({ bestanden: await lijstInbox(id) });
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const { soort, naam } = await request.json();

  try {
    const bestand = await leesUitInbox(id, soort, naam);
    if (!bestand) return NextResponse.json({ error: "Bestand niet gevonden" }, { status: 404 });
    if (soort === "roster") await uploadRoster(id, bestand.naam, bestand.buffer);
    else await uploadProfiles(id, [{ fileName: bestand.naam, buffer: bestand.buffer }]);
    await verwijderUitInbox(id, soort, bestand.naam);
    return NextResponse.json({ ok: true, naam: bestand.naam });
  } catch (err) {
    meldStoring("Bestand overnemen uit de inbox mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Het bestand kon niet worden overgenomen." }, { status: 502 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const { soort, naam } = await request.json();
  try {
    const gelukt = await verwijderUitInbox(id, soort, naam);
    if (!gelukt) return NextResponse.json({ error: "Bestand niet gevonden" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    meldStoring("Bestand verwijderen uit de inbox mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "Het bestand kon niet worden verwijderd." }, { status: 502 });
  }
}
