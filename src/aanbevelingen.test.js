import test from "node:test";
import assert from "node:assert/strict";
import { schoneAanbevelingen, bewerkAanbevelingen, isGoedgekeurd, resultatenVoorRapport, AANBEVELING_KOPPEN } from "./aanbevelingen.js";

const VOL = {
  bevindingenSamenvatting: "  Er komt vooral tijd vrij in de administratie.  ",
  krimpendeRollen: [{ rolnaam: "medewerker huuradministratie", toelichting: "veel gegevensverwerking" }],
  groeiendeRollen: [{ rolnaam: "kwaliteitsadviseur", toelichting: "toezicht op AI" }, { rolnaam: "", toelichting: "" }],
  samenvoegKandidaten: [{ rollen: ["planner", "werkvoorbereider"], toelichting: "overlap in planning" }],
  aanbevelingen: [{ titel: "Begin bij huurderscontact", beschrijving: "Start met een proef." }],
};

test("schone aanbevelingen: alleen bekende velden, lege items weg, tekst bijgesneden", () => {
  const s = schoneAanbevelingen({ ...VOL, onbekend: "x", goedgekeurd: { op: "nep" } });
  assert.deepEqual(Object.keys(s), ["bevindingenSamenvatting", "krimpendeRollen", "groeiendeRollen", "samenvoegKandidaten", "aanbevelingen"]);
  assert.equal(s.bevindingenSamenvatting, "Er komt vooral tijd vrij in de administratie.");
  assert.equal(s.groeiendeRollen.length, 1, "het lege item valt weg");
  assert.equal(schoneAanbevelingen({ bevindingenSamenvatting: "a".repeat(5000) }).bevindingenSamenvatting.length, 2000);
  assert.deepEqual(schoneAanbevelingen(null).aanbevelingen, []);
  assert.equal(schoneAanbevelingen({ aanbevelingen: Array.from({ length: 30 }, () => ({ titel: "t", beschrijving: "b" })) }).aanbevelingen.length, 12);
});

test("goedkeuren legt vast wanneer en door wie; bewerken zonder goedkeuren maakt er weer een concept van", () => {
  const goed = bewerkAanbevelingen(VOL, { goedkeuren: true, door: "adviseur@voorbeeld.nl", nu: new Date("2026-11-12T10:00:00Z") });
  assert.equal(isGoedgekeurd(goed), true);
  assert.deepEqual(goed.goedgekeurd, { op: "2026-11-12T10:00:00.000Z", door: "adviseur@voorbeeld.nl" });
  const bewerkt = bewerkAanbevelingen({ ...goed, bevindingenSamenvatting: "Andere tekst" });
  assert.equal(isGoedgekeurd(bewerkt), false);
  assert.equal(isGoedgekeurd(null), false);
  assert.equal(isGoedgekeurd(VOL), false, "wat het model teruggeeft is een concept");
});

test("een rapport krijgt de aanbevelingen alleen als ze zijn goedgekeurd", () => {
  const concept = { rollen: [1], aanbevelingen: schoneAanbevelingen(VOL) };
  assert.equal(resultatenVoorRapport(concept).aanbevelingen, null);
  assert.deepEqual(resultatenVoorRapport(concept).rollen, [1], "de rest van de resultaten blijft");
  const goed = { rollen: [1], aanbevelingen: bewerkAanbevelingen(VOL, { goedkeuren: true }) };
  assert.equal(resultatenVoorRapport(goed), goed);
  assert.equal(resultatenVoorRapport(null), null);
  assert.deepEqual(resultatenVoorRapport({ rollen: [] }), { rollen: [] });
});

test("de koppen spreken over tijd die vrijkomt, niet over krimp", () => {
  for (const kop of Object.values(AANBEVELING_KOPPEN)) assert.doesNotMatch(kop, /krimp|reductie|weg kan/i);
});
