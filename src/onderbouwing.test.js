import { test } from "node:test";
import assert from "node:assert/strict";
import { TASK_CATEGORIES } from "./config.js";
import { onderbouwing, soortenWerk, raamwerkOmvang, opmaak, opmaakHtml, onderbouwingHtml, telwoord } from "./onderbouwing.js";

const KLEUR = { navy: "#2c276a", paars: "#6e3286", limoen: "#b3da65", mist: "#f8f5f9", tekst: "#424242", grijs: "#625e6e", lijn: "#e4dbe9" };

test("elke taakcategorie uit de tool staat in het document, met een eigen omschrijving", () => {
  const soorten = soortenWerk();
  assert.equal(soorten.length, TASK_CATEGORIES.length);
  for (const s of soorten) {
    assert.ok(s.beschreven, `categorie ${s.id} heeft geen naam en voorbeelden in onderbouwing.js`);
    assert.ok(s.voorbeelden.length > 0);
  }
});

test("de percentages in het document zijn die van de tool", () => {
  const perId = Object.fromEntries(soortenWerk().map((s) => [s.id, s.percentage]));
  for (const c of TASK_CATEGORIES) {
    assert.equal(perId[c.id], `${Math.round(c.realistisch * 100)}% tot ${Math.round(c.agressief * 100)}%`);
  }
});

test("de soorten werk staan van hoog naar laag", () => {
  const lage = soortenWerk().map((s) => Number.parseInt(s.percentage, 10));
  assert.deepEqual(lage, [...lage].sort((a, b) => b - a));
});

test("het document noemt het werkelijke aantal thema's en stellingen", () => {
  const o = raamwerkOmvang();
  assert.ok(o.themas > 0 && o.stellingen > 0);
  const tekst = JSON.stringify(onderbouwing());
  assert.ok(tekst.includes(`${o.themas} thema's en ${o.stellingen} stellingen`));
  assert.ok(tekst.includes(`hooguit ${o.stellingen} stellingen`));
});

test("het rekenvoorbeeld klopt met het percentage voor schrijfwerk", () => {
  const schrijven = TASK_CATEGORIES.find((c) => c.id === "schrijven");
  const taak = Math.round(12 * 36 * 0.2);
  const vrij = Math.round(12 * 36 * 0.2 * schrijven.realistisch);
  const tekst = JSON.stringify(onderbouwing());
  assert.ok(tekst.includes(`dus ${taak} uur`));
  assert.ok(tekst.includes(`komt dan ${vrij} uur per week vrij`));
});

test("elk hoofdstuk heeft een eigen anker en alleen bekende blokken", () => {
  const h = onderbouwing();
  assert.equal(new Set(h.map((x) => x.id)).size, h.length);
  const bekend = new Set(["p", "kop", "lijst", "stappen", "tabel", "formule", "kader"]);
  for (const hoofdstuk of h) {
    assert.ok(hoofdstuk.blokken.length > 0);
    for (const b of hoofdstuk.blokken) assert.ok(bekend.has(b.soort), `onbekend blok ${b.soort}`);
  }
});

test("tabellen hebben in elke rij evenveel cellen als de kop", () => {
  for (const h of onderbouwing()) {
    for (const b of h.blokken.filter((x) => x.soort === "tabel")) {
      for (const r of b.rijen) assert.equal(r.length, b.kop.length, `tabel in ${h.id}`);
    }
  }
});

test("opmaak splitst vet en links en laat de rest staan", () => {
  assert.deepEqual(opmaak("**Kop.** Tekst met [bron](https://voorbeeld.nl/a) erbij."), [
    { soort: "vet", tekst: "Kop." },
    { soort: "tekst", tekst: " Tekst met " },
    { soort: "link", tekst: "bron", href: "https://voorbeeld.nl/a" },
    { soort: "tekst", tekst: " erbij." },
  ]);
  assert.deepEqual(opmaak("Gewoon."), [{ soort: "tekst", tekst: "Gewoon." }]);
});

test("opmaak maakt alleen van http-adressen een link", () => {
  assert.deepEqual(opmaak("[klik](javascript:alert(1))"), [{ soort: "tekst", tekst: "[klik](javascript:alert(1))" }]);
});

test("de html voor de pdf ontsnapt tekens en bevat elk hoofdstuk", () => {
  assert.equal(opmaakHtml("a < b & **c**"), "a &lt; b &amp; <strong>c</strong>");
  const html = onderbouwingHtml({ kleur: KLEUR, cocreatie: "In co-creatie ontwikkeld door House of Digital" });
  for (const h of onderbouwing()) assert.ok(html.includes(h.titel.replace(/&/g, "&amp;")), h.titel);
  assert.ok(html.includes("In co-creatie ontwikkeld door House of Digital"));
  assert.ok(!html.includes("undefined"));
});

test("telwoord schrijft kleine getallen uit", () => {
  assert.equal(telwoord(16), "zestien");
  assert.equal(telwoord(8), "acht");
  assert.equal(telwoord(23), "23");
});
