import puppeteer from "puppeteer";
import { buildOrgChartData } from "./orgChartData.js";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eur(n) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function bar(label, value, maxValue, colorClass) {
  const widthPct = Math.max((value / maxValue) * 100, 2);
  return `
    <div class="bar-row">
      <span class="bar-label">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill ${colorClass}" style="width:${widthPct}%"></div></div>
      <span class="bar-value">${value.toFixed(2)}</span>
    </div>`;
}

function taakRows(rol) {
  return rol.scenarios.realistisch.taken
    .map((t, i) => {
      const agressiefPct = rol.scenarios.agressief.taken[i]?.automatiseringspercentage ?? 0;
      return `<tr>
        <td>${esc(t.omschrijving)}</td>
        <td><span class="badge">${esc(t.categorieLabel)}</span></td>
        <td>${pct(t.aandeel)}</td>
        <td>${pct(t.automatiseringspercentage)}</td>
        <td>${pct(agressiefPct)}</td>
      </tr>`;
    })
    .join("");
}

function competentieRows(rol) {
  return (rol.competenties ?? [])
    .map((c) => {
      const delta = c.belangNa - c.belangNu;
      const trendClass = delta > 0 ? "trend-up" : delta < 0 ? "trend-down" : "trend-flat";
      const trendIcon = delta > 0 ? "▲" : delta < 0 ? "▼" : "＝";
      return `<tr>
        <td>${esc(c.naam)}</td>
        <td>${c.belangNu}/5</td>
        <td class="${trendClass}">${trendIcon} ${c.belangNa}/5</td>
        <td>${esc(c.toelichting)}</td>
      </tr>`;
    })
    .join("");
}

function listBlock(title, items, colorClass) {
  if (!items?.length) return "";
  return `
    <h3 class="${colorClass}">${esc(title)}</h3>
    ${items
      .map(
        (i) => `<p class="finding"><strong>${esc(i.rolnaam || i.rollen?.join(" + "))}</strong><br/>${esc(i.toelichting)}</p>`
      )
      .join("")}`;
}

/**
 * Genereert het gecombineerde eindrapport als PDF-buffer via Puppeteer.
 * @param {object} results - het resultaat-object zoals opgeslagen in results.json
 */
