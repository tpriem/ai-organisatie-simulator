// De bevindingen en aanbevelingen worden door een taalmodel opgesteld. Ze gaan pas mee in een rapport
// nadat de adviseur ze heeft gelezen, zo nodig aangepast, en goedgekeurd. Tot dat moment zijn ze een
// concept: zichtbaar in de tool, niet in wat de klant krijgt.

const MAX_TEKST = 2000;
const MAX_KORT = 200;
const MAX_ITEMS = 12;

const tekst = (t, max) => String(t ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

function lijst(ruw, maak) {
  return (Array.isArray(ruw) ? ruw : []).slice(0, MAX_ITEMS).map(maak).filter(Boolean);
}

/** Maakt van ongecontroleerde invoer (uit het model of uit het bewerkscherm) schone aanbevelingen. */
export function schoneAanbevelingen(ruw) {
  const rolItem = (r) => {
    const rolnaam = tekst(r?.rolnaam, MAX_KORT);
    const toelichting = tekst(r?.toelichting, MAX_TEKST);
    return rolnaam || toelichting ? { rolnaam, toelichting } : null;
  };
  return {
    bevindingenSamenvatting: tekst(ruw?.bevindingenSamenvatting, MAX_TEKST),
    krimpendeRollen: lijst(ruw?.krimpendeRollen, rolItem),
    groeiendeRollen: lijst(ruw?.groeiendeRollen, rolItem),
    samenvoegKandidaten: lijst(ruw?.samenvoegKandidaten, (s) => {
      const rollen = lijst(s?.rollen, (x) => tekst(x, MAX_KORT) || null);
      const toelichting = tekst(s?.toelichting, MAX_TEKST);
      return rollen.length || toelichting ? { rollen, toelichting } : null;
    }),
    aanbevelingen: lijst(ruw?.aanbevelingen, (a) => {
      const titel = tekst(a?.titel, MAX_KORT);
      const beschrijving = tekst(a?.beschrijving, MAX_TEKST);
      return titel || beschrijving ? { titel, beschrijving } : null;
    }),
  };
}

export const isGoedgekeurd = (aanbevelingen) => Boolean(aanbevelingen?.goedgekeurd?.op);

/**
 * Slaat een bewerkte versie op. Bewerken alleen maakt er weer een concept van: wat is goedgekeurd is
 * precies de tekst die er op dat moment stond.
 */
export function bewerkAanbevelingen(nieuw, { goedkeuren = false, door = null, nu = new Date() } = {}) {
  const schoon = schoneAanbevelingen(nieuw);
  return goedkeuren ? { ...schoon, goedgekeurd: { op: nu.toISOString(), door: door ? String(door).slice(0, 254) : null } } : schoon;
}

/** De resultaten zoals ze een rapport in gaan: aanbevelingen alleen als ze zijn goedgekeurd. */
export function resultatenVoorRapport(results) {
  if (!results || !results.aanbevelingen || isGoedgekeurd(results.aanbevelingen)) return results;
  return { ...results, aanbevelingen: null };
}

// De koppen boven de drie lijsten. De sleutels in de opslag heten nog naar de oude indeling
// (krimpendeRollen); wat de lezer ziet gaat over tijd die vrijkomt, niet over krimp.
export const AANBEVELING_KOPPEN = {
  krimpendeRollen: "Rollen waar de meeste tijd vrijkomt",
  groeiendeRollen: "Rollen die in waarde groeien of nieuw nodig zijn",
  samenvoegKandidaten: "Rollen met overlappend werk",
};
