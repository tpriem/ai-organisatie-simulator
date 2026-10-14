import test from "node:test";
import assert from "node:assert/strict";
import {
  stelWaardetypeIn,
  herstelWaardetype,
  neemHandmatigeWaardetypesOver,
  waardetypeHerkomst,
  isHandmatig,
} from "./waardetype.js";
import { calculateRole, calculateCapaciteitBestemming } from "./calculate.js";

const NU = new Date("2026-10-15T09:00:00.000Z");

const rol = (rolnaam, waardetype = "kostenreductie", extra = {}) => ({
  rolnaam,
  roleId: rolnaam.toLowerCase(),
  waardetype,
  waardetypeToelichting: "Claude: routinematig werk.",
  ...extra,
});

test("een handmatige keuze staat in waardetype zelf, zodat alles wat dat veld leest klopt", () => {
  const r = stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU });
  assert.equal(r.waardetype, "kwaliteitsverbetering");
  assert.equal(isHandmatig(r), true);
});

test("de inschatting van Claude blijft apart bewaard", () => {
  const r = stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU });
  assert.equal(r.waardetypeAI, "kostenreductie");
  assert.equal(r.waardetypeToelichtingAI, "Claude: routinematig werk.");
});

test("de toelichting van Claude blijft niet staan bij een keuze die Claude niet maakte", () => {
  // Zou "routinematig werk" blijven staan bij kwaliteitsverbetering, dan misleidt het
  // rapport: de tekst verdedigt een keuze die niet meer geldt.
  const r = stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU });
  assert.ok(!r.waardetypeToelichting.includes("routinematig"));
  assert.equal(r.waardetypeToelichting, "", "leeg: dat het handmatig is staat al apart vermeld");
});

test("de reden van de adviseur wordt de toelichting", () => {
  const r = stelWaardetypeIn(rol("A"), "capaciteitsgroei", { reden: "  Groeiambitie in de regio  ", nu: NU });
  assert.equal(r.waardetypeToelichting, "Groeiambitie in de regio");
  assert.equal(r.waardetypeHandmatig.reden, "Groeiambitie in de regio");
  assert.equal(r.waardetypeHandmatig.op, "2026-10-15T09:00:00.000Z");
});

test("een onbekend waardetype wordt geweigerd", () => {
  assert.throws(() => stelWaardetypeIn(rol("A"), "bestaat_niet"), /Onbekend waardetype/);
  assert.throws(() => stelWaardetypeIn(rol("A"), null), /Onbekend waardetype/);
});

test("nogmaals bijsturen behoudt de oorspronkelijke inschatting van Claude", () => {
  // Anders zou de tweede keuze de AI-waarde overschrijven met de eerste handmatige.
  const een = stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU });
  const twee = stelWaardetypeIn(een, "capaciteitsgroei", { nu: NU });
  assert.equal(twee.waardetype, "capaciteitsgroei");
  assert.equal(twee.waardetypeAI, "kostenreductie");
  assert.equal(twee.waardetypeToelichtingAI, "Claude: routinematig werk.");
});

test("herstellen zet de inschatting van Claude volledig terug", () => {
  const r = herstelWaardetype(stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { reden: "x", nu: NU }));
  assert.equal(r.waardetype, "kostenreductie");
  assert.equal(r.waardetypeToelichting, "Claude: routinematig werk.");
  assert.equal(isHandmatig(r), false);
  for (const veld of ["waardetypeHandmatig", "waardetypeAI", "waardetypeToelichtingAI"]) {
    assert.ok(!(veld in r), `${veld} hoort weg te zijn`);
  }
});

test("herstellen van een rol die nooit is bijgestuurd verandert niets", () => {
  const r = rol("A");
  assert.deepEqual(herstelWaardetype(r), r);
});

test("een rol zonder waardetype uit een oude analyse kan ook worden bijgestuurd en hersteld", () => {
  const oud = { rolnaam: "Oud", roleId: "oud" };
  const aangepast = stelWaardetypeIn(oud, "kostenreductie", { nu: NU });
  assert.equal(aangepast.waardetypeAI, null);
  const terug = herstelWaardetype(aangepast);
  assert.equal(terug.waardetype, null);
  assert.ok(!("waardetypeToelichting" in terug), "geen verzonnen toelichting terugzetten");
});

