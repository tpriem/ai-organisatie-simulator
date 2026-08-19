// Puur string-logica, geen Node-only afhankelijkheden — mag zowel server- als
// client-side (browser) geïmporteerd worden, o.a. door calculate.js voor
// live herberekening in de UI.

export function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Geeft het label terug waaronder een roster-rij getoond wordt (incl. afdeling indien aanwezig).
 */
export function roleLabel(row) {
  return row.afdeling ? `${row.rolnaam} (${row.afdeling})` : row.rolnaam;
}

/**
 * Stabiele identiteit voor een rol binnen één analyse — voorkomt dat twee rollen met
 * dezelfde naam in verschillende afdelingen elkaars UI-state/rapportsecties overschrijven.
 */
export function roleId(row) {
  return row.afdeling ? `${slugify(row.afdeling)}::${slugify(row.rolnaam)}` : slugify(row.rolnaam);
}
