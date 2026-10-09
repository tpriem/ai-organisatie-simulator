import { TASK_CATEGORIES } from "./config.js";

/**
 * Het taakprofiel van de organisatie: welk aandeel van alle uren zit in welke
 * taakcategorie, nu en na de transformatie.
 *
 * Twee redenen om dit te tonen.
 *
 * De eerste is inhoudelijk: automatisering raakt categorieën ongelijk, dus het profiel
 * verschuift. Een organisatie waar administratie van 30% naar 9% gaat terwijl
 * strategisch werk van 8% naar 15% groeit, wordt een ander soort organisatie. Dat is
 * een scherpere uitspraak dan "er komt 6,6 FTE vrij", en het volgt uit dezelfde som.
 *
 * De tweede is methodisch: dit aandeel is het eerste getal dat tussen klanten
 * vergelijkbaar is. FTE en euro's hangen af van de omvang van de organisatie, het
 * taakprofiel niet. Daarmee is dit de bouwsteen voor een benchmark over klanten heen —
 * mits die ooit groot en representatief genoeg wordt om zo te noemen.
 *
 * @returns {{ categorieen, urenNu, urenStraks, heeftData }}
 */
export function calculateTaakprofiel(roleResults, scenario = "realistisch") {
  const perCategorie = new Map();

  for (const rol of roleResults ?? []) {
    for (const taak of rol.scenarios?.[scenario]?.taken ?? []) {
      const id = taak.categorie;
      if (!id) continue;

      if (!perCategorie.has(id)) {
        perCategorie.set(id, {
          id,
          label: taak.categorieLabel ?? TASK_CATEGORIES.find((c) => c.id === id)?.label ?? id,
          urenNu: 0,
          urenStraks: 0,
        });
      }

      const c = perCategorie.get(id);
      const uren = taak.urenPerWeek ?? 0;
      c.urenNu += uren;
      c.urenStraks += uren - (taak.urenAutomatiseerbaarPerWeek ?? 0);
    }
  }

  const urenNu = [...perCategorie.values()].reduce((s, c) => s + c.urenNu, 0);
  const urenStraks = [...perCategorie.values()].reduce((s, c) => s + c.urenStraks, 0);

  const categorieen = [...perCategorie.values()]
    .map((c) => {
      const aandeelNu = urenNu > 0 ? c.urenNu / urenNu : 0;
      const aandeelStraks = urenStraks > 0 ? c.urenStraks / urenStraks : 0;
      return {
        ...c,
        aandeelNu,
        aandeelStraks,
        // Verschuiving in relatief gewicht. Positief betekent: dit type werk wordt een
        // groter deel van wat de organisatie doet, ook als het in absolute uren krimpt.
        verschuiving: aandeelStraks - aandeelNu,
      };
    })
    .sort((a, b) => b.aandeelNu - a.aandeelNu);

  return { categorieen, urenNu, urenStraks, heeftData: urenNu > 0 };
}
