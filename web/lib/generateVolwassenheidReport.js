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
} from "docx";
import { renderHtmlToPdf } from "./generateReportPdf.js";

// Weergave van het volwassenheidsrapport in Word en PDF. De inhoud komt uit één gegevensmodel
// (src/rapportVolwassenheid.js); hier zit alleen de opmaak.

const HEADER_FILL = "241B4B";
const LIGHT_FILL = "F1F0F9";
const TABEL_BREEDTE = 9000;
const MAX_NIVEAU = 5;

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- PDF ---------------------------------------------------------------------------------------

/** Het profiel: per onderdeel een balk met het niveau en een streep op het doel. */
function profielHtml(b) {
  const kolommen = b.kolommen;
  const kop = `<tr><th>${esc(kolommen[0])}</th><th class="balkkolom"></th>${kolommen.slice(1).map((k) => `<th>${esc(k)}</th>`).join("")}</tr>`;
  let groep = null;
  const rijen = b.rijen
    .map((r) => {
      const groepRij = r.groep !== groep ? `<tr class="groep"><td colspan="${kolommen.length + 1}">${esc(r.groep)}</td></tr>` : "";
      groep = r.groep;
      const vul = r.niveau === null ? 0 : Math.max(r.niveau, 0.12) * (100 / MAX_NIVEAU);
      const balk = `<div class="balk"><div class="vul${r.niveau === null ? " leeg" : ""}" style="width:${vul}%"></div><div class="doel" style="left:${(r.doel * 100) / MAX_NIVEAU}%"></div></div>`;
      return `${groepRij}<tr><td class="naam">${esc(r.naam)}</td><td class="balkkolom">${balk}</td><td>${esc(r.niveauTekst)}</td><td>${esc(r.doelTekst)}</td><td>${esc(r.gatTekst)}</td>${
        r.onderbouwing ? `<td>${esc(r.onderbouwing)}</td>` : ""
      }</tr>`;
    })
    .join("");
  return `<table class="profiel"><thead>${kop}</thead><tbody>${rijen}</tbody></table>`;
}

