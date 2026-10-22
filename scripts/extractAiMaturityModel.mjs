// Leest de tekst van "The AI Adoption Maturity Model v1.0" (SEI/CMU en Accenture) uit en
// schrijft de structuur naar src/data/aiMaturityModel.json.
//
// Gebruik:
//   pdftotext The_AI_Adoption_Maturity_Model.pdf raw.txt      (zonder -layout)
//   node scripts/extractAiMaturityModel.mjs raw.txt
//
// De inhoud komt letterlijk uit de bron, niet uit overtypen. Daarom controleert dit script
// ook zelf of de aantallen kloppen en stopt het als dat niet zo is.
//
// Let op de rechten: de tekst is auteursrechtelijk beschermd (Copyright 2026 Carnegie Mellon
// University). Intern gebruik, ook van afgeleide werken, is toegestaan mits de
// copyrightvermelding en de "No Warranty"-tekst erbij blijven. Extern verspreiden van
// meer dan het hele, ongewijzigde document vraagt toestemming van het SEI.

import { readFileSync, writeFileSync } from "node:fs";

const invoer = process.argv[2];
if (!invoer) {
  console.error("Gebruik: node scripts/extractAiMaturityModel.mjs <raw.txt>");
  process.exit(1);
}

const regels = readFileSync(invoer, "utf8").split(/\r?\n/);

const NIVEAU_NAAM = { 1: "Exploratory AI", 2: "Implemented AI", 3: "Aligned AI", 4: "Scaled AI", 5: "Future Ready AI" };
const DIMENSIE_NAMEN = [
  "Organizational Strategy",
  "Workforce and Culture",
  "Workflow Re-Engineering",
  "Risk and Governance",
  "Data",
  "Engineering",
  "Operations",
  "Technology Ecosystem",
];

// Table 2 uit het model ("Minimal Capability Area Expectations to Advance in Maturity", blz. 85):
// op welk niveau elke capability area is gepositioneerd. Dit is de gezaghebbende bron. De zin
// "All the goals and applicable practices of ... " bij elke capability area bevat in het
// document enkele kopieerfouten (bij Policy and Compliance, Responsible AI en Measurement and
// Analysis staat de naam van een andere capability area). Het script meldt waar die zin en
// Table 2 afwijken.
const TABEL2 = {
  experimentation: 1,
  ai_literate_workforce_development: 1,
  data_lifecycle_management: 2,
  data_quality_assurance: 2,
  ai_architecting: 2,
  test_and_evaluation: 2,
  ai_model_management: 2,
  ai_model_and_agent_security: 2,
  ai_strategy_development: 2,
  risk_management: 2,
  policy_and_compliance: 2,
  responsible_ai: 2,
  technology_infrastructure: 2,
  legacy_integration: 3,
  transparency_and_explainability: 3,
  monitoring: 3,
  ai_partnership_development: 3,
  organizational_structure_calibration: 3,
  supply_chain_management: 3,
  business_workflow_innovation: 3,
  measurement_and_analysis: 3,
  human_in_the_lead_automation: 3,
  organizational_culture_evolution: 3,
  deployment_at_scale: 4,
  future_ready_planning: 5,
};

const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

// Regels die uit de pagina-opmaak komen en geen inhoud zijn.
function isRuis(r) {
  const t = r.trim();
  if (!t) return false; // lege regels zijn een scheiding, geen ruis
  if (/^The AI Adoption Maturity Model \|/.test(t)) return true;
  if (/^\d{1,3}\s*$/.test(t)) return true;
  if (DIMENSIE_NAMEN.includes(t)) return true;
  if (/^(Organizational Strategy|Workforce and Culture|Workflow Re-Engineering|Risk and Governance|Technology Ecosystem)\s+\d+$/.test(t)) return true;
  return false;
}