export async function generateReportPdf(results) {
  const { bedrijfsnaam, gegenereerdOp, missingProfiles, organisatieTotaal, rollen, sectorAnalyse, aanbevelingen } = results;
  const datum = new Date(gegenereerdOp).toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  const { maxFte, rollen: chartRollen } = buildOrgChartData(rollen);

  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 11px; margin: 0; padding: 32px 40px; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  .subtitle { text-align: center; color: #475569; font-size: 14px; margin: 0 0 4px; }
  .meta { text-align: center; color: #94a3b8; font-size: 10px; margin: 0 0 12px; }
  .disclaimer { font-style: italic; color: #64748b; font-size: 9px; margin-bottom: 20px; }
  h2 { font-size: 15px; border-bottom: 2px solid #4f46e5; padding-bottom: 4px; margin: 24px 0 10px; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 14px 0 6px; page-break-after: avoid; }
  h3.krimp { color: #dc2626; } h3.groei { color: #059669; } h3.samenvoeg { color: #4f46e5; }
  p { line-height: 1.5; margin: 0 0 8px; }
  .banner { background: #4f46e5; color: white; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #1e293b; color: white; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; background: #e0e7ff; color: #4338ca; border-radius: 3px; padding: 1px 5px; font-size: 9px; }
  .role-block { page-break-inside: avoid; margin-bottom: 18px; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .bar-label { width: 80px; font-size: 9px; color: #64748b; flex-shrink: 0; }
  .bar-track { flex: 1; height: 14px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-value { width: 40px; text-align: right; font-size: 9px; font-weight: bold; flex-shrink: 0; }
  .c-slate { background: #94a3b8; } .c-indigo { background: #6366f1; } .c-indigo-light { background: #c7d2fe; }
  .stat-grid { display: flex; gap: 10px; margin-bottom: 14px; }
  .stat-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
  .stat-label { font-size: 9px; color: #94a3b8; margin-bottom: 2px; }
  .stat-value { font-size: 18px; font-weight: bold; }
  .urgency-banner { border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; }
  .urgency-hoog { background: #fef2f2; color: #b91c1c; }
  .urgency-gemiddeld { background: #fffbeb; color: #b45309; }
  .urgency-laag { background: #ecfdf5; color: #047857; }
  .finding { font-size: 10px; margin-bottom: 8px; }
  .trend-up { color: #059669; font-weight: bold; } .trend-down { color: #dc2626; font-weight: bold; } .trend-flat { color: #94a3b8; }
  .findings-cols { display: flex; gap: 16px; }
  .findings-cols > div { flex: 1; }
  .closing { background: #f1f5f9; border-radius: 8px; padding: 14px; margin-top: 20px; }
</style>
</head>
<body>
  <h1>AI Organisatie Transformatie Simulator</h1>
  <p class="subtitle">${esc(bedrijfsnaam)}</p>
  <p class="meta">Gegenereerd op ${esc(datum)}</p>
  <p class="disclaimer">Dit rapport is een strategisch gespreksondersteunend instrument, gebaseerd op huidig onderzoek en technologie. Het is geen exacte voorspelling en vervangt geen diepgaand consultancytraject of individuele functieanalyse.</p>

  <div class="banner"><strong>Richtinggevend, geen voorspelling.</strong> Dit is een vertrekpunt voor gesprek — de basis voor het vervolgtraject, niet het eindoordeel.</div>

  <h2>Managementsamenvatting</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">FTE totaal</div><div class="stat-value">${organisatieTotaal.realistisch.totaalFteHuidig}</div></div>
    <div class="stat-card"><div class="stat-label">Automatiseerbaar</div><div class="stat-value">${pct(organisatieTotaal.realistisch.reductiePercentageOrganisatie)}–${pct(organisatieTotaal.agressief.reductiePercentageOrganisatie)}</div></div>
    <div class="stat-card"><div class="stat-label">Besparing/jaar</div><div class="stat-value">${eur(organisatieTotaal.realistisch.totaalKostenBesparingPerJaar)}–${eur(organisatieTotaal.agressief.totaalKostenBesparingPerJaar)}</div></div>
  </div>
  ${
    sectorAnalyse
      ? `<div class="urgency-banner urgency-${sectorAnalyse.urgentie.startsWith("Hoog") ? "hoog" : sectorAnalyse.urgentie.startsWith("Gemiddeld") ? "gemiddeld" : "laag"}">
    <strong>Eindscore ${sectorAnalyse.eindscore.toFixed(1)} / 5 — ${esc(sectorAnalyse.urgentie)}</strong><br/>${esc(sectorAnalyse.positionering)}
  </div>`
      : ""
  }

  <h2>Interne transformatie — overzicht per rol</h2>
  <table>
    <thead><tr><th>Rol</th><th>FTE</th><th>Uren/wk</th><th>Kosten/uur</th><th>Reductie (R–A)</th><th>Besparing/jaar (R–A)</th></tr></thead>
    <tbody>
      ${rollen
        .map(
          (r) => `<tr>
        <td>${esc(r.rolnaam)}</td><td>${r.fte}</td><td>${r.urenPerWeek}</td><td>${eur(r.kostenPerUur)}</td>
        <td>${pct(r.scenarios.realistisch.reductiePercentage)} – ${pct(r.scenarios.agressief.reductiePercentage)}</td>
        <td>${eur(r.scenarios.realistisch.kostenBesparingPerJaar)} – ${eur(r.scenarios.agressief.kostenBesparingPerJaar)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  ${
    missingProfiles?.length
      ? `<p style="color:#b45309;font-style:italic;">Let op: voor de volgende rollen ontbrak een functieprofiel: ${esc(missingProfiles.join(", "))}.</p>`
      : ""
  }

  <h2>Organogram — voor &amp; na</h2>
  <p class="disclaimer">Geen hiërarchie beschikbaar in het roster — dit toont FTE per rol, huidig versus overgebleven na transformatie, geschaald t.o.v. de grootste rol.</p>
  ${chartRollen
    .map(
      (r) => `<div class="role-block">
      <p style="font-weight:bold;font-size:12px;margin-bottom:4px;">${esc(r.rolnaam)}</p>
      ${bar("Huidig", r.fteHuidig, maxFte, "c-slate")}
      ${bar("Realistisch", r.fteRealistisch, maxFte, "c-indigo")}
      ${bar("Agressief", r.fteAgressief, maxFte, "c-indigo-light")}
    </div>`
    )
    .join("")}

  <h2>Detail per rol — taakverdeling &amp; competenties</h2>
  ${rollen
    .map(
      (r) => `<div class="role-block">
      <h3>${esc(r.rolnaam)} (${r.fte} FTE → ${r.scenarios.realistisch.fteOver.toFixed(2)} realistisch / ${r.scenarios.agressief.fteOver.toFixed(2)} agressief)</h3>
      <table>
        <thead><tr><th>Taak</th><th>Categorie</th><th>Aandeel</th><th>Realistisch %</th><th>Agressief %</th></tr></thead>
        <tbody>${taakRows(r)}</tbody>
      </table>
      ${
        r.competenties?.length
          ? `<table>
        <thead><tr><th>Competentie</th><th>Nu</th><th>Na</th><th>Toelichting</th></tr></thead>
        <tbody>${competentieRows(r)}</tbody>
      </table>`
          : ""
      }
    </div>`
    )
    .join("")}

  ${
    aanbevelingen
      ? `<h2>Bevindingen &amp; Aanbevelingen</h2>
    <p>${esc(aanbevelingen.bevindingenSamenvatting)}</p>
    <div class="findings-cols">
      <div>${listBlock("Krimpende rollen", aanbevelingen.krimpendeRollen, "krimp")}</div>
      <div>${listBlock("Groeiende rollen", aanbevelingen.groeiendeRollen, "groei")}</div>
      <div>${listBlock("Samenvoegkandidaten", aanbevelingen.samenvoegKandidaten, "samenvoeg")}</div>
    </div>
    <h3>Aanbevelingen</h3>
    ${(aanbevelingen.aanbevelingen ?? [])
      .map((a) => `<p class="finding"><strong>${esc(a.titel)}</strong><br/>${esc(a.beschrijving)}</p>`)
      .join("")}`
      : ""
  }

  ${
    sectorAnalyse
      ? `<h2>Sectorpositionering</h2>
    <p>Sector: ${esc(sectorAnalyse.sector.sector)} (niveau ${sectorAnalyse.sector.niveau}) — risico ${sectorAnalyse.sector.risico}/5, kans ${sectorAnalyse.sector.kans}/5.</p>
    <p>Impactscore (positioneringsvragen): ${sectorAnalyse.impactScore?.toFixed(1) ?? "-"} / 5</p>
    <p>Readinessscore (positioneringsvragen): ${sectorAnalyse.readinessScore?.toFixed(1) ?? "-"} / 5</p>
    <p><strong>Eindscore: ${sectorAnalyse.eindscore.toFixed(1)} / 5</strong></p>
    <p>Positionering t.o.v. sectorgemiddelde: ${esc(sectorAnalyse.positionering)}</p>
    <p><strong>Strategische urgentie: ${esc(sectorAnalyse.urgentie)}</strong></p>`
      : ""
  }

  <div class="closing">
    <h2 style="margin-top:0;">Vervolgstappen</h2>
    <p><strong>Dit rapport schetst een richting, geen exacte voorspelling. De cijfers, competentieverschuivingen en aanbevelingen zijn bedoeld als vertrekpunt voor een strategisch gesprek — niet als eindoordeel.</strong></p>
    <p>De uitkomsten geven aanleiding tot verder, verdiepend onderzoek: het toetsen van deze bevindingen aan de praktijk, verfijning op basis van interne kennis en operationele details, en vertaling naar een concreet implementatieplan. Dit rapport is het begin van dat gesprek, niet de afsluiting ervan.</p>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