test("een nieuwe analyse neemt een handmatige keuze over", () => {
  // Een heranalyse begint opnieuw. Zonder overname verdwijnt een bewuste beslissing stil.
  const vorige = [stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { reden: "bewust", nu: NU })];
  const nieuw = [rol("A", "kostenreductie", { waardetypeToelichting: "Nieuwe Claude-tekst." })];
  const [r] = neemHandmatigeWaardetypesOver(nieuw, vorige);

  assert.equal(r.waardetype, "kwaliteitsverbetering", "de keuze blijft staan");
  assert.equal(r.waardetypeHandmatig.reden, "bewust");
  assert.equal(r.waardetypeAI, "kostenreductie", "de nieuwe inschatting van Claude wordt bewaard");
  assert.equal(r.waardetypeToelichtingAI, "Nieuwe Claude-tekst.");
});

test("de overname laat rollen zonder handmatige keuze ongemoeid", () => {
  const vorige = [stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU }), rol("B")];
  const nieuw = [rol("A"), rol("B", "capaciteitsgroei")];
  const uit = neemHandmatigeWaardetypesOver(nieuw, vorige);
  assert.equal(uit[1].waardetype, "capaciteitsgroei", "B volgt de nieuwe inschatting");
  assert.ok(!isHandmatig(uit[1]));
});

test("de overname koppelt op roleId, niet op volgorde", () => {
  const vorige = [stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU })];
  const nieuw = [rol("B"), rol("A")];
  const uit = neemHandmatigeWaardetypesOver(nieuw, vorige);
  assert.equal(uit.find((r) => r.rolnaam === "A").waardetype, "kwaliteitsverbetering");
  assert.equal(uit.find((r) => r.rolnaam === "B").waardetype, "kostenreductie");
});

test("een rol die in de nieuwe analyse niet meer voorkomt veroorzaakt geen fout", () => {
  const vorige = [stelWaardetypeIn(rol("Weg"), "kwaliteitsverbetering", { nu: NU })];
  assert.deepEqual(neemHandmatigeWaardetypesOver([rol("A")], vorige).map((r) => r.rolnaam), ["A"]);
  assert.deepEqual(neemHandmatigeWaardetypesOver([rol("A")], null).map((r) => r.rolnaam), ["A"]);
});

test("de herkomst telt handmatige keuzes en wie afwijkt van Claude", () => {
  const rollen = [
    stelWaardetypeIn(rol("A"), "kwaliteitsverbetering", { nu: NU }), // wijkt af
    stelWaardetypeIn(rol("B"), "kostenreductie", { nu: NU }), // bevestigt Claude
    rol("C"),
  ];
  assert.deepEqual(waardetypeHerkomst(rollen), { totaal: 3, handmatig: 2, afwijkend: 1, bevestigd: 1 });
  assert.deepEqual(waardetypeHerkomst(null), { totaal: 0, handmatig: 0, afwijkend: 0, bevestigd: 0 });
});

test("een bijgestuurde rol verschuift de bestemmingsverdeling van de capaciteit", () => {
  // Het hele doel: de keuze moet doorwerken in het kopgetal van het rapport.
  const maak = (naam, wt) => {
    const r = calculateRole({
      rolnaam: naam, fte: 4, urenPerWeek: 36, kostenPerUur: 40,
      taken: [{ omschrijving: "T", categorie: "klantcontact", aandeel: 1 }],
    });
    r.waardetype = wt;
    r.roleId = naam;
    return r;
  };
  const voor = [maak("A", "kostenreductie"), maak("B", "kostenreductie")];
  const na = [stelWaardetypeIn(voor[0], "kwaliteitsverbetering", { nu: NU }), voor[1]];

  const bVoor = calculateCapaciteitBestemming(voor);
  const bNa = calculateCapaciteitBestemming(na);
  assert.equal(bVoor.length, 1);
  assert.equal(bNa.length, 2, "nu twee bestemmingen");
  assert.ok(bNa.some((b) => b.waardetype === "kwaliteitsverbetering" && b.rollen === 1));
});

// ── Welke rollen moeten bevestigd worden ──────────────────────────────────────────────

import { rollenDieBevestigingVragen, bevestigtInschatting } from "./waardetype.js";

const metCapaciteit = (rolnaam, fteWeg, extra = {}) => ({
  rolnaam,
  roleId: rolnaam,
  waardetype: "kostenreductie",
  scenarios: { realistisch: { fteWeg } },
  ...extra,
});

test("de kleinste groep die samen de helft van de capaciteit draagt", () => {
  // Zoals bij Voorbeeld BV: de grootste rol haalt de helft niet alleen, dus er is een tweede
  // nodig. Totaal 6 FTE: 2,5 is 42%, samen met de volgende 83%.
  const r = rollenDieBevestigingVragen([
    metCapaciteit("Klein", 0.5),
    metCapaciteit("Groot", 2.5),
    metCapaciteit("Middel", 2.5),
    metCapaciteit("Heel klein", 0.5),
  ]);
  assert.deepEqual(r.rollen.map((x) => x.rolnaam), ["Groot", "Middel"]);
  assert.ok(r.aandeelGedekt >= 0.5);
  assert.ok(!r.rollen.some((x) => x.rolnaam === "Klein"), "de kleine rollen horen er niet bij");
});

