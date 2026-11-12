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
// Alle koppen, ook de tussenkoppen binnen een hoofdstuk.
const alleKoppen = (model) => model.blokken.filter((b) => b.soort === "kop").map((b) => b.tekst);
const profielBlok = (model) => model.blokken.find((b) => b.soort === "profiel");
// De blokken van één hoofdstuk: vanaf de kop tot de volgende kop van niveau 1.
function hoofdstuk(model, titel) {
  const i = model.blokken.findIndex((b) => b.soort === "kop" && b.niveau === 1 && b.tekst === titel);
  if (i === -1) return [];
  const eind = model.blokken.findIndex((b, n) => n > i && b.soort === "kop" && b.niveau === 1);
  return model.blokken.slice(i + 1, eind === -1 ? undefined : eind);
}
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
  assert.deepEqual(kopjes(m), ["In het kort"]);
  assert.ok(m.blokken.some((b) => b.soort === "alinea" && /nog geen antwoorden/.test(b.tekst)));
});

test("met antwoorden: de conclusie eerst, dan het beeld, de aanpak, de verdieping per onderdeel en de bijlagen", () => {
  const m = bouw(metGeldend(MIDDEN));
  const k = kopjes(m);
  for (const verwacht of ["In het kort", "Wat het beeld laat zien", "Wat nu: de aanpak in drie stappen", "Per onderdeel", "Bijlage: alle thema's in volgorde van aanpak", "Bijlage: hoe de scan werkt", "Wat dit rapport wel en niet zegt"]) {
    assert.ok(k.includes(verwacht), `${verwacht} ontbreekt`);
  }
  assert.equal(k[0], "In het kort", "de conclusie staat vooraan");
  assert.ok(k.indexOf("Bijlage: hoe de scan werkt") > k.indexOf("Per onderdeel"), "de uitleg van de methode staat achteraan");
  assert.equal(k[k.length - 1], "Wat dit rapport wel en niet zegt");
});

