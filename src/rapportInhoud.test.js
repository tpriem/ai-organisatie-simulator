import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { calculateRole, calculateOrganisatie, calculateCapaciteitBestemming } from "./calculate.js";
import { calculateCapaciteitHerkomst, herkomstRijen, herkomstZin, herkomstCellen } from "./taakprofiel.js";
import { calculateCompetentieProfiel } from "./competencyProfile.js";
import { calculateCompetentieAgenda, agendaRijen, agendaCellen, agendaZin, agendaRestZin } from "./competencyAgenda.js";
import {
  dekkingZinnen,
  beroepsmatchRegel,
  waardetypeHerkomstZin,
  waardetypeHandmatigRegel,
  bevestigingZin,
} from "./rapportTeksten.js";
import { stelWaardetypeIn, rollenDieBevestigingVragen } from "./waardetype.js";
import { nl } from "./formatNl.js";
import { buildOrgChartData, organogramTeksten } from "../web/lib/orgChartData.js";
import { calculateSubtotalenPerAfdeling } from "./calculate.js";
import { SUBTOTALEN_KOLOMMEN, subtotaalCellen } from "./rapportTeksten.js";
import { buildReportHtml } from "../web/lib/generateReportPdf.js";
import { generateReportDocx } from "../web/lib/generateReport.js";

// Toetst dat wat de app toont ook in de rapporten staat, en dat de cijfers daar uit
// dezelfde rekenfuncties komen. Aanleiding: er is een week lang alleen aan de app gebouwd
// terwijl het rapport het product is dat de klant krijgt. Zonder deze toets raken app en
// rapport ongemerkt uit elkaar.

const rol = (rolnaam, afdeling, fte, taken, waardetype) => {
  const r = calculateRole({ rolnaam, afdeling, fte, urenPerWeek: 36, kostenPerUur: 40, taken });
  r.waardetype = waardetype;
  return r;
};

// Competentiegegevens per rol, bewust met gedeelde en niet-gedeelde termen: zo ontstaat er
// zowel overlap tussen rollen (mobiliteit) als een competentie die in meerdere rollen
// terugkomt (ontwikkelagenda), én een laag-trainbare (attitude).
const META = {
  "communiceren met klanten": { type: "competence", reuse: "cross-sector", cat: null },
  "gegevens bijhouden": { type: "competence", reuse: "occupation-specific", cat: null },
  "relaties onderhouden": { type: "competence", reuse: "sector-specific", cat: null },
  "offertes schrijven": { type: "knowledge", reuse: "cross-sector", cat: null },
  "gegevens analyseren": { type: "knowledge", reuse: "cross-sector", cat: null },
  "strategisch plannen": { type: "competence", reuse: "transversal", cat: "denken" },
  "kritisch evalueren": { type: "competence", reuse: "transversal", cat: "denken" },
  "omgaan met onzekerheid": { type: "competence", reuse: "transversal", cat: "attitudes" },
};

const COMPETENTIES = {
  "Klantenservice medewerker": {
    taak: [["communiceren met klanten"], ["gegevens bijhouden"]],
    nieuw: [["kritisch evalueren", 5], ["omgaan met onzekerheid", 3], ["communiceren met klanten", 3]],
  },
  Accountmanager: {
    taak: [["relaties onderhouden", "communiceren met klanten"], ["offertes schrijven"]],
    nieuw: [["kritisch evalueren", 5], ["relaties onderhouden", 4], ["omgaan met onzekerheid", 3]],
  },
  Kwaliteitsmedewerker: {
    taak: [["gegevens analyseren"], ["strategisch plannen"]],
    nieuw: [["kritisch evalueren", 4], ["gegevens analyseren", 4], ["omgaan met onzekerheid", 3]],
  },
};

// Eén sterke, één perfecte en één matige koppeling: zo is er een twijfelgeval om te melden.
const BEROEPEN = {
  "Klantenservice medewerker": { id: "1", label: "vertegenwoordiger klantenservice", score: 0.92 },
  Accountmanager: { id: "2", label: "accountmanager", score: 1 },
  Kwaliteitsmedewerker: { id: "3", label: "kwaliteitsbeoordelaar", score: 0.55 },
};

