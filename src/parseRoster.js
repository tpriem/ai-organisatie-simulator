import path from "node:path";
import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

const REQUIRED_COLUMNS = ["rolnaam", "fte", "uren_per_week", "kosten_per_uur"];
const OPTIONAL_COLUMNS = ["afdeling", "rapporteert_aan"];

const HEADER_ALIASES = {
  rolnaam: ["rolnaam", "rol", "functie", "role"],
  fte: ["fte", "aantal_fte", "aantal fte"],
  uren_per_week: ["uren_per_week", "uren per week", "gemiddeld_aantal_uren_per_week", "hours_per_week"],
  kosten_per_uur: ["kosten_per_uur", "kosten per uur", "gemiddelde_kosten_per_uur", "cost_per_hour"],
  afdeling: ["afdeling", "business_unit", "businessunit", "unit", "department", "afdeling/business_unit"],
  // Verwijst naar de rolnaam van de leidinggevende, zoals die elders in het roster staat.
  rapporteert_aan: [
    "rapporteert_aan",
    "rapporteert aan",
    "leidinggevende",
    "manager",
    "reports_to",
    "reports to",
    "rapporteert_aan_rol",
  ],
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
  for (const col of OPTIONAL_COLUMNS) {
    const alias = HEADER_ALIASES[col].map(normalizeHeader).find((a) => a in normalized);
    row[col] = alias ? normalized[alias] : "";
  }
  return row;
}

/**
 * Leest een roster-bestand (.csv of .xlsx) met kolommen:
 * rolnaam, fte, uren_per_week, kosten_per_uur
 * @param {Buffer} buffer - bestandsinhoud
 * @param {string} fileName - oorspronkelijke bestandsnaam (voor extensie + foutmeldingen)
 */
export function parseRoster(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  let rawRows;

  if (ext === ".csv") {
    rawRows = parseCsv(buffer.toString("utf-8"), { columns: true, skip_empty_lines: true, trim: true });
  } else if (ext === ".xlsx" || ext === ".xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    throw new Error(`Onbekend bestandstype voor roster: ${ext}. Gebruik .csv of .xlsx.`);
  }

  if (rawRows.length === 0) {
    throw new Error(`Roster-bestand "${fileName}" bevat geen rijen.`);
  }

  return rawRows.map((rawRow, idx) => {
    let row;
    try {
      row = mapRow(rawRow);
    } catch (err) {
      throw new Error(`Rij ${idx + 2} in ${fileName}: ${err.message}`);
    }

    const fte = Number(row.fte);
    const urenPerWeek = Number(row.uren_per_week);
    const kostenPerUur = Number(row.kosten_per_uur);
    const rolnaam = String(row.rolnaam).trim();
    const afdeling = String(row.afdeling ?? "").trim();
    const rapporteertAan = String(row.rapporteert_aan ?? "").trim();

    if (!rolnaam) throw new Error(`Rij ${idx + 2}: rolnaam ontbreekt.`);
    if (!Number.isFinite(fte) || fte <= 0) throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige FTE "${row.fte}".`);
    if (!Number.isFinite(urenPerWeek) || urenPerWeek <= 0)
      throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige uren_per_week "${row.uren_per_week}".`);
    if (!Number.isFinite(kostenPerUur) || kostenPerUur <= 0)
      throw new Error(`Rij ${idx + 2} (${rolnaam}): ongeldige kosten_per_uur "${row.kosten_per_uur}".`);

    if (rapporteertAan && rapporteertAan.toLowerCase() === rolnaam.toLowerCase()) {
      throw new Error(`Rij ${idx + 2} (${rolnaam}): rapporteert aan zichzelf.`);
    }

    return { rolnaam, fte, urenPerWeek, kostenPerUur, afdeling, rapporteertAan };
  });
}
