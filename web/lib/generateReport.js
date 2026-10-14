import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  ShadingType,
  BorderStyle,
  HeightRule,
} from "docx";
import { getWaardetype } from "../../src/config.js";
import { buildOrgChartData } from "./orgChartData.js";
import { driedeling } from "../../src/competencyProfile.js";
import { calculateCapaciteitBestemming } from "../../src/calculate.js";
import { calculateTaakprofiel } from "../../src/taakprofiel.js";
import { calculateCompetentieAgenda } from "../../src/competencyAgenda.js";
import { calculateMobiliteit } from "../../src/mobiliteit.js";
import { dekkingZinnen, beroepsmatchRegel, waardetypeHerkomstZin, waardetypeHandmatigRegel } from "../../src/rapportTeksten.js";
import { nl } from "../../src/formatNl.js";

const HEADER_FILL = "1E293B"; // slate-800
const LIGHT_FILL = "F1F5F9"; // slate-100

function eur(n) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function cell(text, { width, header = false, shaded = false, bold = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header
      ? { type: ShadingType.CLEAR, fill: HEADER_FILL }
      : shaded
      ? { type: ShadingType.CLEAR, fill: LIGHT_FILL }
      : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: header || bold,
            color: header ? "FFFFFF" : undefined,
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function noBorderRule() {
  return { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" };
}

function tableBorders() {
  const b = noBorderRule();
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { before: 300, after: 150 } });
}

function paragraph(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}

function rolSummaryTable(rollen) {
  const widths = [2200, 600, 900, 950, 1500, 1500, 1900];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Rol", { width: widths[0], header: true }),
      cell("FTE", { width: widths[1], header: true }),
      cell("Uren/wk", { width: widths[2], header: true }),
      cell("Kosten/uur", { width: widths[3], header: true }),
      cell("Reductie (R–A)", { width: widths[4], header: true }),
      cell("Vrijkomend u/wk (R–A)", { width: widths[5], header: true }),
      cell("Als besparing ingeboekt (R–A)", { width: widths[6], header: true }),
    ],
  });

  const rows = rollen.map((r, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(r.roleLabel ?? r.rolnaam, { width: widths[0], shaded }),
        cell(String(r.fte), { width: widths[1], shaded }),
        cell(String(r.urenPerWeek), { width: widths[2], shaded }),
        cell(eur(r.kostenPerUur), { width: widths[3], shaded }),
        cell(`${pct(r.scenarios.realistisch.reductiePercentage)} – ${pct(r.scenarios.agressief.reductiePercentage)}`, {
          width: widths[4],
          shaded,
        }),
        cell(
          `${Math.round(r.scenarios.realistisch.automatiseerbareUrenPerWeek)} – ${Math.round(r.scenarios.agressief.automatiseerbareUrenPerWeek)}`,
          { width: widths[5], shaded }
        ),
        cell(
          `${eur(r.scenarios.realistisch.kostenBesparingPerJaar)} – ${eur(r.scenarios.agressief.kostenBesparingPerJaar)}`,
          { width: widths[6], shaded }
        ),
      ],
    });
  });

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: tableBorders(),
    rows: [headerRow, ...rows],
  });
}

function subtotalenTable(subtotalenPerAfdeling) {
  const widths = [2600, 1200, 1600, 1600, 1600, 2350];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Afdeling", { width: widths[0], header: true }),
      cell("Rollen", { width: widths[1], header: true }),
      cell("FTE huidig", { width: widths[2], header: true }),
      cell("FTE realist.", { width: widths[3], header: true }),
      cell("FTE agress.", { width: widths[4], header: true }),
      cell("Besparing/jaar (R–A)", { width: widths[5], header: true }),
    ],
  });

  const rows = subtotalenPerAfdeling.map((s, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(s.afdeling, { width: widths[0], shaded }),
        cell(String(s.aantalRollen), { width: widths[1], shaded }),
        cell(nl(s.scenarios.realistisch.totaalFteHuidig, 1), { width: widths[2], shaded }),
        cell(nl(s.scenarios.realistisch.totaalFteOver, 2), { width: widths[3], shaded }),
        cell(nl(s.scenarios.agressief.totaalFteOver, 2), { width: widths[4], shaded }),
        cell(
          `${eur(s.scenarios.realistisch.totaalKostenBesparingPerJaar)} – ${eur(s.scenarios.agressief.totaalKostenBesparingPerJaar)}`,
          { width: widths[5], shaded }
        ),
      ],
    });
  });

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: tableBorders(),
    rows: [headerRow, ...rows],
  });
}

