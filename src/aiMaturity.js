import model from "./data/aiMaturityModel.json" with { type: "json" };

/**
 * Beoordeling volgens "The AI Adoption Maturity Model v1.0" (CMU SEI en Accenture).
 *
 * De structuur en teksten (dimensies, capability areas, goals, practices, maturity
 * indicators, niveaus) komen letterlijk uit het model en staan in src/data/aiMaturityModel.json,
 * gegenereerd door scripts/extractAiMaturityModel.mjs. Copyright 2026 Carnegie Mellon
 * University; de vermelding staat in het modelbestand en moet bij elk gebruik zichtbaar zijn.
 *
 * Scoring: de standaardmethode uit hoofdstuk 5 van het model.
 *  - Een practice is voldaan, deels, niet voldaan of niet van toepassing.
 *  - Een goal is behaald als alle toepasselijke practices voldaan zijn.
 *  - Een capability area is behaald als al zijn goals behaald zijn.
 *  - Elke capability area krijgt per maturity indicator (Accountability, Planning, Resourcing)
 *    een niveau 1-5. Het niveau van de capability area is het laagste daarvan, ook als alle
 *    goals en practices zijn voldaan ("a capability area is rated to its lowest ranking
 *    maturity indicator").
 *  - Een dimensie wordt beoordeeld naar zijn laagst scorende capability area. Volgens
 *    Table 2 van het model is dat per niveau L: alle capability areas die op niveau L of
 *    lager zijn gepositioneerd moeten behaald zijn en alle indicatoren minstens L halen.
 *
 * Wat het model zelf niet vastlegt, en hier een keuze is:
 *  - Een niet beantwoorde practice telt als niet voldaan, een niet beantwoorde indicator als
 *    niveau 1. Dat is streng, zoals de bedoeling van het model, en de uitkomst meldt dat er
 *    nog antwoorden ontbreken.
 *  - Het model kent geen niveau 0. Een dimensie die het eerste niveau niet haalt krijgt hier
 *    niveau 0 ("nog niet Exploratory AI").
 *  - Het model kent geen totaalscore; die wordt hier ook niet berekend.
 */

export const MODEL = model;
export const MODEL_VERSIE = model.versie;
export const NIVEAUS = model.niveaus;
export const INDICATOREN = model.maturityIndicators;
export const DIMENSIES = model.dimensies;

export const ANTWOORDEN = [
  { waarde: "niet", label: "Niet" },
  { waarde: "deels", label: "Deels" },
  { waarde: "ja", label: "Voldaan" },
  { waarde: "nvt", label: "N.v.t." },
];
const GELDIGE_ANTWOORDEN = new Set(ANTWOORDEN.map((a) => a.waarde));
const VOLDAAN = new Set(["ja", "nvt"]);

export const INDICATOR_IDS = INDICATOREN.map((i) => i.id);

/** Naam van een niveau, bijvoorbeeld 3 -> "Aligned AI". Niveau 0 bestaat niet in het model. */
export function niveauNaam(n) {
  if (n === 0) return "Below Exploratory AI";
  return NIVEAUS.find((x) => x.niveau === n)?.naam ?? null;
}

export const practiceSleutel = (goalNummer, practiceNummer) => `${goalNummer}.${practiceNummer}`;

const ZONDER_INVOER = { practices: {}, indicatoren: {}, notities: {}, scope: "" };

/**
 * Beoordeelt één capability area.
 * @param {object} ca capability area uit het model
 * @param {object} invoer
 */