function metCompetenties(r) {
  r.beroepsmatch = BEROEPEN[r.rolnaam];
  r.ongematchteTaken = 0;
  const c = COMPETENTIES[r.rolnaam];
  r.taakCompetenties = c.taak.map((competenties, taakIndex) => ({ taakIndex, competenties }));
  r.nieuweCompetenties = c.nieuw.map(([naam, belang]) => ({ naam, belang, toelichting: "" }));
  r.competentieMeta = META;
  r.competentieProfiel = calculateCompetentieProfiel(
    r.scenarios.realistisch.taken,
    r.taakCompetenties,
    r.nieuweCompetenties,
    META
  );
  return r;
}

function fixture({ competenties = true, mislukt = false, handmatig = false, bevestigd = false } = {}) {
  const rollen = [
    rol("Klantenservice medewerker", "Klantenservice", 8, [
      { omschrijving: "Bellen", categorie: "klantcontact", aandeel: 0.7 },
      { omschrijving: "Administratie", categorie: "data_entry", aandeel: 0.3 },
    ], "kostenreductie"),
    rol("Accountmanager", "Sales", 3, [
      { omschrijving: "Relaties", categorie: "accountmanagement", aandeel: 0.6 },
      { omschrijving: "Offertes", categorie: "schrijven", aandeel: 0.4 },
    ], "capaciteitsgroei"),
    rol("Kwaliteitsmedewerker", "Klantenservice", 2, [
      { omschrijving: "Controle", categorie: "analyseren", aandeel: 0.5 },
      { omschrijving: "Strategie", categorie: "strategisch", aandeel: 0.5 },
    ], "kwaliteitsverbetering"),
  ];
  if (competenties) rollen.forEach(metCompetenties);
  // Klantenservice stond op kostenreductie; de adviseur stuurt dat bij naar kwaliteit.
  if (handmatig) {
    rollen[0] = stelWaardetypeIn(rollen[0], "kwaliteitsverbetering", {
      reden: "Servicekwaliteit is hier het onderscheidend vermogen",
      nu: new Date("2026-10-15T09:00:00.000Z"),
    });
  }
  // De adviseur bevestigt het waardetype van de grote rollen zoals het er staat.
  if (bevestigd) {
    for (const x of rollenDieBevestigingVragen(rollen).rollen) {
      const i = rollen.findIndex((r) => (r.roleId ?? r.rolnaam) === x.roleId);
      rollen[i] = stelWaardetypeIn(rollen[i], rollen[i].waardetype, { nu: new Date("2026-10-15T09:00:00.000Z") });
    }
  }
  return {
    bedrijfsnaam: "Testklant BV",
    scope: "bedrijf",
    scopeLabel: "",
    gegenereerdOp: "2026-10-14T10:00:00.000Z",
    missingProfiles: [],
    mislukteRollen: mislukt ? [{ roleLabel: "Jurist (Legal)", rolnaam: "Jurist", fout: "tijdslimiet" }] : [],
    organisatieTotaal: calculateOrganisatie(rollen),
    subtotalenPerAfdeling: [],
    rollen,
    aanbevelingen: null,
  };
}

const platHtml = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

