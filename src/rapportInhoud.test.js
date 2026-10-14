import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { calculateRole, calculateOrganisatie, calculateCapaciteitBestemming } from "./calculate.js";
import { calculateTaakprofiel } from "./taakprofiel.js";
import { calculateCompetentieProfiel } from "./competencyProfile.js";
import { calculateCompetentieAgenda } from "./competencyAgenda.js";
import { calculateMobiliteit } from "./mobiliteit.js";
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

function metCompetenties(r) {
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

function fixture({ competenties = true } = {}) {
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
  return {
    bedrijfsnaam: "Testklant BV",
    scope: "bedrijf",
    scopeLabel: "",
    gegenereerdOp: "2026-10-14T10:00:00.000Z",
    missingProfiles: [],
    organisatieTotaal: calculateOrganisatie(rollen),
    subtotalenPerAfdeling: [],
    rollen,
    sectorAnalyse: null,
    aanbevelingen: null,
  };
}

const platHtml = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
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
    const fte = results.organisatieTotaal.realistisch.totaalFteWeg.toFixed(1);
    assert.ok(tekst.includes(`${fte} FTE aan capaciteit`), `kopzin "${fte} FTE aan capaciteit" ontbreekt`);
  });

  test(`${formaat}: elke bestemming uit de berekening staat in het rapport`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    for (const b of calculateCapaciteitBestemming(results.rollen, "realistisch")) {
      assert.ok(tekst.includes(`${b.fte.toFixed(1)} FTE`), `${b.waardetype}: ${b.fte.toFixed(1)} FTE ontbreekt`);
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

  test(`${formaat}: het taakprofiel staat erin met de totale verschuiving`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const p = calculateTaakprofiel(results.rollen, "realistisch");
    assert.ok(tekst.includes("Waar het werk uit bestaat"), "sectie ontbreekt");
    assert.ok(
      tekst.includes(`${Math.round(p.urenNu)} → ${Math.round(p.urenStraks)} uur per week`),
      "totaal uren ontbreekt"
    );
    for (const c of p.categorieen) assert.ok(tekst.includes(c.label), `categorie "${c.label}" ontbreekt`);
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

// ── Blok 2: ontwikkelagenda en mobiliteit ─────────────────────────────────────────────

test("de fixture bevat genoeg om ontwikkelagenda en mobiliteit te laten zien", () => {
  // Een test op een lege fixture toetst niets. Dit bewaakt dat de gegevens er echt zijn.
  const { rollen } = fixture();
  assert.ok(rollen.every((r) => r.competentieProfiel), "elke rol heeft een competentieprofiel nodig");
  const agenda = calculateCompetentieAgenda(rollen);
  assert.ok(agenda.competenties.some((c) => c.aantalRollen > 1), "geen competentie in meerdere rollen");
  assert.ok(agenda.competenties.some((c) => c.trainbaarheid === "laag"), "geen laag-trainbare competentie");
  assert.equal(calculateMobiliteit(rollen, { maxPerRol: 2 }).heeftData, true, "mobiliteit levert niets op");
});

for (const formaat of ["pdf", "docx"]) {
  test(`${formaat}: de ontwikkelagenda toont elke competentie en het niet-trainbare aandeel`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const agenda = calculateCompetentieAgenda(results.rollen, "realistisch");
    assert.ok(tekst.includes("Ontwikkelagenda"), "sectie ontbreekt");
    for (const c of agenda.competenties) assert.ok(tekst.includes(c.naam), `competentie "${c.naam}" ontbreekt`);
    assert.ok(
      tekst.includes(`${Math.round(agenda.aandeelNietTrainbaar * 100)}% van de totale ontwikkelbehoefte`),
      "niet-trainbaar aandeel ontbreekt"
    );
    assert.ok(tekst.includes(`${agenda.competenties.length} competenties zijn nieuw nodig`), "aantal ontbreekt");
  });

  test(`${formaat}: de mobiliteit toont per rol blijven tegenover de alternatieven`, async () => {
    const { results, [formaat]: tekst } = await rapporten();
    const m = calculateMobiliteit(results.rollen, { maxPerRol: 2 });
    assert.ok(tekst.includes("Waar kunnen deze mensen heen?"), "sectie ontbreekt");
    for (const h of m.herkomsten) {
      assert.ok(tekst.includes(h.roleLabel), `herkomst "${h.roleLabel}" ontbreekt`);
      assert.ok(tekst.includes(`${h.blijvenOverlapPct}% aansluiting`), `blijven-cijfer van ${h.roleLabel} ontbreekt`);
      for (const a of h.alternatieven) {
        assert.ok(tekst.includes(`${a.overlapPct}% · ${Math.round(a.verhouding * 100)}% hiervan`), `alternatief ${a.roleLabel} ontbreekt`);
      }
    }
  });

  test(`${formaat}: zonder competentiegegevens ontbreken deze secties, zonder fout`, async () => {
    const { [formaat]: tekst } = await rapporten({ competenties: false });
    assert.ok(!tekst.includes("Ontwikkelagenda"));
    assert.ok(!tekst.includes("Waar kunnen deze mensen heen?"));
    assert.ok(tekst.includes("Waar het werk uit bestaat"), "de rest van het rapport moet er gewoon zijn");
  });
}

test("de mobiliteitsconclusie verschijnt alleen als het beste alternatief ver achterblijft", async () => {
  const { results, pdf } = await rapporten();
  const m = calculateMobiliteit(results.rollen, { maxPerRol: 2 });
  const beste = Math.max(0, ...m.herkomsten.filter((h) => h.alternatieven.length).map((h) => h.alternatieven[0].verhouding));
  const verwacht = beste > 0 && beste < 0.6;
  assert.equal(pdf.includes("doorgroeien in de eigen, veranderde rol"), verwacht);
});
