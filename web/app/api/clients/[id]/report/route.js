import { getClientMeta, readResults } from "@/lib/clientStore";
import { generateReportDocx } from "@/lib/generateReport";

function safeFileSegment(name) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

export async function GET(request, { params }) {
  const { id } = await params;
  const meta = getClientMeta(id);
  if (!meta) return new Response(JSON.stringify({ error: "Klant niet gevonden" }), { status: 404 });

  const results = readResults(id);
  if (!results) {
    return new Response(JSON.stringify({ error: "Nog geen analyse uitgevoerd voor deze klant" }), { status: 400 });
  }

  const buffer = await generateReportDocx(results);
  const fileName = `rapport_${safeFileSegment(meta.naam)}.docx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
