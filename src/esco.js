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

// Tweeletterwoorden meenemen: afkortingen als "hr", "ie" en "ko" zijn juist
// onderscheidend. Ze eruit filteren maakte "HR-adviseur" en "IE-adviseur" identiek.
function tokens(tekst) {
  return normaliseer(tekst).split(" ").filter((t) => t.length >= 2);
}

// Veelgebruikte Nederlandse afkortingen die anders nooit matchen op hun voluitgeschreven
// tegenhanger in ESCO. Bewust kort gehouden en toegespitst op het werkveld van deze tool.
const SYNONIEMEN = {
  hr: ["human", "resources", "personeel", "personeelszaken"],
  ict: ["informatietechnologie", "informatica"],
  it: ["informatietechnologie", "informatica"],
  ceo: ["directeur", "bestuurder"],
  cfo: ["financieel", "directeur"],
  hrm: ["human", "resources", "personeel"],
  pz: ["personeelszaken", "personeel"],
  kcc: ["klantenservice", "klantcontact"],

  // Engelse functiewoorden. Rosters van Nederlandse organisaties staan er vol mee,
  // terwijl de ESCO-labels Nederlands zijn. "Software developer" kwam daardoor uit op
  // "embedded systems software developer" — de enige met een Engels alt-label.
  developer: ["ontwikkelaar", "softwareontwikkelaar"],
  analyst: ["analist"],
  designer: ["ontwerper"],
  engineer: ["ingenieur"],
  assistant: ["assistent"],
  advisor: ["adviseur"],
  adviser: ["adviseur"],
  director: ["directeur"],
  head: ["hoofd"],
  officer: ["functionaris"],

  // Domeinsynoniemen die in de praktijk inwisselbaar zijn maar in de taxonomie niet.
  klantenservice: ["contactcenter", "callcenter", "klantcontact"],
  contactcenter: ["klantenservice", "callcenter"],
  callcenter: ["klantenservice", "contactcenter"],
  finance: ["financieel", "financiele", "boekhouding"],
  sales: ["verkoop"],
  marketing: ["marketing"],
};

// Woorden die aangeven dat een rol leidinggevend is. Dat verandert de rol fundamenteel:
// een manager klantenservice heeft een andere competentiepool dan een medewerker
// klantenservice. Zonder deze regel woog "manager" net zo zwaar als elk ander woord en
// kwam een leidinggevende uit op een uitvoerende rol.
//
// Alleen losse woorden tellen, geen samenstellingen: "accountmanager" is één token en
// is géén leidinggevende rol, terwijl "manager klantenservice" er twee heeft.
const LEIDINGGEVEND = new Set([
  "manager",
  "hoofd",
  "teamleider",
  "teamlead",
  "leidinggevende",
  "directeur",
  "chef",
  "supervisor",
  "bedrijfsleider",
  "afdelingshoofd",
]);

function isLeidinggevend(tokenSet) {
  for (const t of tokenSet) if (LEIDINGGEVEND.has(t)) return true;
  return false;
}

/**
 * Bepaalt of een rol-token door een label gedekt wordt, eventueel via een synoniem.
 * Synoniemen tellen bewust alleen mee als alternatieve manier om te matchen; ze worden
 * niet aan de tokenset toegevoegd, want dan zouden ze de noemer opblazen en juist élke
 * score omlaag drukken.
 */
/**
 * Hoe goed dekt één woord uit de rolnaam dit label?
 *
 * Geeft naast de dekking terug wélk labelwoord daarvoor gebruikt is. Dat is nodig omdat
 * een labelwoord dat al via een synoniem is afgedekt niet nóg eens in de noemer mag
 * belanden: "data analyst" tegen "data-analist" hoorde een volle match te zijn, maar
 * "analist" werd als onbeantwoord woord meegeteld en drukte de score onder die van een
 * beroep met een letterlijk Engels alt-label.
 *
 * @returns {{ dekking: number, gebruikt: string|null }}
 */
function tokenGedekt(token, labelTokens) {
  if (labelTokens.has(token)) return { dekking: 1, gebruikt: token };

  for (const syn of SYNONIEMEN[token] ?? []) {
    if (labelTokens.has(syn)) return { dekking: 1, gebruikt: syn };
  }

  // Nederlandse samenstellingen: "beheerder" zit in "systeembeheerder", "advies" in
  // "adviesbureau". Losse woordvergelijking mist dat volledig. Deelcredit, want het is
  // zwakker bewijs dan een echte woordmatch.
  if (token.length >= 5) {
    for (const lt of labelTokens) {
      if (lt.length >= 5 && (lt.includes(token) || token.includes(lt))) return { dekking: 0.6, gebruikt: lt };
    }
  }
  return { dekking: 0, gebruikt: null };
}

