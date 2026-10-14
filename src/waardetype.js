import { WAARDETYPE_IDS } from "./config.js";

/**
 * Handmatig bijsturen van het waardetype per rol.
 *
 * Het waardetype bepaalt waar de vrijgekomen capaciteit naartoe gaat en is daarmee het
 * kopgetal van het rapport geworden. Claude leidt het af uit het functieprofiel, maar
 * een profiel kan niet weten wat de organisatie met die capaciteit wil: dat hangt af van
 * strategie, marktpositie en ambitie. Dat is een keuze van de organisatie en haar
 * adviseur, niet van een taalmodel. Dit is de plek waar die keuze binnenkomt.
 *
 * Ontwerp: de handmatige keuze staat in `waardetype` zelf. Alles wat dat veld leest —
 * app, PDF, Word, de bestemmingsverdeling — klopt daardoor vanzelf. De inschatting van
 * Claude blijft apart bewaard (`waardetypeAI`), zodat zichtbaar is dat het een afwijking
 * is en terugzetten mogelijk blijft.
 */

/** @returns {boolean} */
export function isHandmatig(rol) {
  return Boolean(rol?.waardetypeHandmatig);
}

/**
 * Zet het waardetype van een rol op een handmatige keuze.
 * Een tweede keer bijsturen behoudt de oorspronkelijke AI-inschatting.
 */
export function stelWaardetypeIn(rol, waardetype, { reden = "", nu = new Date() } = {}) {
  if (!WAARDETYPE_IDS.includes(waardetype)) {
    throw new Error(`Onbekend waardetype: ${waardetype}`);
  }

  const handmatig = isHandmatig(rol);
  const ai = handmatig ? rol.waardetypeAI : rol.waardetype;
  const aiToelichting = handmatig ? rol.waardetypeToelichtingAI : rol.waardetypeToelichting;
  const schoneReden = String(reden ?? "").trim();

  return {
    ...rol,
    waardetype,
    // De toelichting van Claude hoort bij Claudes keuze; bij een andere keuze zou die
    // tekst de lezer misleiden. Daarom de reden van de adviseur, of leeg als die er niet is:
    // dat een rol handmatig is bepaald staat al apart vermeld, dus een eigen zin daarvoor
    // zou het dubbel zeggen.
    waardetypeToelichting: schoneReden,
    waardetypeHandmatig: { reden: schoneReden, op: nu.toISOString() },
    waardetypeAI: ai ?? null,
    waardetypeToelichtingAI: aiToelichting ?? null,
  };
}

/** Zet een handmatige keuze terug op de inschatting van Claude. */
export function herstelWaardetype(rol) {
  if (!isHandmatig(rol)) return rol;

  const { waardetypeHandmatig, waardetypeAI, waardetypeToelichtingAI, ...rest } = rol;
  const hersteld = { ...rest, waardetype: waardetypeAI ?? null };
  if (waardetypeToelichtingAI != null) hersteld.waardetypeToelichting = waardetypeToelichtingAI;
  else delete hersteld.waardetypeToelichting;
  return hersteld;
}

/**
 * Neemt handmatige keuzes uit een eerdere analyse over in een nieuwe.
 *
 * Een nieuwe analyse begint helemaal opnieuw en zou een bewuste menselijke beslissing
 * stilzwijgend weggooien. De rol wordt gevonden op roleId. De nieuwe inschatting van
 * Claude wordt bewaard als waardetypeAI, zodat de adviseur ziet als die inmiddels anders
 * is — en de keuze blijft staan.
 */
export function neemHandmatigeWaardetypesOver(nieuweRollen, vorigeRollen) {
  const handmatigeVorige = new Map(
    (vorigeRollen ?? []).filter(isHandmatig).map((r) => [r.roleId ?? r.rolnaam, r])
  );
  if (handmatigeVorige.size === 0) return nieuweRollen;

  return nieuweRollen.map((nieuw) => {
    const vorige = handmatigeVorige.get(nieuw.roleId ?? nieuw.rolnaam);
    if (!vorige) return nieuw;
    return {
      ...nieuw,
      waardetype: vorige.waardetype,
      waardetypeToelichting: vorige.waardetypeToelichting,
      waardetypeHandmatig: vorige.waardetypeHandmatig,
      waardetypeAI: nieuw.waardetype ?? null,
      waardetypeToelichtingAI: nieuw.waardetypeToelichting ?? null,
    };
  });
}

/**
 * Hoeveel rollen hebben een handmatig bepaald waardetype?
 * De bestemmingsverdeling in het rapport rust daar dan deels op menselijk oordeel, en
 * dat moet de lezer kunnen zien.
 */
export function waardetypeHerkomst(rollen) {
  const lijst = rollen ?? [];
  const handmatig = lijst.filter(isHandmatig);
  return {
    totaal: lijst.length,
    handmatig: handmatig.length,
    // Waar de handmatige keuze afwijkt van wat Claude had gekozen.
    afwijkend: handmatig.filter((r) => r.waardetypeAI && r.waardetypeAI !== r.waardetype).length,
  };
}
