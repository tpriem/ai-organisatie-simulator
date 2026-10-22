import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Persoonlijke links voor klanten: een invullink per invuller voor de vragenlijst en een
 * aanleverlink voor de uploads. Alleen op de server te gebruiken (gebruikt node:crypto).
 *
 * Een link ziet er zo uit: /invullen/<klantId>.<geheim> of /aanleveren/<klantId>.<geheim>.
 *  - Het klantId maakt de link herkenbaar voor ons systeem en zorgt dat alles bij de juiste
 *    klant terechtkomt. Het is zelf geen geheim.
 *  - Het geheim is een lange willekeurige code die toegang geeft. In de opslag staat alleen de
 *    hash ervan; verloren is dus echt verloren en wordt vervangen door een nieuwe link.
 *  - Een link geeft alleen toegang tot het invullen van één vragenlijst of het aanleveren van
 *    bestanden voor die ene klant. Nooit tot resultaten of andere klanten.
 */

export const LINK_TYPES = ["invuller", "aanlever"];
export const STANDAARD_GELDIG_DAGEN = 45;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GEHEIM = /^[A-Za-z0-9_-]{32}$/;

export const hashGeheim = (geheim) => createHash("sha256").update(geheim).digest("hex");

/** Maakt een nieuw token voor een klant. Het geheim wordt alleen hier één keer teruggegeven. */
export function maakToken(klantId) {
  if (!UUID.test(klantId)) throw new Error("Ongeldig klant-id");
  const geheim = randomBytes(24).toString("base64url"); // 32 tekens
  return { token: `${klantId}.${geheim}`, geheim, hash: hashGeheim(geheim) };
}

/** Splitst een token uit een URL. Null als het niet op een token lijkt. */
export function splitsToken(token) {
  if (typeof token !== "string") return null;
  const punt = token.indexOf(".");
  if (punt < 0) return null;
  const klantId = token.slice(0, punt);
  const geheim = token.slice(punt + 1);
  if (!UUID.test(klantId) || !GEHEIM.test(geheim)) return null;
  return { klantId: klantId.toLowerCase(), geheim };
}

/** Vergelijkt een geheim met een bewaarde hash, in constante tijd. */
export function geheimKlopt(geheim, bewaardeHash) {
  if (typeof geheim !== "string" || typeof bewaardeHash !== "string") return false;
  const a = Buffer.from(hashGeheim(geheim), "hex");
  const b = Buffer.from(bewaardeHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Een nieuw linkrecord. `hash` komt uit maakToken. */
export function nieuweLink({ type, hash, rol = null, label = "", invullerId = null, nu = new Date(), geldigDagen = STANDAARD_GELDIG_DAGEN }) {
  if (!LINK_TYPES.includes(type)) throw new Error(`Onbekend linktype: ${type}`);
  if (type === "invuller" && !invullerId) throw new Error("Een invullink hoort bij een invuller");
  return {
    id: randomBytes(8).toString("hex"),
    type,
    hash,
    rol: type === "invuller" ? rol : null,
    label: String(label ?? "").trim().slice(0, 60),
    invullerId: type === "invuller" ? invullerId : null,
    aangemaaktOp: nu.toISOString(),
    verlooptOp: new Date(nu.getTime() + geldigDagen * 86_400_000).toISOString(),
    ingetrokken: false,
    laatsteGebruik: null,
  };
}

/** Is de link bruikbaar? Niet ingetrokken en niet verlopen. */
export function linkActief(link, nu = new Date()) {
  return Boolean(link) && link.ingetrokken !== true && new Date(link.verlooptOp).getTime() > nu.getTime();
}

/** Wat de adviseur van een link te zien krijgt: nooit de hash. */
export function publiekeWeergave(link, nu = new Date()) {
  const { hash: _hash, ...rest } = link;
  return { ...rest, actief: linkActief(link, nu) };
}

// ---- Bestanden die via de aanleverlink binnenkomen --------------------------------------------

export const UPLOAD_LIMIETEN = {
  // Vercel accepteert aanvragen tot 4,5 MB; daaronder blijven we, inclusief de opmaak van de aanvraag.
  maxBytesPerBestand: 4 * 1024 * 1024,
  maxBestanden: 80,
  maxTotaalBytes: 150 * 1024 * 1024,
};

export const BESTAND_SOORTEN = {
  roster: { extensies: [".csv", ".xlsx", ".xls"], max: 1, omschrijving: "functieoverzicht (CSV of Excel)" },
  profiel: { extensies: [".docx", ".pdf", ".txt", ".md"], max: 60, omschrijving: "functieprofiel (Word, PDF of tekst)" },
};

/** Een veilige bestandsnaam: geen pad, geen vreemde tekens, begrensde lengte. Null als er niets over blijft. */
export function schoneBestandsnaam(naam) {
  if (typeof naam !== "string") return null;
  const basis = naam.split(/[\\/]/).pop().normalize("NFKC");
  const punt = basis.lastIndexOf(".");
  const stam = (punt > 0 ? basis.slice(0, punt) : basis).replace(/[^\p{L}\p{N} _.()-]+/gu, "_").replace(/\.+/g, ".").trim().slice(0, 80);
  const ext = punt > 0 ? basis.slice(punt).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8) : "";
  if (!stam || stam === "." || !ext) return null;
  return `${stam}${ext}`;
}

/** Controleert soort, extensie en grootte. Geeft { ok, fout? }. */
export function controleerBestand({ soort, naam, bytes }) {
  const regel = BESTAND_SOORTEN[soort];
  if (!regel) return { ok: false, fout: "Onbekend soort bestand." };
  const schoon = schoneBestandsnaam(naam);
  if (!schoon) return { ok: false, fout: "De bestandsnaam is ongeldig." };
  const ext = schoon.slice(schoon.lastIndexOf(".")).toLowerCase();
  if (!regel.extensies.includes(ext)) return { ok: false, fout: `Dit bestandstype wordt niet geaccepteerd. Toegestaan: ${regel.extensies.join(", ")}.` };
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, fout: "Het bestand is leeg." };
  if (bytes > UPLOAD_LIMIETEN.maxBytesPerBestand) return { ok: false, fout: "Het bestand is te groot (maximaal 4 MB). Verklein het bestand of splits het op." };
  return { ok: true, naam: schoon };
}

/**
 * Past de inhoud van een bestand bij wat de extensie belooft? Dit voorkomt dat een hernoemd
 * programma of een ander bestandstype als functieprofiel binnenkomt. Het is geen virusscan.
 */
export function inhoudKlopt(naam, buffer) {
  const ext = String(naam).slice(String(naam).lastIndexOf(".")).toLowerCase();
  const kop = buffer.subarray(0, 8);
  if (ext === ".pdf") return kop.subarray(0, 5).toString("latin1") === "%PDF-";
  if (ext === ".docx" || ext === ".xlsx") return kop[0] === 0x50 && kop[1] === 0x4b; // zipbestand ("PK")
  if (ext === ".xls") return kop[0] === 0xd0 && kop[1] === 0xcf && kop[2] === 0x11 && kop[3] === 0xe0; // oud Excel-formaat
  if (ext === ".csv" || ext === ".txt" || ext === ".md") return !buffer.subarray(0, 4096).includes(0); // tekst heeft geen nulbytes
  return false;
}
