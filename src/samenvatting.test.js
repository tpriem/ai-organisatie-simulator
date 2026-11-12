import test from "node:test";
import assert from "node:assert/strict";
import { kernpunten, kernpuntTekst } from "./samenvatting.js";
import { calculateRole, calculateSubtotalenPerAfdeling } from "./calculate.js";

const rol = (rolnaam, afdeling, fte, categorie) =>
  calculateRole({ rolnaam, afdeling, fte, urenPerWeek: 36, kostenPerUur: 30, taken: [{ omschrijving: "t", categorie, aandeel: 1 }] });
const rollen = [
  rol("administratief medewerker", "Service", 6, "data_entry"),
  rol("klantadviseur", "Service", 12, "klantcontact"),
  rol("ontwerper", "Studio", 12, "creatief"),
  rol("directeur", "Bestuur", 1, "strategisch"),
];
const results = { rollen, subtotalenPerAfdeling: calculateSubtotalenPerAfdeling(rollen) };

test("de kernpunten noemen de afdelingen en functies waar de meeste tijd vrijkomt, grootste eerst", () => {
  const k = kernpunten(results, { aantal: 2 });
  assert.deepEqual(k.afdelingen.map((a) => a.naam), ["Service", "Studio"]);
  assert.deepEqual(k.functies.map((f) => f.naam), ["klantadviseur (Service)", "administratief medewerker (Service)"]);
  const som = kernpunten(results, { aantal: 10 }).functies.reduce((s, f) => s + f.aandeel, 0);
  assert.ok(Math.abs(som - 1) < 1e-9, "de aandelen van alle functies tellen op tot 1");
  assert.ok(k.functies[1].deelVanEigenTijd > k.functies[0].deelVanEigenTijd, "administratie komt naar verhouding meer vrij dan klantcontact");
});

test("lege of ontbrekende resultaten geven lege lijsten, geen fout", () => {
  assert.deepEqual(kernpunten(null), { afdelingen: [], functies: [] });
  assert.deepEqual(kernpunten({ rollen: [] }), { afdelingen: [], functies: [] });
});

test("een kernpunt is leesbaar en afgerond", () => {
  assert.equal(kernpuntTekst({ naam: "Wonen", fteVrij: 16.4, deelVanEigenTijd: 0.412 }), "Wonen (16 FTE, 41% van de eigen tijd)");
  assert.equal(kernpuntTekst({ naam: "planner", fteVrij: 1.84, deelVanEigenTijd: 0.46 }), "planner (1,8 FTE, 46% van de eigen tijd)");
});