function taakTable(rol) {
  const widths = [3600, 2300, 900, 950, 950];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Taak", { width: widths[0], header: true }),
      cell("Categorie", { width: widths[1], header: true }),
      cell("Aandeel", { width: widths[2], header: true }),
      cell("Realist. %", { width: widths[3], header: true }),
      cell("Agress. %", { width: widths[4], header: true }),
    ],
  });

  const rows = rol.scenarios.realistisch.taken.map((t, i) => {
    const agressiefPct = rol.scenarios.agressief.taken[i]?.automatiseringspercentage ?? 0;
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(t.omschrijving, { width: widths[0], shaded }),
        cell(t.categorieLabel, { width: widths[1], shaded }),
        cell(pct(t.aandeel), { width: widths[2], shaded }),
        cell(pct(t.automatiseringspercentage), { width: widths[3], shaded }),
        cell(pct(agressiefPct), { width: widths[4], shaded }),
      ],
    });
  });

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: tableBorders(),
    rows: [headerRow, ...rows],
  });
}

const BAR_TOTAL_WIDTH = 5200; // DXA
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const BESTEMMING_KLEUR = {
  kostenreductie: "94A3B8",
  capaciteitsgroei: "6366F1",
  kwaliteitsverbetering: "10B981",
  onbepaald: "C7D2FE",
};

// Waar de vrijgekomen capaciteit naartoe gaat. Zelfde berekening als in de app
// (calculateCapaciteitBestemming), zodat beide altijd dezelfde cijfers tonen.
function capaciteitSectie(organisatieTotaal, rollen) {
  const t = organisatieTotaal.realistisch;
  const bestemming = calculateCapaciteitBestemming(rollen, "realistisch");
  const heeftBestemming = bestemming.some((b) => b.waardetype !== "onbepaald");
  const uren = t.totaalVrijgekomenUrenPerWeek ?? t.totaalFteWeg * 36;

  const out = [
    paragraph(
      `Er komt ${nl(t.totaalFteWeg, 1)} FTE aan capaciteit vrij (${Math.round(uren)} uur per week, realistisch scenario).` +
        (heeftBestemming ? " Per rol is ingeschat welke bestemming het meest voor de hand ligt:" : ""),
      { bold: true }
    ),
  ];

  if (heeftBestemming) {
    const maxFte = Math.max(...bestemming.map((b) => b.fte), 0.01);
    for (const b of bestemming) {
      const type = getWaardetype(b.waardetype);
      out.push(
        paragraph(
          `${type ? `${type.icon} ${type.label}` : "Nog niet bepaald"} — ${nl(b.fte, 1)} FTE · ${b.rollen} ${
            b.rollen === 1 ? "rol" : "rollen"
          }`,
          { size: 18, color: "475569" }
        )
      );
      out.push(miniBar(b.fte, maxFte, BESTEMMING_KLEUR[b.waardetype] ?? "94A3B8"));
    }
    out.push(
      paragraph(
        `Een vertrekpunt voor het gesprek, geen voorschrift: de keuze waar de capaciteit naartoe gaat is aan de organisatie.${
          waardetypeHerkomstZin(rollen) ? ` ${waardetypeHerkomstZin(rollen)}` : ""
        }`,
        { italics: true, size: 18, color: "64748B" }
      )
    );
  }

  return out;
}

// Het financiële beeld bewust ná en naast de capaciteit, met de voorwaarde erbij.
function financieelAlinea(organisatieTotaal) {
  return paragraph(
    `Financieel beeld. Als de vrijgekomen uren volledig als besparing worden ingeboekt, is dat ${eur(
      organisatieTotaal.realistisch.totaalKostenBesparingPerJaar
    )} tot ${eur(
      organisatieTotaal.agressief.totaalKostenBesparingPerJaar
    )} per jaar (realistisch tot agressief). Dit bedrag geldt alleen als die uren daadwerkelijk uit de kosten verdwijnen; worden ze ingezet voor meer volume of hogere kwaliteit, dan is de opbrengst geen besparing maar extra output.`,
    { italics: true, size: 18, color: "64748B" }
  );
}

