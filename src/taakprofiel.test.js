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

import { calculateCapaciteitHerkomst, herkomstRijen, herkomstZin, herkomstCellen, HERKOMST_KOLOMMEN } from "./taakprofiel.js";

const herkomstVan = (...rollen) => calculateCapaciteitHerkomst(rollen);

test("herkomst: vrijkomende uren per categorie, grootste eerst, over rollen heen", () => {
  const h = herkomstVan(
    rol([taak("klantcontact", "Klantcontact", 100, 70), taak("creatief", "Creatief", 20, 4)]),
    rol([taak("klantcontact", "Klantcontact", 50, 35), taak("data_entry", "Data entry", 40, 30)])
  );
  assert.deepEqual(h.categorieen.map((c) => c.id), ["klantcontact", "data_entry", "creatief"]);
  assert.equal(h.categorieen[0].urenVrij, 105);
  assert.equal(h.categorieen[0].urenNu, 150);
  assert.equal(h.urenVrij, 105 + 30 + 4);
  assert.ok(Math.abs(h.categorieen[0].pctVanCategorie - 0.7) < 1e-9);
});

test("herkomst: de aandelen in het vrijkomende tellen op tot 1 en komen overeen met het totaal", () => {
  const h = herkomstVan(rol([taak("a", "A", 60, 45), taak("b", "B", 40, 10), taak("c", "C", 20, 5)]));
  assert.ok(Math.abs(h.categorieen.reduce((s, c) => s + c.aandeelVanVrij, 0) - 1) < 1e-9);
  assert.equal(h.urenVrij, 60);
});

test("herkomst: dezelfde vrijkomende uren als de rollen zelf melden", () => {
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
  const h = calculateCapaciteitHerkomst([r]);
  assert.ok(Math.abs(h.urenVrij - r.scenarios.realistisch.automatiseerbareUrenPerWeek) < 1e-6);
});

test("herkomst: zonder vrijkomende uren is er niets te tonen", () => {
  assert.equal(herkomstVan(rol([taak("a", "A", 10, 0)])).heeftData, false);
  assert.equal(calculateCapaciteitHerkomst([]).heeftData, false);
});

test("herkomst: de tabel toont de top, vat de rest samen en sluit af met het totaal", () => {
  const taken = Array.from({ length: 8 }, (_, i) => taak(`c${i}`, `Cat ${i}`, 100, 80 - i * 10));
  const h = herkomstVan(rol(taken));
  const rijen = herkomstRijen(h, 5);
  assert.deepEqual(rijen.map((r) => r.soort), ["categorie", "categorie", "categorie", "categorie", "categorie", "overig", "totaal"]);
  assert.equal(rijen[5].label, "Overige categorieën (3)");
  // Wat er in de tabel staat, telt op tot het totaal.
  const som = rijen.filter((r) => r.soort !== "totaal").reduce((s, r) => s + r.urenVrij, 0);
  assert.ok(Math.abs(som - rijen.at(-1).urenVrij) < 1e-9);
});

test("herkomst: één categorie boven de grens wordt niet samengevat", () => {
  const taken = Array.from({ length: 6 }, (_, i) => taak(`c${i}`, `Cat ${i}`, 100, 80 - i * 10));
  const rijen = herkomstRijen(herkomstVan(rol(taken)), 5);
  assert.equal(rijen.filter((r) => r.soort === "overig").length, 0);
  assert.equal(rijen.filter((r) => r.soort === "categorie").length, 6);
});

test("herkomst: de zin noemt de grootste bronnen met hun aandeel", () => {
  const h = herkomstVan(rol([taak("a", "Klantcontact", 100, 60), taak("b", "Administratie", 50, 30), taak("c", "Research", 20, 10)]));
  assert.equal(
    herkomstZin(h),
    "Van de 100 uur per week die vrijkomt (realistisch scenario), komt 60% uit klantcontact, 30% uit administratie en 10% uit research."
  );
});

test("herkomst: de cellen volgen de kolomkoppen", () => {
  const [rij] = herkomstRijen(herkomstVan(rol([taak("a", "A", 100, 60)])));
  assert.equal(herkomstCellen(rij).length, HERKOMST_KOLOMMEN.length);
  assert.deepEqual(herkomstCellen(rij), ["A", "100 u", "60 u", "60%", "100%"]);
});
