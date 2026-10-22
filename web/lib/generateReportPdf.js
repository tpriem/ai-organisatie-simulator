import { buildOrgChartData, balkSegmenten, aansturingRegels, organogramTeksten, BESTEMMING_VOLGORDE } from "./orgChartData.js";
import { driedeling } from "../../src/competencyProfile.js";
import { getWaardetype } from "../../src/config.js";
import { calculateCapaciteitBestemming } from "../../src/calculate.js";
import { calculateCapaciteitHerkomst, herkomstRijen, herkomstZin, herkomstCellen, HERKOMST_KOLOMMEN } from "../../src/taakprofiel.js";
import { calculateCompetentieAgenda } from "../../src/competencyAgenda.js";
import {
  dekkingZinnen,
  beroepsmatchRegel,
  waardetypeHerkomstZin,
  waardetypeHandmatigRegel,
  bevestigingZin,
  volwassenheidVerwijzingZin,
} from "../../src/rapportTeksten.js";
import { nl } from "../../src/formatNl.js";

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

function waardetypeLine(rol) {
  const w = getWaardetype(rol.waardetype);
  if (!w) return "";
  const handmatig = waardetypeHandmatigRegel(rol);
  return `<p><strong>${w.icon} ${esc(w.label)}</strong>${
    rol.waardetypeToelichting ? ` — ${esc(rol.waardetypeToelichting)}` : ""
  }${handmatig ? `<br/><span class="disclaimer">${esc(handmatig)}</span>` : ""}</p>`;
}

// Balk met een eigen waardetekst, voor percentages en gecombineerde cijfers. bar()
// hierboven toont altijd één getal met twee decimalen en past daar niet bij.
function barTekst(label, tekst, breedtePct, colorClass) {
  const breedte = Math.max(Math.min(breedtePct, 100), 1.5);
  return `
    <div class="bar-row">
      <span class="bar-label-wide">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill ${colorClass}" style="width:${breedte}%"></div></div>
      <span class="bar-value" style="width:130px;">${tekst}</span>
    </div>`;
}

const BESTEMMING_KLASSE = {
  kostenreductie: "c-slate",
  capaciteitsgroei: "c-indigo",
  kwaliteitsverbetering: "c-emerald",
  onbepaald: "c-indigo-light",
};

// Waar de vrijgekomen capaciteit naartoe gaat. Zelfde berekening als in de app
// (calculateCapaciteitBestemming), zodat beide altijd dezelfde cijfers tonen.
function capaciteitBlock(organisatieTotaal, rollen) {
  const t = organisatieTotaal.realistisch;
  const bestemming = calculateCapaciteitBestemming(rollen, "realistisch");
  const heeftBestemming = bestemming.some((b) => b.waardetype !== "onbepaald");

  const uren = t.totaalVrijgekomenUrenPerWeek ?? t.totaalFteWeg * 36;
  const kop = `<p><strong>${nl(t.totaalFteWeg, 1)} FTE</strong> aan capaciteit komt vrij (${Math.round(
    uren
  )} uur per week, realistisch scenario).`;

  const rijen = heeftBestemming
    ? bestemming
        .map((b) => {
          const type = getWaardetype(b.waardetype);
          const label = type ? `${type.icon} ${type.label}` : "Nog niet bepaald";
          return barTekst(
            label,
            `${nl(b.fte, 1)} FTE · ${b.rollen} ${b.rollen === 1 ? "rol" : "rollen"}`,
            b.aandeel * 100,
            BESTEMMING_KLASSE[b.waardetype] ?? "c-slate"
          );
        })
        .join("")
    : "";

  return `${kop}${
    heeftBestemming ? " Per rol is ingeschat welke bestemming het meest voor de hand ligt:" : ""
  }</p>
  ${rijen}
  ${
    heeftBestemming
      ? `<p class="disclaimer">Een vertrekpunt voor het gesprek, geen voorschrift: de keuze waar de capaciteit naartoe gaat is aan de organisatie.${
          waardetypeHerkomstZin(rollen) ? ` ${esc(waardetypeHerkomstZin(rollen))}` : ""
        }</p>
      ${
        bevestigingZin(rollen)
          ? `<p class="disclaimer"${bevestigingZin(rollen).startsWith("Let op") ? ' style="color:#b45309;"' : ""}>${esc(bevestigingZin(rollen))}</p>`
          : ""
      }`
      : ""
  }`;
}

