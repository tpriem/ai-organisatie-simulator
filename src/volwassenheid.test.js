import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRole, calculateOrganisatie } from "./calculate.js";
import {
  RAAMWERK,
  ASSEN,
  THEMAS,
  STELLINGEN,
  leegeInvoer,
  schoonInvoer,
  maakSnapshot,
  effectieveAntwoorden,
  beoordeelThema,
  berekenProfiel,
  volgordeVanAanpak,
  vaardigheidVersusBorging,
  tegenstrijdigheden,
  verschilTussenInvullers,
  vergelijkMetingen,
  realisatieVoorwaarden,
  analyseer,
  niveauNaam,
} from "./volwassenheid.js";

const thema = (id) => THEMAS.find((t) => t.id === id);

/** Antwoorden waarin de genoemde thema's op het gegeven niveau zijn voldaan (ja t/m dat niveau). */
function antwoordenOp(themaNiveaus, { tot = null } = {}) {
  const uit = {};
  for (const [id, n] of Object.entries(themaNiveaus)) {
    for (const s of thema(id).stellingen) uit[s.id] = s.niveau <= n ? "ja" : "nee";
  }
  return uit;
}
const metGeldend = (antwoorden, extra = {}) => ({ ...leegeInvoer(), geldend: { antwoorden, bewijs: {}, bewijsGezien: {} }, ...extra });
const themasVan = (asId, n) => Object.fromEntries(ASSEN.find((a) => a.id === asId).themas.map((t) => [t.id, n]));
const alleThemas = (n) => Object.fromEntries(THEMAS.map((t) => [t.id, n]));
const asNiveau = (profiel, id) => profiel.assen.find((a) => a.id === id);

test("het raamwerk wordt als geheel ingelezen", () => {
  assert.equal(ASSEN.length, 8);
  assert.equal(THEMAS.length, 20);
  assert.equal(STELLINGEN.length, 100);
  assert.equal(RAAMWERK.versie, "1.0");
  assert.equal(niveauNaam(3), "Gestuurd");
  assert.equal(niveauNaam(0), "Nog niet begonnen");
});

test("thema-niveau: het hoogste niveau waarvoor alles eronder voldaan is", () => {
  const t = thema("data_kwaliteit");
  const a = antwoordenOp({ data_kwaliteit: 3 });
  assert.equal(beoordeelThema(t, a).niveau, 3);
  a["data_kwaliteit_2"] = "deels";
  assert.equal(beoordeelThema(t, a).niveau, 1, "een gat op niveau 2 blokkeert alles erboven");
});

test("n.v.t. telt als voldaan, deels en onbeantwoord niet", () => {
  const t = thema("data_kwaliteit");
  const a = antwoordenOp({ data_kwaliteit: 2 });
  a["data_kwaliteit_1"] = "nvt";
  assert.equal(beoordeelThema(t, a).niveau, 2);
  a["data_kwaliteit_1"] = "deels";
  assert.equal(beoordeelThema(t, a).niveau, 0);
  delete a["data_kwaliteit_1"];
  const b = beoordeelThema(t, a);
  assert.equal(b.niveau, 0);
  assert.equal(b.onvolledig, true);
});

test("een as volgt het zwakste thema, en een ongemeten thema in een gemeten as telt als niveau 0", () => {
  const a = antwoordenOp({ data_beschikbaar: 4, data_kwaliteit: 2 });
  const p = berekenProfiel(metGeldend(a));
  assert.equal(asNiveau(p, "data").niveau, 2);
  assert.deepEqual(asNiveau(p, "data").zwakksteThemas.map((t) => t.id), ["data_kwaliteit"]);

  const b = berekenProfiel(metGeldend(antwoordenOp({ data_beschikbaar: 4 })));
  assert.equal(asNiveau(b, "data").niveau, 0, "het andere thema is niet beantwoord");
  assert.equal(asNiveau(b, "data").onvolledig, true);
});

test("zonder antwoorden is een as niet gemeten en er is geen totaalscore", () => {
  const p = berekenProfiel(leegeInvoer());
  assert.equal(p.gemeten, 0);
  assert.ok(p.assen.every((a) => a.niveau === null && a.gat === null));
  assert.equal("totaal" in p, false);
  assert.equal(p.laagste, null);
});