// Het soort werk dat de organisatie doet, nu en straks.
function taakprofielSectie(rollen) {
  const p = calculateTaakprofiel(rollen, "realistisch");
  if (!p.heeftData) return [];

  const max = Math.max(...p.categorieen.map((c) => Math.max(c.aandeelNu, c.aandeelStraks)), 0.01);
  const groeiers = p.categorieen.filter((c) => c.verschuiving > 0.01).sort((a, b) => b.verschuiving - a.verschuiving);
  const krimpers = p.categorieen.filter((c) => c.verschuiving < -0.01).sort((a, b) => a.verschuiving - b.verschuiving);
  const pp = (v) => `${v > 0 ? "+" : "−"}${nl(Math.abs(v * 100), 1)} pp`;

  const out = [
    heading("Waar het werk uit bestaat — nu en straks"),
    paragraph(
      "Het aandeel van alle werkuren per taakcategorie. Automatisering raakt categorieën ongelijk, dus de samenstelling verschuift: werk dat moeilijk te automatiseren is wordt een groter deel van het geheel, ook als het in absolute uren krimpt. Grijs is nu, paars na de transformatie.",
      { italics: true, size: 18, color: "64748B" }
    ),
  ];

  if (groeiers.length > 0) {
    out.push(
      paragraph(
        `Het zwaartepunt verschuift naar ${groeiers[0].label.toLowerCase()} (${pp(groeiers[0].verschuiving)})` +
          (krimpers.length > 0 ? `, ten koste van ${krimpers[0].label.toLowerCase()} (${pp(krimpers[0].verschuiving)})` : "") +
          ".",
        { bold: true }
      )
    );
  }

  for (const c of p.categorieen) {
    out.push(
      paragraph(
        `${c.label} — ${Math.round(c.aandeelNu * 100)}% → ${Math.round(c.aandeelStraks * 100)}% (${pp(c.verschuiving)})`,
        { size: 18, color: "475569" }
      )
    );
    out.push(miniBar(c.aandeelNu, max, "94A3B8"));
    out.push(miniBar(c.aandeelStraks, max, "6366F1"));
  }

  out.push(
    paragraph(`In totaal ${Math.round(p.urenNu)} → ${Math.round(p.urenStraks)} uur per week.`, {
      italics: true,
      size: 18,
      color: "64748B",
    })
  );
  return out;
}

function miniBar(value, maxValue, colorHex) {
  const filled = Math.max(Math.round((value / maxValue) * BAR_TOTAL_WIDTH), 40);
  const empty = BAR_TOTAL_WIDTH - filled;

  const cells = [
    new TableCell({
      width: { size: filled, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: colorHex },
      borders: NO_BORDERS,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: [new Paragraph({ children: [] })],
    }),
  ];
  if (empty > 0) {
    cells.push(
      new TableCell({
        width: { size: empty, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: LIGHT_FILL },
        borders: NO_BORDERS,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        children: [new Paragraph({ children: [] })],
      })
    );
  }

  return new Table({
    width: { size: BAR_TOTAL_WIDTH, type: WidthType.DXA },
    columnWidths: empty > 0 ? [filled, empty] : [filled],
    borders: NO_BORDERS,
    rows: [new TableRow({ children: cells, height: { value: 220, rule: HeightRule.ATLEAST } })],
  });
}

function krimpPct(nu, straks) {
  if (!nu) return 0;
  return Math.round(((nu - straks) / nu) * 100);
}

function fteBalken(out, huidig, realistisch, agressief, schaal) {
  out.push(paragraph(`Huidig — ${nl(huidig, 2)} FTE`, { size: 16, color: "64748B" }));
  out.push(miniBar(huidig, schaal, "94A3B8"));
  out.push(paragraph(`Realistisch — ${nl(realistisch, 2)} FTE`, { size: 16, color: "64748B" }));
  out.push(miniBar(realistisch, schaal, "6366F1"));
  out.push(paragraph(`Agressief — ${nl(agressief, 2)} FTE`, { size: 16, color: "64748B" }));
  out.push(miniBar(agressief, schaal, "C7D2FE"));
}

function hierarchieKnoopWord(out, knoop, maxFte, diepte = 0) {
  const krimp = krimpPct(knoop.fteHuidig, knoop.fteRealistisch);
  const spanKrimp = krimpPct(knoop.spanTotaalHuidig, knoop.spanTotaalRealistisch);

  out.push(
    new Paragraph({
      spacing: { before: 160, after: 40 },
      indent: { left: diepte * 280 },
      children: [
        new TextRun({
          text:
            `${knoop.rolnaam} — ${nl(knoop.fteHuidig, 1)} → ${nl(knoop.fteRealistisch, 2)} FTE` +
            (krimp > 0 ? ` (−${krimp}%)` : ""),
          bold: true,
          size: 20,
        }),
      ],
    })
  );

  if (knoop.kinderen.length) {
    out.push(
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: diepte * 280 },
        children: [
          new TextRun({
            text:
              `stuurt ${knoop.spanDirect} ${knoop.spanDirect === 1 ? "rol" : "rollen"} aan · ` +
              `${nl(knoop.spanTotaalHuidig, 1)} → ${nl(knoop.spanTotaalRealistisch, 2)} FTE onder zich` +
              (spanKrimp > 0 ? ` (−${spanKrimp}%)` : ""),
            size: 16,
            color: "94A3B8",
          }),
        ],
      })
    );
  }

  out.push(paragraph(`Huidig — ${nl(knoop.fteHuidig, 2)} FTE`, { size: 16, color: "64748B" }));
  out.push(miniBar(knoop.fteHuidig, maxFte, "94A3B8"));
  out.push(paragraph(`Realistisch — ${nl(knoop.fteRealistisch, 2)} FTE`, { size: 16, color: "64748B" }));
  out.push(miniBar(knoop.fteRealistisch, maxFte, "6366F1"));

  for (const kind of knoop.kinderen) hierarchieKnoopWord(out, kind, maxFte, diepte + 1);
}

