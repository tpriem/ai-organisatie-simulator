import { getCategory, SCENARIOS } from "./config.js";

/**
 * Berekent per rol de automatiseerbare uren, overgebleven uren en scenario's,
 * voor elk scenario (realistisch, agressief).
 *
 * Let op: het brondocument (3.4) formuleert "FTE die theoretisch weg kan" als
 * overgebleven uren ÷ uren per FTE. Dat is achterstevoren: overgebleven uren zijn
 * de uren die nog nodig zijn, dus die bepalen juist hoeveel FTE OVERBLIJFT.
 * Het aantal FTE dat weg kan volgt logisch uit de automatiseerbare uren.
 * Hier gebruiken we daarom: FTE_weg = automatiseerbare_uren ÷ uren_per_fte,
 * en FTE_over = totaal_fte - FTE_weg (equivalent aan overgebleven_uren ÷ uren_per_fte).
 */
export function calculateRole({ rolnaam, fte, urenPerWeek, kostenPerUur, taken }) {
  const totaalUrenPerWeek = fte * urenPerWeek;
  const urenPerFte = urenPerWeek;

  const scenarios = {};
  for (const scenario of SCENARIOS) {
    let automatiseerbareUren = 0;
    const takenDetail = taken.map((taak) => {
      const categorie = getCategory(taak.categorie);
      const pct = categorie[scenario];
      const urenVoorTaak = totaalUrenPerWeek * taak.aandeel;
      const urenAutomatiseerbaar = urenVoorTaak * pct;
      automatiseerbareUren += urenAutomatiseerbaar;
      return {
        omschrijving: taak.omschrijving,
        categorie: categorie.id,
        categorieLabel: categorie.label,
        aandeel: taak.aandeel,
        automatiseringspercentage: pct,
        urenPerWeek: urenVoorTaak,
        urenAutomatiseerbaarPerWeek: urenAutomatiseerbaar,
      };
    });

    const overgeblevenUren = totaalUrenPerWeek - automatiseerbareUren;
    const fteWeg = automatiseerbareUren / urenPerFte;
    const fteOver = fte - fteWeg;
    const kostenBesparingPerWeek = automatiseerbareUren * kostenPerUur;

    scenarios[scenario] = {
      automatiseerbareUrenPerWeek: automatiseerbareUren,
      overgeblevenUrenPerWeek: overgeblevenUren,
      fteWeg,
      fteOver: Math.max(fteOver, 0),
      reductiePercentage: totaalUrenPerWeek > 0 ? automatiseerbareUren / totaalUrenPerWeek : 0,
      kostenBesparingPerWeek,
      kostenBesparingPerJaar: kostenBesparingPerWeek * 52,
      outputgroeiPercentage: fteOver > 0 ? automatiseerbareUren / overgeblevenUren : null,
      taken: takenDetail,
    };
  }

  return {
    rolnaam,
    fte,
    urenPerWeek,
    kostenPerUur,
    totaalUrenPerWeek,
    scenarios,
  };
}

export function calculateOrganisatie(roleResults) {
  const totals = {};
  for (const scenario of SCENARIOS) {
    const totaalFteHuidig = roleResults.reduce((s, r) => s + r.fte, 0);
    const totaalFteWeg = roleResults.reduce((s, r) => s + r.scenarios[scenario].fteWeg, 0);
    const totaalFteOver = roleResults.reduce((s, r) => s + r.scenarios[scenario].fteOver, 0);
    const totaalKostenBesparingPerJaar = roleResults.reduce(
      (s, r) => s + r.scenarios[scenario].kostenBesparingPerJaar,
      0
    );
    const totaalUrenPerWeek = roleResults.reduce((s, r) => s + r.totaalUrenPerWeek, 0);
    const totaalAutomatiseerbaarPerWeek = roleResults.reduce(
      (s, r) => s + r.scenarios[scenario].automatiseerbareUrenPerWeek,
      0
    );

    totals[scenario] = {
      totaalFteHuidig,
      totaalFteWeg,
      totaalFteOver,
      reductiePercentageOrganisatie: totaalUrenPerWeek > 0 ? totaalAutomatiseerbaarPerWeek / totaalUrenPerWeek : 0,
      totaalKostenBesparingPerJaar,
    };
  }
  return totals;
}