test("doel per as: standaard 3, eigen doel, ongeldig doel valt terug, kloof niet negatief", () => {
  const a = antwoordenOp(themasVan("data", 4));
  const p = berekenProfiel(metGeldend(a, { doelen: { data: 5, strategie: 9 } }));
  assert.equal(asNiveau(p, "data").doel, 5);
  assert.equal(asNiveau(p, "data").gat, 1);
  assert.equal(asNiveau(p, "strategie").doel, 3, "ongeldig doel valt terug");
  const q = berekenProfiel(metGeldend(a, { doelen: { data: 2 } }));
  assert.equal(asNiveau(q, "data").gat, 0);
});

test("de volgende stap is de eerste stelling die nog niet voldaan is, in woorden uit het raamwerk", () => {
  const a = antwoordenOp({ data_kwaliteit: 1 });
  const b = beoordeelThema(thema("data_kwaliteit"), a);
  assert.equal(b.volgendeStap.stellingId, "data_kwaliteit_2");
  assert.equal(b.volgendeStap.tekst, STELLINGEN.find((s) => s.id === "data_kwaliteit_2").tekst);
  assert.equal(beoordeelThema(thema("data_kwaliteit"), antwoordenOp({ data_kwaliteit: 5 })).volgendeStap, null);
});

test("G: zonder gezien bewijs is een niveau indicatief; nvt hoeft niet onderbouwd", () => {
  const a = antwoordenOp({ data_kwaliteit: 2 });
  assert.equal(beoordeelThema(thema("data_kwaliteit"), a, {}).onderbouwd, false);
  assert.equal(beoordeelThema(thema("data_kwaliteit"), a, { data_kwaliteit_1: true, data_kwaliteit_2: true }).onderbouwd, true);
  a["data_kwaliteit_1"] = "nvt";
  assert.equal(beoordeelThema(thema("data_kwaliteit"), a, { data_kwaliteit_2: true }).onderbouwd, true);
  // bewijs bij een hogere, niet gehaalde stelling telt niet mee
  assert.equal(beoordeelThema(thema("data_kwaliteit"), antwoordenOp({ data_kwaliteit: 2 }), { data_kwaliteit_1: true, data_kwaliteit_2: true, data_kwaliteit_3: true }).onderbouwd, true);
});

test("G: aandeel onderbouwing per as", () => {
  const a = antwoordenOp(themasVan("data", 2));
  const p = berekenProfiel(metGeldend(a, { geldend: { antwoorden: a, bewijs: {}, bewijsGezien: { data_beschikbaar_1: true, data_beschikbaar_2: true } } }));
  const d = asNiveau(p, "data");
  assert.equal(d.onderbouwing.voldaan, 4);
  assert.equal(d.onderbouwing.gezien, 2);
  assert.equal(d.onderbouwing.aandeel, 0.5);
  assert.equal(d.onderbouwd, false);
});

test("D: vaardigheid versus borging, alleen als over borging iets is beantwoord", () => {
  // data_kwaliteit: borging op niveau 3 en 4, vaardigheid op 1, 2 en 5
  const a = antwoordenOp({ data_kwaliteit: 5 });
  a["data_kwaliteit_3"] = "nee";
  a["data_kwaliteit_4"] = "nee";
  const p = berekenProfiel(metGeldend(a));
  const d = vaardigheidVersusBorging(p).find((x) => x.thema === "data_kwaliteit");
  assert.equal(d.kanHet, 5);
  assert.equal(d.geborgd, 2);
  assert.equal(d.verschil, 3);
  assert.equal(d.signaal, "hangt aan personen of toeval");

  const alleenVaardigheid = {};
  for (const s of thema("data_kwaliteit").stellingen.filter((x) => x.kant === "vaardigheid")) alleenVaardigheid[s.id] = "ja";
  assert.equal(vaardigheidVersusBorging(berekenProfiel(metGeldend(alleenVaardigheid))).length, 0, "borging niet beantwoord");
});

test("C: grootste kloof eerst, bij gelijke kloof het laagste niveau", () => {
  const a = { ...antwoordenOp({ data_beschikbaar: 1, data_kwaliteit: 3, strategie_richting: 2 }) };
  const p = berekenProfiel(metGeldend(a));
  const v = volgordeVanAanpak(p);
  assert.deepEqual(v.slice(0, 2).map((i) => i.thema), ["data_beschikbaar", "strategie_richting"]);
  assert.ok(!v.some((i) => i.thema === "data_kwaliteit"), "doel gehaald, geen kloof");
  assert.deepEqual(v.map((i) => i.volgorde), v.map((_, n) => n + 1));
});

