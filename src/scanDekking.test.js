import test from "node:test";
import assert from "node:assert/strict";
import { calculateScanDekking, matchKwaliteit } from "./scanDekking.js";

const rol = (rolnaam, { score = 1, ongematcht = 0, taken = 5 } = {}) => ({
  rolnaam,
  roleLabel: rolnaam,
  beroepsmatch: score === null ? null : { id: "x", label: `beroep ${rolnaam}`, score },
  ongematchteTaken: ongematcht,
  scenarios: { realistisch: { taken: Array.from({ length: taken }, (_, i) => ({ omschrijving: `T${i}` })) } },
});

test("matchkwaliteit kent drie niveaus", () => {
  assert.equal(matchKwaliteit(1), "sterk");
  assert.equal(matchKwaliteit(0.8), "sterk");
  assert.equal(matchKwaliteit(0.61), "matig");
  assert.equal(matchKwaliteit(0.46), "zwak");
});

test("zonder score geen oordeel", () => {
  assert.equal(matchKwaliteit(null), null);
  assert.equal(matchKwaliteit(undefined), null);
  assert.equal(matchKwaliteit("0.9"), null, "een string is geen score");
});

test("alles onder sterk komt bij de twijfelgevallen", () => {
  // Precies het geval uit de praktijk: een manager die op een frontlinierol matcht (0,61)
  // en een developer op een niche (0,46). Beide bepalen de competentiepool.
  const d = calculateScanDekking({
    rollen: [rol("Directeur", { score: 1 }), rol("Manager", { score: 0.61 }), rol("Developer", { score: 0.46 })],
  });
  assert.equal(d.zwakkeMatches.length, 2);
  assert.deepEqual(
    d.zwakkeMatches.map((m) => m.rolnaam),
    ["Manager", "Developer"]
  );
});

test("taakdekking telt over alle rollen", () => {
  const d = calculateScanDekking({
    rollen: [rol("A", { taken: 6, ongematcht: 1 }), rol("B", { taken: 4, ongematcht: 0 })],
  });
  assert.equal(d.takenTotaal, 10);
  assert.equal(d.ongematchteTaken, 1);
  assert.ok(Math.abs(d.taakdekking - 0.9) < 1e-9);
});

test("volledige dekking levert 1, geen null", () => {
  const d = calculateScanDekking({ rollen: [rol("A", { taken: 5, ongematcht: 0 })] });
  assert.equal(d.taakdekking, 1);
});

test("ontbrekende profielen en mislukte rollen komen mee", () => {
  const d = calculateScanDekking({
    rollen: [rol("A")],
    missingProfiles: ["Stagiair", "Receptionist"],
    mislukteRollen: [{ roleLabel: "Jurist", fout: "tijdslimiet" }],
  });
  assert.equal(d.ontbrekendeProfielen.length, 2);
  assert.equal(d.mislukteRollen.length, 1);
});

test("een rol zonder beroepsmatch telt niet als twijfelgeval maar wordt wel gemeld", () => {
  const d = calculateScanDekking({ rollen: [rol("A", { score: null })] });
  assert.equal(d.matches[0].beroep, null);
  assert.equal(d.matches[0].kwaliteit, null);
  assert.equal(d.zwakkeMatches.length, 0);
  assert.equal(d.heeftMatchdata, false);
});

test("lege of ontbrekende resultaten geven geen fout", () => {
  const leeg = calculateScanDekking({});
  assert.equal(leeg.rollen, 0);
  assert.equal(leeg.taakdekking, null);
  assert.equal(calculateScanDekking(null).rollen, 0);
});