function organogramSection(rollen) {
  const chart = buildOrgChartData(rollen);
  const out = [
    paragraph(
      chart.hierarchie
        ? `Opgebouwd uit de rapportagelijnen in het roster — ${chart.hierarchie.lagen} ${
            chart.hierarchie.lagen === 1 ? "laag" : "lagen"
          }. Per rol: FTE nu versus overgebleven na transformatie, en hoeveel FTE eronder hangt.`
        : chart.heeftAfdelingen
          ? "Opgebouwd uit de afdelingen in het roster. Het roster bevat geen rapportagelijnen, dus dit toont de organisatie per afdeling — FTE nu versus overgebleven na transformatie."
          : "Geen afdelingen in het roster — dit toont FTE per rol, huidig versus overgebleven na transformatie, geschaald t.o.v. de grootste rol.",
      { italics: true, size: 18, color: "64748B" }
    ),
  ];

  if (chart.hierarchie) {
    if (chart.hierarchie.problemen.length) {
      out.push(
        paragraph(`Let op bij de rapportagelijnen: ${chart.hierarchie.problemen.join(" ")}`, {
          size: 16,
          color: "92400E",
        })
      );
    }
    for (const knoop of chart.hierarchie.top) hierarchieKnoopWord(out, knoop, chart.maxFte);
    return out;
  }

  if (!chart.heeftAfdelingen) {
    for (const r of chart.rollen) {
      out.push(
        new Paragraph({
          spacing: { before: 200, after: 60 },
          children: [new TextRun({ text: r.label, bold: true, size: 22 })],
        })
      );
      fteBalken(out, r.fteHuidig, r.fteRealistisch, r.fteAgressief, chart.maxFte);
    }
    return out;
  }

  const orgKrimp = krimpPct(chart.organisatie.fteHuidig, chart.organisatie.fteRealistisch);
  out.push(
    paragraph(
      `Hele organisatie: ${nl(chart.organisatie.fteHuidig, 1)} → ${nl(chart.organisatie.fteRealistisch, 2)} FTE` +
        (orgKrimp > 0 ? ` (−${orgKrimp}%)` : "") +
        ` — ${chart.afdelingen.length} afdelingen, ${chart.rollen.length} rollen`,
      { bold: true, size: 20 }
    )
  );

  for (const a of chart.afdelingen) {
    const krimp = krimpPct(a.fteHuidig, a.fteRealistisch);
    out.push(
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({
            text:
              `${a.afdeling} — ${nl(a.fteHuidig, 1)} → ${nl(a.fteRealistisch, 2)} FTE` +
              (krimp > 0 ? ` (−${krimp}%)` : ""),
            bold: true,
            size: 22,
          }),
        ],
      })
    );
    fteBalken(out, a.fteHuidig, a.fteRealistisch, a.fteAgressief, chart.maxAfdelingFte);

    // Bij één rol zijn de rolbalken identiek aan die van de afdeling; dan alleen de naam.
    if (a.rollen.length === 1) {
      out.push(paragraph(a.rollen[0].rolnaam, { size: 16, color: "64748B" }));
      continue;
    }
    for (const r of a.rollen) {
      out.push(
        new Paragraph({
          spacing: { before: 140, after: 40 },
          indent: { left: 300 },
          children: [new TextRun({ text: r.rolnaam, size: 18 })],
        })
      );
      fteBalken(out, r.fteHuidig, r.fteRealistisch, r.fteAgressief, chart.maxFte);
    }
  }

  return out;
}

function competentieTop5Table(items) {
  const widths = [900, 5300, 1500];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("#", { width: widths[0], header: true }),
      cell("Competentie", { width: widths[1], header: true }),
      cell("Relatief gewicht", { width: widths[2], header: true }),
    ],
  });

  const rows = items.map((c, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(String(i + 1), { width: widths[0], shaded }),
        cell(c.naam, { width: widths[1], shaded }),
        cell(`${c.relatiefPct}%`, { width: widths[2], shaded }),
      ],
    });
  });

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: tableBorders(),
    rows: [headerRow, ...rows],
  });
}

const TRAINBAARHEID_LABEL = {
  hoog: "hoog trainbaar",
  midden: "midden trainbaar",
  laag: "laag trainbaar",
};