test("een rol die alleen al meer dan de helft draagt staat er alleen", () => {
  const r = rollenDieBevestigingVragen([metCapaciteit("Reus", 8), metCapaciteit("A", 1), metCapaciteit("B", 1)]);
  assert.deepEqual(r.rollen.map((x) => x.rolnaam), ["Reus"]);
  assert.ok(Math.abs(r.rollen[0].aandeel - 0.8) < 1e-9);
});

test("gelijke rollen geven een vaste uitkomst, ongeacht de volgorde", () => {
  const a = rollenDieBevestigingVragen([metCapaciteit("B", 2), metCapaciteit("A", 2), metCapaciteit("C", 2), metCapaciteit("D", 2)]);
  const b = rollenDieBevestigingVragen([metCapaciteit("D", 2), metCapaciteit("C", 2), metCapaciteit("A", 2), metCapaciteit("B", 2)]);
  assert.deepEqual(a.rollen.map((x) => x.rolnaam), b.rollen.map((x) => x.rolnaam));
});

test("een bevestigde rol blijft in de groep, maar telt als bevestigd", () => {
  // De groep hangt af van de capaciteit, niet van wat al is gedaan; anders verschuift de
  // lijst telkens zodra iemand iets bevestigt.
  const rollen = [stelWaardetypeIn(metCapaciteit("Groot", 4), "kostenreductie", { nu: NU }), metCapaciteit("Middel", 2.5), metCapaciteit("Klein", 0.5)];
  const r = rollenDieBevestigingVragen(rollen);
  const groot = r.rollen.find((x) => x.rolnaam === "Groot");
  assert.equal(groot.bevestigd, true);
  assert.equal(r.rollen.find((x) => x.rolnaam === "Middel")?.bevestigd ?? false, false);
});

test("het onbevestigde aandeel daalt zodra een rol is bevestigd", () => {
  const voor = rollenDieBevestigingVragen([metCapaciteit("Groot", 4), metCapaciteit("Middel", 2.5)]);
  const na = rollenDieBevestigingVragen([stelWaardetypeIn(metCapaciteit("Groot", 4), "kostenreductie", { nu: NU }), metCapaciteit("Middel", 2.5)]);
  assert.ok(na.onbevestigdAandeel < voor.onbevestigdAandeel);
  assert.equal(voor.alleBevestigd, false);
});

test("alles bevestigd betekent geen openstaande vraag", () => {
  const rollen = [stelWaardetypeIn(metCapaciteit("Groot", 6), "kwaliteitsverbetering", { nu: NU }), metCapaciteit("Klein", 1)];
  const r = rollenDieBevestigingVragen(rollen);
  assert.equal(r.alleBevestigd, true);
  assert.equal(r.onbevestigdAandeel, 0);
});

test("rollen zonder vrijgekomen capaciteit tellen niet mee", () => {
  const r = rollenDieBevestigingVragen([metCapaciteit("Nul", 0), metCapaciteit("Echt", 3)]);
  assert.deepEqual(r.rollen.map((x) => x.rolnaam), ["Echt"]);
});

test("zonder rollen of zonder capaciteit is er niets te bevestigen en geen fout", () => {
  for (const invoer of [[], null, undefined, [metCapaciteit("Nul", 0)]]) {
    const r = rollenDieBevestigingVragen(invoer);
    assert.deepEqual(r.rollen, []);
    assert.equal(r.alleBevestigd, true);
  }
});

test("de drempel is instelbaar", () => {
  const rollen = [metCapaciteit("A", 5), metCapaciteit("B", 3), metCapaciteit("C", 2)];
  assert.equal(rollenDieBevestigingVragen(rollen, { drempel: 0.5 }).rollen.length, 1);
  assert.equal(rollenDieBevestigingVragen(rollen, { drempel: 0.9 }).rollen.length, 3);
});

test("bevestigen van wat Claude al koos is iets anders dan aanpassen", () => {
  const bevestigd = stelWaardetypeIn(rol("A", "kostenreductie"), "kostenreductie", { nu: NU });
  const aangepast = stelWaardetypeIn(rol("A", "kostenreductie"), "capaciteitsgroei", { nu: NU });
  assert.equal(bevestigtInschatting(bevestigd), true);
  assert.equal(bevestigtInschatting(aangepast), false);
  assert.equal(bevestigtInschatting(rol("A")), false, "een rol zonder handmatige keuze bevestigt niets");
});
