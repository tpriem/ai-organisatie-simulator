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
