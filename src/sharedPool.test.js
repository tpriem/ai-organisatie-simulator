import test from "node:test";
import assert from "node:assert/strict";
import { matchOccupations, buildCandidateSkills, buildSharedCandidateSkills } from "./esco.js";

const occsVoor = (rolnaam) => matchOccupations(rolnaam, 3).map((b) => b.id);

const ROLLEN = [
  "Directeur",
  "Manager Klantenservice",
  "Klantenservice medewerker",
  "Financieel administratief medewerker",
  "Accountmanager",
  "Software developer",
];

test("alle rollen krijgen exact dezelfde woordenschat", () => {
  // Dit is het hele punt: zonder één pool beschrijven rollen hetzelfde vermogen met
  // verschillende termen en lijkt hun overlap nul.
  const perRol = ROLLEN.map(occsVoor);
  const pool = buildSharedCandidateSkills(perRol);
  assert.ok(pool.length > 100, `pool is maar ${pool.length} groot`);
  assert.ok(pool.length <= 150, "pool blijft binnen de schemalimiet van de API");
});

test("de pool bevat geen duplicaten", () => {
  const pool = buildSharedCandidateSkills(ROLLEN.map(occsVoor));
  assert.equal(new Set(pool.map((k) => k.id)).size, pool.length);
  assert.equal(new Set(pool.map((k) => k.label)).size, pool.length);
});

test("elke rol houdt een substantieel deel van zijn eigen kandidaten", () => {
  // Een gedeelde woordenschat mag een specialistische rol niet wegdrukken.
  const perRol = ROLLEN.map(occsVoor);
  const gedeeld = new Set(buildSharedCandidateSkills(perRol).map((k) => k.label));
  for (let i = 0; i < ROLLEN.length; i++) {
    const eigen = buildCandidateSkills(perRol[i]).map((k) => k.label);
    const behouden = eigen.filter((l) => gedeeld.has(l)).length;
    assert.ok(behouden / eigen.length > 0.6, `${ROLLEN[i]} houdt maar ${behouden} van ${eigen.length}`);
  }
});

test("de transversale competenties zitten er altijd in", () => {
  // Die worden juist ná automatisering relevant, ongeacht de rol.
  const pool = buildSharedCandidateSkills(ROLLEN.map(occsVoor)).map((k) => k.label);
  for (const verwacht of ["omgaan met onzekerheid", "analytisch denken", "zich aan verandering aanpassen"]) {
    assert.ok(pool.includes(verwacht), `"${verwacht}" ontbreekt`);
  }
});

test("een enkele rol valt terug op de gewone pool", () => {
  const occs = occsVoor("Accountmanager");
  assert.deepEqual(
    buildSharedCandidateSkills([occs]).map((k) => k.id),
    buildCandidateSkills(occs).map((k) => k.id)
  );
});

test("ook een specialistische rol tussen generalisten blijft vertegenwoordigd", () => {
  // De developer is de enige technische rol; zonder gegarandeerd minimum zou die
  // kunnen wegvallen tegen vijf kantoorrollen.
  const perRol = ROLLEN.map(occsVoor);
  const gedeeld = new Set(buildSharedCandidateSkills(perRol).map((k) => k.label));
  const devEigen = buildCandidateSkills(occsVoor("Software developer")).map((k) => k.label);
  const technisch = devEigen.filter((l) => gedeeld.has(l));
  assert.ok(technisch.length >= 40, `developer houdt maar ${technisch.length} kandidaten`);
});

test("lege invoer levert een lege pool, geen fout", () => {
  assert.deepEqual(buildSharedCandidateSkills([]), []);
  assert.deepEqual(buildSharedCandidateSkills(null), []);
  assert.deepEqual(buildSharedCandidateSkills([[], []]), []);
});