// Begin van de inhoud: het eerste echte dimensiekopje (niet de inhoudsopgave).
const start = regels.findIndex((r) => /^4\.4 Organizational Strategy Dimension\s*$/.test(r.trim()));
if (start < 0) throw new Error("Begin van sectie 4.4 niet gevonden");
const eind = regels.findIndex((r, i) => i > start && /^4\.12 /.test(r.trim()));
const tekst = regels.slice(start, eind > 0 ? eind : undefined);

const dimensies = [];
let dim = null;
let ca = null;
let goal = null;
let practice = null;
let modus = null; // "dimbeschrijving" | "cabeschrijving" | "goal" | "practice" | "artifacts" | "niveau"
let buffer = [];

const schoon = (arr) => arr.join(" ").replace(/\s+/g, " ").trim();

function sluit() {
  const t = schoon(buffer);
  if (modus === "dimbeschrijving" && dim) dim.beschrijving = t;
  else if (modus === "cabeschrijving" && ca) ca.beschrijving = t;
  else if (modus === "goal" && goal) goal.tekst = t;
  else if (modus === "practice" && practice) practice.tekst = t;
  else if (modus === "artifacts" && ca) {
    ca.artifacts = t
      .split("ï¿½|�|�")
      .join("�")
      .split("�")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }
  buffer = [];
}

for (let i = 0; i < tekst.length; i++) {
  const t = tekst[i].trim();

  const dimKop = t.match(/^4\.(\d+) (.+) Dimension$/);
  if (dimKop && !/Capability Areas Supporting/.test(t) && DIMENSIE_NAMEN.includes(dimKop[2])) {
    sluit();
    dim = { id: slug(dimKop[2]), naam: dimKop[2], beschrijving: "", capabilityAreas: [] };
    dimensies.push(dim);
    ca = goal = practice = null;
    modus = "dimbeschrijving";
    continue;
  }

  const caKop = t.match(/^4\.\d+\.\d+ (.+) Capability Area$/);
  if (caKop) {
    sluit();
    ca = { id: slug(caKop[1]), naam: caKop[1], beschrijving: "", positioneringsNiveau: null, goals: [], artifacts: [] };
    dim.capabilityAreas.push(ca);
    goal = practice = null;
    modus = "cabeschrijving";
    continue;
  }

  // Sectie "Capability Areas Supporting ..." sluit de dimensie af.
  if (/^4\.\d+\.\d+ Capability Areas Supporting/.test(t)) {
    sluit();
    modus = null;
    ca = goal = practice = null;
    continue;
  }

  if (isRuis(t)) continue;

  if (/^Goals and Practices$/.test(t)) {
    sluit();
    modus = null;
    continue;
  }

  const goalKop = t.match(/^Goal (\d+)\s*(.*)$/);
  if (goalKop && ca) {
    sluit();
    goal = { nummer: Number(goalKop[1]), tekst: "", practices: [] };
    ca.goals.push(goal);
    practice = null;
    modus = "goal";
    if (goalKop[2]) buffer.push(goalKop[2]);
    continue;
  }

  const practiceKop = t.match(/^Practice (\d+)\s*(.*)$/);
  if (practiceKop && goal) {
    sluit();
    practice = { nummer: Number(practiceKop[1]), tekst: "" };
    goal.practices.push(practice);
    modus = "practice";
    if (practiceKop[2]) buffer.push(practiceKop[2]);
    continue;
  }

  const niveauZin = t.match(/^All the goals and applicable practices of (?:the )?(.+?) capability area need to be accomplished for this dimension to be at (.+?) Level Maturity \(Level (\d)\)/);
  if (niveauZin && ca) {
    sluit();
    // Alleen de eerste zin per capability area telt; latere zinnen zijn de afwijkende kopieën.
    if (ca.zinNiveau === undefined) ca.zinNiveau = Number(niveauZin[3]);
    modus = null;
    continue;
  }

  if (/^Example Artifacts$/.test(t) && ca) {
    sluit();
    modus = "artifacts";
    continue;
  }

  if (!t) {
    // Een lege regel beëindigt een alinea binnen een goal of practice niet per se: de
    // tekst loopt soms door over een paginagrens. Beëindiging gebeurt bij het volgende kopje.
    continue;
  }

  if (modus) buffer.push(t);
}
sluit();

