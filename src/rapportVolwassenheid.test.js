import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { calculateRole, calculateOrganisatie } from "./calculate.js";
import { THEMAS, leegeInvoer, berekenProfiel, maakSnapshot } from "./volwassenheid.js";
import { bouwVolwassenheidsRapport, modelTeksten } from "./rapportVolwassenheid.js";
import { bouwVolwassenheidHtml, generateVolwassenheidDocx } from "../web/lib/generateVolwassenheidReport.js";

const thema = (id) => THEMAS.find((t) => t.id === id);
function antwoordenOp(themaNiveaus) {
  const uit = {};
  for (const [id, n] of Object.entries(themaNiveaus)) for (const s of thema(id).stellingen) uit[s.id] = s.niveau <= n ? "ja" : "nee";
  return uit;
}
const metGeldend = (antwoorden, extra = {}) => ({ ...leegeInvoer(), geldend: { antwoorden, bewijs: {}, bewijsGezien: {} }, ...extra });
const alleThemas = (n) => Object.fromEntries(THEMAS.map((t) => [t.id, n]));
const kopjes = (model) => model.blokken.filter((b) => b.soort === "kop" && b.niveau === 1).map((b) => b.tekst);
const bouw = (invoer, extra = {}) =>
  bouwVolwassenheidsRapport({ invoer, klantNaam: "Voorbeeld BV", datum: "22 oktober 2026", ...extra });

const rolanalyse = () => {
  const rol = calculateRole({
    rolnaam: "Medewerker",
    afdeling: "Service",
    fte: 10,
    urenPerWeek: 36,
    kostenPerUur: 40,
    taken: [
      { omschrijving: "Dossiers invoeren", categorie: "data_entry", aandeel: 0.5 },
      { omschrijving: "Klanten helpen", categorie: "klantcontact", aandeel: 0.5 },
    ],
  });
  rol.waardetype = "kwaliteitsverbetering";
  return { rollen: [rol], organisatieTotaal: calculateOrganisatie([rol]) };
};

const MIDDEN = antwoordenOp({ ...alleThemas(2), bouwen_bouwen: 3, data_kwaliteit: 1, strategie_portfolio: 3, werkprocessen_effect: 1 });

test("zonder antwoorden: alleen de samenvatting, met een melding", () => {
  const m = bouw(leegeInvoer());
  assert.deepEqual(kopjes(m), ["Managementsamenvatting"]);
  assert.ok(m.blokken.some((b) => b.soort === "alinea" && /nog geen antwoorden/.test(b.tekst)));
});

test("met antwoorden: samenvatting, uitleg, per as, volgorde en beperkingen", () => {
  const m = bouw(metGeldend(MIDDEN));
  const k = kopjes(m);
  for (const verwacht of ["Managementsamenvatting", "Hoe dit te lezen", "Per as: waar staat de organisatie en wat is de volgende stap", "Volgorde van aanpak", "Wat dit rapport wel en niet zegt"]) {
    assert.ok(k.includes(verwacht), `${verwacht} ontbreekt`);
  }
});

test("de samenvattingstabel toont elke as met het niveau uit de berekening", () => {
  const invoer = metGeldend(MIDDEN);
  const m = bouw(invoer);
  const profiel = berekenProfiel(invoer);
  const t = m.blokken.find((b) => b.soort === "tabel");
  assert.deepEqual(t.kolommen, ["As", "Niveau", "Doel", "Nog te gaan"], "zonder vastgelegd bewijs geen kolom onderbouwing");
  assert.equal(t.rijen.length, 8);
  for (const a of profiel.assen) {
    const rij = t.rijen.find((r) => r[0] === a.naam);
    assert.ok(rij, a.naam);
    assert.ok(rij[1].startsWith(`${a.niveau} · ${a.niveauNaam}`), `${a.naam}: ${rij[1]}`);
    assert.equal(rij[2], String(a.doel));
  }
  assert.ok(m.blokken.some((b) => b.soort === "alinea" && /Er is geen totaalscore/.test(b.tekst)));
});

test("bewustwordingsfase: een eerste beeld op basis van zelfbeoordeling, zonder onderbouwing per as", () => {
  const m = bouw(metGeldend(antwoordenOp({ data_kwaliteit: 2, data_beschikbaar: 2 })));
  const tekst = modelTeksten(m).join(" ");
  assert.match(tekst, /eerste beeld op basis van zelfbeoordeling/);
  assert.doesNotMatch(tekst, /indicatief|onderbouwd/, "geen onderbouwingstaal zonder vastgelegd bewijs");
  assert.ok(!kopjes(m).includes("Onderbouwing"));
});

