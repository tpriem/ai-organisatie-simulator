import test from "node:test";
import assert from "node:assert/strict";
import { calculateCompetentieProfiel } from "./competencyProfile.js";

// Klantenservicerol waarin het belwerk grotendeels wegvalt — het scenario waar de hele
// module om draait: de rol krimpt niet alleen, hij verandert van aard.
const taken = [
  { omschrijving: "Telefonisch klantcontact", aandeel: 0.8, automatiseringspercentage: 0.85 },
  { omschrijving: "E-mailafhandeling", aandeel: 0.1, automatiseringspercentage: 0.6 },
  { omschrijving: "Complexe klachten", aandeel: 0.1, automatiseringspercentage: 0.2 },
];

const taakCompetenties = [
  { taakIndex: 0, competenties: ["communiceren met klanten"] },
  { taakIndex: 1, competenties: ["communiceren met klanten"] },
  { taakIndex: 2, competenties: ["omgaan met klachten"] },
];

const nieuweCompetenties = [
  { naam: "AI-output beoordelen", belang: 5 },
  { naam: "omgaan met onzekerheid", belang: 3 },
];

const meta = {
  "communiceren met klanten": { type: "competence", reuse: "cross-sector", cat: null },
  "omgaan met klachten": { type: "competence", reuse: "sector-specific", cat: null },
  "AI-output beoordelen": { type: "knowledge", reuse: "cross-sector", cat: null },
  "omgaan met onzekerheid": { type: "competence", reuse: "transversal", cat: "attitudes" },
};

const som = (lijst) => lijst.reduce((s, c) => s + c.aandeel, 0);

test("beide profielen zijn genormaliseerde verdelingen", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, meta);
  assert.ok(Math.abs(som(r.profielNu) - 1) < 1e-9, "profielNu telt op tot 1");
  assert.ok(Math.abs(som(r.profielStraks) - 1) < 1e-9, "profielStraks telt op tot 1");
});

test("overlap en tekort vullen samen het geheel", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, meta);
  const tekort = [...r.teOntwikkelen, ...r.teToetsen].reduce((s, c) => s + c.pct, 0);
  // Afrondingsruis van hooguit een procentpunt per post is acceptabel.
  assert.ok(Math.abs(r.overlapPct + tekort - 100) <= 2, `overlap ${r.overlapPct} + tekort ${tekort} ≈ 100`);
});

test("overlap na training ligt tussen de overlap en 100 procent", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, meta);
  assert.ok(r.overlapNaTrainingPct >= r.overlapPct);
  assert.ok(r.overlapNaTrainingPct <= 100);
});

test("nieuwe competenties verschijnen alleen in het toekomstprofiel", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, meta);
  const nu = r.profielNu.map((c) => c.naam);
  const straks = r.profielStraks.map((c) => c.naam);
  assert.ok(straks.includes("AI-output beoordelen"), "nieuwe competentie zit in straks");
  assert.ok(!nu.includes("AI-output beoordelen"), "nieuwe competentie zit niet in nu");
});

test("niet-trainbare competenties komen bij te toetsen, niet bij te ontwikkelen", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, meta);
  assert.ok(
    r.teToetsen.some((c) => c.naam === "omgaan met onzekerheid"),
    "attitude staat bij te toetsen"
  );
  assert.ok(
    !r.teOntwikkelen.some((c) => c.naam === "omgaan met onzekerheid"),
    "attitude staat niet bij te ontwikkelen"
  );
});

test("zonder trainbaarheidsgegevens wordt geen belofte gedaan over training", () => {
  // Analyses van vóór de ESCO-koppeling: liever geen cijfer dan een te optimistisch cijfer.
  const r = calculateCompetentieProfiel(taken, taakCompetenties, nieuweCompetenties, {});
  assert.equal(r.overlapNaTrainingPct, null);
  assert.equal(r.heeftTrainbaarheidsdata, false);
});

test("zonder bruikbare invoer volgt null in plaats van een leeg profiel", () => {
  assert.equal(calculateCompetentieProfiel([], [], [], {}), null);
  assert.equal(calculateCompetentieProfiel(taken, [], [], meta), null);
  assert.equal(calculateCompetentieProfiel(null, null, null, null), null);
});

test("een taakverwijzing buiten de lijst wordt genegeerd in plaats van te crashen", () => {
  const metOnzin = [...taakCompetenties, { taakIndex: 99, competenties: ["bestaat niet"] }];
  const r = calculateCompetentieProfiel(taken, metOnzin, nieuweCompetenties, meta);
  assert.ok(r !== null);
  assert.ok(!r.profielNu.some((c) => c.naam === "bestaat niet"));
});

test("zonder nieuwe competenties blijft het toekomstprofiel bruikbaar", () => {
  const r = calculateCompetentieProfiel(taken, taakCompetenties, [], meta);
  assert.ok(Math.abs(som(r.profielStraks) - 1) < 1e-9);
  assert.ok(r.overlapPct > 0);
});
