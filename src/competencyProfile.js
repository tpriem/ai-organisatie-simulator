// Competentieprofiel nu vs. straks, en wat dat betekent voor de bezetting.
//
// Puur rekenwerk, geen Claude-call en geen Node-only imports — zo kan dit zowel
// server-side (bij het genereren van de resultaten) als client-side (live herberekenen
// in TaakTable als de gebruiker aandelen aanpast) draaien, net als competencyTop5.js.
//
// Waarom niet alleen top5Nu/top5Na (competencyTop5.js): daar is het toekomstprofiel
// een herweging van hetzelfde competentieset, waardoor er nooit een níeuwe competentie
// kan verschijnen en een overlapmaat per definitie 100% zou zijn. Daarom voegt de
// AI-stap `nieuweCompetenties` toe: wat de rol ná transformatie extra nodig heeft.

import { getTrainability, isTrainbaar } from "./trainability.js";

function normaliseer(gewichten, totaal) {
  const out = new Map();
  if (totaal <= 0) return out;
  for (const [naam, gewicht] of gewichten) out.set(naam, gewicht / totaal);
  return out;
}

function toLijst(verdeling, tierVan) {
  const max = Math.max(0, ...verdeling.values());
  return [...verdeling.entries()]
    .filter(([, aandeel]) => aandeel > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([naam, aandeel]) => ({
      naam,
      aandeel,
      pct: Math.round(aandeel * 100),
      relatiefPct: max > 0 ? Math.round((aandeel / max) * 100) : 0,
      trainbaarheid: tierVan(naam),
    }));
}

/**
 * @param {Array} takenRealistisch - taken met `aandeel` en `automatiseringspercentage`
 * @param {Array} taakCompetenties - [{ taakIndex, competenties: string[] }]
 * @param {Array} nieuweCompetenties - [{ naam, belang }] — wat de rol ná transformatie
 *   nieuw nodig heeft; `belang` is een relatieve weging (1-5)
 * @param {Map|Object} skillMeta - competentienaam -> ESCO-metadata voor trainbaarheid
 * @returns {Object|null} null als er te weinig gegevens zijn om iets zinnigs te zeggen
 */
export function calculateCompetentieProfiel(takenRealistisch, taakCompetenties, nieuweCompetenties, skillMeta) {
  const lookup = skillMeta instanceof Map ? skillMeta : new Map(Object.entries(skillMeta ?? {}));
  const tierVan = (naam) => getTrainability(lookup.get(naam));

  const gewichtNu = new Map();
  const gewichtOver = new Map();
  let massaNu = 0;
  let massaOver = 0;

  for (const tag of taakCompetenties ?? []) {
    const taak = takenRealistisch?.[tag.taakIndex];
    if (!taak) continue;
    const overgebleven = taak.aandeel * (1 - taak.automatiseringspercentage);
    for (const competentie of tag.competenties ?? []) {
      gewichtNu.set(competentie, (gewichtNu.get(competentie) ?? 0) + taak.aandeel);
      gewichtOver.set(competentie, (gewichtOver.get(competentie) ?? 0) + overgebleven);
      massaNu += taak.aandeel;
      massaOver += overgebleven;
    }
  }

  if (massaNu <= 0) return null;

  // De vrijgekomen capaciteit is precies de ruimte die naar nieuw werk gaat; die
  // verdelen we over de nieuwe competenties naar belang. Daardoor houden het huidige
  // en het toekomstige profiel dezelfde totale massa en zijn ze eerlijk vergelijkbaar.
  const vrijgekomenMassa = Math.max(0, massaNu - massaOver);
  const nieuwe = (nieuweCompetenties ?? []).filter((n) => n?.naam && (n.belang ?? 0) > 0);
  const belangTotaal = nieuwe.reduce((som, n) => som + n.belang, 0);

  const gewichtStraks = new Map(gewichtOver);
  if (belangTotaal > 0 && vrijgekomenMassa > 0) {
    for (const n of nieuwe) {
      const deel = (n.belang / belangTotaal) * vrijgekomenMassa;
      gewichtStraks.set(n.naam, (gewichtStraks.get(n.naam) ?? 0) + deel);
    }
  }

  const massaStraks = [...gewichtStraks.values()].reduce((som, g) => som + g, 0);
  const profielNu = normaliseer(gewichtNu, massaNu);
  const profielStraks = normaliseer(gewichtStraks, massaStraks);

  // Overlap = histogram-intersectie: hoeveel van de toekomstige competentiebehoefte al
  // gedekt wordt door het huidige profiel. Een standaardmaat, netjes begrensd op 0-100%.
  let overlap = 0;
  const tekorten = [];
  for (const [naam, straksAandeel] of profielStraks) {
    const nuAandeel = profielNu.get(naam) ?? 0;
    overlap += Math.min(nuAandeel, straksAandeel);
    const tekort = straksAandeel - nuAandeel;
    if (tekort > 0) tekorten.push({ naam, tekort, trainbaarheid: tierVan(naam) });
  }

  // Zonder trainbaarheidsdata (analyses van vóór de ESCO-koppeling) kunnen we geen
  // uitspraak doen over wat te ontwikkelen valt — dan liever geen cijfer dan een
  // cijfer dat te veel belooft.
  const heeftTiers = tekorten.length === 0 || tekorten.some((t) => t.trainbaarheid !== null);

  tekorten.sort((a, b) => b.tekort - a.tekort);
  const teOntwikkelen = tekorten.filter((t) => isTrainbaar(t.trainbaarheid));
  const teToetsen = tekorten.filter((t) => t.trainbaarheid === "laag");
  const trainbaarTekort = teOntwikkelen.reduce((som, t) => som + t.tekort, 0);

  const alsItem = (t) => ({
    naam: t.naam,
    pct: Math.round(t.tekort * 100),
    trainbaarheid: t.trainbaarheid,
  });

  return {
    profielNu: toLijst(profielNu, tierVan),
    profielStraks: toLijst(profielStraks, tierVan),
    overlapPct: Math.round(overlap * 100),
    overlapNaTrainingPct: heeftTiers ? Math.round((overlap + trainbaarTekort) * 100) : null,
    teOntwikkelen: teOntwikkelen.map(alsItem),
    teToetsen: teToetsen.map(alsItem),
    heeftTrainbaarheidsdata: heeftTiers,
  };
}
