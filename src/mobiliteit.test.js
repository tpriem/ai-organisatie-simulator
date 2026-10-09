import test from "node:test";
import assert from "node:assert/strict";
import { calculateMobiliteit, vergelijkProfielen } from "./mobiliteit.js";

const comp = (naam, aandeel, trainbaarheid = "hoog") => ({ naam, aandeel, trainbaarheid });

const rol = (rolnaam, { fteWeg = 1, fteOver = 1, nu = [], straks = [] } = {}) => ({
  rolnaam,
  roleId: rolnaam.toLowerCase().replace(/\W+/g, "_"),
  roleLabel: rolnaam,
  scenarios: { realistisch: { fteWeg, fteOver }, agressief: { fteWeg: fteWeg * 1.3, fteOver: fteOver * 0.7 } },
  competentieProfiel: { profielNu: nu, profielStraks: straks },
});

test("identieke profielen geven volledige overlap", () => {
  const p = [comp("a", 0.6), comp("b", 0.4)];
  const v = vergelijkProfielen(p, p);
  assert.ok(Math.abs(v.overlap - 1) < 1e-9);
  assert.equal(v.teOntwikkelen.length, 0);
});

test("profielen zonder gedeelde competenties geven geen overlap", () => {
  const v = vergelijkProfielen([comp("a", 1)], [comp("b", 1)]);
  assert.equal(v.overlap, 0);
  assert.equal(v.teOntwikkelen.length, 1);
});

test("het tekort is trainbaar of niet, en dat bepaalt de haalbaarheid", () => {
  const nu = [comp("gedeeld", 0.5)];
  const trainbaar = vergelijkProfielen(nu, [comp("gedeeld", 0.5), comp("nieuw", 0.5, "hoog")]);
  const niet = vergelijkProfielen(nu, [comp("gedeeld", 0.5), comp("nieuw", 0.5, "laag")]);

  assert.ok(Math.abs(trainbaar.overlap - 0.5) < 1e-9);
  assert.ok(Math.abs(trainbaar.overlapNaTraining - 1) < 1e-9, "trainbaar tekort telt mee na training");
  assert.ok(Math.abs(niet.overlapNaTraining - 0.5) < 1e-9, "niet-trainbaar tekort telt niet mee");
  assert.equal(niet.teToetsen.length, 1);
});

test("overlap na training ligt nooit onder de overlap of boven 100%", () => {
  const v = vergelijkProfielen([comp("a", 0.3), comp("b", 0.7)], [comp("a", 0.5), comp("c", 0.5, "hoog")]);
  assert.ok(v.overlapNaTraining >= v.overlap);
  assert.ok(v.overlapNaTraining <= 1 + 1e-9);
});

test("een rol zonder vrijgekomen capaciteit is geen herkomst", () => {
  const m = calculateMobiliteit([
    rol("Blijft", { fteWeg: 0, nu: [comp("a", 1)], straks: [comp("a", 1)] }),
    rol("Doel", { fteWeg: 0, nu: [comp("a", 1)], straks: [comp("a", 1)] }),
  ]);
  assert.equal(m.herkomsten.length, 0);
  assert.equal(m.heeftData, false);
});

test("de herkomst met de meeste vrijgekomen capaciteit staat vooraan", () => {
  const p = [comp("a", 1)];
  const m = calculateMobiliteit([
    rol("Klein", { fteWeg: 0.5, nu: p, straks: p }),
    rol("Groot", { fteWeg: 4, nu: p, straks: p }),
    rol("Doel", { fteWeg: 0, nu: p, straks: p }),
  ]);
  assert.equal(m.herkomsten[0].rolnaam, "Groot");
});

test("te weinig rollen of ontbrekende profielen leveren geen fout", () => {
  assert.equal(calculateMobiliteit([]).heeftData, false);
  assert.equal(calculateMobiliteit(null).heeftData, false);
  assert.equal(calculateMobiliteit([{ rolnaam: "A" }, { rolnaam: "B" }]).heeftData, false);
});

test("blijven is de maatstaf waaraan alternatieven worden afgemeten", () => {
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 2, nu: [comp("a", 0.5), comp("b", 0.5)], straks: [comp("a", 1)] }),
    rol("Doel", { fteWeg: 0, nu: [], straks: [comp("b", 1)] }),
  ]);
  const h = m.herkomsten[0];
  assert.equal(h.blijvenOverlapPct, 50, "eigen profiel dekt de helft van de eigen toekomst");
  assert.equal(h.alternatieven[0].overlapPct, 50);
  assert.ok(Math.abs(h.alternatieven[0].verhouding - 1) < 1e-9, "even kansrijk als blijven");
});

test("een alternatief dat ver achterblijft bij blijven wordt niet genoemd", () => {
  // Niet omdat het onmogelijk is, maar omdat het geen advies is dat deze data draagt.
  const m = calculateMobiliteit(
    [
      rol("Herkomst", { fteWeg: 2, nu: [comp("a", 0.9), comp("b", 0.1)], straks: [comp("a", 1)] }),
      rol("Ver weg", { fteWeg: 0, nu: [], straks: [comp("b", 1)] }),
    ],
    { minimaleVerhouding: 0.4 }
  );
  assert.equal(m.herkomsten[0].alternatieven.length, 0, "0,1 tegen 0,9 is te ver");
});

test("een rol is nooit zijn eigen alternatief", () => {
  const p = [comp("x", 1)];
  const m = calculateMobiliteit([rol("A", { fteWeg: 2, nu: p, straks: p }), rol("B", { fteWeg: 0, nu: p, straks: p })]);
  assert.ok(m.herkomsten[0].alternatieven.every((a) => a.rolnaam !== "A"));
});

test("alternatieven staan op volgorde van ruwe overlap, niet van trainbaarheid", () => {
  // Overlap na training onderscheidt bestemmingen nauwelijks; de ruwe overlap wel.
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 3, nu: [comp("a", 0.6), comp("b", 0.4)], straks: [comp("a", 1)] }),
    rol("Dichtbij", { fteWeg: 0, nu: [], straks: [comp("a", 0.6), comp("nieuw", 0.4, "hoog")] }),
    rol("Verder", { fteWeg: 0, nu: [], straks: [comp("b", 0.4), comp("nieuw", 0.6, "hoog")] }),
  ]);
  assert.equal(m.herkomsten[0].alternatieven[0].rolnaam, "Dichtbij");
});

test("het niet-trainbare deel van het gat komt mee als risicosignaal", () => {
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 2, nu: [comp("gedeeld", 1)], straks: [comp("gedeeld", 1)] }),
    rol("Doel", { fteWeg: 0, nu: [], straks: [comp("gedeeld", 0.5), comp("hard", 0.5, "laag")] }),
  ]);
  const alt = m.herkomsten[0].alternatieven[0];
  assert.equal(alt.nietTrainbaarPct, 50);
  assert.equal(alt.teToetsen.length, 1);
});

test("de krimp van de bestemmingsrol komt mee", () => {
  // Een rol die zelf vrijwel verdwijnt is geen realistische bestemming, hoe goed de
  // competenties ook aansluiten. Dat oordeel is aan de lezer, dus het getal hoort erbij.
  const p = [comp("a", 1)];
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 2, nu: p, straks: p }),
    rol("Verdwijnt bijna", { fteWeg: 0, fteOver: 0.1, nu: p, straks: p }),
  ]);
  assert.equal(m.herkomsten[0].alternatieven[0].fteNaTransformatie, 0.1);
});