export function beoordeelCapabilityArea(ca, invoer = ZONDER_INVOER) {
  const antwoorden = invoer.practices?.[ca.id] ?? {};
  const gekozen = invoer.indicatoren?.[ca.id] ?? {};

  const goals = ca.goals.map((g) => {
    const practices = g.practices.map((p) => ({
      nummer: p.nummer,
      tekst: p.tekst,
      antwoord: antwoorden[practiceSleutel(g.nummer, p.nummer)] ?? null,
    }));
    const open = practices.filter((p) => !VOLDAAN.has(p.antwoord));
    return {
      nummer: g.nummer,
      tekst: g.tekst,
      practices,
      behaald: open.length === 0,
      open: open.length,
      onbeantwoord: practices.filter((p) => p.antwoord === null).length,
    };
  });

  const alle = goals.flatMap((g) => g.practices);
  const telling = {
    totaal: alle.length,
    beantwoord: alle.filter((p) => p.antwoord !== null).length,
    voldaan: alle.filter((p) => p.antwoord === "ja").length,
    nvt: alle.filter((p) => p.antwoord === "nvt").length,
    deels: alle.filter((p) => p.antwoord === "deels").length,
    niet: alle.filter((p) => p.antwoord === "niet").length,
  };

  const doelenBehaald = goals.every((g) => g.behaald);

  const indicatoren = {};
  for (const id of INDICATOR_IDS) {
    const w = gekozen[id];
    indicatoren[id] = Number.isInteger(w) && w >= 1 && w <= 5 ? w : null;
  }
  const indicatorOnbeantwoord = INDICATOR_IDS.filter((id) => indicatoren[id] === null);
  // Niet beantwoord telt als niveau 1: de strenge lezing van het model.
  const indicatorMin = Math.min(...INDICATOR_IDS.map((id) => indicatoren[id] ?? 1));

  const gemeten = telling.beantwoord > 0 || indicatorOnbeantwoord.length < INDICATOR_IDS.length;

  // Niveau van de capability area zelf: de laagste indicator, en niet hoger dan één onder
  // de positionering zolang de goals niet behaald zijn.
  const niveau = doelenBehaald ? indicatorMin : Math.min(ca.positioneringsNiveau - 1, indicatorMin);

  return {
    id: ca.id,
    naam: ca.naam,
    beschrijving: ca.beschrijving,
    positioneringsNiveau: ca.positioneringsNiveau,
    goals,
    telling,
    doelenBehaald,
    indicatoren,
    indicatorMin,
    indicatorOnbeantwoord,
    gemeten,
    onvolledig: telling.beantwoord < telling.totaal || indicatorOnbeantwoord.length > 0,
    niveau,
    notitie: String(invoer.notities?.[ca.id] ?? ""),
  };
}

/** Wat een capability area nog tegenhoudt om aan niveau `l` te voldoen. */
function belemmering(ca, l) {
  if (!ca.doelenBehaald) {
    const openGoals = ca.goals.filter((g) => !g.behaald);
    return {
      soort: "goals",
      capabilityArea: ca.naam,
      capabilityAreaId: ca.id,
      openGoals: openGoals.map((g) => g.nummer),
      openPractices: openGoals.reduce((s, g) => s + g.open, 0),
    };
  }
  const laag = INDICATOR_IDS.filter((id) => (ca.indicatoren[id] ?? 1) < l);
  return {
    soort: "indicator",
    capabilityArea: ca.naam,
    capabilityAreaId: ca.id,
    indicatoren: laag,
  };
}

/**
 * Beoordeelt één dimensie.
 * Niveau L is gehaald als alle capability areas die op niveau L of lager zijn gepositioneerd
 * behaald zijn en al hun indicatoren minstens L zijn (Table 2 van het model).
 */
export function beoordeelDimensie(dim, invoer = ZONDER_INVOER) {
  const cas = dim.capabilityAreas.map((ca) => beoordeelCapabilityArea(ca, invoer));
  const gemeten = cas.some((c) => c.gemeten);

  const voldoetAan = (l) => cas.filter((c) => c.positioneringsNiveau <= l).every((c) => c.doelenBehaald && c.indicatorMin >= l);

  let niveau = 0;
  while (niveau < 5 && voldoetAan(niveau + 1)) niveau += 1;

  const volgend = niveau < 5 ? niveau + 1 : null;
  const beperkend =
    volgend === null
      ? []
      : cas
          .filter((c) => c.positioneringsNiveau <= volgend && !(c.doelenBehaald && c.indicatorMin >= volgend))
          .map((c) => belemmering(c, volgend));

  return {
    id: dim.id,
    naam: dim.naam,
    beschrijving: dim.beschrijving,
    gemeten,
    niveau: gemeten ? niveau : null,
    niveauNaam: gemeten ? niveauNaam(niveau) : null,
    volgendNiveau: gemeten ? volgend : null,
    beperkend: gemeten ? beperkend : [],
    capabilityAreas: cas,
    onvolledig: cas.some((c) => c.onvolledig),
    telling: cas.reduce(
      (t, c) => ({ totaal: t.totaal + c.telling.totaal, beantwoord: t.beantwoord + c.telling.beantwoord }),
      { totaal: 0, beantwoord: 0 }
    ),
  };
}

