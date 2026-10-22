import test from "node:test";
import assert from "node:assert/strict";
import { buildOrgChartData, balkSegmenten, aansturingRegels, organogramTeksten } from "../web/lib/orgChartData.js";

const rol = (rolnaam, { afdeling = "", fte = 1, over = 0.5, rapporteertAan = "", waardetype = "kwaliteitsverbetering" } = {}) => ({
  rolnaam,
  roleId: `${afdeling}::${rolnaam}`.toLowerCase().replace(/\W+/g, "_"),
  roleLabel: afdeling ? `${rolnaam} (${afdeling})` : rolnaam,
  afdeling,
  rapporteertAan,
  fte,
  waardetype,
  scenarios: { realistisch: { fteOver: over }, agressief: { fteOver: over / 2 } },
});

const team = () => [
  rol("Manager", { fte: 1, over: 0.5, waardetype: "capaciteitsgroei" }),
  rol("Medewerker A", { fte: 4, over: 1.6, rapporteertAan: "Manager", waardetype: "kwaliteitsverbetering" }),
  rol("Medewerker B", { fte: 2, over: 1.5, rapporteertAan: "Manager", waardetype: "kostenreductie" }),
];

test("per rol komt vrij wat de rol niet overhoudt, met de bestemming erbij", () => {
  const { rollen } = buildOrgChartData(team());
  const a = rollen.find((r) => r.rolnaam === "Medewerker A");
  assert.ok(Math.abs(a.fteVrij - 2.4) < 1e-9);
  assert.deepEqual(Object.keys(a.vrijPerType), ["kwaliteitsverbetering"]);
});

test("de organisatie telt de vrijgekomen capaciteit per bestemming op", () => {
  const { organisatie } = buildOrgChartData(team());
  assert.ok(Math.abs(organisatie.fteVrij - (0.5 + 2.4 + 0.5)) < 1e-9);
  assert.ok(Math.abs(organisatie.vrijPerType.capaciteitsgroei - 0.5) < 1e-9);
  assert.ok(Math.abs(organisatie.vrijPerType.kostenreductie - 0.5) < 1e-9);
  assert.ok(Math.abs(organisatie.vrijPerType.kwaliteitsverbetering - 2.4) < 1e-9);
});

test("een afdeling telt alleen haar eigen rollen", () => {
  const rollen = [
    rol("Medewerker", { afdeling: "NL", fte: 2, over: 1 }),
    rol("Medewerker", { afdeling: "BE", fte: 4, over: 1 }),
  ];
  const { afdelingen } = buildOrgChartData(rollen);
  assert.equal(afdelingen.find((a) => a.afdeling === "NL").fteVrij, 1);
  assert.equal(afdelingen.find((a) => a.afdeling === "BE").fteVrij, 3);
});

test("onder een leidinggevende hangt hoeveel werk er is en hoeveel daarvan vrijkomt", () => {
  const { hierarchie } = buildOrgChartData(team());
  const manager = hierarchie.top[0];
  assert.equal(manager.spanTotaalHuidig, 6);
  assert.ok(Math.abs(manager.spanTotaalVrij - (2.4 + 0.5)) < 1e-9);
  assert.equal(manager.spanAantalRollen, 2);
});

test("een rol zonder waardetype telt als onbepaald, niet als een van de drie", () => {
  const { organisatie } = buildOrgChartData([rol("A", { waardetype: null })]);
  assert.deepEqual(Object.keys(organisatie.vrijPerType), ["onbepaald"]);
});

test("de balk toont alleen het vrijkomende deel en nooit meer dan het geheel", () => {
  const seg = balkSegmenten(4, { kwaliteitsverbetering: 1, kostenreductie: 1 });
  assert.deepEqual(
    seg.map((s) => [s.soort, s.aandeel]),
    [
      ["kostenreductie", 0.25],
      ["kwaliteitsverbetering", 0.25],
    ]
  );
  assert.ok(balkSegmenten(1, { kostenreductie: 5 })[0].aandeel <= 1);
  assert.deepEqual(balkSegmenten(0, { kostenreductie: 1 }), []);
});

test("de aansturing benoemt alleen leidinggevenden, en alleen de hoge krimp krijgt een vraag", () => {
  const { hierarchie } = buildOrgChartData(team());
  const regels = aansturingRegels(hierarchie);
  assert.equal(regels.length, 1);
  assert.equal(regels[0].rolnaam, "Manager");
  // 2,9 van 6 FTE = 48%: boven de drempel.
  assert.equal(regels[0].hoog, true);
  assert.match(regels[0].tekst, /stuurt 2 rollen aan, samen 6,0 FTE/);
  assert.match(regels[0].tekst, /Bekijk of de manier van aansturen/);

  const rustig = aansturingRegels(buildOrgChartData([rol("L", { fte: 1, over: 1 }), rol("M", { fte: 4, over: 3.5, rapporteertAan: "L" })]).hierarchie);
  assert.equal(rustig[0].hoog, false);
  assert.doesNotMatch(rustig[0].tekst, /Bekijk of/);
});

test("zonder rapportagelijnen is er geen aansturing om te tonen", () => {
  assert.deepEqual(aansturingRegels(buildOrgChartData([rol("A"), rol("B")]).hierarchie), []);
});

test("de teksten spreken over capaciteit, nooit over mensen die overblijven of afvloeien", () => {
  const chart = buildOrgChartData(team());
  const t = organogramTeksten(chart);
  const alles = [t.uitleg, t.totaal, t.onderdeel(chart.organisatie), ...aansturingRegels(chart.hierarchie).map((r) => r.tekst)].join(" ");
  assert.match(t.totaal, /Hele organisatie: 7,0 FTE, waarvan 3,4 FTE \(49%\) aan capaciteit vrijkomt/);
  assert.doesNotMatch(alles, /overgebleven|overblijf|afvloei|ontslag|→|−/i);
});
