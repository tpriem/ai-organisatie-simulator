import { getSector } from "./sectors.js";

/**
 * Weging van de eindscore. De briefing (4.2-4.4) specificeert dat de sectorscore
 * het zwaarst weegt en dat de 10 vragen samen 30% wegen (20% impact + 10%
 * readiness), maar geeft geen exact gewicht voor de sectorscore zelf.
 * Aanname hier: sector 70%, impact 20%, readiness 10%.
 */
const WEIGHTS = { sector: 0.7, impact: 0.2, readiness: 0.1 };

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Berekent de Deel 2 sector-analyse: eindscore, positionering en risico/kans-profiel.
 * @param {string} sectorId
 * @param {Record<string, number>} impactAnswers - vraag-id -> score 1-5
 * @param {Record<string, number>} readinessAnswers - vraag-id -> score 1-5
 */
export function calculateSectorAnalyse(sectorId, impactAnswers, readinessAnswers) {
  const sector = getSector(sectorId);
  if (!sector) return null;

  const impactScore = average(Object.values(impactAnswers));
  const readinessScore = average(Object.values(readinessAnswers));

  const heeftAlleAntwoorden = impactScore !== null && readinessScore !== null;

  const eindscore = heeftAlleAntwoorden
    ? WEIGHTS.sector * sector.risico + WEIGHTS.impact * impactScore + WEIGHTS.readiness * (6 - readinessScore)
    : sector.risico;

  const verschilTovSector = eindscore - sector.risico;
  let positionering;
  if (!heeftAlleAntwoorden) {
    positionering = "Nog niet te bepalen — vul eerst de 10 positioneringsvragen in.";
  } else if (verschilTovSector > 0.3) {
    positionering = "Slechter dan sectorgemiddelde (hogere blootstelling / lagere gereedheid dan typisch in deze sector)";
  } else if (verschilTovSector < -0.3) {
    positionering = "Beter dan sectorgemiddelde (lagere blootstelling / hogere gereedheid dan typisch in deze sector)";
  } else {
    positionering = "Ongeveer gelijk aan sectorgemiddelde";
  }

  let urgentie;
  if (eindscore >= 4) urgentie = "Hoog — transformatie is dringend aan te raden";
  else if (eindscore >= 2.5) urgentie = "Gemiddeld — transformatie is raadzaam op middellange termijn";
  else urgentie = "Laag — geen directe urgentie, wel kansen te verkennen";

  return {
    sector,
    impactScore,
    readinessScore,
    eindscore,
    positionering,
    urgentie,
    weging: WEIGHTS,
  };
}
