import test from "node:test";
import assert from "node:assert/strict";
import { bouwRosterCheck } from "./klantOverzicht.js";
import { parseRoster } from "./parseRoster.js";

const CSV = `rolnaam,fte,uren_per_week,kosten_per_uur,afdeling,rapporteert_aan
directeur,1,36,79,Bestuur,
woonconsulent,12,36,31,Wonen,directeur
coördinator onderhoud,2,36,42,Vastgoed,directeur
medewerker financial planning & control,2,36,48,Financiën,directeur
`;
const rows = () => parseRoster(Buffer.from(CSV), "roster.csv");

test("welke rollen een profiel hebben volgt uit de bestandsnamen, ook na het opschonen van accenten en &", () => {
  // Zo staan de namen in de opslag: zonder accent, en & vervangen door een streepje.
  const c = bouwRosterCheck(rows(), ["woonconsulent.txt", "coordinator onderhoud.txt", "medewerker financial planning _ control.txt"]);
  assert.equal(c.totaalRollen, 4);
  assert.equal(c.gekoppeld, 3);
  assert.deepEqual(c.zonderProfiel, ["directeur (Bestuur)"]);
  assert.equal(c.rollen.find((r) => r.rolnaam === "coördinator onderhoud").gekoppeld, true);
});

test("zonder profielen is geen enkele rol gekoppeld en staan alle rollen in de lijst zonder profiel", () => {
  const c = bouwRosterCheck(rows(), []);
  assert.equal(c.gekoppeld, 0);
  assert.equal(c.zonderProfiel.length, 4);
  assert.equal(bouwRosterCheck(rows(), null).gekoppeld, 0);
});

test("een profiel dat twee keer past telt de rol één keer", () => {
  const c = bouwRosterCheck(rows(), ["woonconsulent.txt", "Wonen_woonconsulent.docx"]);
  assert.equal(c.gekoppeld, 1);
});

test("de totalen en subtotalen per afdeling komen uit het functieoverzicht", () => {
  const c = bouwRosterCheck(rows(), []);
  assert.equal(c.totalen.totaalFte, 17);
  assert.equal(c.totalen.gewogenUrenPerWeek, 36);
  assert.equal(Math.round(c.totalen.totaalLoonkostenPerJaar), Math.round((1 * 79 + 12 * 31 + 2 * 42 + 2 * 48) * 36 * 52));
  assert.deepEqual(c.subtotalenPerAfdeling.map((s) => [s.afdeling, s.aantalRollen, s.totaalFte]), [
    ["Bestuur", 1, 1],
    ["Wonen", 1, 12],
    ["Vastgoed", 1, 2],
    ["Financiën", 1, 2],
  ]);
});

test("zonder afdelingen zijn er geen subtotalen", () => {
  const zonder = parseRoster(Buffer.from("rolnaam,fte,uren_per_week,kosten_per_uur\nplanner,4,36,29\n"), "r.csv");
  assert.deepEqual(bouwRosterCheck(zonder, ["planner.txt"]).subtotalenPerAfdeling, []);
});