// De ontwikkelbehoefte opgeteld over alle rollen. Zelfde berekening als in de app.
function ontwikkelagendaSectie(rollen) {
  const agenda = calculateCompetentieAgenda(rollen, "realistisch");
  if (agenda.competenties.length === 0) return [];

  const breed = agenda.competenties.filter((c) => c.aantalRollen > 1);
  const nietTrainbaar = agenda.competenties.filter((c) => c.trainbaarheid === "laag");

  const widths = [4300, 1700, 800, 800, 800];
  const kop = new TableRow({
    tableHeader: true,
    children: [
      cell("Competentie", { width: widths[0], header: true }),
      cell("Ontwikkelbaar", { width: widths[1], header: true }),
      cell("Rollen", { width: widths[2], header: true }),
      cell("FTE", { width: widths[3], header: true }),
      cell("Belang", { width: widths[4], header: true }),
    ],
  });
  const rijen = agenda.competenties.map((c, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(c.naam, { width: widths[0], shaded }),
        cell(TRAINBAARHEID_LABEL[c.trainbaarheid] ?? "onbekend", { width: widths[1], shaded }),
        cell(String(c.aantalRollen), { width: widths[2], shaded }),
        cell(nl(c.fte, 1), { width: widths[3], shaded }),
        cell(nl(c.gemiddeldBelang, 1), { width: widths[4], shaded }),
      ],
    });
  });

  return [
    heading("Ontwikkelagenda — organisatiebreed"),
    paragraph(
      "De competenties die ná de transformatie nieuw nodig zijn, opgeteld over alle rollen en gewogen naar de FTE die overblijft. Een competentie die in meerdere rollen terugkomt is één programma, geen reeks losse gesprekken.",
      { italics: true, size: 18, color: "64748B" }
    ),
    paragraph(
      `${agenda.competenties.length} competenties zijn nieuw nodig, waarvan ${breed.length} in meerdere rollen.` +
        (agenda.aandeelNietTrainbaar === null
          ? ""
          : ` ${Math.round(agenda.aandeelNietTrainbaar * 100)}% van de totale ontwikkelbehoefte is niet met training op te lossen (${nietTrainbaar.length} van de ${agenda.competenties.length} competenties).`),
      { bold: true }
    ),
    new Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
      columnWidths: widths,
      borders: tableBorders(),
      rows: [kop, ...rijen],
    }),
    ...(nietTrainbaar.length > 0
      ? [
          paragraph(
            `${nietTrainbaar.length === 1 ? "Eén competentie" : `${nietTrainbaar.length} competenties`} in deze lijst ${
              nietTrainbaar.length === 1 ? "is" : "zijn"
            } laag trainbaar — disposities in plaats van vaardigheden. Die los je niet op met een opleidingsbudget; de vraag is of ze al in huis zijn. Toets daarop bij de huidige bezetting.`,
            { italics: true, size: 18, color: "64748B" }
          ),
        ]
      : []),
  ];
}

// Waar kunnen de mensen heen bij wie capaciteit vrijkomt? Als vergelijking met blijven,
// niet als ranglijst: een ranglijst suggereert keuzevrijheid die de data niet draagt.
function mobiliteitSectie(rollen) {
  const m = calculateMobiliteit(rollen, { maxPerRol: 2 });
  if (!m.heeftData) return [];

  const metAlt = m.herkomsten.filter((h) => h.alternatieven.length > 0);
  const beste = Math.max(0, ...metAlt.map((h) => h.alternatieven[0].verhouding));

  const out = [
    heading("Waar kunnen deze mensen heen?"),
    paragraph(
      "Per rol waar capaciteit vrijkomt: hoe goed het huidige profiel aansluit op de eigen rol ná de transformatie, en hoe het dichtstbijzijnde alternatief daarbij afsteekt. Competenties zijn vergelijkbaar doordat alle rollen uit dezelfde ESCO-woordenschat putten.",
      { italics: true, size: 18, color: "64748B" }
    ),
  ];

  if (beste > 0 && beste < 0.6) {
    out.push(
      paragraph(
        `In deze organisatie is doorgroeien in de eigen, veranderde rol overal kansrijker dan overstappen — het beste alternatief komt nergens boven ${Math.round(
          beste * 100
        )}% van die aansluiting uit. Dat wijst op sterk gespecialiseerde rollen: reken niet op interne doorstroom als vanzelfsprekende uitweg.`,
        { bold: true }
      )
    );
  }

  for (const h of m.herkomsten) {
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: `${h.roleLabel} — ${nl(h.vrijgekomenFte, 2)} FTE komt vrij`, bold: true, size: 20 })],
      })
    );
    out.push(paragraph(`Blijven, in de veranderde rol — ${h.blijvenOverlapPct}% aansluiting`, { size: 18, color: "475569" }));
    out.push(miniBar(h.blijvenOverlapPct, 100, "6366F1"));
    for (const a of h.alternatieven) {
      out.push(
        paragraph(`→ ${a.roleLabel} — ${a.overlapPct}% · ${Math.round(a.verhouding * 100)}% hiervan`, {
          size: 18,
          color: "64748B",
        })
      );
      out.push(miniBar(a.overlapPct, 100, "94A3B8"));
    }
    if (h.alternatieven.length === 0) {
      out.push(paragraph("Geen enkele andere rol komt in de buurt.", { italics: true, size: 18, color: "64748B" }));
    }
    if (h.blijvenNietTrainbaarPct > 0) {
      out.push(
        paragraph(
          `Van wat deze rol straks extra nodig heeft is ${h.blijvenNietTrainbaarPct}% niet met training te overbruggen — toetsing van de huidige bezetting is daar nodig.`,
          { italics: true, size: 18, color: "64748B" }
        )
      );
    }
  }

  return out;
}