// ---- Controle van de uitkomst ----
const fouten = [];
if (dimensies.length !== 8) fouten.push(`verwacht 8 dimensies, gevonden ${dimensies.length}`);
for (const d of dimensies) {
  if (!d.beschrijving) fouten.push(`${d.naam}: beschrijving ontbreekt`);
  if (d.capabilityAreas.length === 0) fouten.push(`${d.naam}: geen capability areas`);
  for (const c of d.capabilityAreas) {
    if (!c.beschrijving) fouten.push(`${c.naam}: beschrijving ontbreekt`);
    c.positioneringsNiveau = TABEL2[c.id] ?? null;
    if (!c.positioneringsNiveau) fouten.push(`${c.naam}: niet in Table 2`);
    if (c.zinNiveau !== undefined && c.zinNiveau !== c.positioneringsNiveau)
      console.warn(`LET OP ${c.naam}: de zin in het document noemt niveau ${c.zinNiveau}, Table 2 niveau ${c.positioneringsNiveau} (Table 2 gebruikt)`);
    delete c.zinNiveau;
    if (c.goals.length === 0) fouten.push(`${c.naam}: geen goals`);
    c.goals.forEach((g, gi) => {
      if (g.nummer !== gi + 1) fouten.push(`${c.naam}: goal-nummering loopt niet door bij goal ${g.nummer}`);
      if (!g.tekst) fouten.push(`${c.naam} goal ${g.nummer}: tekst ontbreekt`);
      if (g.practices.length === 0) fouten.push(`${c.naam} goal ${g.nummer}: geen practices`);
      g.practices.forEach((p, pi) => {
        if (p.nummer !== pi + 1) fouten.push(`${c.naam} goal ${g.nummer}: practice-nummering loopt niet door bij ${p.nummer}`);
        if (!p.tekst) fouten.push(`${c.naam} goal ${g.nummer} practice ${p.nummer}: tekst ontbreekt`);
      });
    });
  }
}

const aantalCa = dimensies.reduce((s, d) => s + d.capabilityAreas.length, 0);
const aantalGoals = dimensies.reduce((s, d) => s + d.capabilityAreas.reduce((t, c) => t + c.goals.length, 0), 0);
const aantalPractices = dimensies.reduce(
  (s, d) => s + d.capabilityAreas.reduce((t, c) => t + c.goals.reduce((u, g) => u + g.practices.length, 0), 0),
  0
);
console.log(`dimensies ${dimensies.length}, capability areas ${aantalCa}, goals ${aantalGoals}, practices ${aantalPractices}`);
for (const d of dimensies) {
  console.log(`\n${d.naam}`);
  for (const c of d.capabilityAreas) {
    console.log(
      `  L${c.positioneringsNiveau} ${c.naam}: ${c.goals.length} goals, ${c.goals.reduce((s, g) => s + g.practices.length, 0)} practices, ${c.artifacts.length} artifacts`
    );
  }
}
if (fouten.length) {
  console.error("\nFOUTEN:\n" + fouten.map((f) => " - " + f).join("\n"));
  process.exit(2);
}

// ---- Niveaus en maturity indicators (sectie 4.13) ----
const tekstGeheel = regels.join("\n");
function haalNiveaus() {
  const kop = tekstGeheel.indexOf("The following describes maturity levels, as defined in in Section 3");
  const blok = tekstGeheel.slice(kop, kop + 6000);
  const uit = [];
  for (let n = 1; n <= 5; n++) {
    const m = blok.match(new RegExp(`\\n${n}\\. ${NIVEAU_NAAM[n]}: ([\\s\\S]*?)(?=\\n${n + 1}\\. |\\nThe AI Adoption|\\n\\n)`));
    if (!m) throw new Error(`Niveau ${n} niet gevonden`);
    uit.push({ niveau: n, naam: NIVEAU_NAAM[n], beschrijving: m[1].replace(/\s+/g, " ").trim() });
  }
  return uit;
}