test("C: een afhankelijkheid zet het vereiste thema vóór het thema dat het nodig heeft", () => {
  // Bouwen wil naar 3 (doel), maar Data: kwaliteit zit op 1 (vereist: 2).
  const a = antwoordenOp({ bouwen_bouwen: 1, data_kwaliteit: 1, bouwen_toetsen: 2 });
  const p = berekenProfiel(metGeldend(a, { doelen: { bouwen: 3, data: 2 } }));
  const v = volgordeVanAanpak(p);
  const iBouwen = v.findIndex((i) => i.thema === "bouwen_bouwen");
  const iData = v.findIndex((i) => i.thema === "data_kwaliteit");
  assert.ok(iData >= 0 && iBouwen >= 0 && iData < iBouwen, "data eerst");
  const data = v[iData];
  assert.ok(data.redenen.some((r) => r.soort === "afhankelijkheid" && r.voorThema === "bouwen_bouwen"));
});

test("C: een afhankelijkheid voegt een thema toe dat zelf geen kloof heeft", () => {
  // Data heeft doel 1 (geen kloof) maar Bouwen wil naar 3 en heeft Data: kwaliteit op 1 nodig op 2.
  const a = antwoordenOp({ bouwen_bouwen: 1, data_kwaliteit: 1 });
  const p = berekenProfiel(metGeldend(a, { doelen: { data: 1, bouwen: 3 } }));
  const v = volgordeVanAanpak(p);
  const data = v.find((i) => i.thema === "data_kwaliteit");
  assert.ok(data, "toegevoegd als voorwaarde");
  assert.equal(data.doel, 2, "tot het vereiste niveau, niet tot het doel van de as");
  assert.ok(v.indexOf(data) < v.findIndex((i) => i.thema === "bouwen_bouwen"));
});

test("C: geen afhankelijkheid zolang de as het niveau niet nastreeft of het vereiste is gehaald", () => {
  const a = antwoordenOp({ bouwen_bouwen: 1, data_kwaliteit: 2 });
  const p = berekenProfiel(metGeldend(a));
  const data = volgordeVanAanpak(p).find((i) => i.thema === "data_kwaliteit");
  assert.ok(!data?.redenen.some((r) => r.soort === "afhankelijkheid"));
});

test("E: een regel over assen verschijnt alleen als beide assen gemeten zijn", () => {
  const a = { ...antwoordenOp(themasVan("bouwen", 3)), ...antwoordenOp(themasVan("data", 1)) };
  const p = berekenProfiel(metGeldend(a));
  const e1 = tegenstrijdigheden(p).filter((s) => s.id === "E1");
  assert.equal(e1.length, 1);
  assert.match(e1[0].plek, /Bouwen en integreren \(niveau 3\)/);

  const alleenBouwen = berekenProfiel(metGeldend(antwoordenOp(themasVan("bouwen", 3))));
  assert.equal(tegenstrijdigheden(alleenBouwen).filter((s) => s.id === "E1").length, 0);
});

test("E: regel over thema's, spreiding, overschatting, n.v.t. en ladder", () => {
  const a = {
    ...antwoordenOp({ strategie_portfolio: 3, werkprocessen_effect: 1 }),
    ...antwoordenOp(themasVan("beheer", 5)),
  };
  const p = berekenProfiel(metGeldend(a));
  const ids = tegenstrijdigheden(p).map((s) => s.id);
  assert.ok(ids.includes("E5"));
  assert.ok(ids.includes("E6"), "beheer op 5 naast een as op 0");
  assert.ok(!ids.includes("E7"), "zonder vastgelegd bewijs is de overschattingsregel niet van toepassing");

  const nvt = {};
  for (const s of STELLINGEN.filter((x) => x.asId === "risico")) nvt[s.id] = "nvt";
  assert.ok(tegenstrijdigheden(berekenProfiel(metGeldend(nvt))).some((s) => s.id === "E8"));

  const ladder = antwoordenOp({ data_kwaliteit: 3 });
  ladder["data_kwaliteit_1"] = "nee";
  assert.ok(tegenstrijdigheden(berekenProfiel(metGeldend(ladder))).some((s) => s.id === "E9"));
});

