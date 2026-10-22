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

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- PDF ---------------------------------------------------------------------------------------

export function bouwVolwassenheidHtml(model) {
  const blokken = model.blokken
    .map((b) => {
      if (b.soort === "kop") return b.niveau === 1 ? `<h2>${esc(b.tekst)}</h2>` : `<h3>${esc(b.tekst)}</h3>`;
      if (b.soort === "alinea") {
        const klasse = b.stijl === "noot" ? ' class="noot"' : b.stijl === "waarschuwing" ? ' class="waarschuwing"' : "";
        return `<p${klasse}>${esc(b.tekst)}</p>`;
      }
      if (b.soort === "lijst") return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      if (b.soort === "genummerd") return `<ol>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
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
  .meta { text-align: center; color: #9d9bbd; font-size: 10px; margin: 0 0 2px; }
  .disclaimer { font-style: italic; color: #6b6a8f; font-size: 9px; margin: 12px 0 18px; }
  h2 { font-size: 15px; border-bottom: 2px solid #7b4feb; padding-bottom: 4px; margin: 24px 0 10px; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 14px 0 6px; page-break-after: avoid; }
  p { line-height: 1.5; margin: 0 0 8px; }
  p.noot { font-style: italic; color: #6b6a8f; font-size: 10px; }
  p.waarschuwing { color: #b45309; }
  ul, ol { margin: 0 0 10px; padding-left: 20px; }
  li { line-height: 1.5; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
  th, td { border: 1px solid #d2d0e6; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #241b4b; color: white; }
  tr:nth-child(even) td { background: #f7f6fc; }
  tr { page-break-inside: avoid; }
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

const GEWICHT = { Waarom: 3, Betekenis: 3, Thema: 2, As: 2, Naam: 2 };

function cel(tekst, breedte, { kop = false, schaduw = false } = {}) {
  return new TableCell({
    width: { size: breedte, type: WidthType.DXA },
    shading: kop ? { type: ShadingType.CLEAR, fill: HEADER_FILL } : schaduw ? { type: ShadingType.CLEAR, fill: LIGHT_FILL } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text: String(tekst), bold: kop, color: kop ? "FFFFFF" : undefined, size: 18 })] })],
  });
}

function wordTabel(b) {
  const gewichten = b.kolommen.map((k) => GEWICHT[k] ?? 1);
  const som = gewichten.reduce((s, g) => s + g, 0);
  const breedtes = gewichten.map((g) => Math.floor((TABEL_BREEDTE * g) / som));
  const rand = { style: BorderStyle.SINGLE, size: 2, color: "D2D0E6" };
  return new Table({
    width: { size: breedtes.reduce((s, x) => s + x, 0), type: WidthType.DXA },
    columnWidths: breedtes,
    borders: { top: rand, bottom: rand, left: rand, right: rand, insideHorizontal: rand, insideVertical: rand },
    rows: [
      new TableRow({ tableHeader: true, children: b.kolommen.map((k, i) => cel(k, breedtes[i], { kop: true })) }),
      ...b.rijen.map((r, n) => new TableRow({ cantSplit: true, children: r.map((c, i) => cel(c, breedtes[i], { schaduw: n % 2 === 1 })) })),
    ],
  });
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
        })
      );
    } else if (b.soort === "alinea") {
      const opmaak = b.stijl === "noot" ? { italics: true, size: 18, color: "6B6A8F" } : b.stijl === "waarschuwing" ? { color: "B45309" } : {};
      children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: b.tekst, ...opmaak })] }));
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
    } else if (b.soort === "tabel") {
      children.push(wordTabel(b), new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }

  return Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] }));
}
