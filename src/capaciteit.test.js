import test from "node:test";
import assert from "node:assert/strict";
import { calculateRole, calculateOrganisatie, calculateCapaciteitBestemming } from "./calculate.js";

const taak = (categorie, aandeel) => ({ omschrijving: "T", categorie, aandeel });

// Klantcontact is 70% automatiseerbaar in het realistische scenario, strategisch 25%.
const rol = (rolnaam, { fte = 1, categorie = "klantcontact", waardetype = null } = {}) => {
  const r = calculateRole({ rolnaam, fte, urenPerWeek: 36, kostenPerUur: 40, taken: [taak(categorie, 1)] });
  if (waardetype) r.waardetype = waardetype;
  return r;
};

test("vrijgekomen uren worden op organisatieniveau teruggegeven", () => {
  // Vier FTE à 36 uur = 144 uur; 70% daarvan is automatiseerbaar.
  const totals = calculateOrganisatie([rol("Klantenservice", { fte: 4 })]);
  assert.ok(Math.abs(totals.realistisch.totaalVrijgekomenUrenPerWeek - 144 * 0.7) < 0.01);
});

test("vrijgekomen uren en vrijgekomen FTE beschrijven hetzelfde", () => {
  const totals = calculateOrganisatie([rol("A", { fte: 4 }), rol("B", { fte: 2, categorie: "strategisch" })]);
  const { totaalVrijgekomenUrenPerWeek, totaalFteWeg } = totals.realistisch;
  // Alle rollen hier werken 36 uur per FTE, dus uren / 36 moet gelijk zijn aan FTE.
  assert.ok(Math.abs(totaalVrijgekomenUrenPerWeek / 36 - totaalFteWeg) < 1e-9);
});

test("bestemming splitst de capaciteit over de waardetypes", () => {
  const b = calculateCapaciteitBestemming([
    rol("Klantenservice", { fte: 4, waardetype: "kostenreductie" }),
    rol("Accountmanager", { fte: 2, waardetype: "capaciteitsgroei" }),
    rol("Kwaliteit", { fte: 1, waardetype: "kwaliteitsverbetering" }),
  ]);
  assert.equal(b.length, 3);
  assert.equal(b[0].waardetype, "kostenreductie", "grootste bestemming staat vooraan");
  assert.ok(Math.abs(b.reduce((s, g) => s + g.aandeel, 0) - 1) < 1e-9, "aandelen tellen op tot 1");
});

test("rollen met hetzelfde waardetype worden opgeteld", () => {
  const b = calculateCapaciteitBestemming([
    rol("A", { fte: 2, waardetype: "kostenreductie" }),
    rol("B", { fte: 3, waardetype: "kostenreductie" }),
  ]);
  assert.equal(b.length, 1);
  assert.equal(b[0].rollen, 2);
  assert.ok(Math.abs(b[0].aandeel - 1) < 1e-9);
});

test("rollen zonder waardetype vallen apart, niet stilzwijgend bij een van de drie", () => {
  // Analyses van vóór de waardetypes mogen de verdeling niet vervuilen.
  const b = calculateCapaciteitBestemming([
    rol("Oud", { fte: 2 }),
    rol("Nieuw", { fte: 2, waardetype: "kostenreductie" }),
  ]);
  assert.ok(b.some((g) => g.waardetype === "onbepaald"));
  assert.equal(b.find((g) => g.waardetype === "kostenreductie").rollen, 1);
});

test("het agressieve scenario levert meer capaciteit op dan het realistische", () => {
  const rollen = [rol("A", { fte: 4, waardetype: "kostenreductie" })];
  const re = calculateCapaciteitBestemming(rollen, "realistisch")[0];
  const ag = calculateCapaciteitBestemming(rollen, "agressief")[0];
  assert.ok(ag.urenPerWeek > re.urenPerWeek);
});

test("zonder rollen geen verdeling", () => {
  assert.deepEqual(calculateCapaciteitBestemming([]), []);
});