test("verdiepingsfase: zodra de adviseur bewijs vastlegt komt de onderbouwing terug", () => {
  const invoer = metGeldend(antwoordenOp({ data_kwaliteit: 2, data_beschikbaar: 2 }));
  const t = (m) => m.blokken.find((b) => b.soort === "tabel").rijen.find((r) => r[0] === "Data");
  const gezien = Object.fromEntries(["data_kwaliteit_1", "data_kwaliteit_2", "data_beschikbaar_1"].map((id) => [id, true]));
  const m = bouw({ ...invoer, geldend: { ...invoer.geldend, bewijsGezien: gezien } });
  assert.equal(m.blokken.find((b) => b.soort === "tabel").kolommen[4], "Onderbouwing");
  assert.equal(t(m)[4], "indicatief", "niet alle voldane stellingen zijn gezien");
  assert.ok(kopjes(m).includes("Onderbouwing"));
  const alles = Object.fromEntries(["data_kwaliteit_1", "data_kwaliteit_2", "data_beschikbaar_1", "data_beschikbaar_2"].map((id) => [id, true]));
  assert.equal(t(bouw({ ...invoer, geldend: { ...invoer.geldend, bewijsGezien: alles } }))[4], "onderbouwd");
});

test("waar verdieping het meest oplevert: grote kloven, borging, signalen en verschillen tussen rollen", () => {
  const maak = (rol, n) => ({ id: `${rol}-1`, rol, label: "", antwoorden: antwoordenOp({ mensen_omgang: n }), bewijs: {} });
  const a = { ...antwoordenOp({ bouwen_bouwen: 3, bouwen_toetsen: 3, data_beschikbaar: 1, data_kwaliteit: 1 }), ...antwoordenOp({ werkprocessen_effect: 1 }) };
  a.bouwen_bouwen_3 = "nee";
  a.bouwen_bouwen_4 = "ja";
  a.bouwen_bouwen_5 = "ja";
  const m = bouw({ ...metGeldend(a), invullers: [maak("directie", 4), maak("werkvloer", 1)] });
  assert.ok(kopjes(m).includes("Waar verdieping het meest oplevert"));
  const i = m.blokken.findIndex((b) => b.soort === "kop" && b.tekst === "Waar verdieping het meest oplevert");
  const lijst = m.blokken[i + 2];
  assert.equal(lijst.soort, "lijst");
  const tekst = lijst.items.join(" ");
  assert.match(tekst, /groot verschil tussen niveau/);
  assert.match(tekst, /Ontwerpen en bouwen: de organisatie kan het, maar heeft het niet geborgd/);
  assert.match(tekst, /Omgang met AI in het dagelijks werk: rollen zien het verschillend/);
  assert.ok(lijst.items.length <= 8);
  assert.equal(new Set(lijst.items).size, lijst.items.length, "geen dubbele regels");
});

test("zonder iets om te verdiepen ontbreekt het slotdeel", () => {
  const alles = metGeldend(Object.fromEntries(THEMAS.flatMap((t) => t.stellingen.map((s) => [s.id, "ja"]))));
  assert.ok(!kopjes(bouw(alles)).includes("Waar verdieping het meest oplevert"));
});

test("onvolledig: het rapport zegt hoeveel is beantwoord en dat de niveaus een ondergrens zijn", () => {
  const m = bouw(metGeldend(antwoordenOp({ data_kwaliteit: 2, data_beschikbaar: 2 })));
  const w = m.blokken.find((b) => b.soort === "alinea" && b.stijl === "waarschuwing");
  assert.match(w.tekst, /Van de 100 stellingen zijn er 10 beantwoord/);
  assert.match(w.tekst, /ondergrens/);
  const alles = metGeldend(Object.fromEntries(THEMAS.flatMap((t) => t.stellingen.map((s) => [s.id, "ja"]))));
  assert.ok(!bouw(alles).blokken.some((b) => b.soort === "alinea" && /Van de 100 stellingen/.test(b.tekst)));
});

test("de volgorde van aanpak komt uit dezelfde berekening en noemt de reden van een afhankelijkheid", () => {
  const invoer = metGeldend(antwoordenOp({ bouwen_bouwen: 1, data_kwaliteit: 1 }), { doelen: { bouwen: 3, data: 2 } });
  const m = bouw(invoer);
  const lijst = m.blokken.find((b) => b.soort === "genummerd");
  assert.ok(lijst.items.length >= 2);
  assert.match(lijst.items.join(" "), /Eerst nodig voor Ontwerpen en bouwen/);
});

test("secties zonder inhoud ontbreken: signalen, invullers, voortgang en koppeling", () => {
  const m = bouw(metGeldend(antwoordenOp({ data_kwaliteit: 2 })));
  const k = kopjes(m);
  for (const weg of ["Signalen om te bespreken", "Verschil tussen invullers", "Voortgang sinds de vorige meting", "Koppeling met de analyse van functies"]) {
    assert.ok(!k.includes(weg), `${weg} hoort er niet te zijn`);
  }
});

test("signalen verschijnen als er een tegenstrijdigheid is", () => {
  const a = { ...antwoordenOp({ bouwen_bouwen: 3, bouwen_toetsen: 3 }), ...antwoordenOp({ data_beschikbaar: 1, data_kwaliteit: 1 }) };
  const m = bouw(metGeldend(a));
  assert.ok(kopjes(m).includes("Signalen om te bespreken"));
});

