import { getClientMeta, readResults } from "@/lib/clientStore";
import { generateReportPdf } from "@/lib/generateReportPdf";

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

  const buffer = await generateReportPdf(results);
  const fileName = `rapport_${safeFileSegment(meta.naam)}.pdf`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
