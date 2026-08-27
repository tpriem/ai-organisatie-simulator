import { buildOrgChartData } from "./orgChartData.js";
import { WAARDETYPES, getWaardetype } from "../../src/config.js";

/**
 * Vercel's serverless functions kunnen geen volledige, lokaal-geïnstalleerde Chromium
 * draaien (te groot, verkeerd platform). Daar gebruiken we puppeteer-core met de
 * kleine, Linux-serverless-compatibele @sparticuz/chromium build. Lokaal (Windows/Mac/
 * Linux dev) gebruiken we gewoon de volledige puppeteer-package met bijbehorende
 * lokale Chromium-download.
 */
async function launchBrowser() {
  if (process.env.VERCEL) {
    const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const { default: puppeteer } = await import("puppeteer");
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

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

function waardetypeSummarySentence(rollen) {
  const parts = WAARDETYPES.map((w) => ({
    ...w,
    count: rollen.filter((r) => r.waardetype === w.id).length,
  })).filter((w) => w.count > 0);
  if (parts.length === 0) return null;
  const clauses = parts.map((w) => `${w.count} rol${w.count === 1 ? "" : "len"} ${w.label.toLowerCase()}`);
  return `Van de vrijgekomen capaciteit is de meest passende lezing: ${clauses.join(", ")}.`;
}

function waardetypeLine(rol) {
  const w = getWaardetype(rol.waardetype);
  if (!w) return "";
  return `<p><strong>${w.icon} ${esc(w.label)}</strong>${
    rol.waardetypeToelichting ? ` — ${esc(rol.waardetypeToelichting)}` : ""
  }</p>`;
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

function competentieTop5Block(title, items) {
  if (!items?.length) return "";
  return `
    <p style="font-weight:bold;font-size:12px;margin:10px 0 4px;">${esc(title)}</p>
    ${items
      .map(
        (c) => `
      <div class="bar-row">
        <span class="bar-label">${esc(c.naam)}</span>
        <div class="bar-track"><div class="bar-fill c-indigo" style="width:${Math.max(c.relatiefPct, 2)}%"></div></div>
        <span class="bar-value">${c.relatiefPct}%</span>
      </div>`
      )
      .join("")}`;
}

function krimpPct(nu, straks) {
  if (!nu) return 0;
  return Math.round(((nu - straks) / nu) * 100);
}

/** Eén rol in de rapportagestructuur, met wie eronder hangt. */
function hierarchieKnoop(knoop, maxFte, diepte = 0) {
  const krimp = krimpPct(knoop.fteHuidig, knoop.fteRealistisch);
  const spanKrimp = krimpPct(knoop.spanTotaalHuidig, knoop.spanTotaalRealistisch);
  const inspringen = diepte * 14;

  return `<div style="margin-left:${inspringen}px;border-left:${
    diepte > 0 ? "1px solid #e2e8f0" : "none"
  };padding-left:${diepte > 0 ? 8 : 0}px;margin-top:6px;">
    <p style="font-weight:bold;font-size:11px;margin:0 0 2px;">${esc(knoop.rolnaam)} — ${knoop.fteHuidig.toFixed(
      1
    )} → ${knoop.fteRealistisch.toFixed(2)} FTE${krimp > 0 ? ` (−${krimp}%)` : ""}</p>
    ${
      knoop.kinderen.length
        ? `<p style="font-size:9px;color:#94a3b8;margin:0 0 3px;">stuurt ${knoop.spanDirect} ${
            knoop.spanDirect === 1 ? "rol" : "rollen"
          } aan · ${knoop.spanTotaalHuidig.toFixed(1)} → ${knoop.spanTotaalRealistisch.toFixed(2)} FTE onder zich${
            spanKrimp > 0 ? ` (−${spanKrimp}%)` : ""
          }</p>`
        : ""
    }
    ${bar("Huidig", knoop.fteHuidig, maxFte, "c-slate")}
    ${bar("Realistisch", knoop.fteRealistisch, maxFte, "c-indigo")}
    ${knoop.kinderen.map((k) => hierarchieKnoop(k, maxFte, diepte + 1)).join("")}
  </div>`;
}

/** Eén afdeling in het organogram, met de rollen eronder. */
function afdelingBlok(afdeling, orgChart) {
  const krimp = krimpPct(afdeling.fteHuidig, afdeling.fteRealistisch);
  // Bij één rol zijn de rolbalken identiek aan die van de afdeling; dan alleen de naam.
  const rollen =
    afdeling.rollen.length === 1
      ? `<p style="font-size:10px;color:#64748b;margin:4px 0 0 14px;">${esc(afdeling.rollen[0].rolnaam)}</p>`
      : afdeling.rollen
          .map(
            (r) => `<div style="margin:6px 0 0 14px;">
        <p style="font-size:10px;margin:0 0 3px;">${esc(r.rolnaam)}</p>
        ${bar("Huidig", r.fteHuidig, orgChart.maxFte, "c-slate")}
        ${bar("Realistisch", r.fteRealistisch, orgChart.maxFte, "c-indigo")}
        ${bar("Agressief", r.fteAgressief, orgChart.maxFte, "c-indigo-light")}
      </div>`
          )
          .join("");

  return `<div class="role-block">
    <p style="font-weight:bold;font-size:12px;margin-bottom:4px;">${esc(afdeling.afdeling)} — ${afdeling.fteHuidig.toFixed(
      1
    )} → ${afdeling.fteRealistisch.toFixed(2)} FTE${krimp > 0 ? ` (−${krimp}%)` : ""}</p>
    ${bar("Huidig", afdeling.fteHuidig, orgChart.maxAfdelingFte, "c-slate")}
    ${bar("Realistisch", afdeling.fteRealistisch, orgChart.maxAfdelingFte, "c-indigo")}
    ${bar("Agressief", afdeling.fteAgressief, orgChart.maxAfdelingFte, "c-indigo-light")}
    ${rollen}
  </div>`;
}

const TIER_KLASSE = { hoog: "c-emerald", midden: "c-blue", laag: "c-orange" };

function profielKolom(titel, items) {
  if (!items?.length) return "";
  return `
    <div class="profiel-kolom">
      <p class="profiel-kop">${esc(titel)}</p>
      ${items
        .slice(0, 6)
        .map(
          (c) => `
        <div class="bar-row">
          <span class="bar-label-wide">${esc(c.naam)}</span>
          <div class="bar-track"><div class="bar-fill ${
            TIER_KLASSE[c.trainbaarheid] ?? "c-slate"
          }" style="width:${Math.max(c.relatiefPct, 2)}%"></div></div>
          <span class="bar-value">${c.pct}%</span>
        </div>`
        )
        .join("")}
    </div>`;
}

/**
 * Het competentieprofiel vertaald naar de vraag waar een CHRO op stuurt. Spiegelt
 * bewust dezelfde inhoud als de Word-versie en de live weergave in de app.
 */
function competentieProfielBlock(profiel) {
  if (!profiel) return "";
  const zin =
    `De toekomstige competentiebehoefte van deze functie komt voor <strong>${profiel.overlapPct}%</strong> overeen met wat de rol nu al vraagt.` +
    (profiel.overlapNaTrainingPct != null
      ? ` Met gerichte ontwikkeling loopt dat op tot <strong>${profiel.overlapNaTrainingPct}%</strong>.`
      : "");

  const acties = [
    profiel.teOntwikkelen?.length
      ? `<p style="font-size:10px;margin:4px 0 0;">Te ontwikkelen: ${profiel.teOntwikkelen
          .map((c) => esc(c.naam))
          .join(", ")}.</p>`
      : "",
    profiel.teToetsen?.length
      ? `<p style="font-size:10px;margin:2px 0 0;">Toets de huidige bezetting op: ${profiel.teToetsen
          .map((c) => esc(c.naam))
          .join(", ")} — deze competenties laten zich moeilijk aanleren.</p>`
      : "",
  ].join("");

  return `
    <p style="font-weight:bold;font-size:12px;margin:10px 0 4px;">Competentieprofiel — nu versus straks</p>
    <p style="font-size:10px;margin:0 0 6px;">${zin}</p>
    <div class="profiel-grid">
      ${profielKolom("Nu", profiel.profielNu)}
      ${profielKolom("Straks", profiel.profielStraks)}
    </div>
    <p class="tier-legenda">
      <span><i class="tier-stip c-emerald"></i>hoog trainbaar</span>
      <span><i class="tier-stip c-blue"></i>midden trainbaar</span>
      <span><i class="tier-stip c-orange"></i>laag trainbaar</span>
    </p>
    ${acties}`;
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
  const {
    bedrijfsnaam,
    scope,
    scopeLabel,
    gegenereerdOp,
    missingProfiles,
    organisatieTotaal,
    subtotalenPerAfdeling,
    rollen,
    sectorAnalyse,
    aanbevelingen,
  } = results;
  const datum = new Date(gegenereerdOp).toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  const orgChart = buildOrgChartData(rollen);
  const { maxFte, rollen: chartRollen } = orgChart;
  const scopeSuffix = scope === "afdeling" && scopeLabel ? ` — ${esc(scopeLabel)}` : "";

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
  .c-emerald { background: #10b981; } .c-blue { background: #3b82f6; } .c-orange { background: #f97316; }
  .profiel-grid { display: flex; gap: 16px; }
  .profiel-kolom { flex: 1; min-width: 0; }
  .profiel-kop { font-size: 9px; color: #94a3b8; margin: 0 0 3px; }
  .bar-label-wide { width: 120px; font-size: 9px; color: #475569; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tier-legenda { display: flex; gap: 12px; font-size: 9px; color: #94a3b8; margin: 5px 0 0; }
  .tier-stip { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
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
  <p class="subtitle">${esc(bedrijfsnaam)}${scopeSuffix}</p>
  ${
    scope === "afdeling" && scopeLabel
      ? `<p class="meta" style="color:#b45309;font-style:italic;">Dit rapport betreft de business unit/afdeling "${esc(scopeLabel)}", niet de volledige organisatie.</p>`
      : ""
  }
  <p class="meta">Gegenereerd op ${esc(datum)}</p>
  <p class="disclaimer">Dit rapport is een strategisch gespreksondersteunend instrument, gebaseerd op huidig onderzoek en technologie. Het is geen exacte voorspelling en vervangt geen diepgaand consultancytraject of individuele functieanalyse.</p>

  <div class="banner"><strong>Richtinggevend, geen voorspelling.</strong> Dit is een vertrekpunt voor gesprek — de basis voor het vervolgtraject, niet het eindoordeel.</div>

  <h2>Managementsamenvatting</h2>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-label">FTE totaal</div><div class="stat-value">${organisatieTotaal.realistisch.totaalFteHuidig}</div></div>
    <div class="stat-card"><div class="stat-label">Automatiseerbaar</div><div class="stat-value">${pct(organisatieTotaal.realistisch.reductiePercentageOrganisatie)}–${pct(organisatieTotaal.agressief.reductiePercentageOrganisatie)}</div></div>
    <div class="stat-card"><div class="stat-label">Besparing/jaar</div><div class="stat-value">${eur(organisatieTotaal.realistisch.totaalKostenBesparingPerJaar)}–${eur(organisatieTotaal.agressief.totaalKostenBesparingPerJaar)}</div></div>
  </div>
  ${waardetypeSummarySentence(rollen) ? `<p>${esc(waardetypeSummarySentence(rollen))}</p>` : ""}
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
        <td>${esc(r.roleLabel ?? r.rolnaam)}</td><td>${r.fte}</td><td>${r.urenPerWeek}</td><td>${eur(r.kostenPerUur)}</td>
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

  ${
    subtotalenPerAfdeling?.length
      ? `<h3>Subtotalen per afdeling</h3>
    <table>
      <thead><tr><th>Afdeling</th><th>Rollen</th><th>FTE huidig</th><th>FTE realist.</th><th>FTE agress.</th><th>Besparing/jaar (R–A)</th></tr></thead>
      <tbody>
        ${subtotalenPerAfdeling
          .map(
            (s) => `<tr>
          <td>${esc(s.afdeling)}</td><td>${s.aantalRollen}</td>
          <td>${s.scenarios.realistisch.totaalFteHuidig.toFixed(1)}</td>
          <td>${s.scenarios.realistisch.totaalFteOver.toFixed(2)}</td>
          <td>${s.scenarios.agressief.totaalFteOver.toFixed(2)}</td>
          <td>${eur(s.scenarios.realistisch.totaalKostenBesparingPerJaar)} – ${eur(s.scenarios.agressief.totaalKostenBesparingPerJaar)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
      : ""
  }

  <h2>Organogram — voor &amp; na</h2>
  <p class="disclaimer">${
    orgChart.hierarchie
      ? `Opgebouwd uit de rapportagelijnen in het roster — ${orgChart.hierarchie.lagen} ${
          orgChart.hierarchie.lagen === 1 ? "laag" : "lagen"
        }. Per rol: FTE nu versus overgebleven na transformatie, en hoeveel FTE eronder hangt.`
      : orgChart.heeftAfdelingen
        ? "Opgebouwd uit de afdelingen in het roster. Het roster bevat geen rapportagelijnen, dus dit toont de organisatie per afdeling — FTE nu versus overgebleven na transformatie."
        : "Geen afdelingen in het roster — dit toont FTE per rol, huidig versus overgebleven na transformatie, geschaald t.o.v. de grootste rol."
  }</p>
  ${
    orgChart.hierarchie?.problemen?.length
      ? `<p class="disclaimer" style="color:#92400e;">Let op bij de rapportagelijnen: ${orgChart.hierarchie.problemen
          .map(esc)
          .join(" ")}</p>`
      : ""
  }
  ${
    orgChart.hierarchie
      ? orgChart.hierarchie.top.map((k) => hierarchieKnoop(k, orgChart.maxFte)).join("")
      : orgChart.heeftAfdelingen
      ? `<p style="font-weight:bold;font-size:12px;margin:8px 0 2px;">Hele organisatie: ${orgChart.organisatie.fteHuidig.toFixed(
          1
        )} → ${orgChart.organisatie.fteRealistisch.toFixed(2)} FTE${
          krimpPct(orgChart.organisatie.fteHuidig, orgChart.organisatie.fteRealistisch) > 0
            ? ` (−${krimpPct(orgChart.organisatie.fteHuidig, orgChart.organisatie.fteRealistisch)}%)`
            : ""
        }</p>
    <p class="disclaimer" style="margin:0 0 8px;">${orgChart.afdelingen.length} afdelingen, ${
          orgChart.rollen.length
        } rollen</p>` + orgChart.afdelingen.map((a) => afdelingBlok(a, orgChart)).join("")
      : chartRollen
          .map(
            (r) => `<div class="role-block">
      <p style="font-weight:bold;font-size:12px;margin-bottom:4px;">${esc(r.rolnaam)}</p>
      ${bar("Huidig", r.fteHuidig, maxFte, "c-slate")}
      ${bar("Realistisch", r.fteRealistisch, maxFte, "c-indigo")}
      ${bar("Agressief", r.fteAgressief, maxFte, "c-indigo-light")}
    </div>`
          )
          .join("")
  }

  <h2>Detail per rol — taakverdeling &amp; competenties</h2>
  ${rollen
    .map(
      (r) => `<div class="role-block">
      <h3>${esc(r.roleLabel ?? r.rolnaam)} (${r.fte} FTE → ${r.scenarios.realistisch.fteOver.toFixed(2)} realistisch / ${r.scenarios.agressief.fteOver.toFixed(2)} agressief)</h3>
      ${waardetypeLine(r)}
      <table>
        <thead><tr><th>Taak</th><th>Categorie</th><th>Aandeel</th><th>Realistisch %</th><th>Agressief %</th></tr></thead>
        <tbody>${taakRows(r)}</tbody>
      </table>
      ${
        r.competentieProfiel
          ? competentieProfielBlock(r.competentieProfiel)
          : competentieTop5Block("De functie vóór de transformatie — top 5 competenties", r.competentieTop5?.top5Nu) +
            competentieTop5Block("De functie ná de transformatie — top 5 competenties", r.competentieTop5?.top5Na)
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

  ${
    // Verplichte bronvermelding bij hergebruik van ESCO (voorwaarde 1 schrijft deze zin
    // letterlijk voor voor publicaties) en markering van eigen bewerkingen (voorwaarde 2).
    rollen.some((r) => r.competentieProfiel)
      ? `<h2>Verantwoording competentiegegevens</h2>
    <p><em>This publication uses the ESCO classification of the European Commission.</em></p>
    <p class="disclaimer">De competenties in dit rapport komen uit ESCO, de classificatie van de Europese Commissie voor vaardigheden, competenties en beroepen. De indeling naar trainbaarheid is een eigen afleiding van House of Digital op basis van ESCO-metadata (type competentie, mate van herbruikbaarheid en de transversale categorie), geïnterpreteerd via het competentiemodel van Spencer &amp; Spencer (1993). Die weging maakt geen deel uit van ESCO zelf.</p>`
      : ""
  }
</body>
</html>`;

  const browser = await launchBrowser();
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
