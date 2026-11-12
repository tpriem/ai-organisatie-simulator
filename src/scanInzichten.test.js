import test from "node:test";
import assert from "node:assert/strict";
import { calculateRole, calculateOrganisatie } from "./calculate.js";
import { THEMAS, ASSEN, leegeInvoer, analyseer, berekenProfiel, verschilTussenInvullers } from "./volwassenheid.js";
import { SECTORTHEMAS, themaStap, totaalbeeld, organisatieEnSystemen, sterkePunten, bijnaZover, rolBeeld, sectorBeeld, stappenplan, onderdeelBeeld } from "./scanInzichten.js";

const thema = (id) => THEMAS.find((t) => t.id === id);
function antwoordenOp(themaNiveaus) {
  const uit = {};
  for (const [id, n] of Object.entries(themaNiveaus)) for (const s of thema(id).stellingen) uit[s.id] = s.niveau <= n ? "ja" : "nee";
  return uit;
}
const metGeldend = (antwoorden, extra = {}) => ({ ...leegeInvoer(), geldend: { antwoorden, bewijs: {}, bewijsGezien: {} }, ...extra });
const alleThemas = (n) => Object.fromEntries(THEMAS.map((t) => [t.id, n]));
const profielVan = (niveaus, extra) => berekenProfiel(metGeldend(antwoordenOp(niveaus), extra));
const themasVan = (kant) => ASSEN.filter((a) => a.kant === kant).flatMap((a) => a.themas.map((t) => t.id));

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
  return { rollen: [rol], organisatieTotaal: calculateOrganisatie([rol]) };
};

test("de eerstvolgende stap van een thema: met de voorbeelden uit het raamwerk en of er al een begin is", () => {
  const a = { ...antwoordenOp({ data_kwaliteit: 1 }), data_kwaliteit_2: "deels" };
  const t = berekenProfiel(metGeldend(a)).assen.find((x) => x.id === "data").themas.find((x) => x.id === "data_kwaliteit");
  const stap = themaStap(t);
  assert.equal(stap.niveau, 2);
  assert.equal(stap.deels, true);
  assert.deepEqual(stap.voorbeelden, thema("data_kwaliteit").stellingen.find((s) => s.niveau === 2).bewijsvoorbeelden);
  assert.equal(stap.tekst, thema("data_kwaliteit").stellingen.find((s) => s.niveau === 2).tekst);
});

test("een thema dat alles heeft gehaald heeft geen volgende stap", () => {
  const t = profielVan({ data_kwaliteit: 5 }).assen.find((x) => x.id === "data").themas.find((x) => x.id === "data_kwaliteit");
  assert.equal(themaStap(t), null);
});

test("totaalbeeld: de verdeling over de niveaus, de afstand tot het doel en waar die het grootst is", () => {
  const b = totaalbeeld(profielVan({ ...alleThemas(1), ...Object.fromEntries(themasVan("systeem").filter((id) => id.startsWith("beheer_")).map((id) => [id, 2])) }));
  assert.equal(b.gemeten, 8);
  assert.deepEqual(b.perNiveau.map((g) => [g.niveau, g.assen.length]), [[1, 7], [2, 1]]);
  assert.equal(b.meest.niveau, 1);
  assert.equal(b.onderDoel, 8);
  assert.equal(b.opDoel, 0);
  assert.equal(b.grootsteGat, 2);
  assert.equal(b.verst.length, 7);
  assert.equal(b.doel, 3, "overal het standaarddoel");
});

test("totaalbeeld: bij verschillende doelen is er geen gezamenlijk doel, en gehaalde doelen tellen mee", () => {
  const b = totaalbeeld(profielVan(alleThemas(2), { doelen: { data: 2, bouwen: 4 } }));
  assert.equal(b.doel, null);
  assert.equal(b.opDoel, 1, "Data haalt het doel van 2");
  assert.deepEqual(b.verst, ["Bouwen en integreren"]);
});