// Inverse document frequency over alle beroepslabels: generieke woorden als "medewerker"
// of "adviseur" komen in honderden labels voor en zeggen dus weinig, terwijl "hypotheek"
// of "magazijn" een rol echt identificeert. Zonder deze weging won een match op louter
// "adviseur" het van een inhoudelijk veel betere kandidaat.
let idfCache = null;
function getIdf() {
  if (idfCache) return idfCache;
  const documentFrequentie = new Map();
  const items = occupations.items ?? [];
  for (const occ of items) {
    const gezien = new Set(tokens(`${occ.label} ${(occ.altLabels ?? []).join(" ")}`));
    for (const t of gezien) documentFrequentie.set(t, (documentFrequentie.get(t) ?? 0) + 1);
  }
  const totaal = Math.max(1, items.length);
  idfCache = new Map();
  for (const [t, df] of documentFrequentie) idfCache.set(t, Math.log(totaal / df));
  return idfCache;
}

function gewichtVan(token) {
  // Onbekende tokens (bijv. uit een functieprofiel) zijn per definitie zeldzaam in de
  // beroepenlijst en krijgen daarom een hoog, maar begrensd gewicht.
  return getIdf().get(token) ?? Math.log((occupations.items?.length ?? 1) / 1);
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
 * Scoort één rolnaam tegen één beroepslabel, met IDF-gewogen tokenoverlap. Zeldzame,
 * inhoudelijke woorden bepalen de score; generieke functiewoorden nauwelijks.
 * Trigrammen vangen Nederlandse samenstellingen op ("hypotheekadviseur" tegenover
 * "hypotheekmakelaar"), waar losse woorden geen overlap geven.
 */
function scoreLabel(rolTokens, rolTrigrammen, label) {
  const labelTokens = new Set(tokens(label));
  if (labelTokens.size === 0) return 0;

  let gedeeld = 0;
  let unie = 0;
  const gebruikteLabelwoorden = new Set();
  for (const t of rolTokens) {
    const g = gewichtVan(t);
    unie += g;
    const { dekking, gebruikt } = tokenGedekt(t, labelTokens);
    gedeeld += g * dekking;
    if (gebruikt) gebruikteLabelwoorden.add(gebruikt);
  }
  // Woorden die alleen in het label staan tellen mee in de noemer, zodat een kort,
  // generiek label niet automatisch wint van een specifieker beroep. Woorden die al
  // een rolwoord hebben beantwoord — ook via een synoniem — tellen niet nog eens mee.
  for (const t of labelTokens) {
    if (!rolTokens.has(t) && !gebruikteLabelwoorden.has(t)) unie += gewichtVan(t);
  }
  const tokenScore = unie > 0 ? gedeeld / unie : 0;
  const trigramScore = overlapScore(rolTrigrammen, trigrammen(label));
  let score = tokenScore * 0.75 + trigramScore * 0.25;

  // Leidinggevend of niet is geen detail maar een ander beroep. Komen rol en label
  // daarin niet overeen, dan is de match verdacht — ook als de woorden verder kloppen.
  const rolLeidt = isLeidinggevend(rolTokens);
  const labelLeidt = isLeidinggevend(labelTokens);
  if (rolLeidt !== labelLeidt) score *= rolLeidt ? 0.5 : 0.8;

  return score;
}

/**
 * Zoekt de best passende ESCO-beroepen bij een rol. Puur lokaal en zonder AI-call —
 * het resultaat is een shortlist die daarna aan Claude wordt voorgelegd, niet een
 * definitieve keuze.
 *
 * Bewust alleen op de functietitel. Het functieprofiel meewegen is geprobeerd — zowel
 * tegen de beroepstitels als tegen de skills van de bovenste kandidaten — maar maakte
 * de uitkomst aantoonbaar slechter: bij een vage titel staan de juiste beroepen sowieso
 * niet in de shortlist, en bij een goede titel verstoorde het een correcte match.
 * Komt een rol er alsnog naast te zitten, dan is dat zichtbaar via het aantal taken
 * zonder passende competentie (`ongematchteTaken`) in plaats van stilzwijgend fout.
 *
 * @param {string} rolnaam
 * @param {number} limiet
 * @returns {Array<{id, label, score}>} aflopend gesorteerd, maximaal `limiet`
 */
export function matchOccupations(rolnaam, limiet = 3) {
  const rolTokens = new Set(tokens(rolnaam));
  const rolTrigrammen = trigrammen(rolnaam);
  if (rolTokens.size === 0) return [];

  const scores = [];
  for (const occ of occupations.items ?? []) {
    // Een match op het hoofdlabel telt iets zwaarder dan op een alternatief label.
    // Generieke alt-labels komen bij veel beroepen voor: "projectmanager" staat bij vijf
    // beroepen, waaronder "manager productontwikkeling kleding". Zonder dit onderscheid
    // wint zo'n specifiek beroep de gelijkspel willekeurig van het beroep dat gewoon
    // "projectmanager" heet.
    let beste = scoreLabel(rolTokens, rolTrigrammen, occ.label);
    for (const alt of occ.altLabels ?? []) {
      const s = scoreLabel(rolTokens, rolTrigrammen, alt) * 0.93;
      if (s > beste) beste = s;
    }
    if (beste > 0) scores.push({ id: occ.id, label: occ.label, score: beste });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, limiet);
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

/**
 * Bouwt één gedeelde kandidatenpool voor álle rollen van een klant samen.
 *
 * Waarom dit nodig is. Tot nu toe kreeg elke rol een eigen pool uit zijn eigen
 * gematchte beroepen. Het gevolg: rollen beschrijven hetzelfde vermogen met
 * verschillende ESCO-termen, puur omdat de ene term wel en de andere niet in hun pool
 * zat. Gemeten op Voorbeeld BV: een klantenservicemedewerker kreeg "communiceren met
 * klanten", een accountmanager kreeg "relaties met klanten onderhouden" — en geen van
 * beide had de term van de ander beschikbaar. Daardoor leek de overlap tussen die
 * rollen nul, terwijl het grotendeels hetzelfde werk raakt.
 *
 * Met één pool kiezen alle rollen uit dezelfde woordenschat. Dat maakt profielen
 * onderling vergelijkbaar, wat een voorwaarde is voor elke uitspraak over interne
 * doorstroom.
 *
 * Verdeling van de beperkte ruimte: skills die bij meerdere rollen horen gaan voor,
 * want juist dat zijn de begrippen waarop rollen elkaar kunnen raken. Daarna krijgt
 * elke rol gegarandeerd een eigen minimum, zodat een specialistische rol niet
 * wegvalt tegen de meerderheid.
 *
 * @param {Array<string[]>} occupationIdsPerRol per rol de gematchte beroeps-id's
 * @returns {Array<{id, label, type}>} gededupliceerd, maximaal MAX_KANDIDATEN
 */
export function buildSharedCandidateSkills(occupationIdsPerRol, { minPerRol = 6 } = {}) {
  const rollen = (occupationIdsPerRol ?? []).filter((ids) => (ids ?? []).length > 0);
  if (rollen.length === 0) return [];
  if (rollen.length === 1) return buildCandidateSkills(rollen[0]);

  // Per rol de skills verzamelen, essentieel apart van optioneel.
  const perRol = rollen.map((ids) => {
    const essentieel = new Set();
    const optioneel = new Set();
    for (const id of ids) {
      const rel = occupationSkills.items?.[id];
      if (!rel) continue;
      for (const s of rel.essential ?? []) essentieel.add(s);
      for (const s of rel.optional ?? []) optioneel.add(s);
    }
    return { essentieel, optioneel };
  });

  // Bij hoeveel rollen komt een skill voor? Dat bepaalt de voorrang.
  const rolTelling = new Map();
  for (const { essentieel, optioneel } of perRol) {
    for (const id of new Set([...essentieel, ...optioneel])) {
      rolTelling.set(id, (rolTelling.get(id) ?? 0) + 1);
    }
  }

  const gekozen = new Map();
  const voegToe = (id) => {
    if (gekozen.size >= RUIMTE_BEROEPSSKILLS || gekozen.has(id)) return false;
    const s = getSkill(id);
    if (!s) return false;
    gekozen.set(id, { id, label: s.label, type: s.type });
    return true;
  };

  // 1. Elke rol eerst zijn gegarandeerde minimum, uit de eigen essentiële skills.
  //    Dit staat vooraan zodat een specialistische rol altijd vertegenwoordigd is,
  //    ook als de rest van de ruimte opgaat aan gedeelde begrippen.
  for (const { essentieel } of perRol) {
    let gezet = 0;
    const gesorteerd = [...essentieel].sort((a, b) => (rolTelling.get(b) ?? 0) - (rolTelling.get(a) ?? 0));
    for (const id of gesorteerd) {
      if (gezet >= minPerRol) break;
      if (voegToe(id)) gezet++;
    }
  }

  // 2. Resterende ruimte naar de skills die bij de meeste rollen horen. Dit zijn de
  //    begrippen waarop rollen elkaar kunnen raken, en dus waar doorstroom zichtbaar
  //    wordt. Essentieel gaat voor optioneel bij gelijke spreiding.
  const essentieelErgens = new Set(perRol.flatMap(({ essentieel }) => [...essentieel]));
  const rest = [...rolTelling.entries()]
    .filter(([id]) => !gekozen.has(id))
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        Number(essentieelErgens.has(b[0])) - Number(essentieelErgens.has(a[0])) ||
        String(a[0]).localeCompare(String(b[0]))
    );
  for (const [id] of rest) voegToe(id);

  // 3. De transversale pijler hoort er altijd bij: die competenties worden juist ná
  //    automatisering relevant, ongeacht de rol.
  for (const id of skills.transversaal ?? []) {
    if (gekozen.size >= MAX_KANDIDATEN || gekozen.has(id)) continue;
    const s = getSkill(id);
    if (s) gekozen.set(id, { id, label: s.label, type: s.type });
  }

  return [...gekozen.values()];
}
