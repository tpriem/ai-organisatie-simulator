import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODEL,
  DIMENSIES,
  INDICATOR_IDS,
  berekenProfiel,
  beoordeelDimensie,
  beoordeelCapabilityArea,
  vergelijkMetingen,
  schoonInvoer,
  maakSnapshot,
  niveauNaam,
  practiceSleutel,
} from "./aiMaturity.js";

const dim = (id) => DIMENSIES.find((d) => d.id === id);
const ca = (id) => DIMENSIES.flatMap((d) => d.capabilityAreas).find((c) => c.id === id);

// Bouwt invoer waarin de opgegeven capability areas volledig voldaan zijn, met één
// indicatorniveau voor alle drie de indicatoren.
function invoerVoor(ids, { antwoord = "ja", indicator = 3 } = {}) {
  const practices = {};
  const indicatoren = {};
  for (const id of ids) {
    practices[id] = {};
    for (const g of ca(id).goals) for (const p of g.practices) practices[id][practiceSleutel(g.nummer, p.nummer)] = antwoord;
    indicatoren[id] = Object.fromEntries(INDICATOR_IDS.map((i) => [i, indicator]));
  }
  return { practices, indicatoren, notities: {}, scope: "" };
}
const alleCas = (dimId) => dim(dimId).capabilityAreas.map((c) => c.id);

test("het model is volledig overgenomen: 8 dimensies, 25 capability areas, 64 goals, 242 practices", () => {
  assert.deepEqual(
    DIMENSIES.map((d) => d.naam),
    [
      "Organizational Strategy",
      "Workforce and Culture",
      "Workflow Re-Engineering",
      "Risk and Governance",
      "Data",
      "Engineering",
      "Operations",
      "Technology Ecosystem",
    ]
  );
  const cas = DIMENSIES.flatMap((d) => d.capabilityAreas);
  assert.equal(cas.length, 25);
  assert.equal(cas.flatMap((c) => c.goals).length, 64);
  assert.equal(cas.flatMap((c) => c.goals.flatMap((g) => g.practices)).length, 242);
  assert.match(MODEL.copyright, /Copyright 2026 Carnegie Mellon University/);
  assert.match(MODEL.copyright, /NO WARRANTY/);
});

test("de positionering volgt Table 2 van het model", () => {
  const verwacht = {
    experimentation: 1,
    ai_literate_workforce_development: 1,
    risk_management: 2,
    responsible_ai: 2,
    technology_infrastructure: 2,
    monitoring: 3,
    business_workflow_innovation: 3,
    organizational_culture_evolution: 3,
    deployment_at_scale: 4,
    future_ready_planning: 5,
  };
  for (const [id, niveau] of Object.entries(verwacht)) assert.equal(ca(id).positioneringsNiveau, niveau, id);
});

test("drie maturity indicators met een tekst per niveau 1-5", () => {
  assert.deepEqual(INDICATOR_IDS, ["accountability", "planning", "resourcing"]);
  for (const i of MODEL.maturityIndicators) for (let n = 1; n <= 5; n++) assert.ok(i.niveaus[n]?.length > 20, `${i.id} ${n}`);
});

test("zonder antwoorden is een dimensie niet gemeten", () => {
  const p = berekenProfiel({});
  assert.equal(p.gemeten, 0);
  assert.ok(p.dimensies.every((d) => d.niveau === null));
  assert.equal(p.laagste, null);
});

test("alles voldaan en alle indicatoren 5: de dimensie haalt niveau 5", () => {
  const d = beoordeelDimensie(dim("organizational_strategy"), invoerVoor(alleCas("organizational_strategy"), { indicator: 5 }));
  assert.equal(d.niveau, 5);
  assert.deepEqual(d.beperkend, []);
});

