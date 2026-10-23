import test from "node:test";
import assert from "node:assert/strict";
import { valideerOntvanger, conceptMail, bouwMail, urlPastBijLink, MAIL_LIMIETEN } from "./mailLink.js";

const ORIGIN = "https://www.transformation-simulation.ai";
const TOKEN = "a7a47c8c-2acf-42f6-aada-9d9a89d5b282.xlL6uAvmsxj5OD7ikKtUJ_i_9Wu7YA1_";

test("één geldig e-mailadres wordt geaccepteerd, de rest niet", () => {
  assert.equal(valideerOntvanger("  jan@bedrijf.nl "), "jan@bedrijf.nl");
  for (const slecht of ["", null, "jan", "jan@bedrijf", "a@b.nl, c@d.nl", "a@b.nl;c@d.nl", "Jan <jan@bedrijf.nl>", "jan@bedrijf.nl\nbcc:x@y.nl", "a b@c.nl"]) {
    assert.equal(valideerOntvanger(slecht), null, `"${slecht}" had geweigerd moeten worden`);
  }
  assert.equal(valideerOntvanger(`${"a".repeat(MAIL_LIMIETEN.email)}@b.nl`), null);
});

test("het concept noemt de organisatie en bij een invuller de rol", () => {
  const inv = conceptMail({ soort: "invuller", organisatie: "Voorbeeld BV", rol: "Directie · directielid" });
  assert.match(inv.onderwerp, /Voorbeeld BV/);
  assert.match(inv.tekst, /vanuit de rol: Directie · directielid/);
  assert.match(inv.tekst, /niet per persoon getoond/);
  const aan = conceptMail({ soort: "aanlever", organisatie: "Voorbeeld BV" });
  assert.match(aan.onderwerp, /Gegevens aanleveren/);
  assert.match(aan.tekst, /geen namen van personen/);
  assert.doesNotMatch(aan.tekst, /rol:/);
});

test("zonder organisatienaam valt het concept terug op 'uw organisatie'", () => {
  assert.match(conceptMail({ soort: "invuller", organisatie: "" }).onderwerp, /uw organisatie/);
});

test("de mail bevat de link één keer als knop en als gewone tekst, met de geldigheid", () => {
  const { text, html } = bouwMail({ tekst: "Beste,\n\nKijk even.", url: `${ORIGIN}/invullen/${TOKEN}`, soort: "invuller", geldigTot: "6 december 2026" });
  assert.match(text, /Vragenlijst openen: https:\/\/www\.transformation-simulation\.ai\/invullen\//);
  assert.match(text, /geldig tot 6 december 2026/);
  assert.match(html, /<a href="https:\/\/www\.transformation-simulation\.ai\/invullen\/[^"]+"[^>]*>Vragenlijst openen<\/a>/);
});

test("het bericht kan geen html of extra links in de mail brengen", () => {
  const { html } = bouwMail({ tekst: '<script>alert(1)</script> <a href="https://kwaad.nl">klik</a> & "meer"', url: `${ORIGIN}/aanleveren/${TOKEN}`, soort: "aanlever" });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<a href="https:\/\/kwaad\.nl"/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
  // De enige echte link is die van ons.
  assert.equal([...html.matchAll(/<a href="([^"]+)"/g)].length, 1);
});

test("alinea's en regeleinden blijven behouden", () => {
  const { html } = bouwMail({ tekst: "Eerste regel\nTweede regel\n\nNieuwe alinea", url: `${ORIGIN}/invullen/${TOKEN}`, soort: "invuller" });
  assert.match(html, /Eerste regel<br>Tweede regel/);
  assert.equal((html.match(/<p style="margin:0 0 14px/g) ?? []).length, 2);
});

test("alleen een invul- of aanleverlink van deze site komt door de controle", () => {
  assert.deepEqual(urlPastBijLink(`${ORIGIN}/invullen/${TOKEN}`, ORIGIN), { soort: "invuller", token: TOKEN });
  assert.deepEqual(urlPastBijLink(`${ORIGIN}/aanleveren/${TOKEN}`, ORIGIN), { soort: "aanlever", token: TOKEN });
  for (const slecht of [
    `https://kwaad.nl/invullen/${TOKEN}`,
    `${ORIGIN}/app/klant/x`,
    `${ORIGIN}/invullen/kort`,
    `${ORIGIN}/invullen/${TOKEN}?x=1`,
    `${ORIGIN}/invullen/${TOKEN}#a`,
    `${ORIGIN}/invullen/${TOKEN}/extra`,
    `http://www.transformation-simulation.ai/invullen/${TOKEN}`,
    "geen url",
    "",
  ]) {
    assert.equal(urlPastBijLink(slecht, ORIGIN), null, `"${slecht}" had geweigerd moeten worden`);
  }
});
