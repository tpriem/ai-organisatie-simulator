import * as XLSX from "xlsx";

// Sjabloon voor het roster dat klanten aanleveren. Bestaat vooral om discussie over
// kolomnamen te voorkomen: de parser accepteert synoniemen, maar met een sjabloon hoeft
// niemand te raden. De voorbeeldregels laten meteen zien hoe "rapporteert aan" werkt,
// want dat is het veld waar het in de praktijk misgaat.

const KOLOMMEN = ["rolnaam", "fte", "uren_per_week", "kosten_per_uur", "afdeling", "rapporteert_aan"];

// Bewust géén voorbeeldregels op het invulblad: blijven die staan, dan belanden er
// verzonnen rollen in het rapport van de klant. Het uitgewerkte voorbeeld staat op het
// toelichtingsblad, waar het niet meegeparsed kan worden.
const TOELICHTING = [
  ["Roster — toelichting bij de kolommen"],
  [],
  ["Kolom", "Verplicht", "Toelichting"],
  ["rolnaam", "ja", "De functienaam. Rollen met dezelfde naam in verschillende afdelingen worden apart behandeld."],
  ["fte", "ja", "Aantal FTE in deze rol. Een getal groter dan 0, bijvoorbeeld 8 of 2,5."],
  ["uren_per_week", "ja", "Gemiddeld aantal uren per week per FTE, bijvoorbeeld 36."],
  ["kosten_per_uur", "ja", "Gemiddelde kosten per uur in euro's, inclusief werkgeverslasten."],
  ["afdeling", "nee", "Afdeling of business unit. Zonder deze kolom worden alle rollen als één geheel getoond."],
  [
    "rapporteert_aan",
    "nee",
    "De rolnaam van de leidinggevende, precies zoals die elders in de kolom rolnaam staat. Laat leeg voor de hoogste rol.",
  ],
  [],
  ["Voorbeeld — zo ziet een ingevuld roster eruit"],
  ["rolnaam", "fte", "uren_per_week", "kosten_per_uur", "afdeling", "rapporteert_aan"],
  ["Directeur", 1, 40, 90, "Directie", ""],
  ["Manager Klantenservice", 1, 38, 60, "Klantenservice", "Directeur"],
  ["Klantenservice medewerker", 8, 36, 28, "Klantenservice", "Manager Klantenservice"],
  ["Kwaliteitsmedewerker", 1, 36, 35, "Klantenservice", "Manager Klantenservice"],
  [],
  ["Aandachtspunten"],
  ["", "Vul per rol één regel in, niet per medewerker: 8 klantenservicemedewerkers zijn één regel met 8 FTE."],
  [
    "",
    "Verwijst rapporteert_aan naar een rolnaam die niet in het bestand staat, dan komt die rol bovenaan te hangen en verschijnt een waarschuwing in de analyse.",
  ],
  ["", "Lever per rol ook een functieprofiel aan (.docx, .pdf of .txt), met de rolnaam in de bestandsnaam."],
];

function metKolombreedtes(sheet, breedtes) {
  sheet["!cols"] = breedtes.map((w) => ({ wch: w }));
  return sheet;
}

/** Genereert het rostersjabloon als .xlsx buffer. */
export function generateRosterTemplate() {
  const wb = XLSX.utils.book_new();

  const roster = XLSX.utils.aoa_to_sheet([KOLOMMEN]);
  XLSX.utils.book_append_sheet(wb, metKolombreedtes(roster, [32, 8, 14, 15, 20, 26]), "Roster");

  const uitleg = XLSX.utils.aoa_to_sheet(TOELICHTING);
  XLSX.utils.book_append_sheet(wb, metKolombreedtes(uitleg, [30, 10, 95, 16, 20, 26]), "Toelichting");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
