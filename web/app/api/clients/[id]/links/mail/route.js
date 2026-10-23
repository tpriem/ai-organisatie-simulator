import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getClientMeta } from "@/lib/clientStore";
import { zoekLink } from "@/lib/linkStore";
import { sendLinkEmail } from "@/lib/mail";
import { siteOrigin } from "@/lib/siteOrigin";
import { meldStoring } from "@/lib/alert";
import { valideerOntvanger, bouwMail, urlPastBijLink, MAIL_LIMIETEN } from "../../../../../../../src/mailLink.js";

// Een invul- of aanleverlink per mail naar een klant sturen. Alleen voor ingelogde adviseurs.
// De link wordt hier gecontroleerd (van deze site, bij deze klant, nog geldig) en door de server onder
// het bericht gezet; het bericht zelf is vrije tekst van de adviseur en wordt als tekst verwerkt.

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  const sessie = await auth();
  return NextResponse.json({
    organisatie: meta.naam,
    afzender: sessie?.user?.email ?? null,
    beschikbaar: Boolean(process.env.RESEND_API_KEY),
  });
}

const datum = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
};

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldig verzoek." }, { status: 400 });
  }

  const aan = valideerOntvanger(body.aan);
  if (!aan) return NextResponse.json({ error: "Vul één geldig e-mailadres in." }, { status: 400 });

  const onderwerp = String(body.onderwerp ?? "").replace(/[\r\n]+/g, " ").trim();
  const tekst = String(body.tekst ?? "").trim();
  if (!onderwerp || onderwerp.length > MAIL_LIMIETEN.onderwerp) {
    return NextResponse.json({ error: `Het onderwerp is verplicht en maximaal ${MAIL_LIMIETEN.onderwerp} tekens.` }, { status: 400 });
  }
  if (!tekst || tekst.length > MAIL_LIMIETEN.tekst) {
    return NextResponse.json({ error: `Het bericht is verplicht en maximaal ${MAIL_LIMIETEN.tekst} tekens.` }, { status: 400 });
  }

  const onderdelen = urlPastBijLink(body.url, siteOrigin(request));
  if (!onderdelen) return NextResponse.json({ error: "Dit is geen link van deze site." }, { status: 400 });
  const gevonden = await zoekLink(onderdelen.token, onderdelen.soort);
  if (!gevonden || gevonden.klantId !== id) {
    return NextResponse.json({ error: "Deze link hoort niet bij deze klant of is niet meer geldig." }, { status: 400 });
  }

  const sessie = await auth();
  const afzender = sessie?.user?.email ?? null;
  const { text, html } = bouwMail({
    tekst,
    url: body.url,
    soort: onderdelen.soort,
    geldigTot: datum(gevonden.link.verlooptOp),
    logoUrl: `${siteOrigin(request)}/hod-logo-white.png`,
  });

  try {
    await sendLinkEmail({
      to: aan,
      replyTo: afzender ?? undefined,
      bcc: body.kopie && afzender ? afzender : undefined,
      subject: onderwerp,
      text,
      html,
    });
  } catch (err) {
    // Het adres van de klant komt bewust niet in de melding of het log terecht.
    meldStoring("Link mailen mislukt", { klantId: id, fout: err.message });
    return NextResponse.json({ error: `De mail kon niet worden verstuurd: ${err.message}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