/** Het volledige profiel: een niveau per dimensie. Het model kent geen totaalscore. */
export function berekenProfiel(invoer = ZONDER_INVOER) {
  const dimensies = DIMENSIES.map((d) => beoordeelDimensie(d, invoer));
  const gemeten = dimensies.filter((d) => d.gemeten);
  const telling = dimensies.reduce(
    (t, d) => ({ totaal: t.totaal + d.telling.totaal, beantwoord: t.beantwoord + d.telling.beantwoord }),
    { totaal: 0, beantwoord: 0 }
  );
  return {
    modelVersie: MODEL_VERSIE,
    scope: String(invoer.scope ?? ""),
    dimensies,
    gemeten: gemeten.length,
    telling,
    laagste: gemeten.length ? gemeten.reduce((m, d) => (d.niveau < m.niveau ? d : m)) : null,
    hoogste: gemeten.length ? gemeten.reduce((m, d) => (d.niveau > m.niveau ? d : m)) : null,
  };
}

/** Verschil per dimensie tussen twee metingen van dezelfde modelversie. */
export function vergelijkMetingen(eerder, nu) {
  if (!eerder || !nu) return null;
  if (eerder.modelVersie !== nu.modelVersie) return null;
  const verschillen = nu.dimensies
    .map((d) => {
      const voor = eerder.dimensies.find((x) => x.id === d.id);
      if (!voor || voor.niveau === null || d.niveau === null) return null;
      return { id: d.id, naam: d.naam, voor: voor.niveau, nu: d.niveau, verschil: d.niveau - voor.niveau };
    })
    .filter(Boolean);
  return {
    verschillen,
    gestegen: verschillen.filter((v) => v.verschil > 0).length,
    gedaald: verschillen.filter((v) => v.verschil < 0).length,
    gelijk: verschillen.filter((v) => v.verschil === 0).length,
  };
}

/**
 * Maakt van ongecontroleerde invoer een schone meting: alleen bekende capability areas en
 * practices, geldige antwoorden, indicatorniveaus 1-5 en begrensde tekst.
 */
export function schoonInvoer(invoer) {
  const practices = {};
  const indicatoren = {};
  const notities = {};
  for (const d of DIMENSIES) {
    for (const ca of d.capabilityAreas) {
      const geldigeSleutels = new Set(ca.goals.flatMap((g) => g.practices.map((p) => practiceSleutel(g.nummer, p.nummer))));
      const ruw = invoer?.practices?.[ca.id];
      if (ruw && typeof ruw === "object") {
        const schoon = {};
        for (const [sleutel, waarde] of Object.entries(ruw)) {
          if (geldigeSleutels.has(sleutel) && GELDIGE_ANTWOORDEN.has(waarde)) schoon[sleutel] = waarde;
        }
        if (Object.keys(schoon).length) practices[ca.id] = schoon;
      }
      const ind = invoer?.indicatoren?.[ca.id];
      if (ind && typeof ind === "object") {
        const schoon = {};
        for (const id of INDICATOR_IDS) if (Number.isInteger(ind[id]) && ind[id] >= 1 && ind[id] <= 5) schoon[id] = ind[id];
        if (Object.keys(schoon).length) indicatoren[ca.id] = schoon;
      }
      const notitie = invoer?.notities?.[ca.id];
      if (typeof notitie === "string" && notitie.trim()) notities[ca.id] = notitie.trim().slice(0, 1000);
    }
  }
  const scope = typeof invoer?.scope === "string" ? invoer.scope.trim().slice(0, 200) : "";
  return { scope, practices, indicatoren, notities };
}

/** Een vastgelegde meting: alleen de invoer, het profiel wordt bij het lezen opnieuw berekend. */
export function maakSnapshot(invoer, { op = new Date() } = {}) {
  return { op: op.toISOString(), modelVersie: MODEL_VERSIE, ...schoonInvoer(invoer) };
}
