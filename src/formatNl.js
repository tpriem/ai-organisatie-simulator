/**
 * Nederlandse getalnotatie: komma als decimaalteken, punt als duizendtal.
 *
 * In de app en de rapporten stond overal toFixed(), dus "6.4 FTE" en "match 0.84" in
 * rapporten voor Nederlandse klanten. Eén functie voor alle weergave voorkomt dat dat
 * per plek anders wordt opgelost. Intl is de standaard en hoeft niet zelf te worden
 * nagebouwd; Node en de browser leveren nl-NL beide mee.
 */
export function nl(waarde, decimalen = 1) {
  if (typeof waarde !== "number" || !Number.isFinite(waarde)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: decimalen,
    maximumFractionDigits: decimalen,
  }).format(waarde);
}

/**
 * Een bedrag in euro's, kort: "€420k" of "€1,2 mln". Voor kaarten en tabellen waar een precies
 * bedrag schijnnauwkeurigheid zou geven: het zijn inschattingen.
 */
export function euroKort(bedrag) {
  if (typeof bedrag !== "number" || !Number.isFinite(bedrag)) return "—";
  const abs = Math.abs(bedrag);
  if (abs >= 1_000_000) return `€${nl(bedrag / 1_000_000, 1)} mln`;
  if (abs >= 1000) return `€${Math.round(bedrag / 1000).toLocaleString("nl-NL")}k`;
  return `€${Math.round(bedrag).toLocaleString("nl-NL")}`;
}

// Totalen voor de hele organisatie zijn een optelsom van inschattingen. "59,9 FTE" suggereert een
// precisie die er niet is; daarom worden kopgetallen afgerond en als bandbreedte getoond (realistisch
// tot ambitieus). Per functie blijft één decimaal staan, anders verdwijnen kleine functies.

/** Een FTE-getal voor een kopcijfer: vanaf 10 op hele FTE, daaronder op één decimaal. */
export function fteRond(fte) {
  if (typeof fte !== "number" || !Number.isFinite(fte)) return "—";
  return Math.abs(fte) >= 10 ? nl(Math.round(fte), 0) : nl(fte, 1);
}

/** De bandbreedte tussen twee scenario's: "60–86 FTE", of één getal als ze afgerond gelijk zijn. */
export function fteBereik(realistisch, ambitieus) {
  const a = fteRond(realistisch);
  const b = fteRond(ambitieus);
  if (a === "—") return "—";
  return b === "—" || a === b ? `${a} FTE` : `${a}–${b} FTE`;
}

/** Uren per week voor een kopcijfer: vanaf 100 op tientallen, met punt als duizendtal. */
export function urenRond(uren) {
  if (typeof uren !== "number" || !Number.isFinite(uren)) return "—";
  return nl(Math.abs(uren) >= 100 ? Math.round(uren / 10) * 10 : Math.round(uren), 0);
}