test("Data heeft alleen niveau 2-capability areas: voldaan en indicatoren 2 geeft niveau 2", () => {
  const d = beoordeelDimensie(dim("data"), invoerVoor(alleCas("data"), { indicator: 2 }));
  assert.equal(d.niveau, 2);
  assert.equal(d.volgendNiveau, 3);
  // Voor niveau 3 zijn de indicatoren te laag, niet de goals.
  assert.ok(d.beperkend.length > 0 && d.beperkend.every((b) => b.soort === "indicator"));
  assert.deepEqual(d.beperkend[0].indicatoren.sort(), [...INDICATOR_IDS].sort());
});

test("de strenge regel: alle goals voldaan maar één indicator op 1 houdt de dimensie op niveau 1", () => {
  const invoer = invoerVoor(alleCas("data"), { indicator: 4 });
  invoer.indicatoren.data_quality_assurance.planning = 1;
  const d = beoordeelDimensie(dim("data"), invoer);
  assert.equal(beoordeelCapabilityArea(ca("data_quality_assurance"), invoer).niveau, 1);
  assert.equal(d.niveau, 1);
  assert.deepEqual(d.beperkend.find((b) => b.capabilityAreaId === "data_quality_assurance").indicatoren, ["planning"]);
});

test("een niet behaalde capability area op niveau 5 houdt de dimensie op niveau 4", () => {
  const ids = alleCas("organizational_strategy").filter((id) => id !== "future_ready_planning");
  const d = beoordeelDimensie(dim("organizational_strategy"), invoerVoor(ids, { indicator: 5 }));
  assert.equal(d.niveau, 4);
  assert.equal(d.beperkend.length, 1);
  assert.equal(d.beperkend[0].soort, "goals");
  assert.equal(d.beperkend[0].capabilityAreaId, "future_ready_planning");
  assert.equal(d.beperkend[0].openPractices, 13);
});

test("een open practice in een niveau 2-capability area blokkeert niveau 2", () => {
  const invoer = invoerVoor(alleCas("data"), { indicator: 3 });
  invoer.practices.data_lifecycle_management["1.1"] = "deels";
  const d = beoordeelDimensie(dim("data"), invoer);
  assert.equal(d.niveau, 1, "Data heeft geen niveau 1-capability area: niveau 1 is het vloer");
  const b = d.beperkend.find((x) => x.capabilityAreaId === "data_lifecycle_management");
  assert.equal(b.soort, "goals");
  assert.deepEqual(b.openGoals, [1]);
  assert.equal(b.openPractices, 1);
});

test("niet van toepassing telt als voldaan, deels niet", () => {
  const invoer = invoerVoor(["data_quality_assurance"], { indicator: 2 });
  invoer.practices.data_quality_assurance["1.1"] = "nvt";
  assert.equal(beoordeelCapabilityArea(ca("data_quality_assurance"), invoer).doelenBehaald, true);
  invoer.practices.data_quality_assurance["1.1"] = "deels";
  assert.equal(beoordeelCapabilityArea(ca("data_quality_assurance"), invoer).doelenBehaald, false);
});

test("een onbeantwoorde practice telt als niet voldaan en wordt als onvolledig gemeld", () => {
  const invoer = invoerVoor(["data_quality_assurance"]);
  delete invoer.practices.data_quality_assurance["2.1"];
  const c = beoordeelCapabilityArea(ca("data_quality_assurance"), invoer);
  assert.equal(c.doelenBehaald, false);
  assert.equal(c.onvolledig, true);
  assert.equal(c.goals[1].onbeantwoord, 1);
});

test("een onbeantwoorde indicator telt als niveau 1 en wordt als onvolledig gemeld", () => {
  const invoer = invoerVoor(["data_quality_assurance"], { indicator: 4 });
  delete invoer.indicatoren.data_quality_assurance.resourcing;
  const c = beoordeelCapabilityArea(ca("data_quality_assurance"), invoer);
  assert.equal(c.indicatorMin, 1);
  assert.deepEqual(c.indicatorOnbeantwoord, ["resourcing"]);
  assert.equal(c.onvolledig, true);
});

