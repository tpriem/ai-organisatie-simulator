import test from "node:test";
import assert from "node:assert/strict";
import { invoerSleutel, hergebruikRol, analyseOngewijzigd } from "./hergebruik.js";
import { calculateRole } from "./calculate.js";
import { stelWaardetypeIn } from "./waardetype.js";

const PROFIEL = "Functieprofiel: woonconsulent\n\nKerntaken:\n- verhuren van woningen\n- huuradministratie";
const row = (extra = {}) => ({ rolnaam: "woonconsulent", afdeling: "Wonen", fte: 12, urenPerWeek: 36, kostenPerUur: 31, ...extra });
const taken = [
  { omschrijving: "Verhuren", categorie: "verhuur", aandeel: 0.6 },
  { omschrijving: "Administratie", categorie: "data_entry", aandeel: 0.4 },
];

function vorige(extra = {}) {
  const sleutel = invoerSleutel({ rolLabel: "woonconsulent (Wonen)", profielTekst: PROFIEL });
  const r = calculateRole({ ...row(), taken });
  return { ...r, waardetype: "capaciteitsgroei", waardetypeToelichting: "bedient huurders", invoerSleutel: sleutel, ingeschatOp: "2026-11-11T10:00:00.000Z", ...extra };
}

test("de sleutel is gelijk bij dezelfde invoer en anders bij een ander profiel of een andere rol", () => {
  const a = invoerSleutel({ rolLabel: "woonconsulent (Wonen)", profielTekst: PROFIEL });
  assert.equal(a, invoerSleutel({ rolLabel: "woonconsulent (Wonen)", profielTekst: PROFIEL }));
  assert.equal(a, invoerSleutel({ rolLabel: " woonconsulent  (Wonen)", profielTekst: PROFIEL.replace(/\n/g, "\r\n") }), "witruimte en regeleinden tellen niet");
  assert.notEqual(a, invoerSleutel({ rolLabel: "woonconsulent (Wonen)", profielTekst: PROFIEL + "\n- taxeren" }));
  assert.notEqual(a, invoerSleutel({ rolLabel: "verkoopmakelaar (Wonen)", profielTekst: PROFIEL }));
});

test("bij dezelfde invoer wordt de eerdere inschatting hergebruikt en geeft dat dezelfde uitkomst", () => {
  const v = vorige();
  const r = hergebruikRol(v, row(), v.invoerSleutel);
  assert.ok(r);
  assert.equal(r.scenarios.realistisch.fteWeg, v.scenarios.realistisch.fteWeg);
  assert.deepEqual(r.taken.map((t) => [t.categorie, t.aandeel]), taken.map((t) => [t.categorie, t.aandeel]));
  assert.equal(r.waardetype, "capaciteitsgroei");
  assert.equal(r.ingeschatOp, "2026-11-11T10:00:00.000Z", "het moment van inschatten blijft dat van de eerste keer");
});

test("een ander aantal FTE in het functieoverzicht wordt wel doorgerekend", () => {
  const v = vorige();
  const r = hergebruikRol(v, row({ fte: 6 }), v.invoerSleutel);
  assert.equal(r.fte, 6);
  assert.ok(Math.abs(r.scenarios.realistisch.fteWeg - v.scenarios.realistisch.fteWeg / 2) < 1e-9);
});

test("zonder eerdere inschatting, of bij andere invoer, wordt niets hergebruikt", () => {
  const v = vorige();
  assert.equal(hergebruikRol(null, row(), v.invoerSleutel), null);
  assert.equal(hergebruikRol(v, row(), "andere-sleutel"), null);
  assert.equal(hergebruikRol({ ...v, invoerSleutel: undefined }, row(), v.invoerSleutel), null, "oude resultaten zonder sleutel");
  assert.equal(hergebruikRol({ ...v, taken: [] }, row(), v.invoerSleutel), null);
  const onbekend = { ...v, taken: [{ omschrijving: "x", categorie: "accountmanagement", aandeel: 1 }] };
  assert.equal(hergebruikRol(onbekend, row(), v.invoerSleutel), null, "een categorie die niet meer bestaat");
});

test("hergebruik neemt de inschatting van het model over, niet de handmatige keuze van de adviseur", () => {
  const v = stelWaardetypeIn(vorige(), "kostenreductie", { reden: "keuze van de klant" });
  const r = hergebruikRol(v, row(), v.invoerSleutel);
  assert.equal(r.waardetype, "capaciteitsgroei", "de handmatige keuze wordt daarna apart overgenomen");
  assert.equal(r.waardetypeToelichting, "bedient huurders");
});

test("een analyse is ongewijzigd als elke rol dezelfde invoer en dezelfde uitkomst heeft", () => {
  const v = vorige();
  const a = { rollen: [v], missingProfiles: [], mislukteRollen: [] };
  const zelfde = { rollen: [hergebruikRol(v, row(), v.invoerSleutel)], missingProfiles: [], mislukteRollen: [] };
  assert.equal(analyseOngewijzigd(a, zelfde), true);
  const andereFte = { rollen: [hergebruikRol(v, row({ fte: 6 }), v.invoerSleutel)], missingProfiles: [], mislukteRollen: [] };
  assert.equal(analyseOngewijzigd(a, andereFte), false);
  assert.equal(analyseOngewijzigd(a, { ...zelfde, missingProfiles: ["x"] }), false);
  assert.equal(analyseOngewijzigd(a, { ...zelfde, mislukteRollen: [{ roleId: "y" }] }), false);
  assert.equal(analyseOngewijzigd(null, zelfde), false);
  assert.equal(analyseOngewijzigd({ rollen: [{ ...v, invoerSleutel: undefined }] }, zelfde), false);
});
