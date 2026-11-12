import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { slugify, roleLabel, roleId } from "./roleIdentity.js";

const SUPPORTED_EXT = [".docx", ".pdf", ".txt", ".md"];

export { SUPPORTED_EXT, slugify, roleLabel, roleId };

async function readProfileBuffer(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  if (ext === ".pdf") {
    const { text } = await pdfParse(buffer);
    return text;
  }
  if (ext === ".txt" || ext === ".md") {
    return buffer.toString("utf-8");
  }
  throw new Error(`Onbekend bestandstype voor functieprofiel: ${ext}`);
}

/**
 * Leest een set functieprofielen (bestandsnaam + buffer) en geeft { slug -> { fileName, text } } terug.
 * @param {{ fileName: string, buffer: Buffer }[]} files
 */
export async function parseProfileFiles(files) {
  const supported = files.filter((f) => SUPPORTED_EXT.includes(path.extname(f.fileName).toLowerCase()));

  if (supported.length === 0) {
    throw new Error(`Geen functieprofielen gevonden (verwacht .docx, .pdf, .txt of .md).`);
  }

  const profiles = {};
  for (const { fileName, buffer } of supported) {
    const text = (await readProfileBuffer(buffer, fileName)).trim();
    const baseName = path.basename(fileName, path.extname(fileName));
    profiles[slugify(baseName)] = { fileName, roleNameGuess: baseName, text };
  }
  return profiles;
}

/**
 * De profielen op bestandsnaam, zonder de bestanden te lezen. De koppeling aan een rol gaat alleen op naam
 * (zie matchRosterToProfiles); de inhoud is pas nodig bij de analyse. Zo hoeft het overzicht van een klant
 * niet tientallen bestanden te downloaden. Of een bestand leesbaar is, blijkt dus pas bij de analyse.
 * @param {string[]} fileNames
 */
export function profielenOpNaam(fileNames) {
  const profielen = {};
  for (const fileName of fileNames) {
    if (!SUPPORTED_EXT.includes(path.extname(fileName).toLowerCase())) continue;
    const baseName = path.basename(fileName, path.extname(fileName));
    profielen[slugify(baseName)] = { fileName, roleNameGuess: baseName, text: "" };
  }
  return profielen;
}

/**
 * Matcht roster-rollen aan functieprofielen.
 *
 * Zonder afdeling: matcht op geslugificeerde rolnaam (ongewijzigd gedrag).
 * Met afdeling: zoekt eerst een afdeling-specifiek profiel ("<afdeling>_<rolnaam>" of
 * "<rolnaam>_<afdeling>" als bestandsnaam), en valt terug op een gedeeld profiel op
 * rolnaam alleen als dat niet bestaat — zo kan dezelfde rolnaam in twee afdelingen naar
 * twee verschillende profielen wijzen wanneer de taken echt verschillen.
 *
 * Geeft { matched: [{...row, profile}], missing: [roleLabel] } terug.
 */
export function matchRosterToProfiles(rosterRows, profiles) {
  const matched = [];
  const missing = [];

  for (const row of rosterRows) {
    const rolSlug = slugify(row.rolnaam);
    let profile = null;

    if (row.afdeling) {
      const afdSlug = slugify(row.afdeling);
      profile = profiles[`${afdSlug}_${rolSlug}`] ?? profiles[`${rolSlug}_${afdSlug}`] ?? profiles[rolSlug] ?? null;
    } else {
      profile = profiles[rolSlug] ?? null;
    }

    if (profile) {
      matched.push({ ...row, profile });
    } else {
      missing.push(roleLabel(row));
    }
  }

  return { matched, missing };
}