test("het profiel toont elk onderdeel met het niveau en het doel uit de berekening", () => {
  const invoer = metGeldend(MIDDEN);
  const m = bouw(invoer);
  const profiel = berekenProfiel(invoer);
  const p = profielBlok(m);
  assert.deepEqual(p.kolommen, ["Onderdeel", "Niveau", "Doel", "Nog te gaan"], "zonder vastgelegd bewijs geen kolom onderbouwing");
  assert.equal(p.rijen.length, 8);
  for (const a of profiel.assen) {
    const rij = p.rijen.find((r) => r.naam === a.naam);
    assert.ok(rij, a.naam);
    assert.ok(rij.niveauTekst.startsWith(`${a.niveau} · ${a.niveauNaam}`), `${a.naam}: ${rij.niveauTekst}`);
    assert.equal(rij.niveau, a.niveau, "de balk gebruikt hetzelfde niveau");
    assert.equal(rij.doel, a.doel);
    assert.equal(rij.doelTekst, String(a.doel));
    assert.equal(rij.groep, a.kant === "systeem" ? "Systemen" : "Organisatie");
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
  const t = (m) => profielBlok(m).rijen.find((r) => r.naam === "Data").onderbouwing;
  const gezien = Object.fromEntries(["data_kwaliteit_1", "data_kwaliteit_2", "data_beschikbaar_1"].map((id) => [id, true]));
  const m = bouw({ ...invoer, geldend: { ...invoer.geldend, bewijsGezien: gezien } });
  assert.equal(profielBlok(m).kolommen[4], "Onderbouwing");
  assert.equal(t(m), "indicatief", "niet alle voldane stellingen zijn gezien");
  assert.ok(kopjes(m).includes("Onderbouwing"));
  const alles = Object.fromEntries(["data_kwaliteit_1", "data_kwaliteit_2", "data_beschikbaar_1", "data_beschikbaar_2"].map((id) => [id, true]));
  assert.equal(t(bouw({ ...invoer, geldend: { ...invoer.geldend, bewijsGezien: alles } })), "onderbouwd");
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
  const lijst = hoofdstuk(m, "Bijlage: alle thema's in volgorde van aanpak").find((b) => b.soort === "genummerd");
  assert.ok(lijst.items.length >= 2);
  assert.match(lijst.items.join(" "), /Eerst nodig voor Ontwerpen en bouwen/);
  // Hetzelfde thema staat in stap 1 van de aanpak, met dezelfde reden.
  const stap1 = hoofdstuk(m, "Wat nu: de aanpak in drie stappen").filter((b) => b.soort === "alinea" && b.label);
  assert.ok(stap1.some((b) => /Kwaliteit en herkomst/.test(b.label) && /Eerst nodig voor Ontwerpen en bouwen/.test(b.tekst)));
});

test("secties zonder inhoud ontbreken: signalen, invullers, voortgang en koppeling", () => {
  const m = bouw(metGeldend(antwoordenOp({ data_kwaliteit: 2 })));
  const k = alleKoppen(m);
  for (const weg of ["Signalen om te bespreken", "Verschil tussen rollen", "Kunnen en borgen", "Bijna zover", "Voortgang sinds de vorige meting", "Wat dit betekent voor de vrijkomende tijd"]) {
    assert.ok(!k.includes(weg), `${weg} hoort er niet te zijn`);
  }
});

test("signalen verschijnen als er een tegenstrijdigheid is", () => {
  const a = { ...antwoordenOp({ bouwen_bouwen: 3, bouwen_toetsen: 3 }), ...antwoordenOp({ data_beschikbaar: 1, data_kwaliteit: 1 }) };
  const m = bouw(metGeldend(a));
  assert.ok(alleKoppen(m).includes("Signalen om te bespreken"));
});

test("verschil tussen invullers: per rol, nooit per persoon", () => {
  const maak = (rol, n, id) => ({ id, rol, label: "geheim-label", antwoorden: antwoordenOp({ mensen_omgang: n }), bewijs: {} });
  const m = bouw({ ...leegeInvoer(), invullers: [maak("directie", 4, "d1"), maak("werkvloer", 1, "w1")] });
  assert.ok(alleKoppen(m).includes("Verschil tussen rollen"));
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
  assert.ok(kopjes(m).includes("Wat dit betekent voor de vrijkomende tijd"));
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

// ---- De nieuwe opbouw: conclusie, patronen, aanpak, per onderdeel --------------------------------

test("in het kort: een openingszin, hooguit vier conclusies, het profiel en waar te beginnen", () => {
  const m = bouw(metGeldend(MIDDEN), { results: rolanalyse() });
  const kort = hoofdstuk(m, "In het kort");
  assert.equal(kort[0].stijl, "lead");
  assert.match(kort[0].tekst, /^Voorbeeld BV staat op \d+ van de 8 gemeten onderdelen op niveau/);
  assert.match(kort[0].tekst, /Het doel is niveau 3 \(gestuurd\) op alle onderdelen\./);
  const kader = kort.find((b) => b.soort === "kader");
  assert.ok(kader.items.length >= 2 && kader.items.length <= 4);
  assert.match(kader.items[0], /is het doel nog niet gehaald/);
  assert.ok(kader.items.some((i) => /voorwaarden om de vrijkomende tijd uit de capaciteitsanalyse te benutten/.test(i)), "de koppeling met de capaciteitsanalyse hoort bij de conclusies");
  assert.ok(kort.some((b) => b.soort === "profiel"));
  const begin = kort.find((b) => b.soort === "genummerd");
  assert.ok(begin.items.length >= 3 && begin.items.length <= 4, "drie of vier thema's om mee te beginnen");
});

test("in het kort bij verschillende doelen: het rapport zegt dat de doelen verschillen", () => {
  const m = bouw(metGeldend(MIDDEN, { doelen: { data: 2, bouwen: 4 } }));
  assert.match(hoofdstuk(m, "In het kort")[0].tekst, /De doelen verschillen per onderdeel\./);
});

test("alles gehaald: de conclusie zegt dat, en er is geen aanpak", () => {
  const alles = metGeldend(Object.fromEntries(THEMAS.flatMap((t) => t.stellingen.map((s) => [s.id, "ja"]))));
  const m = bouw(alles);
  assert.match(hoofdstuk(m, "In het kort").find((b) => b.soort === "kader").items[0], /Op alle gemeten onderdelen is het doel gehaald/);
  assert.ok(!kopjes(m).includes("Wat nu: de aanpak in drie stappen"));
});

test("bijna zover: thema's waarvan de eerstvolgende stap deels is gezet", () => {
  const a = { ...MIDDEN, data_kwaliteit_2: "deels", mensen_omgang_3: "deels" };
  const m = bouw(metGeldend(a));
  assert.ok(alleKoppen(m).includes("Bijna zover"));
  const beeld = hoofdstuk(m, "Wat het beeld laat zien");
  const i = beeld.findIndex((b) => b.soort === "kop" && b.tekst === "Bijna zover");
  assert.match(beeld[i + 1].tekst, /deze 2 thema's/);
  const items = beeld[i + 2].items.join(" ");
  assert.match(items, /Kwaliteit en herkomst \(Data\), naar niveau 2/);
  assert.match(items, /Omgang met AI in het dagelijks werk \(Mensen en cultuur\), naar niveau 3/);
});

test("zonder sectorthema's heeft het rapport geen blok voor één sector", () => {
  const m = bouw(metGeldend(MIDDEN));
  assert.ok(!alleKoppen(m).includes("Specifiek voor corporaties"));
});

test("de aanpak: stap 1 begint bij wat de vrijkomende tijd tegenhoudt en zegt wanneer de eerste stap is gezet", () => {
  const m = bouw(metGeldend(antwoordenOp({ ...alleThemas(2), werkprocessen_herontwerp: 1 })), { results: rolanalyse() });
  const wat = hoofdstuk(m, "Wat nu: de aanpak in drie stappen");
  assert.deepEqual(wat.filter((b) => b.soort === "kop").map((b) => b.tekst).slice(0, 1), ["Stap 1: nu beginnen"]);
  const eerste = wat.find((b) => b.soort === "alinea" && b.label);
  assert.match(eerste.label, /^1\. Herontwerp met de mens in de regie \(Werkprocessen\)$/);
  assert.match(eerste.tekst, /Voorwaarde om de vrijkomende tijd te benutten/);
  const stap = wat[wat.indexOf(eerste) + 1];
  assert.equal(stap.soort, "lijst");
  assert.match(stap.items[0], /^De eerste stap is gezet als geldt: /);
  assert.ok(stap.items.some((x) => /^Dat is te zien aan: /.test(x)), "de voorbeelden uit het raamwerk maken de stap tastbaar");
});

test("per onderdeel: een vaste opbouw met wat er al is, wat het niveau bepaalt en de stand per thema", () => {
  const m = bouw(metGeldend(MIDDEN), { results: rolanalyse() });
  const per = hoofdstuk(m, "Per onderdeel");
  const koppen = per.filter((b) => b.soort === "kop").map((b) => b.tekst);
  assert.equal(koppen.length, 8);
  assert.ok(koppen.every((k) => /: niveau \d \(.+\), doel \d$/.test(k)), koppen.join(" | "));
  const i = per.findIndex((b) => b.soort === "kop" && b.tekst.startsWith("Data:"));
  const eind = per.findIndex((b, n) => n > i && b.soort === "kop");
  const data = per.slice(i + 1, eind);
  assert.deepEqual(data.filter((b) => b.label).map((b) => b.label).slice(0, 3), ["Waar het over gaat", "Wat er al is", "Wat het niveau bepaalt"]);
  assert.match(data.find((b) => b.label === "Wat het niveau bepaalt").tekst, /Kwaliteit en herkomst/);
  const t = data.find((b) => b.soort === "tabel");
  assert.deepEqual(t.kolommen, ["Thema", "Niveau", "Eerstvolgende stap", "Stand"]);
  assert.equal(t.rijen.length, 2, "elk thema van het onderdeel staat erin, niet alleen het zwakste");
  assert.ok(t.rijen.every((r) => ["nog niet", "deels gedaan", "alle niveaus gehaald", "niet gemeten"].includes(r[3])));
});

test("per onderdeel: waar rollen elkaar tegenspreken staat er een voorbeeld bij, per rol", () => {
  const maak = (rol, n, id) => ({ id, rol, label: "geheim-label", antwoorden: antwoordenOp({ mensen_omgang: n }), bewijs: {} });
  const m = bouw({ ...leegeInvoer(), invullers: [maak("directie", 4, "d1"), maak("werkvloer", 1, "w1")] });
  const blok = hoofdstuk(m, "Per onderdeel").find((b) => b.label === "Waar rollen het anders zien");
  assert.match(blok.tekst, /Directie zegt ja, Werkvloer zegt nee/);
  assert.ok(!modelTeksten(m).join(" ").includes("geheim-label"));
});

test("het rapport noemt een as een onderdeel", () => {
  const m = bouw(metGeldend(MIDDEN), { results: rolanalyse() });
  assert.doesNotMatch(modelTeksten(m).join(" "), /\bassen\b|\bde as\b|\bper as\b|\been as\b/i);
});

test("in het kort past bij een gewone uitkomst op één pagina: geen lange lijsten in de samenvatting", () => {
  const m = bouw(metGeldend(antwoordenOp(alleThemas(1))), { results: rolanalyse() });
  const kort = hoofdstuk(m, "In het kort");
  const tekens = kort.flatMap((b) => (b.soort === "kader" || b.soort === "genummerd" ? b.items : b.tekst ? [b.tekst] : [])).join(" ").length;
  assert.ok(tekens < 1900, `de samenvatting is ${tekens} tekens`);
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