async function rapporten(opties) {
  const results = fixture(opties);
  const pdf = platHtml(buildReportHtml(results));
  const docx = (await mammoth.extractRawText({ buffer: await generateReportDocx(results) })).value.replace(/\s+/g, " ");
  return { results, pdf, docx };
}

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: het kopgetal is vrijgekomen capaciteit, niet besparing`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const fte = nl(results.organisatieTotaal.realistisch.totaalFteWeg, 1);
    assert.ok(tekst.includes(`${fte} FTE aan capaciteit`), `kopzin "${fte} FTE aan capaciteit" ontbreekt`);
  });

  test(`${formaat}: elke bestemming uit de berekening staat in het rapport`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    for (const b of calculateCapaciteitBestemming(results.rollen, "realistisch")) {
      assert.ok(tekst.includes(`${nl(b.fte, 1)} FTE`), `${b.waardetype}: ${nl(b.fte, 1)} FTE ontbreekt`);
    }
  });

  test(`${formaat}: het financiële beeld staat ná de capaciteit en met zijn voorwaarde`, async () => {
    const { [formaat]: tekst } = await rapporten();
    const cap = tekst.indexOf("capaciteit");
    const fin = tekst.indexOf("Financieel beeld");
    assert.ok(fin > 0, "financieel beeld ontbreekt");
    assert.ok(cap < fin, "capaciteit hoort vóór het financiële beeld");
    assert.ok(tekst.includes("alleen als die uren daadwerkelijk uit de kosten verdwijnen"), "voorwaarde ontbreekt");
  });

  test(`${formaat}: de herkomst van de capaciteit staat erin als tabel met de totale uren`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const h = calculateCapaciteitHerkomst(results.rollen, "realistisch");
    assert.ok(tekst.includes("Waar komt de capaciteit vandaan?"), "sectie ontbreekt");
    assert.ok(tekst.includes(herkomstZin(h)), "de zin met de grootste bronnen ontbreekt");
    for (const rij of herkomstRijen(h, 5)) {
      for (const c of herkomstCellen(rij)) assert.ok(tekst.includes(c), `cel "${c}" (${rij.label}) ontbreekt`);
    }
    // De oude weergave in aandelen en verschuivingen is weg.
    assert.ok(!tekst.includes("Het zwaartepunt verschuift"), "oude zwaartepuntzin staat er nog");
    assert.doesNotMatch(tekst, /d+ pp/, "verschuiving in procentpunten staat er nog");
  });

  test(`${formaat}: de rollentabel toont vrijgekomen uren naast het bedrag`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    assert.ok(tekst.includes("Vrijkomend"), "kolom met vrijgekomen uren ontbreekt");
    const eerste = results.rollen[0].scenarios.realistisch.automatiseerbareUrenPerWeek;
    assert.ok(tekst.includes(String(Math.round(eerste))), `${Math.round(eerste)} uur van de eerste rol ontbreekt`);
  });
}

test("pdf: het oude kopgetal 'Besparing/jaar' staat niet meer als samenvattingskaart", () => {
  const html = buildReportHtml(fixture());
  assert.ok(!html.includes('<div class="stat-label">Besparing/jaar</div>'));
});

// ── Blok 2: ontwikkelagenda ─────────────────────────────────────────────

test("de fixture bevat genoeg om de ontwikkelagenda te laten zien", () => {
  // Een test op een lege fixture toetst niets. Dit bewaakt dat de gegevens er echt zijn.
  const { rollen } = fixture();
  assert.ok(rollen.every((r) => r.competentieProfiel), "elke rol heeft een competentieprofiel nodig");
  const agenda = calculateCompetentieAgenda(rollen);
  assert.ok(agenda.competenties.some((c) => c.aantalRollen > 1), "geen competentie in meerdere rollen");
  assert.ok(agenda.competenties.some((c) => c.trainbaarheid === "laag"), "geen laag-trainbare competentie");
});

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: de competentietabel toont de breedste competenties en het niet-trainbare aandeel`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const agenda = calculateCompetentieAgenda(results.rollen, "realistisch");
    assert.ok(tekst.includes("Welke competenties raken de hele organisatie?"), "sectie ontbreekt");
    const { rijen, rest } = agendaRijen(agenda, 5);
    for (const c of rijen) {
      for (const cel of agendaCellen(c, agenda.aantalRollenTotaal)) assert.ok(tekst.includes(cel), `cel "${cel}" (${c.naam}) ontbreekt`);
    }
    if (rest > 0) assert.ok(tekst.includes(agendaRestZin(rest)), "melding over de overige competenties ontbreekt");
    assert.ok(tekst.includes(agendaZin(agenda)), "samenvattende zin ontbreekt");
    // De kolommen FTE en Belang zijn weg: die lazen als formatie en als een getal zonder uitleg.
    assert.ok(!tekst.includes("Ontwikkelbaar"), "oude kolom staat er nog");
  });

  test(`${formaat}: zonder competentiegegevens ontbreken deze secties, zonder fout`, async () => {
    const { [formaat]: tekst } = await rapporten({ competenties: false });
    assert.ok(!tekst.includes("Welke competenties raken de hele organisatie?"));
    assert.ok(tekst.includes("Waar komt de capaciteit vandaan?"), "de rest van het rapport moet er gewoon zijn");
  });
}