test("het niveau 1-ankerpunt: een niet behaalde niveau 1-capability area geeft niveau 0", () => {
  const invoer = invoerVoor(["organizational_culture_evolution"]); // alleen iets ingevuld in de dimensie
  const d = beoordeelDimensie(dim("workforce_and_culture"), invoer);
  assert.equal(d.gemeten, true);
  assert.equal(d.niveau, 0, "AI-Literate Workforce Development (niveau 1) is niet behaald");
  assert.equal(d.niveauNaam, "Below Exploratory AI");
  assert.equal(niveauNaam(3), "Aligned AI");
});

test("het niveau van een capability area: behaald is de laagste indicator, niet behaald max positionering-1", () => {
  const behaald = beoordeelCapabilityArea(ca("monitoring"), invoerVoor(["monitoring"], { indicator: 4 }));
  assert.equal(behaald.niveau, 4);
  const invoer = invoerVoor(["monitoring"], { indicator: 4 });
  invoer.practices.monitoring["1.1"] = "niet";
  assert.equal(beoordeelCapabilityArea(ca("monitoring"), invoer).niveau, 2, "positionering 3 min 1");
  const invoer2 = invoerVoor(["monitoring"], { indicator: 1 });
  invoer2.practices.monitoring["1.1"] = "niet";
  assert.equal(beoordeelCapabilityArea(ca("monitoring"), invoer2).niveau, 1, "de laagste indicator weegt mee");
});

test("het profiel heeft een niveau per dimensie en geen totaalscore", () => {
  const p = berekenProfiel(invoerVoor(alleCas("data"), { indicator: 3 }));
  assert.equal(p.gemeten, 1);
  assert.equal(p.dimensies.find((d) => d.id === "data").niveau, 3);
  assert.equal("totaal" in p, false);
  assert.equal("score" in p, false);
  assert.equal(p.telling.totaal, 242);
  assert.equal(p.telling.beantwoord, 24, "data: 15 + 9 practices");
});

test("vergelijking tussen metingen, en geen vergelijking over modelversies heen", () => {
  const voor = berekenProfiel(invoerVoor(alleCas("data"), { indicator: 2 }));
  const nu = berekenProfiel(invoerVoor(alleCas("data"), { indicator: 4 }));
  const v = vergelijkMetingen(voor, nu);
  assert.equal(v.gestegen, 1);
  assert.equal(v.verschillen[0].verschil, 2);
  assert.equal(vergelijkMetingen({ ...voor, modelVersie: "0.9" }, nu), null);
  assert.equal(vergelijkMetingen(null, nu), null);
});

test("schoonInvoer: onbekende capability areas, practices en antwoorden verdwijnen", () => {
  const s = schoonInvoer({
    scope: "  Hele organisatie  ",
    practices: {
      data_quality_assurance: { "1.1": "ja", "9.9": "ja", "1.2": "misschien", "2.1": "deels" },
      bestaat_niet: { "1.1": "ja" },
    },
    indicatoren: { monitoring: { accountability: 4, planning: 9, resourcing: 2.5, extra: 3 } },
    notities: { monitoring: "  bewijs  ", data_quality_assurance: "   " },
    extra: "weg",
  });
  assert.equal(s.scope, "Hele organisatie");
  assert.deepEqual(s.practices, { data_quality_assurance: { "1.1": "ja", "2.1": "deels" } });
  assert.deepEqual(s.indicatoren, { monitoring: { accountability: 4 } });
  assert.deepEqual(s.notities, { monitoring: "bewijs" });
  assert.equal("extra" in s, false);
  assert.deepEqual(schoonInvoer(undefined), { scope: "", practices: {}, indicatoren: {}, notities: {} });
});

test("snapshot bewaart alleen de schone invoer, de modelversie en het tijdstip", () => {
  const s = maakSnapshot(invoerVoor(["data_quality_assurance"]), { op: new Date("2026-10-22T10:00:00Z") });
  assert.deepEqual(Object.keys(s).sort(), ["indicatoren", "modelVersie", "notities", "op", "practices", "scope"]);
  assert.equal(s.modelVersie, "1.0");
  assert.equal(s.op, "2026-10-22T10:00:00.000Z");
});
