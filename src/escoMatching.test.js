import test from "node:test";
import assert from "node:assert/strict";
import { matchOccupations } from "./esco.js";

// Regressiesuite voor de beroepsmatching. Elke zaak hier is ooit fout gegaan op echte
// of plausibele functietitels. De match bepaalt uit welke competentiepool de analyse
// kiest, dus een misser hier maakt alle competentie-uitspraken over die rol onbetrouwbaar.

const beste = (rolnaam) => matchOccupations(rolnaam, 1)[0] ?? null;
const topLabels = (rolnaam, n = 5) => matchOccupations(rolnaam, n).map((m) => m.label);

function assertMatcht(rolnaam, patroon) {
  const m = beste(rolnaam);
  assert.ok(m, `geen match voor "${rolnaam}"`);
  assert.match(m.label, patroon, `"${rolnaam}" kwam uit op "${m.label}"`);
}

test("een generiek beroep wint van specifieke beroepen die het als alt-label dragen", () => {
  // "projectmanager" is zelf een ESCO-beroep, maar vier andere beroepen voeren het als
  // alt-label. Die wonnen de gelijkspel willekeurig — met "manager productontwikkeling
  // kleding" als uitkomst voor een gewone projectmanager.
  assertMatcht("Projectmanager", /^projectmanager$/i);
});

test("een leidinggevende rol matcht niet op een uitvoerende rol", () => {
  // "Manager Klantenservice" kwam uit op "vertegenwoordiger klantenservice": een
  // leidinggevende kreeg de competentiepool van een frontliniemedewerker.
  const m = beste("Manager Klantenservice");
  assert.doesNotMatch(m.label, /vertegenwoordiger|klantadviseur/i, `kwam uit op "${m.label}"`);
  assert.match(m.label, /manager|leider|hoofd|supervisor/i, `kwam uit op "${m.label}"`);
});

test("ook teamleider en hoofd gelden als leidinggevend", () => {
  for (const titel of ["Teamleider Klantenservice", "Hoofd Klantenservice"]) {
    const m = beste(titel);
    assert.doesNotMatch(m.label, /vertegenwoordiger klantenservice|klantadviseur/i, `${titel} -> ${m.label}`);
  }
});

test("Engelse functietitels vinden het Nederlandse beroep", () => {
  // "Software developer" kwam uit op "embedded systems software developer" (0,46),
  // een niche, omdat "developer" alleen in dat Engelse alt-label voorkwam.
  assert.match(beste("Software developer").label, /software\s*ontwikkelaar/i);
  assert.match(beste("Data analyst").label, /analist/i);
});

test("eerder gevonden fouten blijven opgelost", () => {
  // Generieke functiewoorden mogen de match niet bepalen.
  assertMatcht("HR-adviseur", /personeel/i);
  // Samengestelde woorden moeten op hun deel matchen.
  assertMatcht("ICT-beheerder", /systeembeheerder/i);
  // De afdeling hoort de match niet te sturen.
  assertMatcht("Financieel administratief medewerker", /administratief medewerker/i);
});

test("herkenbare titels blijven gewoon goed", () => {
  assertMatcht("accountmanager", /accountmanager/i);
  assertMatcht("recruiter", /recruiter/i);
  assertMatcht("Data analist", /data-?analist/i);
  assertMatcht("Operationeel manager", /operationeel manager|manager bedrijfseenheid/i);
});

test("een accountmanager geldt niet als leidinggevende", () => {
  // "manager" zit in het woord, maar het is geen leidinggevende rol. Zou de
  // leidinggevende-regel hierop aanslaan, dan gaat de match de verkeerde kant op.
  assert.match(beste("Accountmanager").label, /accountmanager/i);
});

test("een lege of onzinnige titel levert niets op", () => {
  assert.deepEqual(matchOccupations("", 3), []);
  assert.deepEqual(matchOccupations("!!", 3), []);
});

test("de topmatches bevatten geen duplicaten", () => {
  const labels = topLabels("Manager Klantenservice", 5);
  assert.equal(new Set(labels).size, labels.length);
});