// ── Blok 3: beroepsmatch en meldingen ───────────────────────────────────────────────────

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: bij elke rol staat het ESCO-beroep waaruit de competenties komen`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    for (const r of results.rollen) {
      assert.ok(tekst.includes(beroepsmatchRegel(r.beroepsmatch)), `regel voor ${r.rolnaam} ontbreekt`);
    }
  });

  test(`${formaat}: een matige koppeling wordt als indicatief benoemd, een sterke niet`, async () => {
    const { [formaat]: tekst } = await rapporten();
    assert.ok(tekst.includes(`"kwaliteitsbeoordelaar" (match ${nl(0.55, 2)}). De koppeling sluit minder nauw aan`));
    assert.ok(!tekst.includes(`"accountmanager" (match ${nl(1, 2)}). De koppeling sluit minder nauw aan`));
  });

  test(`${formaat}: er is geen aparte dekkingssectie meer; twijfelgevallen staan per rol`, async () => {
    // Taakdekking en een lijst koppelingen zeggen een lezer weinig. De matige koppeling staat bij de
    // rol zelf (zie hierboven); alleen wat de totalen verandert krijgt een melding bovenaan.
    const { [formaat]: tekst } = await rapporten();
    assert.ok(!tekst.includes("Dekking en betrouwbaarheid"));
    assert.ok(!tekst.includes("aan een competentie worden gekoppeld"), "taakdekkingszin staat er nog");
  });

  test(`${formaat}: een mislukte rol wordt gemeld bij de totalen, voor de analyses`, async () => {
    // Zonder deze melding ontbreekt de rol stilzwijgend in alle totalen van een rapport
    // dat naar de klant gaat.
    const { results, [formaat]: tekst } = await rapporten({ mislukt: true });
    const zin = dekkingZinnen(results).mislukt;
    assert.ok(zin, "er hoort een melding te zijn");
    assert.equal(tekst.split(zin).length - 1, 1, "de melding hoort één keer te staan");
    assert.ok(tekst.indexOf(zin) < tekst.indexOf("Waar komt de capaciteit vandaan?"), "melding hoort vóór de analyses te staan");
  });

  test(`${formaat}: zonder mislukte rollen staat er geen melding over mislukte rollen`, async () => {
    const { [formaat]: tekst } = await rapporten();
    assert.ok(!tekst.includes("Niet geanalyseerd, en dus niet opgenomen in de totalen"));
  });
}

test("de rapportteksten gebruiken een decimale komma", () => {
  assert.equal(nl(0.84, 2), "0,84");
  assert.equal(nl(6.4, 1), "6,4");
  assert.equal(beroepsmatchRegel({ label: "x", score: 0.84 }), 'Competenties ontleend aan het ESCO-beroep "x" (match 0,84).');
});

test("een sterke koppeling krijgt geen voorbehoud", () => {
  assert.ok(!beroepsmatchRegel({ label: "x", score: 0.9 }).includes("indicatief"));
  assert.ok(beroepsmatchRegel({ label: "x", score: 0.61 }).includes("indicatief"));
  assert.ok(beroepsmatchRegel({ label: "x", score: 0.46 }).includes("indicatief"));
});

test("zonder beroepsmatch geen regel en geen fout", () => {
  assert.equal(beroepsmatchRegel(null), null);
  assert.equal(beroepsmatchRegel({}), null);
  assert.deepEqual(dekkingZinnen({}).heeftIets, false);
});

// ── Getalnotatie ──────────────────────────────────────────────────────────────────────

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: getallen met decimalen staan met een komma, niet met een punt`, async () => {
    // Nederlandse rapporten voor Nederlandse lezers: "6,4 FTE", niet "6.4 FTE". Zoekt naar
    // een decimale punt tussen cijfers, met uitzondering van datums (dd.mm.jjjj) en
    // duizendtallen met een punt (1.234.567), die er wel horen te staan.
    const { [formaat]: tekst } = await rapporten();
    const verdacht = [...tekst.matchAll(/(?<![\d.])\d{1,3}\.\d{1,2}(?![\d.])\s*(FTE|%|pp|uur)/g)].map((m) => m[0]);
    assert.deepEqual(verdacht, [], `decimale punt gevonden: ${verdacht.slice(0, 3).join(" | ")}`);
  });
}