test("organisatie en systemen: benoemd als een kant duidelijk voorloopt, anders gelijk", () => {
  const sys = Object.fromEntries(themasVan("systeem").map((id) => [id, 3]));
  const org = Object.fromEntries(themasVan("organisatie").map((id) => [id, 3]));
  assert.equal(organisatieEnSystemen(profielVan({ ...alleThemas(1), ...sys })).voorop, "systemen");
  assert.equal(organisatieEnSystemen(profielVan({ ...alleThemas(1), ...org })).voorop, "organisatie");
  assert.equal(organisatieEnSystemen(profielVan(alleThemas(2))).voorop, "gelijk");
  const beeld = organisatieEnSystemen(profielVan({ ...alleThemas(1), ...sys }));
  assert.deepEqual([beeld.organisatie.laagste, beeld.organisatie.hoogste, beeld.systemen.laagste, beeld.systemen.hoogste], [1, 1, 3, 3]);
});

test("organisatie en systemen: zonder meting aan een van beide kanten valt er niets te vergelijken", () => {
  assert.equal(organisatieEnSystemen(profielVan({ data_kwaliteit: 2, data_beschikbaar: 2 })), null);
});

test("wat er al staat: per thema de verst gevorderde voldane stelling, het hoogste niveau eerst", () => {
  const sterk = sterkePunten(profielVan({ ...alleThemas(1), data_kwaliteit: 3, mensen_omgang: 2, bouwen_bouwen: 0 }), 3);
  assert.deepEqual(sterk.map((s) => [s.naam, s.niveau]), [
    ["Kwaliteit en herkomst", 3],
    ["Omgang met AI in het dagelijks werk", 2],
    [sterk[2].naam, 1],
  ]);
  assert.equal(sterk[0].tekst, thema("data_kwaliteit").stellingen.find((s) => s.niveau === 3).tekst);
  assert.equal(sterk[0].asNaam, "Data");
  const alles = sterkePunten(profielVan({ ...alleThemas(1), bouwen_bouwen: 0 }), 99);
  assert.ok(!alles.some((s) => s.naam === "Ontwerpen en bouwen"), "een thema op niveau 0 heeft nog niets bereikt");
});

test("bijna zover: alleen thema's waarvan de eerstvolgende stap deels is gezet, onder het doel eerst", () => {
  const a = { ...antwoordenOp(alleThemas(1)), data_kwaliteit_2: "deels", mensen_omgang_2: "deels", bouwen_bouwen_4: "deels" };
  const bijna = bijnaZover(berekenProfiel(metGeldend(a)));
  assert.deepEqual(bijna.map((b) => b.naam).sort(), ["Kwaliteit en herkomst", "Omgang met AI in het dagelijks werk"], "deels op een stelling die nog niet aan de beurt is telt niet");
  assert.ok(bijna.every((b) => b.naarNiveau === 2 && b.onderDoel));
  assert.deepEqual(bijnaZover(profielVan(alleThemas(1))), []);
});

test("rollen: wie het vaakst het hoogst en het laagst inschat, alleen als dat duidelijk is", () => {
  const maak = (rol, niveaus) => ({ id: `${rol}-1`, rol, label: "", antwoorden: antwoordenOp(niveaus), bewijs: {} });
  const invoer = {
    ...leegeInvoer(),
    invullers: [maak("directie", { mensen_omgang: 4, data_kwaliteit: 3, bouwen_bouwen: 3 }), maak("werkvloer", { mensen_omgang: 1, data_kwaliteit: 1, bouwen_bouwen: 3 })],
  };
  const beeld = rolBeeld(verschilTussenInvullers(invoer));
  assert.equal(beeld.themasVergeleken, 3);
  assert.equal(beeld.themasMetVerschil, 2);
  assert.equal(beeld.meestPositief, "directie");
  assert.equal(beeld.meestKritisch, "werkvloer");
  assert.ok(beeld.tegenspraken > 0);

  const eens = { ...leegeInvoer(), invullers: [maak("directie", { mensen_omgang: 2 }), maak("werkvloer", { mensen_omgang: 2 })] };
  const gelijk = rolBeeld(verschilTussenInvullers(eens));
  assert.equal(gelijk.themasMetVerschil, 0);
  assert.equal(gelijk.meestPositief, null);
  assert.equal(rolBeeld(null), null);
});