test("E7 verdwijnt als het bewijs is gezien", () => {
  const a = antwoordenOp(themasVan("beheer", 5));
  const gezien = Object.fromEntries(STELLINGEN.filter((s) => s.asId === "beheer").map((s) => [s.id, true]));
  const p = berekenProfiel(metGeldend(a, { geldend: { antwoorden: a, bewijs: {}, bewijsGezien: gezien } }));
  assert.ok(!tegenstrijdigheden(p).some((s) => s.id === "E7"));
});

test("effectieve antwoorden: het oordeel van de adviseur gaat voor, anders het strengste van de invullers", () => {
  const invoer = {
    ...leegeInvoer(),
    invullers: [
      { id: "a", rol: "directie", label: "", antwoorden: { data_kwaliteit_1: "ja", data_kwaliteit_2: "ja", data_kwaliteit_3: "nvt" }, bewijs: {} },
      { id: "b", rol: "it_data", label: "", antwoorden: { data_kwaliteit_1: "ja", data_kwaliteit_2: "nee", data_kwaliteit_3: "ja" }, bewijs: {} },
    ],
    geldend: { antwoorden: { data_kwaliteit_1: "deels" }, bewijs: {}, bewijsGezien: {} },
  };
  const e = effectieveAntwoorden(invoer);
  assert.equal(e.data_kwaliteit_1, "deels", "de adviseur beslist");
  assert.equal(e.data_kwaliteit_2, "nee", "strengste");
  assert.equal(e.data_kwaliteit_3, "ja", "ja is strenger dan n.v.t. bij gelijke rang");
  assert.equal(e.data_kwaliteit_4, null);
});

function invullerVoor(rol, themaNiveaus) {
  return { id: `${rol}-1`, rol, label: "", antwoorden: antwoordenOp(themaNiveaus), bewijs: {} };
}

test("F: verschil tussen rollen per thema, met tegenspraken per stelling", () => {
  const invoer = {
    ...leegeInvoer(),
    invullers: [invullerVoor("directie", { mensen_omgang: 4 }), invullerVoor("werkvloer", { mensen_omgang: 1 })],
  };
  const f = verschilTussenInvullers(invoer);
  const t = f.themas.find((x) => x.thema === "mensen_omgang");
  assert.deepEqual(t.niveausPerRol, { directie: 4, werkvloer: 1 });
  assert.equal(t.spreiding, 3);
  assert.equal(t.signaal, true);
  assert.ok(t.tegenspraken.length >= 3);
  assert.deepEqual(t.tegenspraken[0].rollenJa, ["directie"]);
  assert.deepEqual(t.tegenspraken[0].rollenNee, ["werkvloer"]);
  assert.ok(f.signalen.some((x) => x.thema === "mensen_omgang"));
});

test("F: nooit per persoon: twee invullers met dezelfde rol worden samengevoegd tot het strengste", () => {
  const invoer = {
    ...leegeInvoer(),
    invullers: [
      { ...invullerVoor("directie", { mensen_omgang: 4 }), id: "d1" },
      { ...invullerVoor("directie", { mensen_omgang: 2 }), id: "d2" },
      invullerVoor("it_data", { mensen_omgang: 2 }),
    ],
  };
  const t = verschilTussenInvullers(invoer).themas.find((x) => x.thema === "mensen_omgang");
  assert.deepEqual(t.niveausPerRol, { directie: 2, it_data: 2 });
  assert.equal(t.signaal, false);
  assert.ok(!JSON.stringify(verschilTussenInvullers(invoer)).includes("d1"), "geen invuller-id in de uitkomst");
});

test("F: pas zinvol bij twee rollen met genoeg antwoorden; de adviseur telt niet als invuller", () => {
  const een = { ...leegeInvoer(), invullers: [invullerVoor("directie", { mensen_omgang: 3 })] };
  assert.equal(verschilTussenInvullers(een), null);
  const metAdviseur = { ...een, invullers: [...een.invullers, invullerVoor("adviseur", { mensen_omgang: 1 })] };
  assert.equal(verschilTussenInvullers(metAdviseur), null);

  const weinig = {
    ...leegeInvoer(),
    invullers: [invullerVoor("directie", { mensen_omgang: 3 }), { id: "w", rol: "werkvloer", label: "", antwoorden: { mensen_omgang_1: "ja", mensen_omgang_2: "ja" }, bewijs: {} }],
  };
  assert.equal(verschilTussenInvullers(weinig).themas.length, 0, "twee antwoorden is te weinig voor een niveau");
});