// ── Handmatig bepaald waardetype ──────────────────────────────────────────────────────

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: een bijgestuurd waardetype werkt door in de verdeling van de capaciteit`, async () => {
    // Het hele doel van bijsturen: de keuze van de adviseur moet in het kopgetal staan.
    const { results, [formaat]: tekst } = await rapporten({ handmatig: true });
    assert.equal(results.rollen[0].waardetype, "kwaliteitsverbetering");
    const verdeling = calculateCapaciteitBestemming(results.rollen, "realistisch");
    assert.ok(verdeling.some((b) => b.waardetype === "kwaliteitsverbetering"));
    for (const b of verdeling) assert.ok(tekst.includes(`${nl(b.fte, 1)} FTE`), `${b.waardetype} ontbreekt`);
  });

  test(`${formaat}: het rapport meldt dat de bestemming deels handmatig is bepaald`, async () => {
    const { results, [formaat]: tekst } = await rapporten({ handmatig: true });
    const zin = waardetypeHerkomstZin(results.rollen);
    assert.ok(zin && zin.includes("1 van de 3 rollen"), `zin onverwacht: ${zin}`);
    assert.ok(tekst.includes(zin), "herkomstzin ontbreekt in het rapport");
  });

  test(`${formaat}: bij de bijgestuurde rol staat de reden en wat de inschatting was`, async () => {
    const { results, [formaat]: tekst } = await rapporten({ handmatig: true });
    assert.ok(tekst.includes("Servicekwaliteit is hier het onderscheidend vermogen"), "reden ontbreekt");
    assert.ok(tekst.includes(waardetypeHandmatigRegel(results.rollen[0])));
    assert.ok(tekst.includes("De inschatting op basis van het functieprofiel was: kostenreductie"));
  });

  test(`${formaat}: zonder bijsturen staat er niets over handmatig bepaalde waardetypes`, async () => {
    const { [formaat]: tekst } = await rapporten();
    assert.ok(!tekst.includes("handmatig bepaald"));
    assert.ok(!tekst.includes("Handmatig bepaald"));
  });
}

test("het rapport noemt het taalmodel niet bij naam", () => {
  // De klant leest "de inschatting op basis van het functieprofiel"; in de app mag het
  // "Claude" zijn, voor de adviseur.
  const { rollen } = fixture({ handmatig: true });
  assert.ok(!waardetypeHandmatigRegel(rollen[0]).includes("Claude"));
  assert.ok(!waardetypeHerkomstZin(rollen).includes("Claude"));
});

// ── Bevestiging van de grote rollen ───────────────────────────────────────────────────

test("de fixture heeft grote rollen die om bevestiging vragen", () => {
  // Zonder dat zijn de volgende toetsen leeg.
  const b = rollenDieBevestigingVragen(fixture().rollen);
  assert.ok(b.rollen.length >= 1);
  assert.equal(b.alleBevestigd, false);
});

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: niets bevestigd — het rapport waarschuwt en noemt de rollen met hun aandeel`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const zin = bevestigingZin(results.rollen);
    assert.ok(zin.startsWith("Let op"), zin);
    assert.ok(tekst.includes(zin), "waarschuwing ontbreekt in het rapport");
    const b = rollenDieBevestigingVragen(results.rollen);
    assert.ok(zin.includes(`${Math.round(b.onbevestigdAandeel * 100)}%`), "aandeel ontbreekt in de zin");
  });

  test(`${formaat}: alles bevestigd — het rapport meldt dat zonder waarschuwing`, async () => {
    const { results, [formaat]: tekst } = await rapporten({ bevestigd: true });
    const zin = bevestigingZin(results.rollen);
    assert.ok(zin.includes("door de adviseur bevestigd") && !zin.startsWith("Let op"), zin);
    assert.ok(tekst.includes(zin));
    assert.ok(!tekst.includes("nog niet door de adviseur bevestigd"));
  });

  test(`${formaat}: bevestigen van wat al stond leest als bevestigd, niet als aangepast`, async () => {
    const { results, [formaat]: tekst } = await rapporten({ bevestigd: true });
    assert.ok(tekst.includes("Bevestigd door de adviseur."), "regel bij de rol ontbreekt");
    const zin = waardetypeHerkomstZin(results.rollen);
    assert.ok(zin.includes("door de adviseur bevestigd"), zin);
    assert.ok(!zin.includes("afwijkt") && !zin.includes("wijken"), "er is niets afwijkends");
    assert.ok(!tekst.includes("De inschatting op basis van het functieprofiel was"), "er is niets aangepast");
  });

  test(`${formaat}: gemengd — één rol aangepast, de rest nog open`, async () => {
    const { results, [formaat]: tekst } = await rapporten({ handmatig: true });
    const zin = bevestigingZin(results.rollen);
    assert.ok(tekst.includes(zin));
    const b = rollenDieBevestigingVragen(results.rollen);
    // De aangepaste rol telt als nagelopen: hij staat niet meer in de lijst van open rollen.
    const aangepast = results.rollen[0].roleLabel;
    if (!b.alleBevestigd) assert.ok(!zin.includes(aangepast), `${aangepast} is bijgesteld en hoort niet meer open te staan`);
  });
}

