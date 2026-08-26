import test from "node:test";
import assert from "node:assert/strict";
import { matchOccupations, buildCandidateSkills, getSkill } from "./esco.js";
import { getTrainability } from "./trainability.js";

const besteMatch = (rolnaam) => matchOccupations(rolnaam, 1)[0]?.label ?? null;

test("herkenbare functietitels vinden hun ESCO-beroep", () => {
  assert.equal(besteMatch("accountmanager"), "accountmanager");
  assert.equal(besteMatch("recruiter"), "recruiter");
  assert.equal(besteMatch("salarisadministrateur"), "salarisadministrateur");
  assert.equal(besteMatch("marketingmedewerker"), "marketingmedewerker");
});

test("generieke functiewoorden bepalen de match niet", () => {
  // Regressie: "HR-adviseur" kwam uit op "adviseur intellectuele eigendom" omdat korte
  // tokens werden weggefilterd en "adviseur" even zwaar telde als een inhoudelijk woord.
  const match = besteMatch("HR-adviseur");
  assert.match(match, /personeel/i, `verwacht een personeelsrol, kreeg "${match}"`);
});

test("samengestelde woorden matchen op hun deel", () => {
  // Regressie: "beheerder" matchte niet op "systeembeheerder".
  const match = besteMatch("ICT-beheerder");
  assert.match(match, /systeembeheerder/i, `verwacht een systeembeheerder, kreeg "${match}"`);
});

test("de afdeling hoort de beroepsmatch niet te sturen", () => {
  // Regressie: het label mét afdeling maakte van een administratief medewerker een
  // financieel directeur. De matching hoort alleen naar de functietitel te kijken.
  assert.equal(besteMatch("Financieel administratief medewerker"), "administratief medewerker");
});

test("een lege of onbruikbare rolnaam levert geen match op", () => {
  assert.deepEqual(matchOccupations("", 3), []);
  assert.deepEqual(matchOccupations("!!", 3), []);
});

test("de kandidatenlijst blijft binnen de schemalimiet van de API", () => {
  // Boven ongeveer 160 waarden weigert de API het tool-schema te compileren.
  for (const rol of ["Software developer", "Klantenservice medewerker", "Accountmanager"]) {
    const pool = buildCandidateSkills(matchOccupations(rol, 3).map((b) => b.id));
    assert.ok(pool.length <= 150, `${rol}: ${pool.length} kandidaten`);
    assert.ok(pool.length > 50, `${rol}: te weinig kandidaten (${pool.length})`);
  }
});

test("elke kandidatenlijst bevat de niet-trainbare competenties", () => {
  // Zonder attitudes in de lijst kan de analyse nooit "toetsen bezetting" adviseren,
  // en belooft de tool dat alles met training op te lossen is.
  const pool = buildCandidateSkills(matchOccupations("Accountmanager", 3).map((b) => b.id));
  const attitudes = pool.filter((k) => getTrainability(getSkill(k.id)) === "laag");
  assert.ok(attitudes.length >= 20, `slechts ${attitudes.length} attitudes in de lijst`);
});

test("de gebundelde ESCO-dataset is compleet genoeg om op te bouwen", () => {
  const pool = buildCandidateSkills(matchOccupations("Klantenservice medewerker", 3).map((b) => b.id));
  assert.ok(pool.every((k) => k.label && k.id), "elke kandidaat heeft een label en id");
});
