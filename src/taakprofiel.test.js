import test from "node:test";
import assert from "node:assert/strict";
import { calculateTaakprofiel } from "./taakprofiel.js";
import { calculateRole } from "./calculate.js";

const taak = (categorie, categorieLabel, urenPerWeek, automatiseerbaar) => ({
  categorie,
  categorieLabel,
  urenPerWeek,
  urenAutomatiseerbaarPerWeek: automatiseerbaar,
});

const rol = (taken) => ({ scenarios: { realistisch: { taken } } });

test("aandelen tellen op tot 1, nu en straks", () => {
  const p = calculateTaakprofiel([
    rol([taak("data_entry", "Data entry", 60, 45), taak("strategisch", "Strategisch", 40, 10)]),
  ]);
  const somNu = p.categorieen.reduce((s, c) => s + c.aandeelNu, 0);
  const somStraks = p.categorieen.reduce((s, c) => s + c.aandeelStraks, 0);
  assert.ok(Math.abs(somNu - 1) < 1e-9);
  assert.ok(Math.abs(somStraks - 1) < 1e-9);
});

test("werk dat minder automatiseerbaar is wordt relatief belangrijker", () => {
  // Administratie verliest 75% van de uren, strategisch werk maar 25%.
  const p = calculateTaakprofiel([
    rol([taak("data_entry", "Data entry", 60, 45), taak("strategisch", "Strategisch", 40, 10)]),
  ]);
  const admin = p.categorieen.find((c) => c.id === "data_entry");
  const strat = p.categorieen.find((c) => c.id === "strategisch");

  assert.ok(admin.verschuiving < 0, "administratie krimpt in aandeel");
  assert.ok(strat.verschuiving > 0, "strategisch werk groeit in aandeel");
  // In absolute uren krimpt strategisch werk óók — het aandeel is wat stijgt.
  assert.ok(strat.urenStraks < strat.urenNu);
});

test("uren worden over rollen heen opgeteld per categorie", () => {
  const p = calculateTaakprofiel([
    rol([taak("klantcontact", "Klantcontact", 100, 70)]),
    rol([taak("klantcontact", "Klantcontact", 50, 35)]),
  ]);
  assert.equal(p.categorieen.length, 1);
  assert.equal(p.categorieen[0].urenNu, 150);
  assert.equal(p.categorieen[0].urenStraks, 45);
});

test("de grootste categorie staat vooraan", () => {
  const p = calculateTaakprofiel([
    rol([taak("creatief", "Creatief", 10, 2), taak("data_entry", "Data entry", 90, 60)]),
  ]);
  assert.equal(p.categorieen[0].id, "data_entry");
});

test("het aandeel is onafhankelijk van de omvang van de organisatie", () => {
  // Hetzelfde profiel, tien keer zo groot: de aandelen moeten gelijk zijn. Dat is wat
  // dit getal tussen klanten vergelijkbaar maakt.
  const klein = calculateTaakprofiel([rol([taak("a", "A", 30, 10), taak("b", "B", 70, 20)])]);
  const groot = calculateTaakprofiel([rol([taak("a", "A", 300, 100), taak("b", "B", 700, 200)])]);
  for (const c of klein.categorieen) {
    const g = groot.categorieen.find((x) => x.id === c.id);
    assert.ok(Math.abs(c.aandeelNu - g.aandeelNu) < 1e-9);
    assert.ok(Math.abs(c.aandeelStraks - g.aandeelStraks) < 1e-9);
  }
});

test("werkt op echte rolresultaten uit calculateRole", () => {
  const r = calculateRole({
    rolnaam: "Klantenservice",
    fte: 4,
    urenPerWeek: 36,
    kostenPerUur: 30,
    taken: [
      { omschrijving: "Bellen", categorie: "klantcontact", aandeel: 0.7 },
      { omschrijving: "Rapporteren", categorie: "analyseren", aandeel: 0.3 },
    ],
  });
  const p = calculateTaakprofiel([r]);
  assert.equal(p.categorieen.length, 2);
  assert.ok(Math.abs(p.urenNu - 4 * 36) < 1e-9, "totaal komt overeen met de rol");
  assert.ok(p.urenStraks < p.urenNu);
});

test("lege invoer levert een leeg profiel, geen fout", () => {
  assert.deepEqual(calculateTaakprofiel([]).categorieen, []);
  assert.equal(calculateTaakprofiel([]).heeftData, false);
  assert.deepEqual(calculateTaakprofiel(null).categorieen, []);
});