function haalIndicatoren() {
  const kop = tekstGeheel.indexOf("The following three maturity indicators are included");
  const eindeIndicatoren = tekstGeheel.indexOf("Higher maturity (e.g., Scaled AI)", kop);
  const blok = tekstGeheel.slice(kop, eindeIndicatoren);
  const beschr = {};
  for (const [i, naam] of ["Accountability", "Planning", "Resourcing"].entries()) {
    const m = blok.match(new RegExp(`${i + 1}\\. The ${naam} maturity indicator ([\\s\\S]*?)(?=\\n\\d\\. The |\\nThe following statements)`));
    beschr[naam] = m ? `The ${naam} maturity indicator ${m[1].replace(/\s+/g, " ").trim()}` : "";
  }
  const uit = [];
  for (const naam of ["Accountability", "Planning", "Resourcing"]) {
    // Kopjes hebben in de bron soms een spatie aan het eind.
    // (Een paginascheiding, \f, kan voor het kopje staan.)
    const positie = (x) => blok.match(new RegExp(`\\n\\f?${x}[ \\t]*\\n`))?.index ?? -1;
    const start2 = positie(naam);
    const volgende = ["Accountability", "Planning", "Resourcing"].map(positie).filter((p) => p > start2).sort((a, b) => a - b)[0];
    const deel = blok.slice(start2, volgende ?? blok.length);
    const niveaus = {};
    // Per niveau: alles tussen "Level N" en het volgende "Level". De naam van het niveau staat
    // in de bron soms midden in de zin (kolomopmaak) en wordt daaruit gehaald.
    const delen = deel.split(/Level ?(\d)/);
    for (let k = 1; k < delen.length; k += 2) {
      const n = Number(delen[k]);
      niveaus[n] = delen[k + 1]
        .replace(/The AI Adoption Maturity Model \|[^\n]*/g, "")
        .replace(/^\s*\d{2,3}\s*$/gm, "")
        .replace(new RegExp(NIVEAU_NAAM[n].replace(/ /g, "\\s*"), "g"), "")
        .replace(/\s+/g, " ")
        .trim();
    }
    uit.push({ id: slug(naam), naam, beschrijving: beschr[naam], niveaus });
  }
  return uit;
}

const niveaus = haalNiveaus();
const indicatoren = haalIndicatoren();
for (const ind of indicatoren) {
  for (let n = 1; n <= 5; n++) if (!ind.niveaus[n]) throw new Error(`Indicator ${ind.naam} niveau ${n} niet gevonden`);
}

const copyrightStart = regels.findIndex((r) => r.includes("Copyright 2026 Carnegie Mellon University."));
const copyrightTekst = regels
  .slice(copyrightStart, copyrightStart + 6)
  .map((r) => r.replace(//g, "")).filter((r) => r.trim() && !/^About Us/.test(r))
  .join("\n")
  .replace(/�/g, "®");

const uit = {
  naam: "The AI Adoption Maturity Model",
  versie: "1.0",
  uitgever: "Carnegie Mellon University Software Engineering Institute, in partnership with Accenture",
  bron: "https://www.sei.cmu.edu/library/ai-adoption-maturity-model/",
  copyright: copyrightTekst,
  niveaus,
  maturityIndicators: indicatoren,
  dimensies,
};

writeFileSync(new URL("../src/data/aiMaturityModel.json", import.meta.url), JSON.stringify(uit, null, 1));
console.log("\nGeschreven: src/data/aiMaturityModel.json");