test("een rapport zonder rollen met capaciteit zegt niets over bevestiging", () => {
  assert.equal(bevestigingZin([]), null);
  assert.equal(bevestigingZin(null), null);
});

// --- Verwijzing naar het volwassenheidsrapport -------------------------------------------------

import { volwassenheidVerwijzingZin } from "./rapportTeksten.js";

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: het impactrapport verwijst naar het volwassenheidsrapport als er een meting is, en anders niet`, async () => {
    const maak = async (results) => {
      if (formaat === "pdf") return platHtml(buildReportHtml(results));
      return (await mammoth.extractRawText({ buffer: await generateReportDocx(results) })).value.replace(/\s+/g, " ");
    };
    const met = await maak({ ...fixture(), volwassenheidBeschikbaar: true });
    const zonder = await maak(fixture());
    assert.ok(met.includes(volwassenheidVerwijzingZin), "verwijzing ontbreekt");
    assert.ok(!zonder.includes(volwassenheidVerwijzingZin), "verwijzing hoort er niet te staan zonder meting");
    assert.ok(!/volwassenheidsrapport/.test(zonder));
  });
}

// ── Organogram: capaciteit per rol en afdeling, geen formatie ─────────────────────────

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: het organogram toont de vrijgekomen capaciteit van de hele organisatie`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const o = buildOrgChartData(results.rollen).organisatie;
    assert.ok(tekst.includes("Organogram — waar de capaciteit vrijkomt"), "kop ontbreekt");
    assert.ok(
      tekst.includes(`Hele organisatie: ${nl(o.fteHuidig, 1)} FTE, waarvan ${nl(o.fteVrij, 1)} FTE`),
      "totaalregel met vrijgekomen capaciteit ontbreekt"
    );
  });

  test(`${formaat}: elke afdeling staat in het organogram met haar vrijgekomen capaciteit`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const chart = buildOrgChartData(results.rollen);
    const t = organogramTeksten(chart);
    for (const a of chart.afdelingen) {
      assert.ok(tekst.includes(`${a.afdeling} — ${t.onderdeel(a)}`), `afdeling ${a.afdeling} ontbreekt of klopt niet`);
    }
  });

  test(`${formaat}: het organogram spreekt niet meer over wie er overblijft`, async () => {
    const { [formaat]: tekst } = await rapporten();
    const deel = tekst.slice(tekst.indexOf("Organogram — waar de capaciteit vrijkomt"));
    const organogram = deel.slice(0, deel.indexOf("Waar komt de capaciteit vandaan?") > 0 ? deel.indexOf("Waar komt de capaciteit vandaan?") : 4000);
    assert.doesNotMatch(organogram, /overgebleven|na transformatie/i);
    assert.doesNotMatch(organogram, /\d,\d+ → \d,\d+ FTE/);
  });
}

