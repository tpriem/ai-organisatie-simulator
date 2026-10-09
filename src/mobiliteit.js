import { isTrainbaar } from "./trainability.js";

/**
 * Waar kunnen de mensen heen bij wie capaciteit vrijkomt?
 *
 * De tool kon tot nu toe per rol zeggen hoe goed het huidige profiel aansluit op wat
 * diezelfde rol ná de transformatie vraagt. Wat ontbrak is de vraag die een leider
 * werkelijk stelt: er komt capaciteit vrij bij deze rol — waar kunnen die mensen heen?
 *
 * Die vergelijking kan omdat alle rollen hun competenties uit dezelfde ESCO-taxonomie
 * halen. Daardoor is het profiel van een klantenservicemedewerker rechtstreeks te
 * leggen naast dat van een kwaliteitsmedewerker. Zonder gedeelde woordenschat zou dit
 * niet kunnen.
 *
 * De rekenwijze is dezelfde histogram-intersectie die competencyProfile.js binnen één
 * rol gebruikt, nu tussen twee rollen: het huidige profiel van de herkomstrol tegen het
 * toekomstige profiel van de bestemmingsrol. Bewust dezelfde maat, zodat "61% overlap"
 * overal hetzelfde betekent.
 *
 * Twee ontwerpkeuzes die uit meten volgen, niet uit voorkeur.
 *
 * De vergelijking is met blíjven, niet een ranglijst van bestemmingen. Op de echte data
 * ligt de overlap met de eigen, veranderde rol op 33-65% en met andere rollen op
 * 14-21%. Een kale ranglijst van bestemmingen suggereert dan keuzevrijheid die er niet
 * is; het eerlijke beeld is dat doorgroeien in de eigen rol doorgaans kansrijker is, en
 * hoe ver het beste alternatief daarbij achterblijft.
 *
 * En er wordt gerangschikt op ruwe overlap, niet op overlap ná training. Dat laatste
 * getal komt voor elk rolpaar op 76-100% uit, en bij een bestemming zonder
 * laag-trainbare competenties stelselmatig op 100%. Het meet vooral hoe trainbaar de
 * bestemming is, niet hoe dicht iemand erbij staat. Als rangschikking is het dus
 * waardeloos; het niet-trainbare deel van het gat blijft wél als risicosignaal staan.
 */

const alsMap = (lijst) => new Map((lijst ?? []).map((c) => [c.naam, c.aandeel ?? 0]));

/**
 * Vergelijkt één herkomstprofiel met één bestemmingsprofiel.
 * @returns {{ overlap, overlapNaTraining, teOntwikkelen, teToetsen, heeftTrainbaarheidsdata }}
 */
export function vergelijkProfielen(profielNu, profielStraks) {
  const nu = alsMap(profielNu);
  const straks = alsMap(profielStraks);

  let overlap = 0;
  const tekorten = [];
  for (const [naam, straksAandeel] of straks) {
    const nuAandeel = nu.get(naam) ?? 0;
    overlap += Math.min(nuAandeel, straksAandeel);
    const tekort = straksAandeel - nuAandeel;
    if (tekort > 0) {
      // Trainbaarheid staat al op het item van het bestemmingsprofiel; die is per
      // competentie bepaald en dus onafhankelijk van welke rol hem nodig heeft.
      const bron = (profielStraks ?? []).find((c) => c.naam === naam);
      tekorten.push({ naam, tekort, trainbaarheid: bron?.trainbaarheid ?? null });
    }
  }

  const heeftTiers = tekorten.length === 0 || tekorten.some((t) => t.trainbaarheid !== null);
  tekorten.sort((a, b) => b.tekort - a.tekort);

  const teOntwikkelen = tekorten.filter((t) => isTrainbaar(t.trainbaarheid));
  const teToetsen = tekorten.filter((t) => t.trainbaarheid === "laag");
  const trainbaarTekort = teOntwikkelen.reduce((s, t) => s + t.tekort, 0);

  const alsItem = (t) => ({ naam: t.naam, pct: Math.round(t.tekort * 100), trainbaarheid: t.trainbaarheid });

  return {
    overlap,
    overlapNaTraining: heeftTiers ? overlap + trainbaarTekort : null,
    teOntwikkelen: teOntwikkelen.map(alsItem),
    teToetsen: teToetsen.map(alsItem),
    heeftTrainbaarheidsdata: heeftTiers,
  };
}

