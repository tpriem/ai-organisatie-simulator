import test from "node:test";
import assert from "node:assert/strict";
import { parseProfileFiles, profielenOpNaam, matchRosterToProfiles } from "./parseProfiles.js";

const namen = [
  "woonconsulent.txt",
  "coordinator onderhoud.txt", // zoals de opslag hem bewaart: zonder accent
  "medewerker financial planning _ control.txt",
  "Wonen_planner.md",
  "notities.xlsx", // geen profiel
];
const roster = [
  { rolnaam: "woonconsulent", afdeling: "Wonen" },
  { rolnaam: "coördinator onderhoud", afdeling: "Vastgoed" },
  { rolnaam: "medewerker financial planning & control", afdeling: "Financiën" },
  { rolnaam: "planner", afdeling: "Wonen" },
  { rolnaam: "directeur", afdeling: "Bestuur" },
];

test("de koppeling op bestandsnaam geeft hetzelfde resultaat als het inlezen van de bestanden", async () => {
  const inhoud = namen
    .filter((n) => !n.endsWith(".xlsx"))
    .map((fileName) => ({ fileName, buffer: Buffer.from(`Functieprofiel: ${fileName}\n\nKerntaken:\n- iets`) }));
  const gelezen = matchRosterToProfiles(roster, await parseProfileFiles(inhoud));
  const opNaam = matchRosterToProfiles(roster, profielenOpNaam(namen));

  assert.deepEqual(opNaam.matched.map((r) => r.rolnaam), gelezen.matched.map((r) => r.rolnaam));
  assert.deepEqual(opNaam.missing, gelezen.missing);
  assert.deepEqual(opNaam.missing, ["directeur (Bestuur)"], "alleen de directeur heeft geen profiel");
});

test("bestanden die geen profiel kunnen zijn doen niet mee", () => {
  assert.deepEqual(Object.keys(profielenOpNaam(["a.xlsx", "b.exe", "c.docx"])), ["c"]);
  assert.deepEqual(profielenOpNaam([]), {});
});

test("de opgeschoonde opslagnaam koppelt aan dezelfde rol als de oorspronkelijke naam", () => {
  const { matched } = matchRosterToProfiles(
    [{ rolnaam: "hoofd financiële administratie", afdeling: "Financiën" }],
    profielenOpNaam(["hoofd financiele administratie.txt"])
  );
  assert.equal(matched.length, 1);
});
