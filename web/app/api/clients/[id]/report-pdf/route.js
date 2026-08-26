import { getClientMeta, readResults } from "@/lib/clientStore";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { meldStoring } from "@/lib/alert";

function safeFileSegment(name) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = await getClientMeta(id);
  if (!meta) return new Response(JSON.stringify({ error: "Klant niet gevonden" }), { status: 404 });

  const results = await readResults(id);
  if (!results) {
    return new Response(JSON.stringify({ error: "Nog geen analyse uitgevoerd voor deze klant" }), { status: 400 });
  }

  // PDF-generatie leunt op een Chromium-binary die op Vercel eerder ontbrak. Een
  // onbehandelde fout gaf de klant een kale 500; nu volgt een begrijpelijke melding
  // en weten wij het meteen.
  let buffer;
  try {
    buffer = await generateReportPdf(results);
  } catch (err) {
    meldStoring("PDF-rapport genereren mislukt", { klant: meta.naam, klantId: id, fout: err.message });
    return new Response(
      JSON.stringify({ error: "Het PDF-rapport kon niet gegenereerd worden. Probeer het Word-rapport." }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const fileName = `rapport_${safeFileSegment(meta.naam)}.pdf`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