function competentieProfielTable(items) {
  const widths = [4200, 1500, 2000];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Competentie", { width: widths[0], header: true }),
      cell("Gewicht", { width: widths[1], header: true }),
      cell("Trainbaarheid", { width: widths[2], header: true }),
    ],
  });

  const rows = items.slice(0, 6).map((c, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(c.naam, { width: widths[0], shaded }),
        cell(`${c.pct}%`, { width: widths[1], shaded }),
        cell(TRAINBAARHEID_LABEL[c.trainbaarheid] ?? "onbekend", { width: widths[2], shaded }),
      ],
    });
  });

  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: tableBorders(),
    rows: [headerRow, ...rows],
  });
}

/**
 * Vertaalt het competentieprofiel naar de vraag waar een CHRO op stuurt: kun je met
 * dezelfde mensen verder, is het te ontwikkelen, of moet je hierop toetsen? Bewust
 * geen uitspraak over het vervangen van mensen — de analyse kent het rolprofiel, niet
 * de individuele medewerker.
 */
// Drie delen die samen 100% zijn, in plaats van "loopt op tot X%" — dat laatste las
// als een toestand die bereikt wordt, terwijl het een bovengrens is.
function competentieZin(profiel) {
  const basis = `De toekomstige competentiebehoefte van deze functie komt voor ${profiel.overlapPct}% overeen met wat de rol nu al vraagt.`;
  const d = driedeling(profiel);
  if (!d) return basis;

  return (
    `${basis} Daarvan komt ${d.teOntwikkelenPct}% erbij dat met gerichte ontwikkeling te overbruggen is` +
    (d.nietTrainbaarPct > 0
      ? `, en ${d.nietTrainbaarPct}% dat zich niet laat trainen — daarop is toetsing van de huidige bezetting nodig.`
      : "; er blijft niets over dat zich niet laat trainen.")
  );
}

function competentieProfielBlok(profiel) {
  if (!profiel) return [];

  const uit = [
    paragraph("Competentieprofiel — nu versus straks", { bold: true, size: 20 }),
    paragraph(
      competentieZin(profiel),
      { size: 18 }
    ),
    paragraph("Zwaarste competenties nu", { bold: true, size: 18 }),
    competentieProfielTable(profiel.profielNu),
    paragraph("Zwaarste competenties straks", { bold: true, size: 18 }),
    competentieProfielTable(profiel.profielStraks),
  ];

  if (profiel.teOntwikkelen?.length) {
    uit.push(
      paragraph(
        `Te ontwikkelen: ${profiel.teOntwikkelen.map((c) => c.naam).join(", ")}.`,
        { size: 18 }
      )
    );
  }
  if (profiel.teToetsen?.length) {
    uit.push(
      paragraph(
        `Toets de huidige bezetting op: ${profiel.teToetsen
          .map((c) => c.naam)
          .join(", ")} — deze competenties laten zich moeilijk aanleren.`,
        { size: 18 }
      )
    );
  }

  return uit;
}

/**
 * Genereert het gecombineerde eindrapport (Deel 1 + Deel 2) als .docx buffer.
 * @param {object} results - het resultaat-object zoals opgeslagen in results.json
 */
