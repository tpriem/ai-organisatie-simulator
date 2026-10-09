/**
 * Dekking en bewijskracht van een analyse.
 *
 * Een scan die alleen uitkomsten toont verbergt hoe stevig die uitkomsten zijn. Elke
 * rol wordt gekoppeld aan een ESCO-beroep, en uit dát beroep komt de competentiepool
 * waaruit de analyse kiest. Zit die koppeling ernaast, dan is de competentie-analyse
 * van die rol onbetrouwbaar — zonder dat er iets misgaat of een foutmelding verschijnt.
 *
 * Eerder zijn hier drie fouten in gevonden (HR-adviseur, ICT-beheerder, afdeling in de
 * zoekterm). Die waren alleen te vinden door in de data te kijken. Door de matchscore te
 * tonen ziet een adviseur zo'n misser zelf, in plaats van dat het rapport stil iets
 * verkeerds beweert.
 */

// Drempels voor de matchkwaliteit. Bewust conservatief: liever een twijfelgeval te veel
// gemarkeerd dan een verkeerde competentiepool die ongemerkt doorwerkt.
const STERK = 0.8;
const MATIG = 0.5;

export function matchKwaliteit(score) {
  if (typeof score !== "number") return null;
  if (score >= STERK) return "sterk";
  if (score >= MATIG) return "matig";
  return "zwak";
}

/**
 * @param {object} results volledige analyseresultaten
 * @returns {{ rollen, matches, zwakkeMatches, ontbrekendeProfielen, mislukteRollen,
 *             takenTotaal, ongematchteTaken, taakdekking, heeftMatchdata }}
 */
export function calculateScanDekking(results) {
  const rollen = results?.rollen ?? [];

  const matches = rollen.map((r) => {
    const b = r.beroepsmatch ?? null;
    return {
      roleId: r.roleId ?? r.rolnaam,
      rolnaam: r.rolnaam,
      roleLabel: r.roleLabel ?? r.rolnaam,
      beroep: b?.label ?? null,
      score: typeof b?.score === "number" ? b.score : null,
      kwaliteit: matchKwaliteit(b?.score),
      ongematchteTaken: r.ongematchteTaken ?? 0,
      takenTotaal: (r.scenarios?.realistisch?.taken ?? []).length,
    };
  });

  const takenTotaal = matches.reduce((s, m) => s + m.takenTotaal, 0);
  const ongematchteTaken = matches.reduce((s, m) => s + m.ongematchteTaken, 0);

  return {
    rollen: rollen.length,
    matches,
    // Alles onder "sterk" verdient een blik van de adviseur voordat het rapport de deur uit gaat.
    zwakkeMatches: matches.filter((m) => m.kwaliteit === "matig" || m.kwaliteit === "zwak"),
    ontbrekendeProfielen: results?.missingProfiles ?? [],
    mislukteRollen: results?.mislukteRollen ?? [],
    takenTotaal,
    ongematchteTaken,
    // Aandeel taken waarvoor wél een passende competentie gevonden is.
    taakdekking: takenTotaal > 0 ? (takenTotaal - ongematchteTaken) / takenTotaal : null,
    heeftMatchdata: matches.some((m) => m.score !== null),
  };
}