test("deze tool heeft geen sectorthema's; wat er wel in de lijst staat moet in het raamwerk bestaan", () => {
  for (const id of SECTORTHEMAS) assert.ok(thema(id), `${id} staat niet in het raamwerk`);
  assert.deepEqual(sectorBeeld(profielVan(alleThemas(1))), []);
});

test("stappenplan: wat de vrijkomende tijd tegenhoudt komt eerst, ook als het thema zijn eigen doel haalt", () => {
  // Alles op niveau 2 met doel 1: geen enkele kloof. Alleen herontwerp zit onder wat het realistische scenario vraagt.
  const doelen = Object.fromEntries(ASSEN.map((a) => [a.id, 1]));
  const invoer = metGeldend(antwoordenOp({ ...alleThemas(2), werkprocessen_herontwerp: 1 }), { doelen });
  const plan = stappenplan(analyseer(invoer, { results: rolanalyse() }));
  assert.equal(plan.nu[0].naam, "Herontwerp met de mens in de regie");
  assert.equal(plan.nu[0].waarom.soort, "voorwaarde");
  assert.equal(plan.nu[0].doel, 2, "het doel is wat de voorwaarde vraagt");
  assert.equal(plan.totaal, 1);
});

test("stappenplan: zonder capaciteitsanalyse beginnen bij de grootste kloven, minstens drie thema's", () => {
  const plan = stappenplan(analyseer(metGeldend(antwoordenOp(alleThemas(1)))));
  assert.ok(plan.nu.length >= 3 && plan.nu.length <= 4);
  assert.ok(plan.nu.every((i) => i.stap && i.asNaam));
  assert.ok(plan.daarna.length <= 5);
  assert.ok(plan.daarna.every((i) => i.kloof >= 2));
});

test("stappenplan: elk thema staat in precies één stap, en dezelfde antwoorden geven hetzelfde plan", () => {
  const invoer = metGeldend(antwoordenOp({ ...alleThemas(1), data_kwaliteit: 2, mensen_omgang: 3, bouwen_bouwen: 0 }));
  const analyse = analyseer(invoer, { results: rolanalyse() });
  const plan = stappenplan(analyse);
  const alle = [...plan.nu, ...plan.daarna, ...plan.later].map((i) => i.thema);
  assert.equal(alle.length, plan.totaal);
  assert.equal(new Set(alle).size, alle.length, "geen thema dubbel");
  assert.deepEqual(stappenplan(analyseer(invoer, { results: rolanalyse() })), plan);
});

test("stappenplan: een thema dat eerst nodig is voor een ander staat in stap 1 met de reden", () => {
  const invoer = metGeldend(antwoordenOp({ bouwen_bouwen: 1, data_kwaliteit: 1 }), { doelen: { bouwen: 3, data: 2 } });
  const plan = stappenplan(analyseer(invoer));
  const kwaliteit = plan.nu.find((i) => i.naam === "Kwaliteit en herkomst");
  assert.equal(kwaliteit.waarom.soort, "afhankelijkheid");
  assert.deepEqual(kwaliteit.waarom.voorNaam, ["Ontwerpen en bouwen"]);
});

test("per onderdeel: de stand van elk thema en welke het niveau bepalen", () => {
  const a = { ...antwoordenOp({ data_kwaliteit: 1, data_beschikbaar: 5 }), data_kwaliteit_2: "deels" };
  const analyse = analyseer(metGeldend(a), { results: rolanalyse() });
  const o = onderdeelBeeld(analyse.profiel.assen.find((x) => x.id === "data"), analyse);
  assert.deepEqual(o.bepalend, ["Kwaliteit en herkomst"]);
  assert.deepEqual(Object.fromEntries(o.themas.map((t) => [t.naam, t.stand])), {
    "Beschikbaar en bruikbaar": "alle niveaus gehaald",
    "Kwaliteit en herkomst": "deels gedaan",
  });
  assert.equal(o.themas.find((t) => t.bepaaltNiveau).naam, "Kwaliteit en herkomst");
  assert.ok(o.watErAlIs.length > 0 && o.watErAlIs.length <= 3);
  assert.ok(o.voorwaarden.every((v) => v.asId === "data"));
});
