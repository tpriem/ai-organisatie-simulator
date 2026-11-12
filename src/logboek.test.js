import test from "node:test";
import assert from "node:assert/strict";
import { voegToe, schoonLogboek, regelTekst, MAX_REGELS, ACTIES } from "./logboek.js";
import { maakBegrenzer } from "./begrenzer.js";

test("een nieuwe regel komt bovenaan, met tijdstip, handeling en wie het deed", () => {
  const nu = new Date("2026-11-12T09:00:00Z");
  const l = voegToe([], { actie: "analyse_gedraaid", door: "adviseur@voorbeeld.nl", details: { rollen: 51, hergebruikt: 40 } }, { nu });
  assert.deepEqual(l, [{ op: "2026-11-12T09:00:00.000Z", actie: "analyse_gedraaid", door: "adviseur@voorbeeld.nl", details: { rollen: 51, hergebruikt: 40 } }]);
  const l2 = voegToe(l, { actie: "rapport_gedownload", details: { soort: "capaciteit", formaat: "PDF" } });
  assert.equal(l2.length, 2);
  assert.equal(l2[0].actie, "rapport_gedownload");
  assert.equal(l2[0].door, null);
});

test("onbekende handelingen en rommel komen er niet in", () => {
  assert.deepEqual(voegToe([], { actie: "iets_anders" }), []);
  const l = voegToe([{ rommel: true }, null, "tekst"], { actie: "link_gemaakt", details: { soort: "invuller", "slechte sleutel!": "x", object: { a: 1 }, lang: "a".repeat(500) } });
  assert.equal(l.length, 1, "ongeldige oude regels vallen weg");
  assert.deepEqual(Object.keys(l[0].details), ["soort", "lang"]);
  assert.equal(l[0].details.lang.length, 200);
});

test("het logboek groeit niet onbegrensd", () => {
  let l = [];
  for (let i = 0; i < MAX_REGELS + 20; i++) l = voegToe(l, { actie: "rapport_gedownload" });
  assert.equal(l.length, MAX_REGELS);
  assert.equal(schoonLogboek("geen lijst").length, 0);
});

test("een regel is leesbaar voor het scherm", () => {
  assert.equal(regelTekst({ actie: "rapport_gedownload", details: { soort: "capaciteit", formaat: "PDF" } }), "Rapport gedownload (capaciteit, PDF)");
  assert.equal(regelTekst({ actie: "meting_vastgelegd", details: {} }), ACTIES.meting_vastgelegd);
});

test("de begrenzer voor inloggen: na het maximum is het even klaar, per adres apart", () => {
  let t = 0;
  const mag = maakBegrenzer({ limiet: 3, tijdvakMs: 1000, nu: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => mag("a@b.nl")), [true, true, true, false]);
  assert.equal(mag("c@d.nl"), true);
  t = 1001;
  assert.equal(mag("a@b.nl"), true);
});