/**
 * Zet per rol met vrijgekomen capaciteit af: blijven tegenover overstappen.
 *
 * @param {object[]} roleResults
 * @param {object} opties
 * @param {string} opties.scenario
 * @param {number} opties.minimaleVerhouding ondergrens ten opzichte van blijven. Laag
 *   gezet en bewust: dat een alternatief maar een derde zo kansrijk is als blijven, is
 *   zelf de boodschap. Het verhoudingsgetal zegt dat duidelijker dan weglaten.
 * @param {number} opties.maxPerRol hoeveel alternatieven per rol
 */
export function calculateMobiliteit(
  roleResults,
  { scenario = "realistisch", minimaleVerhouding = 0.15, maxPerRol = 3 } = {}
) {
  const rollen = (roleResults ?? []).filter((r) => r.competentieProfiel);
  if (rollen.length < 2) return { herkomsten: [], heeftData: false };

  const herkomsten = [];

  for (const van of rollen) {
    const vrijgekomenFte = van.scenarios?.[scenario]?.fteWeg ?? 0;
    // Zonder vrijgekomen capaciteit is er niemand om te verplaatsen.
    if (vrijgekomenFte <= 0.05) continue;

    // De maatstaf: hoe goed sluit het huidige profiel aan op de eigen rol zoals die ná
    // de transformatie wordt. Alles wat een overstap oplevert wordt hieraan afgemeten.
    const blijven = vergelijkProfielen(van.competentieProfiel.profielNu, van.competentieProfiel.profielStraks);

    const alternatieven = [];
    for (const naar of rollen) {
      if (naar.roleId === van.roleId) continue;

      const v = vergelijkProfielen(van.competentieProfiel.profielNu, naar.competentieProfiel.profielStraks);
      const verhouding = blijven.overlap > 0 ? v.overlap / blijven.overlap : 0;
      if (verhouding < minimaleVerhouding) continue;

      const nietTrainbaar = v.teToetsen.reduce((s, t) => s + t.pct, 0);

      alternatieven.push({
        roleId: naar.roleId,
        rolnaam: naar.rolnaam,
        roleLabel: naar.roleLabel ?? naar.rolnaam,
        afdeling: naar.afdeling ?? "",
        // Hoeveel van de bestemmingsrol na de transformatie overblijft. Een rol die
        // zelf vrijwel verdwijnt is geen realistische bestemming, hoe goed de
        // competenties ook aansluiten. Het oordeel daarover is aan de lezer.
        fteNaTransformatie: naar.scenarios?.[scenario]?.fteOver ?? 0,
        overlapPct: Math.round(v.overlap * 100),
        // Hoe het alternatief zich verhoudt tot blijven. 1,0 betekent even kansrijk.
        verhouding,
        // Het deel van het gat dat niet met training te overbruggen is: het echte
        // risico van deze overstap.
        nietTrainbaarPct: nietTrainbaar,
        teOntwikkelen: v.teOntwikkelen.slice(0, 5),
        teToetsen: v.teToetsen.slice(0, 5),
      });
    }

    alternatieven.sort((a, b) => b.overlapPct - a.overlapPct);

    herkomsten.push({
      roleId: van.roleId,
      rolnaam: van.rolnaam,
      roleLabel: van.roleLabel ?? van.rolnaam,
      afdeling: van.afdeling ?? "",
      vrijgekomenFte,
      blijvenOverlapPct: Math.round(blijven.overlap * 100),
      blijvenNietTrainbaarPct: blijven.teToetsen.reduce((s, t) => s + t.pct, 0),
      alternatieven: alternatieven.slice(0, maxPerRol),
    });
  }

  // Meeste vrijgekomen capaciteit eerst: daar speelt de vraag het sterkst.
  herkomsten.sort((a, b) => b.vrijgekomenFte - a.vrijgekomenFte);

  return { herkomsten, heeftData: herkomsten.length > 0 };
}
