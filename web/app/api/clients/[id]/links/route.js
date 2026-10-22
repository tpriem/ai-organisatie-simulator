import { NextResponse } from "next/server";
import { getClientMeta } from "@/lib/clientStore";
import { readLinks, maakLink, trekLinkIn } from "@/lib/linkStore";
import { readMaturiteit, voegLinkInvullerToe, verwijderLinkInvuller } from "@/lib/maturiteitStore";
import { siteOrigin } from "@/lib/siteOrigin";
import { meldStoring } from "@/lib/alert";
import { publiekeWeergave } from "../../../../../../src/links.js";
import { ROLLEN, MAX_INVULLERS } from "../../../../../../src/volwassenheid.js";

// Links voor klanten, beheerd door de adviseur (achter de login).
//  - invullink: één per invuller, voor de vragenlijst;
//  - aanleverlink: één actieve per klant, voor de uploads.
// Het geheim in een link wordt alleen bij het aanmaken getoond en niet bewaard.

const pad = { invuller: "invullen", aanlever: "aanleveren" };

export async function GET(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const links = await readLinks(id);
  return NextResponse.json({ links: links.map((l) => publiekeWeergave(l)) });
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const body = await request.json();

  try {
    // Een nieuwe link voor dezelfde invuller, bijvoorbeeld als de eerste kwijt is.
    if (body.actie === "vernieuw") {
      const links = await readLinks(id);
      const oud = links.find((l) => l.id === body.linkId && l.type === "invuller");
      if (!oud) return NextResponse.json({ error: "Link niet gevonden" }, { status: 404 });
      await trekLinkIn(id, oud.id);
      const { link, token } = await maakLink(id, { type: "invuller", rol: oud.rol, label: oud.label, invullerId: oud.invullerId });
      return NextResponse.json({ link: publiekeWeergave(link), url: `${siteOrigin(request)}/${pad.invuller}/${token}` });
    }

    if (body.type === "aanlever") {
      const { link, token } = await maakLink(id, { type: "aanlever" });
      return NextResponse.json({ link: publiekeWeergave(link), url: `${siteOrigin(request)}/${pad.aanlever}/${token}` });
    }

    if (body.type === "invuller") {
      if (!ROLLEN.some((r) => r.id === body.rol && r.id !== "adviseur")) {
        return NextResponse.json({ error: "Kies een rol voor deze invuller." }, { status: 400 });
      }
      const { huidig } = await readMaturiteit(id);
      if (huidig.invullers.length >= MAX_INVULLERS) {
        return NextResponse.json({ error: `Er zijn al ${MAX_INVULLERS} invullers.` }, { status: 400 });
      }
      const label = String(body.label ?? "").trim().slice(0, 60);
      const invullerId = `${body.rol}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await voegLinkInvullerToe(id, { invullerId, rol: body.rol, label });
      const { link, token } = await maakLink(id, { type: "invuller", rol: body.rol, label, invullerId });
      return NextResponse.json({ link: publiekeWeergave(link), invullerId, url: `${siteOrigin(request)}/${pad.invuller}/${token}` });
    }

    return NextResponse.json({ error: "Onbekend type link." }, { status: 400 });
  } catch (err) {
    meldStoring("Link aanmaken mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "De link kon niet worden aangemaakt." }, { status: 502 });
  }
}

// Een link intrekken. Voor een invullink kan ook de invuller met zijn antwoorden worden verwijderd.
export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const { linkId, verwijderInvuller } = await request.json();

  try {
    const link = await trekLinkIn(id, linkId);
    if (!link) return NextResponse.json({ error: "Link niet gevonden" }, { status: 404 });
    if (verwijderInvuller && link.type === "invuller" && link.invullerId) await verwijderLinkInvuller(id, link.invullerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    meldStoring("Link intrekken mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: "De link kon niet worden ingetrokken." }, { status: 502 });
  }
}
