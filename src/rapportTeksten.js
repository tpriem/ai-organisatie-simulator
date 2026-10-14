import { calculateScanDekking, matchKwaliteit } from "./scanDekking.js";
import { nl } from "./formatNl.js";
import { getWaardetype } from "./config.js";
import { isHandmatig, waardetypeHerkomst, bevestigtInschatting, rollenDieBevestigingVragen } from "./waardetype.js";

/**
 * Teksten over dekking en bewijskracht, voor de rapporten.
 *
 * Eén plek voor de formulering, zodat PDF en Word niet uiteenlopen. De app richt zich
 * tot de adviseur ("controleer dit voordat het rapport de deur uit gaat"); het rapport
 * gaat naar de klant, dus hier staat de gewone uitleg zonder die aansporing.
 *
 * Eerlijkheid over hoe stevig een uitspraak is hoort bij het rapport zelf: een lezer die
 * niet weet dat een rol is overgeslagen of dat een koppeling wankel is, kan de cijfers
 * niet goed wegen.
 */

/**
 * Eén regel bij een rol: waaruit zijn competenties zijn afgeleid.
 * @returns {string|null}
 */
export function beroepsmatchRegel(beroepsmatch) {
  if (!beroepsmatch?.label) return null;

  const basis =
    typeof beroepsmatch.score === "number"
      ? `Competenties ontleend aan het ESCO-beroep "${beroepsmatch.label}" (match ${nl(beroepsmatch.score, 2)}).`
      : `Competenties ontleend aan het ESCO-beroep "${beroepsmatch.label}".`;

  const kwaliteit = matchKwaliteit(beroepsmatch.score);
  if (kwaliteit === "matig" || kwaliteit === "zwak") {
    return `${basis} De koppeling sluit minder nauw aan op de functietitel; de competentie-uitspraken over deze rol zijn daarom indicatief.`;
  }
  return basis;
}

/**
 * De zinnen voor de sectie "Dekking en betrouwbaarheid".
 * Elk onderdeel is null als er niets over te melden valt.
 *
 * @returns {{ dekking: string|null, mislukt: string|null, zwak: string|null, heeftIets: boolean }}
 */
export function dekkingZinnen(results) {
  const d = calculateScanDekking(results);

  const dekking =
    d.heeftMatchdata && d.takenTotaal > 0
      ? `${d.rollen} ${d.rollen === 1 ? "rol is" : "rollen zijn"} geanalyseerd. Van de ${d.takenTotaal} taken uit de functieprofielen kon ${
          d.takenTotaal - d.ongematchteTaken
        } (${Math.round((d.taakdekking ?? 0) * 100)}%) aan een competentie worden gekoppeld.`
      : null;

  // Een rol die niet geanalyseerd kon worden ontbreekt in alle totalen. Dat moet de lezer
  // weten, anders lijkt het rapport volledig terwijl het dat niet is.
  const mislukt = d.mislukteRollen.length
    ? `Niet geanalyseerd, en dus niet opgenomen in de totalen: ${d.mislukteRollen
        .map((r) => r.roleLabel ?? r.rolnaam)
        .join(", ")} (de analyse van ${d.mislukteRollen.length === 1 ? "deze rol" : "deze rollen"} is niet gelukt).`
    : null;

  const zwak = d.zwakkeMatches.length
    ? `Bij de volgende ${d.zwakkeMatches.length === 1 ? "rol sluit" : "rollen sluit"} de koppeling met de ESCO-beroepsclassificatie minder nauw aan op de functietitel; de competentie-uitspraken ${
        d.zwakkeMatches.length === 1 ? "over deze rol zijn" : "over deze rollen zijn"
      } daarom indicatief: ${d.zwakkeMatches
        .map((m) => `${m.roleLabel} (gekoppeld aan "${m.beroep}", match ${nl(m.score, 2)})`)
        .join("; ")}.`
    : null;

  return { dekking, mislukt, zwak, heeftIets: Boolean(dekking || mislukt || zwak) };
}

/**
 * Eén zin over hoeveel rollen een handmatig bepaalde bestemming hebben.
 *
 * Zodra een adviseur waardetypes bijstuurt, rust de verdeling van de capaciteit deels op
 * menselijk oordeel in plaats van op een afleiding uit de functieprofielen. Dat is geen
 * gebrek — het is juist waar de organisatie haar eigen keuze inbrengt — maar de lezer moet
 * het wel kunnen zien.
 *
 * @returns {string|null}
 */
export function waardetypeHerkomstZin(rollen) {
  const h = waardetypeHerkomst(rollen);
  if (h.handmatig === 0) return null;
  const rollenTekst = `${h.totaal} ${h.totaal === 1 ? "rol" : "rollen"}`;

  // Alleen bevestigd is iets anders dan aangepast: het eerste zegt dat een mens de
  // inschatting heeft nagelopen en onderschrijft, het tweede dat hij een andere keuze maakte.
  if (h.afwijkend === 0 && h.bevestigd === h.handmatig) {
    return `Voor ${h.handmatig} van de ${rollenTekst} is de bestemming door de adviseur bevestigd.`;
  }
  return (
    `Voor ${h.handmatig} van de ${rollenTekst} is de bestemming handmatig vastgelegd` +
    (h.afwijkend > 0
      ? `; daarvan ${h.afwijkend === 1 ? "wijkt 1" : `wijken ${h.afwijkend}`} af van de inschatting op basis van het functieprofiel.`
      : ".")
  );
}

/**
 * Regel bij een rol die laat zien dat het waardetype handmatig is bepaald.
 * @returns {string|null}
 */
export function waardetypeHandmatigRegel(rol) {
  if (!isHandmatig(rol)) return null;
  if (bevestigtInschatting(rol)) return "Bevestigd door de adviseur.";
  const ai = getWaardetype(rol.waardetypeAI);
  const huidig = getWaardetype(rol.waardetype);
  return ai && huidig && ai.id !== huidig.id
    ? `Handmatig bepaald. De inschatting op basis van het functieprofiel was: ${ai.label.toLowerCase()}.`
    : "Handmatig bepaald.";
}

/**
 * Zegt het rapport hoe stevig de bestemming van de grote rollen is.
 *
 * Het waardetype is per rol meestal stabiel, maar de verdeling in het kopgetal is dat niet
 * als de capaciteit zich concentreert: bij één rol met 40% van de capaciteit sprong de
 * verdeling in een van tien runs van 71% naar 31% kwaliteitsverbetering. Of de rollen die
 * samen de helft dragen door een mens zijn nagelopen, bepaalt dus hoeveel gewicht de
 * lezer aan die verdeling kan geven — en hoort in het rapport te staan.
 *
 * @returns {string|null}
 */
export function bevestigingZin(rollen) {
  const b = rollenDieBevestigingVragen(rollen);
  if (b.rollen.length === 0) return null;

  if (b.alleBevestigd) {
    return b.rollen.length === 1
      ? "De bestemming van de rol die de helft van de vrijgekomen capaciteit draagt is door de adviseur bevestigd."
      : `De bestemming van de ${b.rollen.length} rollen die samen de helft van de vrijgekomen capaciteit dragen is door de adviseur bevestigd.`;
  }

  const open = b.rollen.filter((r) => !r.bevestigd);
  return (
    `Let op: de bestemming van ${open.map((r) => r.roleLabel).join(", ")} is een inschatting op basis van het functieprofiel en nog niet door de adviseur bevestigd; ` +
    `${open.length === 1 ? "deze rol draagt" : "deze rollen dragen"} samen ${Math.round(b.onbevestigdAandeel * 100)}% van de vrijgekomen capaciteit.`
  );
}
