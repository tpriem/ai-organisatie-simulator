import { isTrainbaar } from "./trainability.js";

/**
 * NOG NIET IN GEBRUIK — zie de blokkade onderaan deze toelichting.
 *
 * Welke overstap tussen rollen is realistisch?
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
 * BLOKKADE — waarom dit nog niet in de weergave zit.
 *
 * Op de huidige analysedata levert dit vrijwel overal 0% kruisoverlap op. Dat is geen
 * bevinding over de organisatie maar een artefact: elke rol wordt los geanalyseerd, dus
 * het model beschrijft elke rol in zijn eigen beste woorden zonder enige druk richting
 * een gedeelde woordenschat.
 *
 * Gemeten op Voorbeeld BV: de kandidatenpools van de zes rollen delen 95 tot 111 van
 * hun 150 competenties, en ongeveer de helft van de competenties die andere rollen
 * kozen zat gewoon in de eigen pool. De keuze om ze niet te kiezen was dus vrij, niet
 * afgedwongen.
 *
 * Zolang dat zo is, zou deze module aan een CHRO melden dat niemand ergens heen kan,
 * terwijl dat niet volgt uit de data. Eerst moeten alle rollen van een klant uit één
 * gedeelde competentiewoordenschat kiezen; daarna is deze vergelijking betekenisvol.
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
 * Bouwt de mogelijke overstappen tussen alle rollen.
 *
 * @param {object[]} roleResults
 * @param {object} opties
 * @param {string} opties.scenario
 * @param {number} opties.minimaleOverlap ondergrens om een pad te tonen; daaronder is
 *   het geen loopbaanpad maar een carrièreswitch, en dat is geen advies dat deze tool
 *   kan onderbouwen.
 * @param {number} opties.maxPerRol hoeveel bestemmingen per herkomstrol
 */
export function calculateMobiliteit(roleResults, { scenario = "realistisch", minimaleOverlap = 0.3, maxPerRol = 3 } = {}) {
  const rollen = (roleResults ?? []).filter((r) => r.competentieProfiel);
  if (rollen.length < 2) return { herkomsten: [], heeftData: false };

  const herkomsten = [];

  for (const van of rollen) {
    const vrijgekomenFte = van.scenarios?.[scenario]?.fteWeg ?? 0;
    // Zonder vrijgekomen capaciteit is er niemand om te verplaatsen.
    if (vrijgekomenFte <= 0.05) continue;

    const bestemmingen = [];
    for (const naar of rollen) {
      if (naar.roleId === van.roleId) continue;

      const v = vergelijkProfielen(van.competentieProfiel.profielNu, naar.competentieProfiel.profielStraks);
      if (v.overlap < minimaleOverlap) continue;

      bestemmingen.push({
        roleId: naar.roleId,
        rolnaam: naar.rolnaam,
        roleLabel: naar.roleLabel ?? naar.rolnaam,
        afdeling: naar.afdeling ?? "",
        // Hoeveel van de bestemmingsrol na de transformatie overblijft. Een rol die
        // zelf vrijwel verdwijnt is geen realistische bestemming, hoe goed de
        // competenties ook aansluiten.
        fteNaTransformatie: naar.scenarios?.[scenario]?.fteOver ?? 0,
        overlapPct: Math.round(v.overlap * 100),
        overlapNaTrainingPct: v.overlapNaTraining === null ? null : Math.round(v.overlapNaTraining * 100),
        teOntwikkelen: v.teOntwikkelen.slice(0, 5),
        teToetsen: v.teToetsen.slice(0, 5),
        heeftTrainbaarheidsdata: v.heeftTrainbaarheidsdata,
      });
    }

    if (bestemmingen.length === 0) continue;

    // Sorteren op wat haalbaar is ná training: dat is de vraag die telt bij een
    // overstap, niet wat er vandaag al toevallig overlapt.
    bestemmingen.sort(
      (a, b) => (b.overlapNaTrainingPct ?? b.overlapPct) - (a.overlapNaTrainingPct ?? a.overlapPct) || b.overlapPct - a.overlapPct
    );

    herkomsten.push({
      roleId: van.roleId,
      rolnaam: van.rolnaam,
      roleLabel: van.roleLabel ?? van.rolnaam,
      afdeling: van.afdeling ?? "",
      vrijgekomenFte,
      bestemmingen: bestemmingen.slice(0, maxPerRol),
    });
  }

  // Meeste vrijgekomen capaciteit eerst: daar speelt de vraag het sterkst.
  herkomsten.sort((a, b) => b.vrijgekomenFte - a.vrijgekomenFte);

  return { herkomsten, heeftData: herkomsten.length > 0 };
}
