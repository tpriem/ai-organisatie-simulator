import { test } from "node:test";
import assert from "node:assert/strict";
import raamwerk from "./data/volwassenheidsraamwerk.json" with { type: "json" };

// Volledigheid van het inhoudsbestand. Dit toetst het ontwerp, niet de berekening: elke as
// heeft thema's, elk thema een ladder van vijf niveaus, elke stelling een bewijsvraag en een
// analyse, en alles waarnaar regels verwijzen bestaat.

const ANALYSES = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const assen = raamwerk.assen;
const themas = assen.flatMap((a) => a.themas);
const stellingen = themas.flatMap((t) => t.stellingen);
const themaIds = new Set(themas.map((t) => t.id));
const asIds = new Set(assen.map((a) => a.id));

test("acht assen, vier per kant, twee of drie thema's per as", () => {
  assert.equal(assen.length, 8);
  assert.equal(assen.filter((a) => a.kant === "organisatie").length, 4);
  assert.equal(assen.filter((a) => a.kant === "systeem").length, 4);
  for (const a of assen) {
    assert.ok(a.naam && a.beschrijving, a.id);
    assert.ok(a.themas.length >= 2 && a.themas.length <= 3, `${a.id}: ${a.themas.length} thema's`);
  }
});

test("vijf niveaus met eigen namen", () => {
  assert.deepEqual(raamwerk.niveaus.map((n) => n.niveau), [1, 2, 3, 4, 5]);
  for (const n of raamwerk.niveaus) assert.ok(n.naam && n.beschrijving, String(n.niveau));
});

test("elk thema heeft precies één stelling per niveau 1 tot en met 5", () => {
  for (const t of themas) {
    assert.ok(t.naam && t.beschrijving, t.id);
    assert.deepEqual(
      t.stellingen.map((s) => s.niveau),
      [1, 2, 3, 4, 5],
      `${t.id}: niveaus ${t.stellingen.map((s) => s.niveau).join(",")}`
    );
    assert.ok(t.stellingen.some((s) => s.kant === "borging"), `${t.id}: geen borgingsstelling`);
    assert.ok(t.stellingen.some((s) => s.kant === "vaardigheid"), `${t.id}: geen vaardigheidsstelling`);
  }
});

test("tussen 80 en 120 stellingen, met unieke id's", () => {
  assert.ok(stellingen.length >= 80 && stellingen.length <= 120, `${stellingen.length} stellingen`);
  const alleIds = [...assen.map((a) => a.id), ...themas.map((t) => t.id), ...stellingen.map((s) => s.id)];
  assert.equal(new Set(alleIds).size, alleIds.length, "dubbele id's");
  for (const id of alleIds) assert.match(id, /^[a-z0-9_]+$/, id);
});

test("elke stelling heeft tekst, kant, bewijsvraag, bewijsvoorbeelden en minstens één analyse", () => {
  for (const s of stellingen) {
    assert.ok(s.tekst.length > 30, `${s.id}: tekst te kort`);
    assert.ok(["vaardigheid", "borging"].includes(s.kant), `${s.id}: kant ${s.kant}`);
    assert.ok(s.bewijsvraag.endsWith("?") || s.bewijsvraag.endsWith("."), `${s.id}: bewijsvraag`);
    assert.ok(Array.isArray(s.bewijsvoorbeelden) && s.bewijsvoorbeelden.length >= 1, `${s.id}: bewijsvoorbeelden`);
    assert.ok(s.analyses.length >= 1, `${s.id}: geen analyse`);
    for (const a of s.analyses) assert.ok(ANALYSES.includes(a), `${s.id}: onbekende analyse ${a}`);
  }
});

test("elke analyse A tot en met I wordt door minstens één stelling gevoed", () => {
  for (const a of ANALYSES) {
    assert.ok(stellingen.some((s) => s.analyses.includes(a)), `analyse ${a} wordt door geen stelling gevoed`);
  }
});

test("afhankelijkheden verwijzen naar bestaande thema's en zijn niet circulair", () => {
  assert.ok(raamwerk.afhankelijkheden.length >= 5);
  for (const d of raamwerk.afhankelijkheden) {
    assert.ok(themaIds.has(d.van), d.van);
    assert.ok(themaIds.has(d.vereist), d.vereist);
    assert.notEqual(d.van, d.vereist);
    assert.ok(d.vanafNiveau >= 2 && d.vanafNiveau <= 5, `${d.van}: vanafNiveau`);
    assert.ok(d.minimaalNiveau >= 1 && d.minimaalNiveau < d.vanafNiveau, `${d.van}: minimaalNiveau moet onder vanafNiveau liggen`);
    assert.ok(d.reden.length > 20, `${d.van}: reden`);
  }
  // Geen kringen: volg de ketens.
  const volg = (id, gezien) => {
    if (gezien.has(id)) throw new Error(`kring via ${id}`);
    gezien.add(id);
    for (const d of raamwerk.afhankelijkheden.filter((x) => x.van === id)) volg(d.vereist, new Set(gezien));
  };
  for (const t of themaIds) volg(t, new Set());
});

test("tegenstrijdigheidsregels verwijzen naar bestaande assen en thema's", () => {
  assert.ok(raamwerk.tegenstrijdigheden.length >= 5);
  for (const r of raamwerk.tegenstrijdigheden) {
    assert.ok(r.uitleg.length > 20, r.id);
    if (r.soort === "assen") {
      assert.ok(asIds.has(r.als.as) && asIds.has(r.terwijl.as), r.id);
    } else if (r.soort === "themas") {
      assert.ok(themaIds.has(r.als.thema) && themaIds.has(r.terwijl.thema), r.id);
    } else {
      assert.ok(["spreiding", "overschatting", "nvt", "ladder"].includes(r.soort), `${r.id}: soort ${r.soort}`);
    }
  }
});

test("realisatievoorwaarden verwijzen naar bestaande thema's en dekken beide scenario's", () => {
  const scenarios = new Set(raamwerk.realisatievoorwaarden.map((v) => v.scenario));
  assert.ok(scenarios.has("realistisch") && scenarios.has("agressief"));
  for (const v of raamwerk.realisatievoorwaarden) {
    assert.ok(themaIds.has(v.thema), v.thema);
    assert.ok(v.minimaalNiveau >= 1 && v.minimaalNiveau <= 5);
    assert.ok(v.reden.length > 20);
  }
});

test("de rollen voor invullers staan vast en bevatten de adviseur", () => {
  const ids = raamwerk.rollen.map((r) => r.id);
  assert.ok(ids.includes("adviseur"));
  assert.ok(ids.includes("directie") && ids.includes("werkvloer"));
  assert.equal(new Set(ids).size, ids.length);
});

test("de teksten zijn Nederlands en zonder Engelse modeltermen", () => {
  const verboden = /\b(exploratory|implemented|aligned|scaled|future ready|capability area|maturity indicator|practice|goal)\b/i;
  const alleTekst = [
    ...raamwerk.niveaus.map((n) => `${n.naam} ${n.beschrijving}`),
    ...assen.map((a) => `${a.naam} ${a.beschrijving}`),
    ...themas.map((t) => `${t.naam} ${t.beschrijving}`),
    ...stellingen.flatMap((s) => [s.tekst, s.bewijsvraag, ...s.bewijsvoorbeelden]),
  ];
  for (const t of alleTekst) assert.doesNotMatch(t, verboden, t.slice(0, 60));
});
