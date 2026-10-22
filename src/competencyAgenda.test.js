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

import { agendaRijen, agendaCellen, agendaZin, agendaRestZin, agendaLaagZin, AGENDA_KOLOMMEN } from "./competencyAgenda.js";

const breedAgenda = () =>
  calculateCompetentieAgenda([
    rol("A", 2, [["kritisch evalueren", 5], ["anderen leiden", 4]]),
    rol("B", 3, [["kritisch evalueren", 4]]),
    rol("C", 9, [["omgaan met onzekerheid", 3]]),
  ]);

test("agenda: de competentie die de meeste functies raakt staat bovenaan, ook bij minder FTE", () => {
  const a = breedAgenda();
  // omgaan met onzekerheid hangt aan 9 FTE maar aan één functie; kritisch evalueren aan twee.
  assert.equal(a.competenties[0].naam, "kritisch evalueren");
  assert.equal(a.aantalRollenTotaal, 3);
});

test("agenda: de cellen zeggen in hoeveel van alle functies een competentie nodig is", () => {
  const a = breedAgenda();
  assert.deepEqual(agendaCellen(a.competenties[0], a.aantalRollenTotaal), ["kritisch evalueren", "2 van 3 functies", "hoog trainbaar"]);
  assert.equal(agendaCellen(a.competenties[0], a.aantalRollenTotaal).length, AGENDA_KOLOMMEN.length);
  assert.equal(agendaCellen({ naam: "x", aantalRollen: 1, trainbaarheid: null }, 1)[1], "1 van 1 functie");
  assert.equal(agendaCellen({ naam: "x", aantalRollen: 1, trainbaarheid: null }, 1)[2], "onbekend");
});

test("agenda: de tabel toont de top en meldt hoeveel er buiten beeld blijven", () => {
  const taken = Array.from({ length: 8 }, (_, i) => ["kritisch evalueren", 1].map((v, j) => (j === 0 ? `c${i}` : v)));
  const a = calculateCompetentieAgenda([rol("A", 1, taken)]);
  const { rijen, rest } = agendaRijen(a, 5);
  assert.equal(rijen.length, 5);
  assert.equal(rest, 3);
  assert.equal(agendaRestZin(rest), "Daarnaast zijn nog 3 competenties nodig in minder functies.");
  assert.equal(agendaRestZin(0), "");
});

test("agenda: één competentie boven de grens wordt niet weggelaten", () => {
  const taken = Array.from({ length: 6 }, (_, i) => [`c${i}`, 1]);
  const a = calculateCompetentieAgenda([rol("A", 1, taken)]);
  assert.deepEqual(agendaRijen(a, 5), { rijen: a.competenties, rest: 0 });
});

test("agenda: de zinnen spreken over functies en noemen het niet-trainbare deel", () => {
  const a = breedAgenda();
  const z = agendaZin(a);
  assert.match(z, /^3 competenties zijn nieuw nodig, waarvan 1 in meerdere functies./);
  assert.match(z, /\d+% van de totale ontwikkelbehoefte is niet met training op te lossen \(1 van de 3 competenties\)/);
  assert.match(agendaLaagZin(a), /^Eén competentie in deze lijst is laag trainbaar/);
  assert.equal(agendaLaagZin(calculateCompetentieAgenda([rol("A", 1, [["kritisch evalueren", 5]])])), "");
});
