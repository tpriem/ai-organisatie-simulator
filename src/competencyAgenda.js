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
    // iets dat één rol raakt, ook als dat ene geval urgenter voelt. Breedte is het aantal functies;
    // de FTE die erachter hangt beslist pas daarna.
    .sort((a, b) => b.aantalRollen - a.aantalRollen || b.fte - a.fte || a.naam.localeCompare(b.naam));

  const metTier = competenties.filter((c) => c.trainbaarheid !== null);
  const fteSom = competenties.reduce((s, c) => s + c.fte, 0);
  const fteNietTrainbaar = competenties.filter((c) => c.trainbaarheid === "laag").reduce((s, c) => s + c.fte, 0);

  return {
    competenties,
    // Het aantal functies in de analyse, voor "nodig in 6 van 6 functies".
    aantalRollenTotaal: (roleResults ?? []).length,
    fteTotaalNa,
    // Welk deel van de totale ontwikkelbehoefte niet met training op te lossen is.
    // Zonder trainbaarheidsgegevens liever niets beweren dan een te rooskleurig cijfer.
    aandeelNietTrainbaar: metTier.length > 0 && fteSom > 0 ? fteNietTrainbaar / fteSom : null,
    heeftTrainbaarheidsdata: metTier.length > 0,
  };
}

export const AGENDA_KOLOMMEN = ["Competentie", "Nodig in", "Hoe trainbaar"];

export const AGENDA_INTRO =
  "De competenties die ná de transformatie extra nodig zijn, geteld over alle functies. Een competentie die in meerdere functies terugkomt is één programma, geen reeks losse gesprekken.";

/** De samenvattende zin boven de tabel. */
export function agendaZin(agenda) {
  const breed = agenda.competenties.filter((c) => c.aantalRollen > 1).length;
  const nietTrainbaar = agenda.competenties.filter((c) => c.trainbaarheid === "laag").length;
  return (
    `${agenda.competenties.length} competenties zijn nieuw nodig, waarvan ${breed} in meerdere functies.` +
    (agenda.aandeelNietTrainbaar === null
      ? ""
      : ` ${Math.round(agenda.aandeelNietTrainbaar * 100)}% van de totale ontwikkelbehoefte is niet met training op te lossen (${nietTrainbaar} van de ${agenda.competenties.length} competenties).`)
  );
}

export const trainbaarheidTekst = (tier) => (tier ? `${tier} trainbaar` : "onbekend");

/**
 * De rijen van de agendatabel: de competenties die de meeste functies raken, en hoeveel er buiten
 * beeld blijven. Gesorteerd staat het al: breedte eerst. Eén plek voor scherm, PDF en Word.
 */
export function agendaRijen(agenda, aantal = 5) {
  // Eén competentie over is geen "rest" waard; die staat gewoon in de tabel.
  const toon = agenda.competenties.length > aantal + 1 ? aantal : agenda.competenties.length;
  return { rijen: agenda.competenties.slice(0, toon), rest: agenda.competenties.length - toon };
}

/** De cellen van één rij, als tekst. */
export function agendaCellen(c, aantalRollenTotaal) {
  return [
    c.naam,
    `${c.aantalRollen} van ${aantalRollenTotaal} ${aantalRollenTotaal === 1 ? "functie" : "functies"}`,
    trainbaarheidTekst(c.trainbaarheid),
  ];
}

/** De zin onder de tabel als er competenties buiten beeld blijven. */
export function agendaRestZin(rest) {
  return rest > 0 ? `Daarnaast zijn nog ${rest} ${rest === 1 ? "competentie" : "competenties"} nodig in minder functies.` : "";
}

/** De waarschuwing over laag trainbare competenties, of leeg als die er niet zijn. */
export function agendaLaagZin(agenda) {
  const n = agenda.competenties.filter((c) => c.trainbaarheid === "laag").length;
  if (n === 0) return "";
  return `${n === 1 ? "Eén competentie" : `${n} competenties`} in deze lijst ${n === 1 ? "is" : "zijn"} laag trainbaar — disposities in plaats van vaardigheden. Die los je niet op met een opleidingsbudget; de vraag is of ze al in huis zijn. Toets daarop bij de huidige bezetting.`;
}