// Het financiële beeld bewust ná en naast de capaciteit, met de voorwaarde erbij.
function financieelBlock(organisatieTotaal) {
  return `<p class="disclaimer"><strong>Financieel beeld.</strong> Als de vrijgekomen uren volledig als besparing worden ingeboekt, is dat ${eur(
    organisatieTotaal.realistisch.totaalKostenBesparingPerJaar
  )}–${eur(
    organisatieTotaal.agressief.totaalKostenBesparingPerJaar
  )} per jaar (realistisch–agressief). Dit bedrag geldt alleen als die uren daadwerkelijk uit de kosten verdwijnen; worden ze ingezet voor meer volume of hogere kwaliteit, dan is de opbrengst geen besparing maar extra output.</p>`;
}

// Uit welk soort werk de vrijkomende capaciteit komt, als tabel in uren.
function herkomstBlock(rollen) {
  const herkomst = calculateCapaciteitHerkomst(rollen, "realistisch");
  if (!herkomst.heeftData) return "";

  const rijen = herkomstRijen(herkomst, 5)
    .map((rij) => {
      const cellen = herkomstCellen(rij);
      const stijl = rij.soort === "totaal" ? ' style="font-weight:bold;"' : "";
      return `<tr>${cellen
        .map((c, i) => `<td${stijl}${i > 0 ? ' class="num"' : ""}>${esc(c)}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  return `
  <h2>Waar komt de capaciteit vandaan?</h2>
  <p class="disclaimer">Waar het werk vandaan komt dat vrijkomt, per taakcategorie. Dit is dezelfde capaciteit als hierboven; daar staat waar die naartoe kan, hier waar die uit voortkomt.</p>
  <p>${esc(herkomstZin(herkomst))}</p>
  <table>
    <thead><tr>${HERKOMST_KOLOMMEN.map((k, i) => `<th${i > 0 ? ' class="num"' : ""}>${esc(k)}</th>`).join("")}</tr></thead>
    <tbody>${rijen}</tbody>
  </table>`;
}

// Hoe volledig en hoe stevig is deze analyse. Teksten komen uit rapportTeksten.js zodat
// PDF en Word dezelfde formulering gebruiken.
function dekkingBlock(results) {
  const z = dekkingZinnen(results);
  if (!z.heeftIets) return "";

  return `
  <h2>Dekking en betrouwbaarheid</h2>
  <p class="disclaimer">Elke rol wordt gekoppeld aan een beroep uit de ESCO-classificatie; uit dat beroep komt de competentielijst waaruit de analyse kiest. Hoe sterker die koppeling, hoe steviger de competentie-uitspraken over die rol.</p>
  ${z.dekking ? `<p>${esc(z.dekking)}</p>` : ""}
  ${z.mislukt ? `<p style="color:#b45309;">${esc(z.mislukt)}</p>` : ""}
  ${z.zwak ? `<p>${esc(z.zwak)}</p>` : ""}`;
}

// De ontwikkelbehoefte opgeteld over alle rollen. Zelfde berekening als in de app.
function ontwikkelagendaBlock(rollen) {
  const agenda = calculateCompetentieAgenda(rollen, "realistisch");
  if (agenda.competenties.length === 0) return "";

  const breed = agenda.competenties.filter((c) => c.aantalRollen > 1);
  const nietTrainbaar = agenda.competenties.filter((c) => c.trainbaarheid === "laag");

  const rijen = agenda.competenties
    .map((c) => {
      const klasse = TIER_KLASSE[c.trainbaarheid] ?? "c-slate";
      return `<tr>
        <td>${esc(c.naam)}</td>
        <td><i class="tier-stip ${klasse}"></i>${c.trainbaarheid ? `${esc(c.trainbaarheid)} trainbaar` : "onbekend"}</td>
        <td>${c.aantalRollen}</td><td>${nl(c.fte, 1)}</td><td>${nl(c.gemiddeldBelang, 1)}</td>
      </tr>`;
    })
    .join("");

  return `
  <h2>Ontwikkelagenda — organisatiebreed</h2>
  <p class="disclaimer">De competenties die ná de transformatie nieuw nodig zijn, opgeteld over alle rollen en gewogen naar de FTE die overblijft. Een competentie die in meerdere rollen terugkomt is één programma, geen reeks losse gesprekken.</p>
  <p><strong>${agenda.competenties.length}</strong> competenties zijn nieuw nodig, waarvan <strong>${breed.length}</strong> in meerdere rollen.${
    agenda.aandeelNietTrainbaar === null
      ? ""
      : ` <strong>${Math.round(agenda.aandeelNietTrainbaar * 100)}%</strong> van de totale ontwikkelbehoefte is niet met training op te lossen (${nietTrainbaar.length} van de ${agenda.competenties.length} competenties).`
  }</p>
  <table>
    <thead><tr><th>Competentie</th><th>Ontwikkelbaar</th><th>Rollen</th><th>FTE</th><th>Belang</th></tr></thead>
    <tbody>${rijen}</tbody>
  </table>
  ${
    nietTrainbaar.length > 0
      ? `<p class="disclaimer">${
          nietTrainbaar.length === 1 ? "Eén competentie" : `${nietTrainbaar.length} competenties`
        } in deze lijst ${nietTrainbaar.length === 1 ? "is" : "zijn"} laag trainbaar — disposities in plaats van vaardigheden. Die los je niet op met een opleidingsbudget; de vraag is of ze al in huis zijn. Toets daarop bij de huidige bezetting.</p>`
      : ""
  }`;
}

function bar(label, value, maxValue, colorClass) {
  const widthPct = Math.max((value / maxValue) * 100, 2);
  return `
    <div class="bar-row">
      <span class="bar-label">${esc(label)}</span>
      <div class="bar-track"><div class="bar-fill ${colorClass}" style="width:${widthPct}%"></div></div>
      <span class="bar-value">${nl(value, 2)}</span>
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

const BESTEMMING_HEX = { kostenreductie: "#94a3b8", capaciteitsgroei: "#6366f1", kwaliteitsverbetering: "#10b981", onbepaald: "#c7d2fe" };

/** Eén balk: het gekleurde deel komt vrij (per bestemming), de rest blijft. */
function stapelBalk(fteHuidig, vrijPerType) {
  const segmenten = balkSegmenten(fteHuidig, vrijPerType)
    .map((sg) => `<div style="width:${(sg.aandeel * 100).toFixed(2)}%;background:${BESTEMMING_HEX[sg.soort] ?? BESTEMMING_HEX.onbepaald};"></div>`)
    .join("");
  return `<div class="stapel">${segmenten}</div>`;
}

function bestemmingRegel(vrijPerType) {
  const namen = BESTEMMING_VOLGORDE.filter((t) => (vrijPerType?.[t] ?? 0) > 0).map((t) => {
    const w = getWaardetype(t);
    return `<span style="color:${BESTEMMING_HEX[t] === "#c7d2fe" ? "#64748b" : BESTEMMING_HEX[t]};">${w ? `${w.icon} ${esc(w.label)}` : "nog niet bepaald"}</span>`;
  });
  return namen.length ? `<p style="font-size:9px;margin:0 0 2px;">${namen.join(" &nbsp; ")}</p>` : "";
}