export async function generateReportDocx(results) {
  const {
    bedrijfsnaam,
    scope,
    scopeLabel,
    gegenereerdOp,
    missingProfiles,
    organisatieTotaal,
    subtotalenPerAfdeling,
    rollen,
    sectorAnalyse,
    aanbevelingen,
  } = results;
  const datum = new Date(gegenereerdOp).toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });
  const scopeSuffix = scope === "afdeling" && scopeLabel ? ` — ${scopeLabel}` : "";

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: "AI Organisatie Transformatie Simulator", bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: `${bedrijfsnaam ?? ""}${scopeSuffix}`, size: 28, color: "475569" })],
    }),
    ...(scope === "afdeling" && scopeLabel
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: `Dit rapport betreft de business unit/afdeling "${scopeLabel}", niet de volledige organisatie.`,
                size: 18,
                italics: true,
                color: "B45309",
              }),
            ],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: `Gegenereerd op ${datum}`, size: 20, color: "94A3B8" })],
    }),
    paragraph(
      "Dit rapport is een strategisch gespreksondersteunend instrument, gebaseerd op huidig onderzoek en technologie. Het is geen exacte voorspelling en vervangt geen diepgaand consultancytraject of individuele functieanalyse.",
      { italics: true, size: 18, color: "64748B" }
    ),

    heading("Managementsamenvatting"),
    paragraph(
      `De organisatie telt momenteel ${organisatieTotaal.realistisch.totaalFteHuidig} FTE verdeeld over ${rollen.length} geanalyseerde rollen. ` +
        `Op basis van de functieprofielen is de automatiseerbare capaciteit geschat op ${pct(
          organisatieTotaal.realistisch.reductiePercentageOrganisatie
        )} (realistisch scenario) tot ${pct(organisatieTotaal.agressief.reductiePercentageOrganisatie)} (agressief scenario).`
    ),
    ...capaciteitSectie(organisatieTotaal, rollen),
    financieelAlinea(organisatieTotaal),
    ...(sectorAnalyse
      ? [
          paragraph(
            `Op sectorniveau (${sectorAnalyse.sector.sector}) komt de AI-impact eindscore uit op ${nl(sectorAnalyse.eindscore, 1)} van de 5. ${sectorAnalyse.positionering}. Inschatting van de urgentie: ${sectorAnalyse.urgentie}.`
          ),
        ]
      : []),

    heading("Interne transformatie — overzicht per rol"),
    rolSummaryTable(rollen),

    ...(subtotalenPerAfdeling?.length
      ? [heading("Subtotalen per afdeling", HeadingLevel.HEADING_2), subtotalenTable(subtotalenPerAfdeling)]
      : []),

    heading("Organogram — voor & na"),
    ...organogramSection(rollen),

    ...(missingProfiles?.length
      ? [
          paragraph(
            `Let op: voor de volgende rollen uit het roster ontbrak een functieprofiel, en zijn daarom niet meegenomen in de analyse: ${missingProfiles.join(
              ", "
            )}.`,
            { italics: true, color: "B45309" }
          ),
        ]
      : []),
    // Een mislukte rol ontbreekt in alle totalen hierboven; dat hoort direct bij de tabel
    // te staan, niet alleen in de verantwoording aan het eind.
    ...(dekkingZinnen(results).mislukt
      ? [paragraph(`Let op: ${dekkingZinnen(results).mislukt}`, { italics: true, color: "B45309" })]
      : []),

    ...taakprofielSectie(rollen),
    ...mobiliteitSectie(rollen),
    ...ontwikkelagendaSectie(rollen),

    heading("Detail per rol — taakverdeling & competenties"),
    ...rollen.flatMap((r) => [
      heading(
        `${r.roleLabel ?? r.rolnaam} (${r.fte} FTE → ${nl(r.scenarios.realistisch.fteOver, 2)} realistisch / ${nl(r.scenarios.agressief.fteOver, 2)} agressief)`,
        HeadingLevel.HEADING_2
      ),
      ...(getWaardetype(r.waardetype)
        ? [
            paragraph(
              `${getWaardetype(r.waardetype).icon} ${getWaardetype(r.waardetype).label}${
                r.waardetypeToelichting ? ` — ${r.waardetypeToelichting}` : ""
              }`,
              { bold: true, size: 18 }
            ),
          ]
        : []),
      ...(waardetypeHandmatigRegel(r)
        ? [paragraph(waardetypeHandmatigRegel(r), { italics: true, size: 18, color: "64748B" })]
        : []),
      ...(beroepsmatchRegel(r.beroepsmatch)
        ? [paragraph(beroepsmatchRegel(r.beroepsmatch), { italics: true, size: 18, color: "64748B" })]
        : []),
      taakTable(r),
      // Analyses op de ESCO-koppeling tonen het volledige profiel met trainbaarheid;
      // oudere resultaten vallen terug op de top 5-tabellen.
      ...(r.competentieProfiel
        ? competentieProfielBlok(r.competentieProfiel)
        : [
            ...(r.competentieTop5?.top5Nu?.length
              ? [
                  new Paragraph({
                    spacing: { before: 150, after: 80 },
                    children: [
                      new TextRun({ text: "De functie vóór de transformatie — top 5 competenties", bold: true, size: 20 }),
                    ],
                  }),
                  competentieTop5Table(r.competentieTop5.top5Nu),
                ]
              : []),
            ...(r.competentieTop5?.top5Na?.length
              ? [
                  new Paragraph({
                    spacing: { before: 150, after: 80 },
                    children: [
                      new TextRun({ text: "De functie ná de transformatie — top 5 competenties", bold: true, size: 20 }),
                    ],
                  }),
                  competentieTop5Table(r.competentieTop5.top5Na),
                ]
              : []),
          ]),
      new Paragraph({ spacing: { after: 200 }, children: [] }),
    ]),
  ];

  if (aanbevelingen) {
    children.push(
      heading("Bevindingen & Aanbevelingen"),
      paragraph(aanbevelingen.bevindingenSamenvatting)
    );

    if (aanbevelingen.krimpendeRollen?.length) {
      children.push(
        heading("Krimpende rollen", HeadingLevel.HEADING_2),
        ...aanbevelingen.krimpendeRollen.map((r) => paragraph(`${r.rolnaam} — ${r.toelichting}`))
      );
    }
    if (aanbevelingen.groeiendeRollen?.length) {
      children.push(
        heading("Groeiende rollen", HeadingLevel.HEADING_2),
        ...aanbevelingen.groeiendeRollen.map((r) => paragraph(`${r.rolnaam} — ${r.toelichting}`))
      );
    }
    if (aanbevelingen.samenvoegKandidaten?.length) {
      children.push(
        heading("Samenvoegkandidaten", HeadingLevel.HEADING_2),
        ...aanbevelingen.samenvoegKandidaten.map((s) => paragraph(`${s.rollen.join(" + ")} — ${s.toelichting}`))
      );
    }
    if (aanbevelingen.aanbevelingen?.length) {
      children.push(
        heading("Aanbevelingen", HeadingLevel.HEADING_2),
        ...aanbevelingen.aanbevelingen.flatMap((a) => [
          paragraph(a.titel, { bold: true }),
          paragraph(a.beschrijving),
        ])
      );
    }
  }

  if (sectorAnalyse) {
    children.push(
      heading("Sectorpositionering"),
      paragraph(
        `Sector: ${sectorAnalyse.sector.sector} (niveau ${sectorAnalyse.sector.niveau}) — risico ${sectorAnalyse.sector.risico}/5, kans ${sectorAnalyse.sector.kans}/5.`
      ),
      paragraph(`Impactscore (positioneringsvragen): ${nl(sectorAnalyse.impactScore, 1) ?? "-"} / 5`),
      paragraph(`Readinessscore (positioneringsvragen): ${nl(sectorAnalyse.readinessScore, 1) ?? "-"} / 5`),
      paragraph(`Eindscore: ${nl(sectorAnalyse.eindscore, 1)} / 5`, { bold: true }),
      paragraph(`Positionering t.o.v. sectorgemiddelde: ${sectorAnalyse.positionering}`),
      paragraph(`Strategische urgentie: ${sectorAnalyse.urgentie}`, { bold: true })
    );
  }

  // Vaste afsluitende sectie — niet AI-gegenereerd, staat altijd in het rapport.
  children.push(
    heading("Vervolgstappen"),
    paragraph(
      "Dit rapport schetst een richting, geen exacte voorspelling. De cijfers, competentieverschuivingen en aanbevelingen " +
        "zijn bedoeld als vertrekpunt voor een strategisch gesprek — niet als eindoordeel.",
      { bold: true }
    ),
    paragraph(
      `De uitkomsten geven aanleiding tot verder, verdiepend onderzoek: het toetsen van deze bevindingen aan de praktijk, ` +
        `verfijning op basis van interne kennis en operationele details, en vertaling naar een concreet implementatieplan. ` +
        `Dit rapport is het begin van dat gesprek, niet de afsluiting ervan.`
    )
  );

  // Dekking en betrouwbaarheid: hoe stevig zijn de uitspraken in dit rapport. Teksten
  // komen uit rapportTeksten.js zodat PDF en Word dezelfde formulering gebruiken.
  const dekking = dekkingZinnen(results);
  if (dekking.heeftIets) {
    children.push(
      heading("Dekking en betrouwbaarheid", HeadingLevel.HEADING_2),
      paragraph(
        "Elke rol wordt gekoppeld aan een beroep uit de ESCO-classificatie; uit dat beroep komt de competentielijst waaruit de analyse kiest. Hoe sterker die koppeling, hoe steviger de competentie-uitspraken over die rol.",
        { italics: true, size: 18, color: "64748B" }
      ),
      ...(dekking.dekking ? [paragraph(dekking.dekking)] : []),
      ...(dekking.mislukt ? [paragraph(dekking.mislukt, { color: "B45309" })] : []),
      ...(dekking.zwak ? [paragraph(dekking.zwak)] : [])
    );
  }

  // Verplichte bronvermelding bij hergebruik van ESCO (voorwaarde 1 van de
  // ESCO-gebruiksvoorwaarden schrijft deze zin letterlijk voor voor publicaties), plus
  // de markering van eigen bewerkingen (voorwaarde 2). De trainbaarheidsindeling is
  // nadrukkelijk onze interpretatie, niet iets wat ESCO zelf vaststelt.
  if (rollen.some((r) => r.competentieProfiel)) {
    children.push(
      heading("Verantwoording competentiegegevens", HeadingLevel.HEADING_2),
      paragraph("This publication uses the ESCO classification of the European Commission.", { italics: true }),
      paragraph(
        "De competenties in dit rapport komen uit ESCO, de classificatie van de Europese Commissie voor " +
          "vaardigheden, competenties en beroepen. De indeling naar trainbaarheid is een eigen afleiding van " +
          "House of Digital op basis van ESCO-metadata (type competentie, mate van herbruikbaarheid en de " +
          "transversale categorie), geïnterpreteerd via het competentiemodel van Spencer & Spencer (1993). " +
          "Die weging maakt geen deel uit van ESCO zelf."
      )
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