test("H: voortgang per as en thema; niet vergelijkbaar bij andere scope of versie", () => {
  const voor = berekenProfiel(metGeldend(antwoordenOp({ data_kwaliteit: 1, data_beschikbaar: 2 }), { scope: "Hele organisatie" }));
  const nu = berekenProfiel(metGeldend(antwoordenOp({ data_kwaliteit: 3, data_beschikbaar: 2 }), { scope: " hele organisatie " }));
  const v = vergelijkMetingen(voor, nu);
  assert.equal(v.gestegen, 1);
  assert.equal(v.perThema.find((t) => t.id === "data_kwaliteit").verschil, 2);
  assert.equal(v.perThema.find((t) => t.id === "data_beschikbaar").verschil, 0);

  const anders = berekenProfiel(metGeldend(antwoordenOp({ data_kwaliteit: 3, data_beschikbaar: 2 }), { scope: "Unit klantenservice" }));
  assert.deepEqual(vergelijkMetingen(voor, anders), { onvergelijkbaar: "andere scope" });
  assert.deepEqual(vergelijkMetingen({ ...voor, raamwerkVersie: "0.1" }, nu), { onvergelijkbaar: "andere versie van het raamwerk" });
  assert.equal(vergelijkMetingen(null, nu), null);
});

// ---- I ----

const rolanalyse = (extra = {}) => {
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
  rol.waardetype = extra.waardetype ?? "capaciteitsgroei";
  return { rollen: [rol], organisatieTotaal: calculateOrganisatie([rol]) };
};

test("I: zonder rolanalyse of zonder capaciteit is er geen koppeling", () => {
  const p = berekenProfiel(leegeInvoer());
  assert.equal(realisatieVoorwaarden(p, null), null);
  assert.equal(realisatieVoorwaarden(p, { rollen: [] }), null);
});

test("I: voorwaarden per scenario met status, en de FTE uit de rolanalyse", () => {
  const a = antwoordenOp({ werkprocessen_herontwerp: 2, mensen_vaardigheden: 1, risico_beleid: 2, data_beschikbaar: 2 });
  const results = rolanalyse();
  const r = realisatieVoorwaarden(berekenProfiel(metGeldend(a)), results);
  assert.equal(r.fteRealistisch, results.organisatieTotaal.realistisch.totaalFteWeg);
  const per = (thema) => r.voorwaarden.find((v) => v.scenario === "realistisch" && v.thema === thema);
  assert.equal(per("werkprocessen_herontwerp").status, "voldaan");
  assert.equal(per("mensen_vaardigheden").status, "niet voldaan");
  assert.equal(per("mensen_vaardigheden").huidig, 1);
  assert.equal(r.realistisch.totaal, 4);
  assert.equal(r.realistisch.voldaan, 3);
  assert.ok(r.agressief.totaal >= 4);
});

test("I: niet gemeten is iets anders dan niet voldaan", () => {
  const a = antwoordenOp({ werkprocessen_herontwerp: 3 });
  const r = realisatieVoorwaarden(berekenProfiel(metGeldend(a)), rolanalyse());
  const mensen = r.voorwaarden.find((v) => v.thema === "mensen_vaardigheden" && v.scenario === "realistisch");
  assert.equal(mensen.status, "niet gemeten");
  assert.equal(mensen.huidig, null);
});

test("I: de data-voorwaarde en de kwaliteitsvoorwaarde gelden alleen waar dat past", () => {
  const p = berekenProfiel(leegeInvoer());
  const zonderData = {
    rollen: [
      calculateRole({ rolnaam: "X", fte: 5, urenPerWeek: 36, kostenPerUur: 40, taken: [{ omschrijving: "Klanten helpen", categorie: "klantcontact", aandeel: 1 }] }),
    ],
  };
  const r = realisatieVoorwaarden(p, zonderData);
  assert.equal(r.gegevensverwerkingGeldt, false);
  assert.ok(!r.voorwaarden.some((v) => v.thema === "data_beschikbaar"));
  assert.equal(r.kwaliteitGeldt, false);

  const metData = realisatieVoorwaarden(p, rolanalyse({ waardetype: "kwaliteitsverbetering" }));
  assert.equal(metData.gegevensverwerkingGeldt, true);
  assert.ok(metData.voorwaarden.some((v) => v.thema === "data_beschikbaar"));
  assert.equal(metData.kwaliteitGeldt, true);
  assert.ok(metData.voorwaarden.some((v) => v.scenario === "kwaliteitsverbetering"));
});