function legendaOrganogram() {
  const stip = (kleur, tekst) => `<span><span class="tier-stip" style="background:${kleur};"></span>${tekst}</span>`;
  return `<div class="tier-legenda" style="margin:0 0 8px;">
    ${stip("#e2e8f0", "blijft")}<span>komt vrij en kan naar:</span>
    ${["kostenreductie", "capaciteitsgroei", "kwaliteitsverbetering"].map((t) => stip(BESTEMMING_HEX[t], esc(getWaardetype(t).label.toLowerCase()))).join("")}
  </div>`;
}

/** Eén rol in de rapportagestructuur, met wie eronder hangt. */
function hierarchieKnoop(knoop, teksten, diepte = 0) {
  const inspringen = diepte * 14;
  return `<div style="margin-left:${inspringen}px;border-left:${
    diepte > 0 ? "1px solid #e2e8f0" : "none"
  };padding-left:${diepte > 0 ? 8 : 0}px;margin-top:6px;page-break-inside:avoid;">
    <p style="font-weight:bold;font-size:11px;margin:0 0 2px;">${esc(knoop.rolnaam)} — ${teksten.onderdeel(knoop)}</p>
    ${stapelBalk(knoop.fteHuidig, knoop.vrijPerType)}
    ${bestemmingRegel(knoop.vrijPerType)}
    ${knoop.kinderen.map((k) => hierarchieKnoop(k, teksten, diepte + 1)).join("")}
  </div>`;
}

