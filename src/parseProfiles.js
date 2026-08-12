import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const SUPPORTED_EXT = [".docx", ".pdf", ".txt", ".md"];

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function readProfileFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const { text } = await pdfParse(buffer);
    return text;
  }
  if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  }
  throw new Error(`Onbekend bestandstype voor functieprofiel: ${ext}`);
}

/**
 * Leest alle functieprofielen uit een map en geeft { slug -> { fileName, text } } terug.
 */
export async function parseProfilesDir(dirPath) {
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => SUPPORTED_EXT.includes(path.extname(f).toLowerCase()));

  if (files.length === 0) {
    throw new Error(`Geen functieprofielen gevonden in ${dirPath} (verwacht .docx, .pdf, .txt of .md).`);
  }

  const profiles = {};
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const text = (await readProfileFile(fullPath)).trim();
    const baseName = path.basename(file, path.extname(file));
    profiles[slugify(baseName)] = { fileName: file, roleNameGuess: baseName, text };
  }
  return profiles;
}

export { slugify };

/**
 * Matcht roster-rollen aan functieprofielen op basis van geslugificeerde naam.
 * Geeft { matched: [{rolnaam, profile}], missing: [rolnaam] } terug.
 */
export function matchRosterToProfiles(rosterRows, profiles) {
  const matched = [];
  const missing = [];

  for (const row of rosterRows) {
    const slug = slugify(row.rolnaam);
    const profile = profiles[slug];
    if (profile) {
      matched.push({ ...row, profile });
    } else {
      missing.push(row.rolnaam);
    }
  }

  return { matched, missing };
}