// De mobiliteitsvergelijking (blijven tegenover andere rollen) staat niet meer in de rapporten: in
// de awareness-fase zegt ze over functies, niet over mensen, en het aansluitingscijfer van de eigen
// rol staat al per functie. De berekening zelf blijft bestaan voor een verdiepende fase.
for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: het mobiliteitsblok staat niet meer in het rapport`, async () => {
    const { [formaat]: tekst } = await rapporten();
    assert.ok(!tekst.includes("Waar kunnen deze mensen heen?"));
    assert.ok(!tekst.includes("Blijven, in de veranderde rol"));
    assert.ok(!tekst.includes("doorgroeien in de eigen, veranderde rol"));
  });
}

// ── Rolkoppen in capaciteit, niet in overblijvende FTE ────────────────────────────────

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: elke rolkop noemt de vrijkomende capaciteit uit de berekening`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    for (const r of results.rollen) {
      const vrij = (s) => nl(r.scenarios[s].fteWeg, 1);
      const kop = `${r.roleLabel ?? r.rolnaam} — ${nl(r.fte, 1)} FTE, waarvan ${vrij("realistisch")} FTE vrijkomt (realistisch) tot ${vrij("agressief")} FTE (agressief)`;
      assert.ok(tekst.includes(kop), `kop van ${r.rolnaam} ontbreekt of klopt niet: ${kop}`);
    }
  });

  test(`${formaat}: nergens staat nog 'FTE → x realistisch'`, async () => {
    const { [formaat]: tekst } = await rapporten();
    assert.doesNotMatch(tekst, /FTE → \d/);
    assert.doesNotMatch(tekst, /realistisch \/ \d/);
  });
}

// ── Subtotalen per afdeling: vrijkomende capaciteit, niet overblijvende FTE ───────────

async function rapportenMetAfdelingen() {
  const results = fixture();
  results.subtotalenPerAfdeling = calculateSubtotalenPerAfdeling(results.rollen);
  const pdf = platHtml(buildReportHtml(results));
  const docx = (await mammoth.extractRawText({ buffer: await generateReportDocx(results) })).value.replace(/\s+/g, " ");
  return { results, pdf, docx };
}

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: de subtotalen per afdeling tonen wat er vrijkomt, met de waarde per jaar`, async () => {
    const { results, [formaat]: tekst } = await rapportenMetAfdelingen();
    assert.ok(results.subtotalenPerAfdeling.length > 0, "de fixture heeft afdelingen nodig");
    assert.ok(tekst.includes("Subtotalen per afdeling"));
    for (const k of SUBTOTALEN_KOLOMMEN) assert.ok(tekst.includes(k), `kolom "${k}" ontbreekt`);
    for (const sub of results.subtotalenPerAfdeling) {
      for (const cel of subtotaalCellen(sub).slice(2)) assert.ok(tekst.includes(cel), `cel "${cel}" van ${sub.afdeling} ontbreekt`);
    }
    // De oude kolomkoppen over overblijvende FTE en besparing zijn weg.
    assert.ok(!tekst.includes("FTE realist."));
    assert.ok(!tekst.includes("FTE agress."));
    assert.ok(!tekst.includes("Besparing/jaar"));
  });
}
