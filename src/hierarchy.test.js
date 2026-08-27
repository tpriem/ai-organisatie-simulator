import test from "node:test";
import assert from "node:assert/strict";
import { buildHierarchy } from "../web/lib/orgChartData.js";

const rol = (rolnaam, { afdeling = "", fte = 1, over = 0.5, rapporteertAan = "" } = {}) => ({
  rolnaam,
  roleId: `${afdeling}::${rolnaam}`.toLowerCase().replace(/\W+/g, "_"),
  roleLabel: afdeling ? `${rolnaam} (${afdeling})` : rolnaam,
  afdeling,
  rapporteertAan,
  fte,
  scenarios: { realistisch: { fteOver: over }, agressief: { fteOver: over / 2 } },
});

test("zonder rapporteert-aan-kolom is er geen hiërarchie", () => {
  assert.equal(buildHierarchy([rol("A"), rol("B")]), null);
});

test("een eenvoudige boom krijgt de juiste lagen", () => {
  const h = buildHierarchy([
    rol("Directeur"),
    rol("Teamleider", { rapporteertAan: "Directeur" }),
    rol("Medewerker", { rapporteertAan: "Teamleider" }),
  ]);
  assert.equal(h.top.length, 1);
  assert.equal(h.top[0].rolnaam, "Directeur");
  assert.equal(h.lagen, 3);
  assert.equal(h.top[0].kinderen[0].kinderen[0].rolnaam, "Medewerker");
});

test("aansturing telt alles wat eronder hangt, nu en straks", () => {
  const h = buildHierarchy([
    rol("Teamleider", { fte: 1, over: 0.8 }),
    rol("Medewerker A", { fte: 4, over: 1, rapporteertAan: "Teamleider" }),
    rol("Medewerker B", { fte: 2, over: 0.5, rapporteertAan: "Teamleider" }),
  ]);
  const leider = h.top[0];
  assert.equal(leider.spanDirect, 2);
  assert.equal(leider.spanTotaalHuidig, 6);
  assert.equal(leider.spanTotaalRealistisch, 1.5);
});

test("een verwijzing naar een onbekende rol wordt gemeld, niet genegeerd", () => {
  const h = buildHierarchy([rol("Medewerker", { rapporteertAan: "Bestaat Niet" })]);
  assert.equal(h.top.length, 1, "rol komt bovenaan te hangen");
  assert.match(h.problemen.join(" "), /niet in het roster/);
});

test("een kringverwijzing loopt niet vast en wordt gemeld", () => {
  // Zonder afvangen zou dit oneindig doorlopen.
  const h = buildHierarchy([
    rol("A", { rapporteertAan: "B" }),
    rol("B", { rapporteertAan: "A" }),
  ]);
  assert.ok(h.top.length >= 1, "er blijft een ingang over");
  assert.match(h.problemen.join(" "), /kringverwijzing/i);
  assert.ok(h.lagen <= 2);
});

test("een langere kring wordt ook verbroken", () => {
  const h = buildHierarchy([
    rol("A", { rapporteertAan: "C" }),
    rol("B", { rapporteertAan: "A" }),
    rol("C", { rapporteertAan: "B" }),
  ]);
  assert.ok(h.top.length >= 1);
  assert.match(h.problemen.join(" "), /kringverwijzing/i);
});

test("bij dezelfde rolnaam in twee afdelingen wint de eigen afdeling", () => {
  const h = buildHierarchy([
    rol("Teamleider", { afdeling: "NL" }),
    rol("Teamleider", { afdeling: "BE" }),
    rol("Medewerker", { afdeling: "BE", rapporteertAan: "Teamleider" }),
  ]);
  const be = h.top.find((k) => k.afdeling === "BE");
  assert.equal(be.kinderen.length, 1, "medewerker hangt onder de Belgische teamleider");
  assert.equal(be.kinderen[0].afdeling, "BE");
});

test("meerdere personen aan de top blijven naast elkaar staan", () => {
  const h = buildHierarchy([
    rol("Directeur A"),
    rol("Directeur B"),
    rol("Medewerker", { rapporteertAan: "Directeur A" }),
  ]);
  assert.equal(h.top.length, 2);
});
