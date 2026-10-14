import { calculateScanDekking, matchKwaliteit } from "./scanDekking.js";
import { nl } from "./formatNl.js";

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
