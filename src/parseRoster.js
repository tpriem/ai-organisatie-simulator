import fs from "node:fs";
import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

const REQUIRED_COLUMNS = ["rolnaam", "fte", "uren_per_week", "kosten_per_uur"];

const HEADER_ALIASES = {
  rolnaam: ["rolnaam", "rol", "functie", "role"],
  fte: ["fte", "aantal_fte", "aantal fte"],
  uren_per_week: ["uren_per_week", "uren per week", "gemiddeld_aantal_uren_per_week", "hours_per_week"],
  kosten_per_uur: ["kosten_per_uur", "kosten per uur", "gemiddelde_kosten_per_uur", "cost_per_hour"],
};

function normalizeHeader(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, "_");
}

function mapRow(rawRow) {
  const normalized = {};
  for (const [key, value] of Object.entries(rawRow)) {
    normalized[normalizeHeader(key)] = value;
  }

  const row = {};
  for (const col of REQUIRED_COLUMNS) {
    const alias = HEADER_ALIASES[col].map(normalizeHeader).find((a) => a in normalized);
    if (!alias) {
      throw new Error(
        `Kolom voor "${col}" niet gevonden. Verwachte headers: ${HEADER_ALIASES[col].join(", ")}`
      );
    }
    row[col] = normalized[alias];
  }
  return row;
}

/**
 * Leest een roster-bestand (.csv of .xlsx) met kolommen:
 * rolnaam, fte, uren_per_week, kosten_per_uur
 */
export function parseRoster(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  let rawRows;

  if (ext === ".csv") {
    const content = fs.readFileSync(filePath, "utf-8");
    rawRows = parseCsv(content, { columns: true, skip_empty_lines: true, trim: true });
  } else if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    throw new Error(`Onbekend bestandstype voor roster: ${ext}. Gebruik .csv of .xlsx.`);
  }

  if (rawRows.length === 0) {
    throw new Error(`Roster-bestand "${filePath}" bevat geen rijen.`);
  }

  return rawRows.map((rawRow, idx) => {
    let row;
    try {
      row = mapRow(rawRow);
    } catch (err) {
      throw new Error(`Rij ${idx + 2} in ${filePath}: ${err.message}`);
    }

    const fte = Number(row.fte);
    const urenPerWeek = Number(row.uren_per_week);
    const kostenPerUur = Number(row.kosten_per_uur);
    const rolnaam = String(row.rolnaam).trim();

    if (!rolnaam) throw new Error(`Rij ${idx + 2}: rolnaam ontbreekt.`);
    if (!Number.isFinite(fte) || fte <= 0) throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige FTE "${row.fte}".`);
    if (!Number.isFinite(urenPerWeek) || urenPerWeek <= 0)
      throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige uren_per_week "${row.uren_per_week}".`);
    if (!Number.isFinite(kostenPerUur) || kostenPerUur <= 0)
      throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige kosten_per_uur "${row.kosten_per_uur}".`);

    return { rolnaam, fte, urenPerWeek, kostenPerUur };
  });
}