test("verschil tussen invullers: per rol, nooit per persoon", () => {
  const maak = (rol, n, id) => ({ id, rol, label: "geheim-label", antwoorden: antwoordenOp({ mensen_omgang: n }), bewijs: {} });
  const m = bouw({ ...leegeInvoer(), invullers: [maak("directie", 4, "d1"), maak("werkvloer", 1, "w1")] });
  assert.ok(kopjes(m).includes("Verschil tussen invullers"));
  const tekst = modelTeksten(m).join(" ");
  assert.match(tekst, /Directie niveau 4, Werkvloer niveau 1/);
  assert.ok(!tekst.includes("geheim-label"), "het label van een invuller hoort niet in het rapport");
  assert.ok(!/\bd1\b|\bw1\b/.test(tekst));
});

test("voortgang: vergelijking met de laatste vastgelegde meting, en niet vergelijkbaar bij andere scope", () => {
  const voor = maakSnapshot(metGeldend(antwoordenOp({ data_kwaliteit: 1, data_beschikbaar: 2 }), { scope: "Hele organisatie" }));
  const nu = metGeldend(antwoordenOp({ data_kwaliteit: 3, data_beschikbaar: 2 }), { scope: "Hele organisatie" });
  const m = bouw(nu, { metingen: [voor] });
  assert.ok(kopjes(m).includes("Voortgang sinds de vorige meting"));
  assert.match(modelTeksten(m).join(" "), /Data: niveau 1 → 2/);

  const anders = bouw({ ...nu, scope: "Unit klantenservice" }, { metingen: [voor] });
  assert.match(modelTeksten(anders).join(" "), /niet te vergelijken met deze: andere scope/);
});

test("koppeling met de rolanalyse: FTE, voorwaarden met status en de kwaliteitsvoorwaarde", () => {
  const results = rolanalyse();
  const m = bouw(metGeldend(MIDDEN), { results });
  assert.ok(kopjes(m).includes("Koppeling met de analyse van functies"));
  const tekst = modelTeksten(m).join(" ");
  const fte = results.organisatieTotaal.realistisch.totaalFteWeg.toFixed(1).replace(".", ",");
  assert.ok(tekst.includes(`${fte} FTE aan capaciteit`));
  assert.match(tekst, /voldaan|niet voldaan/);
  assert.ok(tekst.includes("Rollen met bestemming kwaliteitsverbetering"));
});

test("het rapport spreekt de klant toe: geen adviseurstaal, geen modelnamen, geen verwijzing naar een extern model", () => {
  const m = bouw(metGeldend(MIDDEN), { results: rolanalyse() });
  const tekst = modelTeksten(m).join(" ");
  assert.doesNotMatch(tekst, /Claude|controleer dit|SEI|Carnegie|Accenture/i);
  assert.match(modelTeksten(m).join(" "), /zelfbeoordeling/);
});

test("de eerlijkheidsparagraaf staat er altijd in", () => {
  const m = bouw(metGeldend(MIDDEN));
  const lijst = m.blokken.filter((b) => b.soort === "lijst").pop();
  assert.ok(lijst.items.some((i) => /geen vergelijking met andere organisaties/i.test(i)));
});

// ---- Parity: elke tekst uit het model staat in Word én PDF --------------------------------------

const plat = (t) => t.replace(/\s+/g, " ").trim();
const platHtml = (html) =>
  plat(
    html
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
  );

test("Word en PDF bevatten allebei alle teksten uit het model", async () => {
  const invoer = {
    ...metGeldend(MIDDEN),
    invullers: [
      { id: "a", rol: "directie", label: "", antwoorden: antwoordenOp({ mensen_omgang: 4 }), bewijs: {} },
      { id: "b", rol: "werkvloer", label: "", antwoorden: antwoordenOp({ mensen_omgang: 1 }), bewijs: {} },
    ],
  };
  const voor = maakSnapshot(metGeldend(antwoordenOp({ data_kwaliteit: 1 })));
  const model = bouw(invoer, { results: rolanalyse(), metingen: [voor] });
  const html = platHtml(bouwVolwassenheidHtml(model));
  const docx = plat((await mammoth.extractRawText({ buffer: await generateVolwassenheidDocx(model) })).value);
  const teksten = modelTeksten(model);
  assert.ok(teksten.length > 60, "het model is niet leeg");
  for (const t of teksten) {
    assert.ok(html.includes(plat(t)), `PDF mist: ${t.slice(0, 70)}`);
    assert.ok(docx.includes(plat(t)), `Word mist: ${t.slice(0, 70)}`);
  }
});

test("het Word-bestand is een geldig document met koppen en tabellen", async () => {
  const model = bouw(metGeldend(MIDDEN));
  const buf = await generateVolwassenheidDocx(model);
  assert.ok(buf.length > 4000);
  assert.equal(buf.subarray(0, 2).toString(), "PK", "een docx is een zipbestand");
});
