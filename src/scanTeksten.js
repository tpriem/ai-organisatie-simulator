import { NIVEAUS, ROLLEN } from "./volwassenheid.js";
import { totaalbeeld, organisatieEnSystemen, bijnaZover, rolBeeld } from "./scanInzichten.js";

/**
 * De zinnen die het rapport en het scherm van de volwassenheidsscan delen: de openingszin, de
 * conclusies en de reden waarom een thema op zijn plek in de aanpak staat. Op één plek, zodat het
 * scherm van de adviseur en het rapport van de klant dezelfde woorden gebruiken.
 *
 * In de tekst heet een as een "onderdeel": zo noemt de lezer het.
 */

export const rolNaam = (id) => ROLLEN.find((r) => r.id === id)?.naam ?? id;
export const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;
export const zijn = (n) => (n === 1 ? "is" : "zijn");
export const klein = (s) => String(s ?? "").toLowerCase();
export const eindpunt = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
const beginKlein = (s) => `${klein(s.charAt(0))}${s.slice(1)}`;

/** "a", "a en b", "a, b en c". */
export function opsomming(delen) {
  if (delen.length <= 1) return delen[0] ?? "";
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

export const naamVanNiveau = (n) => (n === 0 ? "nog niet begonnen" : klein(NIVEAUS.find((x) => x.niveau === n)?.naam));

/** Eén zin over waar de organisatie staat: de verdeling over de niveaus, en het doel. */
export function standZin(beeld, klantNaam) {
  const groep = (g) => `niveau ${g.niveau} (${klein(g.naam)})`;
  let stand;
  if (beeld.perNiveau.length === 1) {
    stand = `${klantNaam} staat op ${beeld.gemeten === 1 ? "het gemeten onderdeel" : `alle ${beeld.gemeten} gemeten onderdelen`} op ${groep(beeld.meest)}.`;
  } else {
    const overig = beeld.perNiveau.filter((g) => g !== beeld.meest);
    const aantalOverig = overig.reduce((n, g) => n + g.assen.length, 0);
    // Weinig uitzonderingen worden bij naam genoemd; bij veel volstaat het bereik.
    const rest =
      aantalOverig <= 3
        ? overig.map((g) => `${opsomming(g.assen)} ${g.assen.length === 1 ? "staat" : "staan"} op ${groep(g)}`).join("; ")
        : `de overige ${aantalOverig} lopen van niveau ${overig[0].niveau} tot ${overig[overig.length - 1].niveau}`;
    stand = `${klantNaam} staat op ${beeld.meest.assen.length} van de ${beeld.gemeten} gemeten onderdelen op ${groep(beeld.meest)}; ${rest}.`;
  }
  const doel = beeld.doel ? ` Het doel is niveau ${beeld.doel} (${naamVanNiveau(beeld.doel)}) op alle onderdelen.` : " De doelen verschillen per onderdeel.";
  return stand + doel;
}

/** Waarom een thema op zijn plek in de aanpak staat, als zin. */
export function waaromZin(w) {
  if (w.soort === "voorwaarde") return `Voorwaarde om de vrijkomende tijd te benutten: ${beginKlein(w.reden)}`;
  if (w.soort === "afhankelijkheid") return `Eerst nodig voor ${opsomming(w.voorNaam)}: ${w.reden}`;
  return "Een van de grootste afstanden tot het doel.";
}

/** Dezelfde reden in een paar woorden, voor de samenvatting. */
export function waaromKort(w) {
  if (w.soort === "voorwaarde") return "voorwaarde om de vrijkomende tijd te benutten";
  if (w.soort === "afhankelijkheid") return `eerst nodig voor ${opsomming(w.voorNaam)}`;
  return "een van de grootste afstanden tot het doel";
}

/** Organisatie tegenover systemen: de stand per kant en wat dat betekent. */
export function organisatieSystemenZin(os) {
  const bereik = (k) => (k.laagste === k.hoogste ? `is het niveau overal ${k.laagste}` : `loopt het niveau van ${k.laagste} tot ${k.hoogste}`);
  const duiding =
    os.voorop === "systemen"
      ? "De systemen lopen voor op de organisatie. Dat is een bekend patroon: de techniek is er eerder dan de afspraken, de vaardigheden en de aangepaste werkprocessen. De tijdwinst komt pas als de organisatie volgt."
      : os.voorop === "organisatie"
        ? "De organisatie loopt voor op de systemen. Er is richting en er zijn afspraken, maar data en techniek kunnen het nog niet dragen. Plannen blijven dan op papier tot de systeemkant volgt."
        : "Organisatie en systemen lopen ongeveer gelijk op. Dat is gunstig: geen van beide houdt de andere op.";
  return `Aan de organisatiekant (${klein(opsomming(os.organisatie.assen.map((a) => a.naam)))}) ${bereik(os.organisatie)}. Aan de systeemkant (${klein(opsomming(os.systemen.assen.map((a) => a.naam)))}) ${bereik(os.systemen)}. ${duiding}`;
}

/**
 * De belangrijkste conclusies, hooguit vier: eerst de afstand tot het doel, dan wat de lezer er het
 * meest aan heeft (de voorwaarden voor de vrijkomende tijd vooraan).
 */
export function conclusies(analyse) {
  const { profiel, realisatie: r } = analyse;
  const beeld = totaalbeeld(profiel);
  const os = organisatieEnSystemen(profiel);
  const bijna = bijnaZover(profiel);
  const borging = analyse.vaardigheidVersusBorging.filter((x) => x.signaal);
  const rollen = rolBeeld(analyse.verschillen);
  const nietVoldaan = r ? r.voorwaarden.filter((v) => v.scenario === "realistisch" && v.status === "niet voldaan") : [];

  const uit = [
    beeld.onderDoel === 0
      ? "Op alle gemeten onderdelen is het doel gehaald."
      : `Op ${beeld.onderDoel} van de ${beeld.gemeten} gemeten onderdelen is het doel nog niet gehaald. ${
          beeld.verst.length <= 3
            ? `De afstand is het grootst bij ${opsomming(beeld.verst)}: ${meervoud(beeld.grootsteGat, "niveau", "niveaus")}.`
            : `Bij ${beeld.verst.length} daarvan is de afstand ${meervoud(beeld.grootsteGat, "niveau", "niveaus")}.`
        }`,
  ];

  const kandidaten = [];
  if (r && r.realistisch.totaal > 0) {
    kandidaten.push(
      nietVoldaan.length === 0
        ? `Aan alle ${r.realistisch.totaal} voorwaarden om de vrijkomende tijd uit de capaciteitsanalyse te benutten is voldaan (realistisch scenario).`
        : `Van de ${r.realistisch.totaal} voorwaarden om de vrijkomende tijd uit de capaciteitsanalyse te benutten ${zijn(r.realistisch.voldaan)} er ${r.realistisch.voldaan} voldaan (realistisch scenario). Nog niet op orde: ${opsomming(nietVoldaan.map((v) => v.naam))}.`
    );
  }
  if (os?.voorop === "systemen") kandidaten.push("De systemen lopen voor op de organisatie: de techniek is verder dan de afspraken, de vaardigheden en de werkprocessen.");
  if (os?.voorop === "organisatie") kandidaten.push("De organisatie loopt voor op de systemen: er is richting en er zijn afspraken, maar data en techniek zijn nog niet zover.");
  if (bijna.length > 0) {
    kandidaten.push(`Bij ${meervoud(bijna.length, "thema", "thema's")} is de eerstvolgende stap al deels gezet. Afmaken levert daar het snelst resultaat op.`);
  }
  if (borging.length > 0) {
    kandidaten.push(`Bij ${meervoud(borging.length, "thema", "thema's")} kan de organisatie meer dan zij heeft vastgelegd. Dat werkt, maar is kwetsbaar.`);
  }
  if (rollen?.meestPositief) {
    const aantal = rollen.rollen.find((x) => x.rol === rollen.meestPositief).hoogst;
    kandidaten.push(`${rolNaam(rollen.meestPositief)} schat de organisatie in ${meervoud(aantal, "thema", "thema's")} hoger in dan de andere rollen.`);
  }
  return [...uit, ...kandidaten.slice(0, 3)];
}