export function bouwVolwassenheidHtml(model) {
  const blokken = model.blokken
    .map((b) => {
      if (b.soort === "kop") {
        const pagina = b.nieuwePagina ? ' class="nieuwe-pagina"' : "";
        return b.niveau === 1 ? `<h2${pagina}>${esc(b.tekst)}</h2>` : `<h3>${esc(b.tekst)}</h3>`;
      }
      if (b.soort === "alinea") {
        const klasse = b.stijl && b.stijl !== "normaal" ? ` class="${b.stijl}"` : b.label ? ' class="gelabeld"' : "";
        return b.label ? `<p${klasse}><strong>${esc(b.label)}</strong><br />${esc(b.tekst)}</p>` : `<p${klasse}>${esc(b.tekst)}</p>`;
      }
      if (b.soort === "lijst") return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      if (b.soort === "genummerd") return `<ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
      if (b.soort === "kader") return `<div class="kader"><p class="kadertitel">${esc(b.titel)}</p><ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol></div>`;
      if (b.soort === "profiel") return profielHtml(b);
      if (b.soort === "tabel") {
        return `<table><thead><tr>${b.kolommen.map((k) => `<th>${esc(k)}</th>`).join("")}</tr></thead><tbody>${b.rijen
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
      }
      return "";
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #241b4b; font-size: 11px; margin: 0; padding: 32px 40px; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  .subtitle { text-align: center; color: #4d4a70; font-size: 14px; margin: 0 0 4px; }
  .meta { text-align: center; color: #6b6a8f; font-size: 10px; margin: 0 0 2px; }
  .disclaimer { font-style: italic; color: #6b6a8f; font-size: 9px; margin: 12px 0 18px; }
  h2 { font-size: 15px; border-bottom: 2px solid #7b4feb; padding-bottom: 4px; margin: 24px 0 10px; page-break-after: avoid; }
  h2.nieuwe-pagina { break-before: page; margin-top: 0; }
  h3 { font-size: 12.5px; color: #7b4feb; margin: 18px 0 6px; page-break-after: avoid; }
  p { line-height: 1.5; margin: 0 0 8px; }
  p.noot { font-style: italic; color: #6b6a8f; font-size: 10px; }
  p.waarschuwing { color: #b45309; }
  p.lead { font-size: 13px; line-height: 1.5; color: #241b4b; font-weight: bold; margin-bottom: 12px; }
  p.gelabeld { margin-bottom: 6px; break-inside: avoid; }
  p.gelabeld strong { display: inline-block; margin-bottom: 1px; }
  ul, ol { margin: 0 0 10px; padding-left: 20px; }
  li { line-height: 1.5; margin-bottom: 4px; }
  .kader { background: #f1f0f9; border-left: 5px solid #7b4feb; border-radius: 0 10px 10px 0; padding: 12px 16px 6px; margin: 0 0 14px; break-inside: avoid; }
  .kadertitel { font-weight: bold; color: #241b4b; font-size: 12px; margin: 0 0 6px; }
  .kader ol { margin-bottom: 6px; }
  .kader li { margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  th, td { border: 1px solid #d2d0e6; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #241b4b; color: white; }
  tr:nth-child(even) td { background: #f7f6fc; }
  tr { page-break-inside: avoid; }
  table.profiel { break-inside: avoid; }
  table.profiel td { background: #ffffff; vertical-align: middle; white-space: nowrap; }
  table.profiel td.naam { white-space: normal; font-weight: bold; color: #241b4b; }
  table.profiel .balkkolom { width: 34%; }
  table.profiel tr.groep td { background: #f1f0f9; color: #7b4feb; font-weight: bold; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; padding: 3px 8px; }
  .balk { position: relative; height: 12px; background: #e9e7f5; border-radius: 6px; }
  .balk .vul { height: 12px; border-radius: 6px; background: #7b4feb; }
  .balk .vul.leeg { background: transparent; }
  .balk .doel { position: absolute; top: -3px; width: 2px; height: 18px; margin-left: -1px; background: #241b4b; }
</style>
</head>
<body>
  <h1>${esc(model.titel)}</h1>
  <p class="subtitle">${esc(model.ondertitel)}</p>
  ${model.meta.map((m) => `<p class="meta">${esc(m)}</p>`).join("\n  ")}
  <p class="disclaimer">${esc(model.disclaimer)}</p>
  ${blokken}
</body>
</html>`;
}

export async function generateVolwassenheidPdf(model) {
  return renderHtmlToPdf(bouwVolwassenheidHtml(model));
}

// ---- Word --------------------------------------------------------------------------------------

const GEWICHT = { Waarom: 3, Betekenis: 3, "Eerstvolgende stap": 4, Thema: 2, As: 2, Onderdeel: 2, Naam: 2 };
const RAND = { style: BorderStyle.SINGLE, size: 2, color: "D2D0E6" };
const RANDEN = { top: RAND, bottom: RAND, left: RAND, right: RAND, insideHorizontal: RAND, insideVertical: RAND };

function cel(tekst, breedte, { kop = false, schaduw = false, vet = false, kleur, kolommen = 1 } = {}) {
  return new TableCell({
    width: { size: breedte, type: WidthType.DXA },
    columnSpan: kolommen > 1 ? kolommen : undefined,
    shading: kop ? { type: ShadingType.CLEAR, fill: HEADER_FILL } : schaduw ? { type: ShadingType.CLEAR, fill: LIGHT_FILL } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: String(tekst), bold: kop || vet, color: kop ? "FFFFFF" : kleur, size: 18 })] })],
  });
}

function verdeel(gewichten) {
  const som = gewichten.reduce((s, g) => s + g, 0);
  return gewichten.map((g) => Math.floor((TABEL_BREEDTE * g) / som));
}

function wordTabel(b) {
  const breedtes = verdeel(b.kolommen.map((k) => GEWICHT[k] ?? 1));
  return new Table({
    width: { size: breedtes.reduce((s, x) => s + x, 0), type: WidthType.DXA },
    columnWidths: breedtes,
    borders: RANDEN,
    rows: [
      new TableRow({ tableHeader: true, children: b.kolommen.map((k, i) => cel(k, breedtes[i], { kop: true })) }),
      ...b.rijen.map((r, n) => new TableRow({ cantSplit: true, children: r.map((c, i) => cel(c, breedtes[i], { schaduw: n % 2 === 1 })) })),
    ],
  });
}

/**
 * Het profiel in Word: een tabel met per onderdeel een balk van blokjes. Gevuld is het niveau, de
 * streep staat achter het doelniveau.
 */
function wordProfiel(b) {
  const metBewijs = b.kolommen.length > 4;
  const breedtes = verdeel([3, 2.2, 2, 1, 1.4, ...(metBewijs ? [1.6] : [])]);
  const totaal = breedtes.reduce((s, x) => s + x, 0);
  const balk = (r) => {
    let uit = "";
    for (let n = 1; n <= MAX_NIVEAU; n++) uit += (r.niveau !== null && n <= r.niveau ? "■" : "□") + (n === r.doel ? "│" : "");
    return uit;
  };
  const rijen = [];
  let groep = null;
  for (const r of b.rijen) {
    if (r.groep !== groep) {
      groep = r.groep;
      rijen.push(new TableRow({ cantSplit: true, children: [cel(r.groep, totaal, { schaduw: true, vet: true, kleur: "7B4FEB", kolommen: breedtes.length })] }));
    }
    rijen.push(
      new TableRow({
        cantSplit: true,
        children: [
          cel(r.naam, breedtes[0], { vet: true, kleur: "241B4B" }),
          cel(balk(r), breedtes[1], { kleur: "7B4FEB" }),
          cel(r.niveauTekst, breedtes[2]),
          cel(r.doelTekst, breedtes[3]),
          cel(r.gatTekst, breedtes[4]),
          ...(metBewijs ? [cel(r.onderbouwing ?? "", breedtes[5])] : []),
        ],
      })
    );
  }
  const koppen = [b.kolommen[0], "", ...b.kolommen.slice(1)];
  return new Table({
    width: { size: totaal, type: WidthType.DXA },
    columnWidths: breedtes,
    borders: RANDEN,
    rows: [new TableRow({ tableHeader: true, children: koppen.map((k, i) => cel(k, breedtes[i], { kop: true })) }), ...rijen],
  });
}

/** Een uitgelicht kader: wit vlak met een limoengroene streep links. */
function wordKader(b) {
  const opmaak = {
    shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
    border: { left: { style: BorderStyle.SINGLE, size: 36, color: "7B4FEB", space: 10 } },
    indent: { left: 240, right: 120 },
  };
  return [
    new Paragraph({ ...opmaak, spacing: { before: 120, after: 80 }, keepNext: true, children: [new TextRun({ text: b.titel, bold: true, color: "241B4B", size: 24 })] }),
    ...b.items.map(
      (item, n) => new Paragraph({ ...opmaak, spacing: { after: n === b.items.length - 1 ? 200 : 80 }, children: [new TextRun({ text: `${n + 1}. ${item}` })] })
    ),
  ];
}

export async function generateVolwassenheidDocx(model) {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: model.titel, bold: true, size: 44 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: model.ondertitel, size: 28, color: "4D4A70" })] }),
    ...model.meta.map((m) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: m, size: 18, color: "9D9BBD" })] })),
    new Paragraph({ spacing: { before: 160, after: 240 }, children: [new TextRun({ text: model.disclaimer, italics: true, size: 18, color: "6B6A8F" })] }),
  ];

  for (const b of model.blokken) {
    if (b.soort === "kop") {
      children.push(
        new Paragraph({
          text: b.tekst,
          heading: b.niveau === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
          keepNext: true,
          pageBreakBefore: Boolean(b.nieuwePagina),
        })
      );
    } else if (b.soort === "alinea") {
      const opmaak =
        b.stijl === "noot"
          ? { italics: true, size: 18, color: "6B6A8F" }
          : b.stijl === "waarschuwing"
            ? { color: "B45309" }
            : b.stijl === "lead"
              ? { bold: true, size: 26, color: "241B4B" }
              : {};
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: b.label
            ? [new TextRun({ text: b.label, bold: true, color: "241B4B" }), new TextRun({ text: b.tekst, break: 1, ...opmaak })]
            : [new TextRun({ text: b.tekst, ...opmaak })],
        })
      );
    } else if (b.soort === "lijst") {
      for (const item of b.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: item })] }));
    } else if (b.soort === "genummerd") {
      b.items.forEach((item, n) =>
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            indent: { left: 360, hanging: 360 },
            children: [new TextRun({ text: `${n + 1}. ${item}` })],
          })
        )
      );
    } else if (b.soort === "kader") {
      children.push(...wordKader(b));
    } else if (b.soort === "profiel") {
      children.push(wordProfiel(b), new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (b.soort === "tabel") {
      children.push(wordTabel(b), new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
}
