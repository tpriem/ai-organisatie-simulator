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
