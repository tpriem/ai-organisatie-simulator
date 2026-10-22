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

/**
 * Uit welk soort werk de vrijkomende capaciteit komt: per taakcategorie hoeveel uren per week er
 * vrijkomen. Dit is de herkomst van dezelfde capaciteit die het bestemmingsblok verdeelt; waar dat
 * blok laat zien waar de tijd heen kan, laat dit zien waar die vandaan komt.
 *
 * Absolute uren in plaats van aandelen: een aandeel verschuift ook in categorieën die niet
 * krimpen, en dat is moeilijk te lezen. Uren zijn wat je bij de functies ook ziet.
 *
 * @returns {{ categorieen, urenNu, urenVrij, heeftData }} categorieën gesorteerd op vrijkomende uren
 */
export function calculateCapaciteitHerkomst(roleResults, scenario = "realistisch") {
  const p = calculateTaakprofiel(roleResults, scenario);
  const urenVrij = p.categorieen.reduce((s, c) => s + (c.urenNu - c.urenStraks), 0);

  const categorieen = p.categorieen
    .map((c) => {
      const vrij = c.urenNu - c.urenStraks;
      return {
        id: c.id,
        label: c.label,
        urenNu: c.urenNu,
        urenVrij: vrij,
        pctVanCategorie: c.urenNu > 0 ? vrij / c.urenNu : 0,
        aandeelVanVrij: urenVrij > 0 ? vrij / urenVrij : 0,
      };
    })
    .sort((a, b) => b.urenVrij - a.urenVrij);

  return { categorieen, urenNu: p.urenNu, urenVrij, heeftData: p.urenNu > 0 && urenVrij > 0 };
}

/**
 * De rijen van de herkomsttabel: de categorieën met de meeste vrijkomende uren, de rest samengevat
 * in één rij, en een totaalrij. Eén plek zodat scherm, PDF en Word dezelfde tabel tonen.
 */
export function herkomstRijen(herkomst, aantal = 5) {
  const { categorieen } = herkomst;
  const kop = categorieen.slice(0, aantal);
  // Eén categorie over is geen samenvatting waard; die staat gewoon in de tabel.
  const rest = categorieen.length > aantal + 1 ? categorieen.slice(aantal) : [];
  const zichtbaar = rest.length ? kop : categorieen;

  const rijen = zichtbaar.map((c) => ({ ...c, soort: "categorie" }));
  if (rest.length) {
    const urenNu = rest.reduce((s, c) => s + c.urenNu, 0);
    const urenVrij = rest.reduce((s, c) => s + c.urenVrij, 0);
    rijen.push({
      soort: "overig",
      id: "overig",
      label: `Overige categorieën (${rest.length})`,
      urenNu,
      urenVrij,
      pctVanCategorie: urenNu > 0 ? urenVrij / urenNu : 0,
      aandeelVanVrij: herkomst.urenVrij > 0 ? urenVrij / herkomst.urenVrij : 0,
    });
  }
  rijen.push({
    soort: "totaal",
    id: "totaal",
    label: "Totaal",
    urenNu: herkomst.urenNu,
    urenVrij: herkomst.urenVrij,
    pctVanCategorie: herkomst.urenNu > 0 ? herkomst.urenVrij / herkomst.urenNu : 0,
    aandeelVanVrij: 1,
  });
  return rijen;
}

export const HERKOMST_KOLOMMEN = ["Taakcategorie", "Uren per week nu", "Komt vrij", "% van categorie vrij", "Aandeel in totaal vrij"];

/** De zin boven de tabel: de drie grootste bronnen van de vrijkomende uren. */
export function herkomstZin(herkomst) {
  const top = herkomst.categorieen.filter((c) => c.urenVrij > 0).slice(0, 3);
  if (top.length === 0) return "";
  const delen = top.map((c) => `${Math.round(c.aandeelVanVrij * 100)}% uit ${c.label.toLowerCase()}`);
  const opsomming = delen.length > 1 ? `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}` : delen[0];
  return `Van de ${Math.round(herkomst.urenVrij)} uur per week die vrijkomt (realistisch scenario), komt ${opsomming}.`;
}

/** De cellen van één rij, als tekst. Zelfde opmaak op scherm, in de PDF en in Word. */
export function herkomstCellen(rij) {
  return [
    rij.label,
    `${Math.round(rij.urenNu)} u`,
    `${Math.round(rij.urenVrij)} u`,
    `${Math.round(rij.pctVanCategorie * 100)}%`,
    `${Math.round(rij.aandeelVanVrij * 100)}%`,
  ];
}