test("analyseer geeft alle analyses in één keer en rekent zonder rolanalyse", () => {
  const a = antwoordenOp(themasVan("bouwen", 3));
  const uit = analyseer(metGeldend(a));
  assert.ok(uit.profiel && Array.isArray(uit.volgorde) && Array.isArray(uit.tegenstrijdigheden));
  assert.equal(uit.verschillen, null);
  assert.equal(uit.realisatie, null);
});

test("schoonInvoer: onbekende stellingen, rollen en antwoorden verdwijnen; invullers worden begrensd", () => {
  const s = schoonInvoer({
    scope: "  Hele organisatie ",
    doelen: { data: 4, strategie: 0, bestaat_niet: 3 },
    invullers: [
      { id: "ok-1", rol: "directie", label: "  CIO ", antwoorden: { data_kwaliteit_1: "ja", data_kwaliteit_2: "misschien", onbekend: "ja" }, bewijs: { data_kwaliteit_1: " memo ", onbekend: "x" } },
      { id: "ok-1", rol: "hr", antwoorden: {} },
      { id: "Slecht Id", rol: "hr", antwoorden: {} },
      { id: "onbekende-rol", rol: "piloot", antwoorden: {} },
    ],
    geldend: { antwoorden: { data_kwaliteit_1: "deels", onbekend: "ja" }, bewijsGezien: { data_kwaliteit_1: true, data_kwaliteit_2: "ja" } },
    extra: "weg",
  });
  assert.equal(s.scope, "Hele organisatie");
  assert.deepEqual(s.doelen, { data: 4 });
  assert.equal(s.invullers.length, 1);
  assert.deepEqual(s.invullers[0], { id: "ok-1", rol: "directie", label: "CIO", antwoorden: { data_kwaliteit_1: "ja" }, bewijs: { data_kwaliteit_1: "memo" } });
  assert.deepEqual(s.geldend.antwoorden, { data_kwaliteit_1: "deels" });
  assert.deepEqual(s.geldend.bewijsGezien, { data_kwaliteit_1: true });
  assert.equal("extra" in s, false);
  assert.deepEqual(schoonInvoer(undefined), leegeInvoer());

  const veel = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, rol: "hr", antwoorden: {} }));
  assert.equal(schoonInvoer({ invullers: veel }).invullers.length, 12);
});

test("snapshot bewaart de schone invoer, de versie en het tijdstip", () => {
  const s = maakSnapshot(metGeldend(antwoordenOp({ data_kwaliteit: 2 })), { op: new Date("2026-10-22T10:00:00Z") });
  assert.deepEqual(Object.keys(s).sort(), ["doelen", "geldend", "invullers", "op", "raamwerkVersie", "scope"]);
  assert.equal(s.raamwerkVersie, "1.0");
  assert.equal(s.op, "2026-10-22T10:00:00.000Z");
});

test("volledig ingevuld: alle 100 stellingen beantwoord", () => {
  const alles = Object.fromEntries(STELLINGEN.map((s) => [s.id, "ja"]));
  const p = berekenProfiel(metGeldend(alles));
  assert.equal(p.ingevuld, true);
  assert.equal(p.telling.beantwoord, 100);
  assert.ok(p.assen.every((a) => a.niveau === 5 && a.ingevuld));
  delete alles.data_kwaliteit_1;
  const q = berekenProfiel(metGeldend(alles));
  assert.equal(q.ingevuld, false);
  assert.equal(asNiveau(q, "data").ingevuld, false);
  assert.equal(asNiveau(q, "strategie").ingevuld, true);
});

test("F: één niveau verschil is nog geen signaal, twee wel", () => {
  const maak = (a, b) => ({
    ...leegeInvoer(),
    invullers: [invullerVoor("directie", { mensen_omgang: a }), invullerVoor("werkvloer", { mensen_omgang: b })],
  });
  const t = (inv) => verschilTussenInvullers(inv).themas.find((x) => x.thema === "mensen_omgang");
  assert.equal(t(maak(3, 2)).spreiding, 1);
  assert.equal(t(maak(3, 2)).signaal, false);
  assert.equal(t(maak(3, 1)).spreiding, 2);
  assert.equal(t(maak(3, 1)).signaal, true);
});

