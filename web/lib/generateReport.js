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
import { WAARDETYPES, getWaardetype } from "../../src/config.js";

const HEADER_FILL = "1E293B"; // slate-800
const LIGHT_FILL = "F1F5F9"; // slate-100

function eur(n) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

function waardetypeSummarySentence(rollen) {
  const parts = WAARDETYPES.map((w) => ({
    ...w,
    count: rollen.filter((r) => r.waardetype === w.id).length,
  })).filter((w) => w.count > 0);
  if (parts.length === 0) return null;
  const clauses = parts.map((w) => `${w.count} rol${w.count === 1 ? "" : "len"} ${w.label.toLowerCase()}`);
  return `Van de vrijgekomen capaciteit is de meest passende lezing: ${clauses.join(", ")}.`;
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
        cell(r.roleLabel ?? r.rolnaam, { width: widths[0], shaded }),
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
        cell(s.scenarios.realistisch.totaalFteHuidig.toFixed(1), { width: widths[2], shaded }),
        cell(s.scenarios.realistisch.totaalFteOver.toFixed(2), { width: widths[3], shaded }),
        cell(s.scenarios.agressief.totaalFteOver.toFixed(2), { width: widths[4], shaded }),
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
        children: [new TextRun({ text: r.roleLabel ?? r.rolnaam, bold: true, size: 22 })],
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
function competentieProfielBlok(profiel) {
  if (!profiel) return [];

  const uit = [
    paragraph("Competentieprofiel — nu versus straks", { bold: true, size: 20 }),
    paragraph(
      `De toekomstige competentiebehoefte van deze functie komt voor ${profiel.overlapPct}% overeen met wat de rol nu al vraagt.` +
        (profiel.overlapNaTrainingPct != null
          ? ` Met gerichte ontwikkeling loopt dat op tot ${profiel.overlapNaTrainingPct}%.`
          : ""),
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
        )} (realistisch scenario) tot ${pct(
          organisatieTotaal.agressief.reductiePercentageOrganisatie
        )} (agressief scenario), overeenkomend met een geschatte jaarlijkse besparing van ${eur(
          organisatieTotaal.realistisch.totaalKostenBesparingPerJaar
        )} tot ${eur(organisatieTotaal.agressief.totaalKostenBesparingPerJaar)}.`
    ),
    ...(waardetypeSummarySentence(rollen) ? [paragraph(waardetypeSummarySentence(rollen))] : []),
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

    heading("Detail per rol — taakverdeling & competenties"),
    ...rollen.flatMap((r) => [
      heading(
        `${r.roleLabel ?? r.rolnaam} (${r.fte} FTE → ${r.scenarios.realistisch.fteOver.toFixed(2)} realistisch / ${r.scenarios.agressief.fteOver.toFixed(
          2
        )} agressief)`,
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
