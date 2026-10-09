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

test("een rol is nooit zijn eigen bestemming", () => {
  const m = calculateMobiliteit([
    rol("A", { fteWeg: 2, nu: [comp("x", 1)], straks: [comp("x", 1)] }),
    rol("B", { fteWeg: 0, nu: [comp("x", 1)], straks: [comp("x", 1)] }),
  ]);
  assert.equal(m.herkomsten[0].bestemmingen.every((b) => b.rolnaam !== "A"), true);
});

test("bestemmingen met te weinig overlap vallen af", () => {
  const m = calculateMobiliteit(
    [
      rol("Herkomst", { fteWeg: 2, nu: [comp("x", 1)], straks: [comp("x", 1)] }),
      rol("Ver weg", { fteWeg: 0, nu: [comp("y", 1)], straks: [comp("y", 1)] }),
    ],
    { minimaleOverlap: 0.3 }
  );
  assert.equal(m.herkomsten.length, 0, "geen enkel pad haalt de ondergrens");
});

test("bestemmingen staan op volgorde van haalbaarheid na training", () => {
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 3, nu: [comp("basis", 1)] , straks: [comp("basis", 1)] }),
    // Dichtbij: half gedeeld, rest trainbaar.
    rol("Dichtbij", { fteWeg: 0, nu: [], straks: [comp("basis", 0.5), comp("extra", 0.5, "hoog")] }),
    // Verder: half gedeeld, rest níet trainbaar.
    rol("Verder", { fteWeg: 0, nu: [], straks: [comp("basis", 0.5), comp("hard", 0.5, "laag")] }),
  ]);
  const namen = m.herkomsten[0].bestemmingen.map((b) => b.rolnaam);
  assert.equal(namen[0], "Dichtbij", `volgorde was ${namen.join(", ")}`);
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

test("de krimp van de bestemmingsrol wordt meegegeven", () => {
  // Een rol die zelf vrijwel verdwijnt is geen realistische bestemming, ook al sluiten
  // de competenties goed aan. Dat oordeel hoort bij de lezer, dus het getal moet erbij.
  const p = [comp("a", 1)];
  const m = calculateMobiliteit([
    rol("Herkomst", { fteWeg: 2, nu: p, straks: p }),
    rol("Verdwijnt bijna", { fteWeg: 0, fteOver: 0.1, nu: p, straks: p }),
  ]);
  assert.equal(m.herkomsten[0].bestemmingen[0].fteNaTransformatie, 0.1);
});

test("te weinig rollen of ontbrekende profielen leveren geen fout", () => {
  assert.equal(calculateMobiliteit([]).heeftData, false);
  assert.equal(calculateMobiliteit(null).heeftData, false);
  assert.equal(calculateMobiliteit([{ rolnaam: "A" }, { rolnaam: "B" }]).heeftData, false);
});