test("D: niveaus met alleen borgingsstellingen laten de vaardigheidsladder niet vanzelf klimmen", () => {
  // mensen_omgang: 1, 2 vaardigheid; 3 borging; 4, 5 vaardigheid. Op niveau 2 en daarboven 'nee'.
  const a = antwoordenOp({ mensen_omgang: 2 });
  const b = beoordeelThema(thema("mensen_omgang"), a);
  assert.equal(b.niveau, 2);
  assert.equal(b.losNiveau, 2, "niveau 3 is alleen borging en telt niet als bereikt");
  const rij = vaardigheidVersusBorging(berekenProfiel(metGeldend(a))).find((x) => x.thema === "mensen_omgang");
  assert.equal(rij.verschil, 0);
  assert.equal(rij.signaal, null);

  // data_kwaliteit: 1, 2 vaardigheid; 3, 4 borging; 5 vaardigheid. Niveau 2 zonder niveau 5.
  const c = beoordeelThema(thema("data_kwaliteit"), antwoordenOp({ data_kwaliteit: 2 }));
  assert.equal(c.losNiveau, 2);
});

import { teltMee } from "./volwassenheid.js";

test("E7 geldt pas als de adviseur bewijs gaat vastleggen: veel ja met weinig gezien bewijs", () => {
  const a = antwoordenOp(themasVan("beheer", 5));
  const een = { beheer_bewaken_1: true }; // 1 van de 10 gezien: ruim onder de 20%
  const p = berekenProfiel(metGeldend(a, { geldend: { antwoorden: a, bewijs: {}, bewijsGezien: een } }));
  assert.equal(p.bewijsGebruikt, true);
  assert.ok(tegenstrijdigheden(p).some((s) => s.id === "E7"));
  assert.equal(berekenProfiel(metGeldend(a)).bewijsGebruikt, false);
});

test("invullers via een link tellen pas mee nadat ze hebben verstuurd", () => {
  const maak = (status, ja) => ({
    id: `d-${status}`,
    rol: "directie",
    label: "",
    bron: "link",
    status,
    antwoorden: Object.fromEntries(thema("data_kwaliteit").stellingen.map((s) => [s.id, ja ? "ja" : "nee"])),
    bewijs: {},
  });
  assert.equal(teltMee(maak("bezig", true)), false);
  assert.equal(teltMee(maak("nieuw", true)), false);
  assert.equal(teltMee(maak("ingediend", true)), true);
  assert.equal(teltMee({ id: "x", rol: "hr", antwoorden: {} }), true, "een invuller zonder link telt altijd mee");

  const bezig = { ...leegeInvoer(), invullers: [maak("bezig", true)] };
  assert.equal(effectieveAntwoorden(bezig).data_kwaliteit_1, null);
  const klaar = { ...leegeInvoer(), invullers: [maak("ingediend", true)] };
  assert.equal(effectieveAntwoorden(klaar).data_kwaliteit_1, "ja");

  // Ook in het verschil tussen rollen telt een nog bezige invuller niet mee.
  const mix = { ...leegeInvoer(), invullers: [maak("ingediend", true), { ...maak("bezig", false), id: "w", rol: "werkvloer" }] };
  assert.equal(verschilTussenInvullers(mix), null);
});

test("schoonInvoer bewaart bron, status en tijdstippen van een link-invuller en negeert ongeldige waarden", () => {
  const s = schoonInvoer({
    invullers: [
      { id: "l-1", rol: "hr", bron: "link", status: "ingediend", bijgewerktOp: "2026-10-22T10:00:00.000Z", ingediendOp: "morgen", antwoorden: {} },
      { id: "l-2", rol: "hr", bron: "link", status: "raar", antwoorden: {} },
      { id: "a-1", rol: "hr", bron: "adviseur", status: "ingediend", antwoorden: {} },
    ],
  });
  assert.equal(s.invullers[0].bron, "link");
  assert.equal(s.invullers[0].status, "ingediend");
  assert.equal(s.invullers[0].bijgewerktOp, "2026-10-22T10:00:00.000Z");
  assert.equal("ingediendOp" in s.invullers[0], false, "ongeldig tijdstip valt weg");
  assert.equal(s.invullers[1].status, "nieuw");
  assert.equal("bron" in s.invullers[2], false, "een gewone invuller heeft geen bron of status");
  assert.equal("status" in s.invullers[2], false);
});
