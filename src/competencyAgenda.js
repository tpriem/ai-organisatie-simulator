import { getTrainability, isTrainbaar } from "./trainability.js";

/**
 * Telt de nieuw benodigde competenties op over alle rollen heen.
 *
 * Per rol staat al welke competenties ná de transformatie nieuw nodig zijn, maar die
 * lijsten blijven los van elkaar staan. Daardoor mist het beeld dat er eigenlijk toe
 * doet: een competentie die álle rollen nodig hebben is één organisatiebreed programma,
 * geen zes aparte ontwikkelgesprekken. Bij de eerste doorrekening bleek één competentie
 * in zes van de zes rollen terug te komen.
 *
 * Weging gebeurt op de FTE die ná de transformatie overblijft, niet op de huidige FTE:
 * de vraag is hoeveel mensen deze competentie straks nodig hebben, niet hoeveel er nu
 * in die rol zitten.
 *
 * @param {object[]} roleResults rollen uit de analyse
 * @param {string} scenario "realistisch" of "agressief"
 * @returns {{ competenties: object[], fteTotaalNa: number, aandeelNietTrainbaar: number|null, heeftTrainbaarheidsdata: boolean }}
 */
export function calculateCompetentieAgenda(roleResults, scenario = "realistisch") {
  const perCompetentie = new Map();
  let fteTotaalNa = 0;

  for (const rol of roleResults ?? []) {
    const fteNa = rol.scenarios?.[scenario]?.fteOver ?? 0;
    fteTotaalNa += fteNa;

    for (const nieuw of rol.nieuweCompetenties ?? []) {
      const naam = nieuw.naam;
      if (!naam) continue;

      if (!perCompetentie.has(naam)) {
        perCompetentie.set(naam, {
          naam,
          rollen: [],
          fte: 0,
          belangSom: 0,
          trainbaarheid: getTrainability(rol.competentieMeta?.[naam]) ?? null,
        });
      }

      const c = perCompetentie.get(naam);
      c.rollen.push(rol.roleLabel ?? rol.rolnaam);
      c.fte += fteNa;
      c.belangSom += nieuw.belang ?? 0;
      // Metadata kan per rol ontbreken; de eerste rol die het wél weet bepaalt de tier.
      c.trainbaarheid ??= getTrainability(rol.competentieMeta?.[naam]) ?? null;
    }
  }

  const competenties = [...perCompetentie.values()]
    .map((c) => ({
      naam: c.naam,
      aantalRollen: c.rollen.length,
      rollen: c.rollen,
      fte: c.fte,
      gemiddeldBelang: c.rollen.length > 0 ? c.belangSom / c.rollen.length : 0,
      trainbaarheid: c.trainbaarheid,
      trainbaar: isTrainbaar(c.trainbaarheid),
    }))
    // Breedte eerst: iets dat de halve organisatie raakt is een ander gesprek dan
    // iets dat één rol raakt, ook als dat ene geval urgenter voelt.
    .sort((a, b) => b.fte - a.fte || b.aantalRollen - a.aantalRollen || a.naam.localeCompare(b.naam));

  const metTier = competenties.filter((c) => c.trainbaarheid !== null);
  const fteSom = competenties.reduce((s, c) => s + c.fte, 0);
  const fteNietTrainbaar = competenties.filter((c) => c.trainbaarheid === "laag").reduce((s, c) => s + c.fte, 0);

  return {
    competenties,
    fteTotaalNa,
    // Welk deel van de totale ontwikkelbehoefte niet met training op te lossen is.
    // Zonder trainbaarheidsgegevens liever niets beweren dan een te rooskleurig cijfer.
    aandeelNietTrainbaar: metTier.length > 0 && fteSom > 0 ? fteNietTrainbaar / fteSom : null,
    heeftTrainbaarheidsdata: metTier.length > 0,
  };
}
