import test from "node:test";
import assert from "node:assert/strict";
import mammoth from "mammoth";
import { calculateRole, calculateOrganisatie, calculateCapaciteitBestemming } from "./calculate.js";
import { calculateTaakprofiel } from "./taakprofiel.js";
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

function fixture() {
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

async function rapporten() {
  const results = fixture();
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