/** Eén afdeling in het organogram, met de rollen eronder. */
function afdelingBlok(afdeling, teksten) {
  // Bij één rol zou de rolbalk die van de afdeling herhalen; dan alleen de naam.
  const rollen =
    afdeling.rollen.length === 1
      ? `<p style="font-size:10px;color:#64748b;margin:4px 0 0 14px;">${esc(afdeling.rollen[0].rolnaam)}</p>`
      : afdeling.rollen
          .map(
            (r) => `<div style="margin:6px 0 0 14px;">
        <p style="font-size:10px;margin:0 0 2px;">${esc(r.rolnaam)} — ${teksten.onderdeel(r)}</p>
        ${stapelBalk(r.fteHuidig, r.vrijPerType)}
        ${bestemmingRegel(r.vrijPerType)}
      </div>`
          )
          .join("");

  return `<div class="role-block">
    <p style="font-weight:bold;font-size:12px;margin-bottom:2px;">${esc(afdeling.afdeling)} — ${teksten.onderdeel(afdeling)}</p>
    ${stapelBalk(afdeling.fteHuidig, afdeling.vrijPerType)}
    ${bestemmingRegel(afdeling.vrijPerType)}
    ${rollen}
  </div>`;
}

function organogramBlok(orgChart) {
  const teksten = organogramTeksten(orgChart);
  const regels = aansturingRegels(orgChart.hierarchie);
  const o = orgChart.organisatie;
  return `<p class="disclaimer">${esc(teksten.uitleg)}</p>
  ${
    orgChart.hierarchie?.problemen?.length
      ? `<p class="disclaimer" style="color:#92400e;">Let op bij de rapportagelijnen: ${orgChart.hierarchie.problemen.map(esc).join(" ")}</p>`
      : ""
  }
  <p style="font-weight:bold;font-size:12px;margin:8px 0 2px;">${esc(teksten.totaal)}</p>
  ${stapelBalk(o.fteHuidig, o.vrijPerType)}
  ${bestemmingRegel(o.vrijPerType)}
  ${legendaOrganogram()}
  ${
    orgChart.hierarchie
      ? orgChart.hierarchie.top.map((k) => hierarchieKnoop(k, teksten)).join("")
      : orgChart.heeftAfdelingen
        ? orgChart.afdelingen.map((a) => afdelingBlok(a, teksten)).join("")
        : orgChart.rollen
            .map(
              (r) => `<div class="role-block">
      <p style="font-weight:bold;font-size:12px;margin-bottom:2px;">${esc(r.rolnaam)} — ${teksten.onderdeel(r)}</p>
      ${stapelBalk(r.fteHuidig, r.vrijPerType)}
      ${bestemmingRegel(r.vrijPerType)}
    </div>`
            )
            .join("")
  }
  ${
    regels.length
      ? `<div class="role-block" style="margin-top:10px;">
    <p style="font-weight:bold;font-size:11px;margin:0 0 4px;">Aansturing</p>
    ${regels.map((r) => `<p style="font-size:10px;margin:0 0 4px;">${esc(r.tekst)}</p>`).join("")}
  </div>`
      : ""
  }`;
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
  // Drie delen die samen 100% zijn, in plaats van "loopt op tot X%" — dat laatste las
  // als een toestand die bereikt wordt, terwijl het een bovengrens is.
  const d = driedeling(profiel);
  const basis = `De toekomstige competentiebehoefte van deze functie komt voor <strong>${profiel.overlapPct}%</strong> overeen met wat de rol nu al vraagt.`;
  const zin = !d
    ? basis
    : `${basis} Daarvan komt <strong>${d.teOntwikkelenPct}%</strong> erbij dat met gerichte ontwikkeling te overbruggen is` +
      (d.nietTrainbaarPct > 0
        ? `, en <strong>${d.nietTrainbaarPct}%</strong> dat zich niet laat trainen — daarop is toetsing van de huidige bezetting nodig.`
        : "; er blijft niets over dat zich niet laat trainen.");

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
 * Bouwt de HTML van het eindrapport. Los van het renderen, zodat de inhoud te toetsen is
 * zonder Chromium te starten — dat laatste is op Vercel en lokaal een kwetsbare stap.
 * @param {object} results - het resultaat-object zoals opgeslagen in results.json
 */
export function buildReportHtml(results) {
  const {
    bedrijfsnaam,
    scope,
    scopeLabel,
    gegenereerdOp,
    missingProfiles,
    organisatieTotaal,
    subtotalenPerAfdeling,
    rollen,
    aanbevelingen,
  } = results;
  const datum = new Date(gegenereerdOp).toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  const orgChart = buildOrgChartData(rollen);
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
  th.num, td.num { text-align: right; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; background: #e0e7ff; color: #4338ca; border-radius: 3px; padding: 1px 5px; font-size: 9px; }
  .role-block { page-break-inside: avoid; margin-bottom: 18px; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; }
  .bar-label { width: 80px; font-size: 9px; color: #64748b; flex-shrink: 0; }
  .bar-track { flex: 1; height: 14px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-value { width: 40px; text-align: right; font-size: 9px; font-weight: bold; flex-shrink: 0; }
  .stapel { display: flex; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; margin: 2px 0 3px; }
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
    <div class="stat-card"><div class="stat-label">Capaciteit die vrijkomt</div><div class="stat-value">${nl(organisatieTotaal.realistisch.totaalFteWeg, 1)} FTE</div></div>
  </div>
  ${capaciteitBlock(organisatieTotaal, rollen)}
  ${results.volwassenheidBeschikbaar ? `<p class="disclaimer">${esc(volwassenheidVerwijzingZin)}</p>` : ""}
  ${financieelBlock(organisatieTotaal)}
  <h2>Interne transformatie — overzicht per rol</h2>
  <table>
    <thead><tr><th>Rol</th><th>FTE</th><th>Uren/wk</th><th>Kosten/uur</th><th>Reductie (R–A)</th><th>Vrijkomend u/wk (R–A)</th><th>Als besparing ingeboekt (R–A)</th></tr></thead>
    <tbody>
      ${rollen
        .map(
          (r) => `<tr>
        <td>${esc(r.roleLabel ?? r.rolnaam)}</td><td>${r.fte}</td><td>${r.urenPerWeek}</td><td>${eur(r.kostenPerUur)}</td>
        <td>${pct(r.scenarios.realistisch.reductiePercentage)} – ${pct(r.scenarios.agressief.reductiePercentage)}</td>
        <td>${Math.round(r.scenarios.realistisch.automatiseerbareUrenPerWeek)} – ${Math.round(r.scenarios.agressief.automatiseerbareUrenPerWeek)}</td>
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
    // Een mislukte rol ontbreekt in alle totalen hierboven; dat hoort direct bij de tabel
    // te staan, niet alleen in de verantwoording aan het eind.
    dekkingZinnen(results).mislukt
      ? `<p style="color:#b45309;font-style:italic;">Let op: ${esc(dekkingZinnen(results).mislukt)}</p>`
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
          <td>${nl(s.scenarios.realistisch.totaalFteHuidig, 1)}</td>
          <td>${nl(s.scenarios.realistisch.totaalFteOver, 2)}</td>
          <td>${nl(s.scenarios.agressief.totaalFteOver, 2)}</td>
          <td>${eur(s.scenarios.realistisch.totaalKostenBesparingPerJaar)} – ${eur(s.scenarios.agressief.totaalKostenBesparingPerJaar)}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
      : ""
  }

  <h2>Organogram — waar de capaciteit vrijkomt</h2>
  ${organogramBlok(orgChart)}

  ${herkomstBlock(rollen)}
  ${ontwikkelagendaBlock(rollen)}

  <h2>Detail per rol — taakverdeling &amp; competenties</h2>
  ${rollen
    .map(
      (r) => `<div class="role-block">
      <h3>${esc(r.roleLabel ?? r.rolnaam)} (${r.fte} FTE → ${nl(r.scenarios.realistisch.fteOver, 2)} realistisch / ${nl(r.scenarios.agressief.fteOver, 2)} agressief)</h3>
      ${waardetypeLine(r)}
      ${beroepsmatchRegel(r.beroepsmatch) ? `<p class="disclaimer">${esc(beroepsmatchRegel(r.beroepsmatch))}</p>` : ""}
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

  <div class="closing">
    <h2 style="margin-top:0;">Vervolgstappen</h2>
    <p><strong>Dit rapport schetst een richting, geen exacte voorspelling. De cijfers, competentieverschuivingen en aanbevelingen zijn bedoeld als vertrekpunt voor een strategisch gesprek — niet als eindoordeel.</strong></p>
    <p>De uitkomsten geven aanleiding tot verder, verdiepend onderzoek: het toetsen van deze bevindingen aan de praktijk, verfijning op basis van interne kennis en operationele details, en vertaling naar een concreet implementatieplan. Dit rapport is het begin van dat gesprek, niet de afsluiting ervan.</p>
  </div>

  ${dekkingBlock(results)}

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

  return html;
}

/**
 * Genereert het gecombineerde eindrapport als PDF-buffer via Puppeteer.
 * @param {object} results - het resultaat-object zoals opgeslagen in results.json
 */
export async function generateReportPdf(results) {
  return renderHtmlToPdf(buildReportHtml(results));
}

/** Rendert een HTML-document naar PDF. Gedeeld door alle rapporten die een PDF leveren. */
export async function renderHtmlToPdf(html) {
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
