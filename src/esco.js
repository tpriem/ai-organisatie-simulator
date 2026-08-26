// Toegang tot de gebundelde ESCO-taxonomie (EU-classificatie voor beroepen en skills,
// CC BY 4.0). De data staat als statische JSON in src/data/ en wordt gegenereerd door
// scripts/buildEscoDataset.mjs — bewust gebundeld en niet runtime opgehaald, omdat de
// benodigde metadata per skill een aparte API-call vergt en dat niet binnen de
// 60s-limiet van de serverless analyse past.
//
// Puur rekenwerk op statische data: geen Node-only imports, dus ook client-side bruikbaar.

import occupations from "./data/esco-occupations.json" with { type: "json" };
import skills from "./data/esco-skills.json" with { type: "json" };
import occupationSkills from "./data/esco-occupation-skills.json" with { type: "json" };

export const ESCO_VERSIE = occupations.versie ?? "onbekend";

/** Skill-metadata op id: { label, type, reuse, cat }. */
export function getSkill(id) {
  return skills.items?.[id] ?? null;
}

/** Bouwt een label -> metadata map, zoals competencyProfile.js die verwacht. */
export function skillMetaByLabel(ids) {
  const map = {};
  for (const id of ids ?? []) {
    const s = getSkill(id);
    if (s) map[s.label] = { type: s.type, reuse: s.reuse, cat: s.cat };
  }
  return map;
}

function normaliseer(tekst) {
  return (tekst ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(tekst) {
  return normaliseer(tekst).split(" ").filter((t) => t.length > 2);
}

function trigrammen(tekst) {
  const s = ` ${normaliseer(tekst)} `;
  const set = new Set();
  for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
  return set;
}

function overlapScore(aSet, bSet) {
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let gedeeld = 0;
  for (const x of aSet) if (bSet.has(x)) gedeeld++;
  return gedeeld / Math.max(aSet.size, bSet.size);
}

/**
 * Scoort één rolnaam tegen één beroepslabel. Tokenoverlap weegt zwaarder dan
 * trigramgelijkenis: "klantenservice medewerker" moet "vertegenwoordiger
 * klantenservice" vinden, ook al staan de woorden in een andere volgorde.
 */
function scoreLabel(rolTokens, rolTrigrammen, label) {
  const labelTokens = new Set(tokens(label));
  const tokenScore = overlapScore(rolTokens, labelTokens);
  const trigramScore = overlapScore(rolTrigrammen, trigrammen(label));
  return tokenScore * 0.7 + trigramScore * 0.3;
}

/**
 * Zoekt de best passende ESCO-beroepen bij een rolnaam. Puur lokaal en zonder
 * AI-call — het resultaat is een shortlist die daarna aan Claude wordt voorgelegd,
 * niet een definitieve keuze.
 *
 * @returns {Array<{id, label, score}>} aflopend gesorteerd, maximaal `limiet`
 */
export function matchOccupations(rolnaam, limiet = 3) {
  const rolTokens = new Set(tokens(rolnaam));
  const rolTrigrammen = trigrammen(rolnaam);
  if (rolTokens.size === 0) return [];

  const scores = [];
  for (const occ of occupations.items ?? []) {
    let beste = scoreLabel(rolTokens, rolTrigrammen, occ.label);
    for (const alt of occ.altLabels ?? []) {
      const s = scoreLabel(rolTokens, rolTrigrammen, alt);
      if (s > beste) beste = s;
    }
    if (beste > 0) scores.push({ id: occ.id, label: occ.label, score: beste });
  }

  return scores.sort((a, b) => b.score - a.score).slice(0, limiet);
}

// De kandidatenlijst wordt als enum in het tool-schema gezet, en de API weigert een
// schema dat te complex wordt ("Schema is too complex for compilation"). Empirisch ligt
// de grens tussen 200 en 240 waarden; we houden ruime marge. Van de beschikbare ruimte
// gaat een vast deel naar de transversale competenties, want daar zitten de attitudes
// in en juist die bepalen of iets te trainen valt of getoetst moet worden.
// Empirisch getest met het daadwerkelijke schema: 160 gaat goed, 180 niet. 150 houdt
// marge voor toekomstige schemawijzigingen. De transversale pijler telt 95 concepten en
// past daarmee volledig binnen de resterende ruimte.
const MAX_KANDIDATEN = 150;
const RUIMTE_BEROEPSSKILLS = 55;

/**
 * Bouwt de kandidatenpool waaruit Claude mag kiezen: de skills van de gematchte
 * beroepen, aangevuld met de transversale competenties (die voor élke rol relevant
 * kunnen worden na automatisering, denk aan kritisch beoordelen van AI-output).
 *
 * Essentiële skills gaan voor optionele, en beroepen worden in volgorde van
 * matchkwaliteit verwerkt, zodat afkappen het minst relevante het eerst raakt.
 *
 * @returns {Array<{id, label, type}>} gededupliceerd, maximaal MAX_KANDIDATEN
 */
export function buildCandidateSkills(occupationIds) {
  const gekozen = new Map();

  const voegToe = (id, limiet) => {
    if (gekozen.size >= limiet || gekozen.has(id)) return;
    const s = getSkill(id);
    if (s) gekozen.set(id, { id, label: s.label, type: s.type });
  };

  const relaties = (occupationIds ?? []).map((id) => occupationSkills.items?.[id]).filter(Boolean);

  for (const rel of relaties) for (const id of rel.essential ?? []) voegToe(id, RUIMTE_BEROEPSSKILLS);
  for (const rel of relaties) for (const id of rel.optional ?? []) voegToe(id, RUIMTE_BEROEPSSKILLS);

  for (const id of skills.transversaal ?? []) voegToe(id, MAX_KANDIDATEN);

  // Resterende ruimte alsnog vullen met optionele beroepsskills.
  for (const rel of relaties) for (const id of rel.optional ?? []) voegToe(id, MAX_KANDIDATEN);

  return [...gekozen.values()];
}

/** Zoekt de skill-id bij een label — nodig om Claude's labelkeuze terug te vertalen. */
export function skillIdByLabel(label, kandidaten) {
  const gezocht = normaliseer(label);
  for (const k of kandidaten ?? []) {
    if (normaliseer(k.label) === gezocht) return k.id;
  }
  return null;
}
