// Het logboek van een klant: wie deed wat en wanneer. Bedoeld om achteraf te kunnen nagaan wie een
// analyse draaide, een rapport ophaalde of een link verstuurde. Er staan geen inhoud en geen adressen
// van klanten in, alleen de handeling.

export const MAX_REGELS = 300;

export const ACTIES = {
  functieoverzicht_geupload: "Functieoverzicht geüpload",
  profielen_geupload: "Functieprofielen geüpload",
  analyse_gedraaid: "Capaciteitsanalyse gedraaid",
  aanbevelingen_gegenereerd: "Aanbevelingen opgesteld door AI",
  aanbevelingen_bewerkt: "Aanbevelingen bewerkt",
  aanbevelingen_goedgekeurd: "Aanbevelingen goedgekeurd",
  versie_teruggezet: "Eerdere versie van de resultaten teruggezet",
  rapport_gedownload: "Rapport gedownload",
  link_gemaakt: "Link gemaakt",
  link_gemaild: "Link per mail verstuurd",
  meting_vastgelegd: "Volwassenheidsmeting vastgelegd",
};

const kort = (v) => (typeof v === "string" ? v.slice(0, 200) : typeof v === "number" || typeof v === "boolean" ? v : undefined);

/** Zet een regel bovenaan het logboek. Onbekende handelingen en te lange waarden komen er niet in. */
export function voegToe(lijst, { actie, door = null, details = {} }, { nu = new Date() } = {}) {
  const bestaand = schoonLogboek(lijst);
  if (!(actie in ACTIES)) return bestaand;
  const schoon = {};
  for (const [k, v] of Object.entries(details ?? {}).slice(0, 8)) {
    const w = kort(v);
    if (w !== undefined && /^[a-zA-Z]{1,30}$/.test(k)) schoon[k] = w;
  }
  return [{ op: nu.toISOString(), actie, door: typeof door === "string" ? door.slice(0, 254) : null, details: schoon }, ...bestaand].slice(0, MAX_REGELS);
}

/** Alleen geldige regels, nieuwste eerst. */
export function schoonLogboek(lijst) {
  return (Array.isArray(lijst) ? lijst : [])
    .filter((r) => r && typeof r.op === "string" && r.actie in ACTIES)
    .slice(0, MAX_REGELS);
}

/** Eén leesbare regel voor het scherm: "Rapport gedownload (PDF, capaciteit)". */
export function regelTekst(regel) {
  const basis = ACTIES[regel.actie] ?? regel.actie;
  const d = Object.values(regel.details ?? {}).filter((v) => v !== "" && v !== null && v !== undefined);
  return d.length ? `${basis} (${d.join(", ")})` : basis;
}
