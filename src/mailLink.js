// De mail waarmee een adviseur een invul- of aanleverlink naar een klant stuurt.
//
// Het concept is bewerkbaar, maar de link zelf niet: de server zet die onder het bericht en
// controleert dat hij bij deze klant hoort en nog geldt. Zo kan deze route niet misbruikt worden om
// willekeurige tekst of links vanuit ons domein te versturen.

export const MAIL_LIMIETEN = { onderwerp: 150, tekst: 4000, email: 254 };

const EMAIL = /^[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[^\s@<>"',;()]{2,}$/;

/** Eén geldig e-mailadres, of null. Geen lijsten: een mail gaat naar één ontvanger. */
export function valideerOntvanger(invoer) {
  const s = String(invoer ?? "").trim();
  return s.length > 0 && s.length <= MAIL_LIMIETEN.email && EMAIL.test(s) ? s : null;
}

const GROET = "Met vriendelijke groet,\nHouse of Digital";

/** Het concept dat de adviseur voor het versturen kan aanpassen. */
export function conceptMail({ soort, organisatie, rol }) {
  const naam = String(organisatie ?? "").trim() || "uw organisatie";
  if (soort === "aanlever") {
    return {
      onderwerp: `Gegevens aanleveren voor de AI-analyse van ${naam}`,
      tekst:
        `Beste,\n\n` +
        `Voor de analyse hebben wij twee dingen nodig: een overzicht van de functies in uw organisatie en de bijbehorende functieprofielen. Via de link hieronder kunt u beide uploaden. Wij controleren de bestanden voordat de analyse start.\n\n` +
        `Wij vragen geen gegevens van individuele medewerkers. Gebruik in de bestanden dus geen namen van personen.\n\n` +
        GROET,
    };
  }
  const rolRegel = rol ? `U vult de vragenlijst in vanuit de rol: ${rol}.\n\n` : "";
  return {
    onderwerp: `AI-volwassenheid van ${naam}: vragenlijst`,
    tekst:
      `Beste,\n\n` +
      `Samen met u brengen wij in kaart hoe ver ${naam} is met het inzetten van AI. Daarvoor vragen wij u een vragenlijst in te vullen: 100 stellingen, ongeveer 30 tot 45 minuten. U kunt tussendoor stoppen en later verdergaan met dezelfde link.\n\n` +
      rolRegel +
      `Uw antwoorden worden per rol verwerkt en niet per persoon getoond.\n\n` +
      GROET,
  };
}

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Zet bericht, knop en voetnoot samen tot de tekst- en de html-versie van de mail.
 * @param {string} tekst het (bewerkte) bericht
 * @param {string} url   de link, door de server gecontroleerd
 * @param {string} soort "invuller" | "aanlever"
 * @param {string|null} geldigTot leesbare datum
 * @param {string|null} logoUrl  absolute url van het (witte) logo; het komt op een donkere balk bovenaan
 */
export function bouwMail({ tekst, url, soort, geldigTot = null, logoUrl = null }) {
  const knop = soort === "aanlever" ? "Gegevens aanleveren" : "Vragenlijst openen";
  const voet = `Deze link is persoonlijk. Deel hem niet verder.${geldigTot ? ` Hij is geldig tot ${geldigTot}.` : ""}`;
  const bericht = String(tekst).replace(/\r\n/g, "\n").trim();

  const text = `${bericht}\n\n${knop}: ${url}\n\n${voet}\n`;

  const alinea = (deel) => `<p style="margin:0 0 14px;line-height:1.55;">${esc(deel).replace(/\n/g, "<br>")}</p>`;
  // Het logo is wit, dus het staat op een donkere balk. Zonder plaatjes (veel mailprogramma's blokkeren die
  // eerst) blijft de balk met de naam leesbaar.
  const kop = logoUrl
    ? `<div style="background:#241b4b;border-radius:10px;padding:16px 20px;margin:0 0 22px;"><img src="${esc(logoUrl)}" alt="House of Digital" height="30" style="height:30px;width:auto;display:block;border:0;color:#ffffff;font-size:14px;font-weight:bold;"></div>`
    : "";
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#241b4b;max-width:560px;">` +
    kop +
    bericht.split(/\n{2,}/).map(alinea).join("") +
    `<p style="margin:20px 0;"><a href="${esc(url)}" style="background:#7b4feb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-weight:bold;">${esc(knop)}</a></p>` +
    `<p style="margin:0 0 6px;font-size:12px;color:#6b6a8f;">Werkt de knop niet? Kopieer dan deze link in uw browser:<br><span style="word-break:break-all;">${esc(url)}</span></p>` +
    `<p style="margin:0;font-size:12px;color:#6b6a8f;">${esc(voet)}</p>` +
    `</div>`;

  return { text, html };
}

/**
 * Haalt soort en token uit een link naar onze eigen site. Geeft null voor alles wat geen invul- of
 * aanleverlink van deze site is.
 */
export function urlPastBijLink(url, origin) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return null;
  }
  if (u.origin !== new URL(origin).origin) return null;
  if (u.search || u.hash) return null;
  const m = u.pathname.match(/^\/(invullen|aanleveren)\/([A-Za-z0-9._-]{20,120})$/);
  if (!m) return null;
  return { soort: m[1] === "invullen" ? "invuller" : "aanlever", token: m[2] };
}
