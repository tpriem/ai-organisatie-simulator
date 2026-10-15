import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRole } from "./calculate.js";
import { koppelAangepasteTaken, neemAangepasteTakenOver, herberekenRolMetTaken } from "./takenOvername.js";

const T = (omschrijving, categorie, aandeel) => ({ omschrijving, categorie, aandeel });
const rol = (taken, extra = {}) => ({
  ...calculateRole({ rolnaam: "Medewerker", afdeling: "Service", fte: 4, urenPerWeek: 36, kostenPerUur: 50, taken }),
  taakCompetenties: [],
  nieuweCompetenties: [],
  ...extra,
});
const aandelen = (taken) => taken.map((t) => Number(t.aandeel.toFixed(4)));

test("exact: dezelfde taken krijgen hun aangepaste aandeel, ook bij andere volgorde", () => {
  const nieuw = [T("Klanten te woord staan", "klantcontact", 0.5), T("Dossiers invoeren", "data_entry", 0.5)];
  const aangepast = [T("dossiers invoeren.", "data_entry", 0.2), T("Klanten te woord staan", "klantcontact", 0.8)];
  const k = koppelAangepasteTaken(nieuw, aangepast);
  assert.equal(k.methode, "exact");
  assert.deepEqual(aandelen(k.taken), [0.8, 0.2]);
});

test("categorie: andere formulering, zelfde categorieën, aandeel per categorie blijft", () => {
  const nieuw = [
    T("Vragen beantwoorden", "klantcontact", 0.3),
    T("Klachten afhandelen", "klantcontact", 0.1),
    T("Gegevens verwerken", "data_entry", 0.6),
  ];
  const aangepast = [T("Klanten helpen", "klantcontact", 0.7), T("Invoer", "data_entry", 0.3)];
  const k = koppelAangepasteTaken(nieuw, aangepast);
  assert.equal(k.methode, "categorie");
  assert.deepEqual(aandelen(k.taken), [0.525, 0.175, 0.3]);
  assert.ok(Math.abs(k.taken.reduce((s, t) => s + t.aandeel, 0) - 1) < 1e-9);
});

test("categorie: een nieuwe of verdwenen categorie geeft geen koppeling", () => {
  const aangepast = [T("a", "klantcontact", 0.7), T("b", "data_entry", 0.3)];
  assert.equal(koppelAangepasteTaken([T("x", "klantcontact", 0.6), T("y", "creatief", 0.4)], aangepast), null);
  assert.equal(koppelAangepasteTaken([T("x", "klantcontact", 1)], aangepast), null);
});

test("een aanpassing die niet op 100% sluit wordt niet overgenomen", () => {
  assert.equal(koppelAangepasteTaken([T("x", "klantcontact", 1)], [T("x", "klantcontact", 0.6)]), null);
});

test("overname herberekent de capaciteit, bewaart de oorspronkelijke taken en laat andere rollen met rust", () => {
  const vorige = herberekenRolMetTaken(rol([T("Oud", "klantcontact", 0.5), T("Oud2", "data_entry", 0.5)]), [
    T("Oud", "klantcontact", 0.1),
    T("Oud2", "data_entry", 0.9),
  ]);
  const nieuw = rol([T("Nieuw", "klantcontact", 0.5), T("Nieuw2", "data_entry", 0.5)]);
  const andere = { ...rol([T("Z", "klantcontact", 1)]), roleId: "andere::rol", rolnaam: "Andere" };

  const [uit, ongemoeid] = neemAangepasteTakenOver([nieuw, andere], [vorige]);
  assert.equal(uit.takenAangepastOvername, "categorie");
  assert.deepEqual(aandelen(uit.takenAangepast), [0.1, 0.9]);
  assert.deepEqual(aandelen(uit.taken), [0.5, 0.5], "de nieuwe analyse blijft als oorspronkelijk bewaard");
  assert.notEqual(
    uit.scenarios.realistisch.automatiseerbareUrenPerWeek,
    nieuw.scenarios.realistisch.automatiseerbareUrenPerWeek
  );
  assert.equal(
    uit.scenarios.realistisch.automatiseerbareUrenPerWeek,
    vorige.scenarios.realistisch.automatiseerbareUrenPerWeek,
    "zelfde verdeling over dezelfde categorieën geeft dezelfde capaciteit"
  );
  assert.equal(ongemoeid, andere);
});

test("onmogelijke koppeling: nieuwe analyse blijft, aanpassing wordt bewaard en gemeld", () => {
  const vorige = herberekenRolMetTaken(rol([T("a", "klantcontact", 0.5), T("b", "data_entry", 0.5)]), [
    T("a", "klantcontact", 0.9),
    T("b", "data_entry", 0.1),
  ]);
  const nieuw = rol([T("x", "klantcontact", 0.5), T("y", "creatief", 0.5)]);
  const [uit] = neemAangepasteTakenOver([nieuw], [vorige]);
  assert.equal(uit.takenAangepast, undefined);
  assert.equal(uit.scenarios, nieuw.scenarios);
  assert.deepEqual(aandelen(uit.takenAangepastVervallen.taken), [0.9, 0.1]);
});

test("zonder eerdere aanpassing verandert er niets", () => {
  const nieuw = [rol([T("x", "klantcontact", 1)])];
  assert.equal(neemAangepasteTakenOver(nieuw, [rol([T("x", "klantcontact", 1)])]), nieuw);
  assert.equal(neemAangepasteTakenOver(nieuw, null), nieuw);
});

test("een fout bij het herberekenen mag de analyse niet omgooien", () => {
  // Een bewaarde aanpassing met een categorie die inmiddels niet meer bestaat: koppelen lukt
  // (zelfde categorieverzameling), herberekenen niet.
  const basis = rol([T("a", "klantcontact", 1)]);
  const vorige = { ...basis, takenAangepast: [T("a", "verdwenen", 1)] };
  const nieuw = { ...basis, taken: [T("a", "verdwenen", 1)] };
  const [uit] = neemAangepasteTakenOver([nieuw], [vorige]);
  assert.ok(uit.takenAangepastVervallen);
  assert.equal(uit.takenAangepast, undefined);
});
