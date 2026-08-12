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
  const widths = [2400, 700, 1000, 1000, 1800, 2450];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Rol", { width: widths[0], header: true }),
      cell("FTE", { width: widths[1], header: true }),
      cell("Uren/wk", { width: widths[2], header: true }),
      cell("Kosten/uur", { width: widths[3], header: true }),
      cell("Reductie (R–A)", { width: widths[4], header: true }),
      cell("Besparing/jaar (R–A)", { width: widths[5], header: true }),
    ],
  });

  const rows = rollen.map((r, i) => {
    const shaded = i % 2 === 1;
    return new TableRow({
      children: [
        cell(r.rolnaam, { width: widths[0], shaded }),
        cell(String(r.fte), { width: widths[1], shaded }),
        cell(String(r.urenPerWeek), { width: widths[2], shaded }),
        cell(eur(r.kostenPerUur), { width: widths[3], shaded }),
        cell(`${pct(r.scenarios.realistisch.reductiePercentage)} – ${pct(r.scenarios.agressief.reductiePercentage)}`, {
          width: widths[4],
          shaded,
        }),
        cell(
          `${eur(r.scenarios.realistisch.kostenBesparingPerJaar)} – ${eur(r.scenarios.agressief.kostenBesparingPerJaar)}`,
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

function organogramSection(rollen) {
  const maxFte = Math.max(...rollen.map((r) => r.fte), 1);
  const out = [
    paragraph(
      "Geen hiërarchie beschikbaar in het roster — dit toont FTE per rol, huidig versus overgebleven na transformatie, geschaald t.o.v. de grootste rol.",
      { italics: true, size: 18, color: "64748B" }
    ),
  ];

  for (const r of rollen) {
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [new TextRun({ text: r.rolnaam, bold: true, size: 22 })],
      })
    );
    out.push(paragraph(`Huidig — ${r.fte.toFixed(2)} FTE`, { size: 16, color: "64748B" }));
    out.push(miniBar(r.fte, maxFte, "94A3B8"));
    out.push(paragraph(`Realistisch — ${r.scenarios.realistisch.fteOver.toFixed(2)} FTE`, { size: 16, color: "64748B" }));
    out.push(miniBar(r.scenarios.realistisch.fteOver, maxFte, "6366F1"));
    out.push(paragraph(`Agressief — ${r.scenarios.agressief.fteOver.toFixed(2)} FTE`, { size: 16, color: "64748B" }));
    out.push(miniBar(r.scenarios.agressief.fteOver, maxFte, "C7D2FE"));
  }

  return out;
}

function competentieTable(rol) {
  const widths = [2200, 900, 900, 4700];
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell("Competentie", { width: widths[0], header: true }),
      cell("Nu", { width: widths[1], header: true }),
      cell("Na", { width: widths[2], header: true }),
      cell("Toelichting", { width: widths[3], header: true }),
    ],
  });

  const rows = (rol.competenties ?? []).map((c, i) => {
    const shaded = i % 2 === 1;
    const delta = c.belangNa - c.belangNu;
    const trend = delta > 0 ? "↑ " : delta < 0 ? "↓ " : "= ";
    return new TableRow({
      children: [
        cell(c.naam, { width: widths[0], shaded }),
        cell(`${c.belangNu}/5`, { width: widths[1], shaded }),
        cell(`${trend}${c.belangNa}/5`, { width: widths[2], shaded }),
        cell(c.toelichting, { width: widths[3], shaded }),
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
 * Genereert het gecombineerde eindrapport (Deel 1 + Deel 2) als .docx buffer.
 * @param {object} results - het resultaat-object zoals opgeslagen in results.json
 */
export async function generateReportDocx(results) {
  const { bedrijfsnaam, gegenereerdOp, missingProfiles, organisatieTotaal, rollen, sectorAnalyse, aanbevelingen } = results;
  const datum = new Date(gegenereerdOp).toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: "AI Organisatie Transformatie Simulator", bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: bedrijfsnaam ?? "", size: 28, color: "475569" })],
    }),
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
        )} (realistisch scenario) tot ${pct(
          organisatieTotaal.agressief.reductiePercentageOrganisatie
        )} (agressief scenario), overeenkomend met een geschatte jaarlijkse besparing van ${eur(
          organisatieTotaal.realistisch.totaalKostenBesparingPerJaar
        )} tot ${eur(organisatieTotaal.agressief.totaalKostenBesparingPerJaar)}.`
    ),
    ...(sectorAnalyse
      ? [
          paragraph(
            `Op sectorniveau (${sectorAnalyse.sector.sector}) komt de AI-impact eindscore uit op ${sectorAnalyse.eindscore.toFixed(
              1
            )} van de 5. ${sectorAnalyse.positionering}. Inschatting van de urgentie: ${sectorAnalyse.urgentie}.`
          ),
        ]
      : []),

    heading("Interne transformatie — overzicht per rol"),
    rolSummaryTable(rollen),

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

    heading("Detail per rol — taakverdeling & competenties"),
    ...rollen.flatMap((r) => [
      heading(
        `${r.rolnaam} (${r.fte} FTE → ${r.scenarios.realistisch.fteOver.toFixed(2)} realistisch / ${r.scenarios.agressief.fteOver.toFixed(
          2
        )} agressief)`,
        HeadingLevel.HEADING_2
      ),
      taakTable(r),
      ...(r.competenties?.length
        ? [
            new Paragraph({ spacing: { before: 150, after: 80 }, children: [new TextRun({ text: "Competentieverschuiving", bold: true, size: 20 })] }),
            competentieTable(r),
          ]
        : []),
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
      paragraph(`Impactscore (positioneringsvragen): ${sectorAnalyse.impactScore?.toFixed(1) ?? "-"} / 5`),
      paragraph(`Readinessscore (positioneringsvragen): ${sectorAnalyse.readinessScore?.toFixed(1) ?? "-"} / 5`),
      paragraph(`Eindscore: ${sectorAnalyse.eindscore.toFixed(1)} / 5`, { bold: true }),
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
