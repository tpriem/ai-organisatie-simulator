import test from "node:test";
import assert from "node:assert/strict";
import { calculateCompetentieAgenda } from "./competencyAgenda.js";

const META = {
  "kritisch evalueren": { type: "knowledge", reuse: "cross-sector", cat: null }, // hoog
  "anderen leiden": { type: "competence", reuse: "transversal", cat: "sociaal" }, // midden
  "omgaan met onzekerheid": { type: "competence", reuse: "transversal", cat: "attitudes" }, // laag
};

const rol = (rolnaam, fteOver, competenties) => ({
  rolnaam,
  roleLabel: rolnaam,
  scenarios: { realistisch: { fteOver }, agressief: { fteOver: fteOver / 2 } },
  competentieMeta: META,
  nieuweCompetenties: competenties.map(([naam, belang]) => ({ naam, belang })),
});

test("een competentie die in meerdere rollen terugkomt wordt één regel", () => {
  const a = calculateCompetentieAgenda([
    rol("A", 2, [["kritisch evalueren", 5]]),
    rol("B", 3, [["kritisch evalueren", 4]]),
  ]);
  assert.equal(a.competenties.length, 1);
  assert.equal(a.competenties[0].aantalRollen, 2);
  assert.equal(a.competenties[0].fte, 5, "FTE van beide rollen opgeteld");
  assert.equal(a.competenties[0].gemiddeldBelang, 4.5);
});

test("breedte bepaalt de volgorde, niet urgentie in één rol", () => {
  const a = calculateCompetentieAgenda([
    rol("Groot", 8, [["kritisch evalueren", 2]]),
    rol("Klein", 1, [["anderen leiden", 5]]),
  ]);
  assert.equal(a.competenties[0].naam, "kritisch evalueren", "raakt meer FTE, dus bovenaan");
});

test("weging gebeurt op de FTE die overblijft, niet op de huidige", () => {
  // fteOver 2 van een rol die nu 10 FTE telt: de agenda gaat over wie er straks zit.
  const a = calculateCompetentieAgenda([{ ...rol("A", 2, [["kritisch evalueren", 3]]), fte: 10 }]);
  assert.equal(a.competenties[0].fte, 2);
});

test("trainbaarheid wordt per competentie overgenomen uit de metadata", () => {
  const a = calculateCompetentieAgenda([
    rol("A", 1, [
      ["kritisch evalueren", 5],
      ["anderen leiden", 4],
      ["omgaan met onzekerheid", 3],
    ]),
  ]);
  const tier = Object.fromEntries(a.competenties.map((c) => [c.naam, c.trainbaarheid]));
  assert.equal(tier["kritisch evalueren"], "hoog");
  assert.equal(tier["anderen leiden"], "midden");
  assert.equal(tier["omgaan met onzekerheid"], "laag");
});

test("het aandeel niet-trainbaar telt alleen de lage tier", () => {
  // Twee competenties van elk 2 FTE, waarvan één laag trainbaar -> 50%.
  const a = calculateCompetentieAgenda([
    rol("A", 2, [
      ["kritisch evalueren", 5],
      ["omgaan met onzekerheid", 5],
    ]),
  ]);
  assert.ok(Math.abs(a.aandeelNietTrainbaar - 0.5) < 1e-9);
  assert.equal(a.heeftTrainbaarheidsdata, true);
});

test("zonder trainbaarheidsgegevens wordt geen aandeel beweerd", () => {
  const zonderMeta = { ...rol("A", 2, [["iets onbekends", 4]]), competentieMeta: {} };
  const a = calculateCompetentieAgenda([zonderMeta]);
  assert.equal(a.aandeelNietTrainbaar, null);
  assert.equal(a.heeftTrainbaarheidsdata, false);
});

test("het agressieve scenario weegt op minder overgebleven FTE", () => {
  const rollen = [rol("A", 4, [["kritisch evalueren", 5]])];
  const re = calculateCompetentieAgenda(rollen, "realistisch");
  const ag = calculateCompetentieAgenda(rollen, "agressief");
  assert.ok(ag.competenties[0].fte < re.competenties[0].fte);
});

test("lege of onvolledige invoer levert een lege agenda, geen fout", () => {
  assert.deepEqual(calculateCompetentieAgenda([]).competenties, []);
  assert.deepEqual(calculateCompetentieAgenda(null).competenties, []);
  const zonder = calculateCompetentieAgenda([{ rolnaam: "A", scenarios: { realistisch: { fteOver: 1 } } }]);
  assert.deepEqual(zonder.competenties, []);
});
