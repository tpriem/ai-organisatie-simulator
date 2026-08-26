import { getClientMeta, readResults } from "@/lib/clientStore";
import { generateReportDocx } from "@/lib/generateReport";
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

  let buffer;
  try {
    buffer = await generateReportDocx(results);
  } catch (err) {
    meldStoring("Word-rapport genereren mislukt", { klant: meta.naam, klantId: id, fout: err.message });
    return new Response(JSON.stringify({ error: "Het Word-rapport kon niet gegenereerd worden." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fileName = `rapport_${safeFileSegment(meta.naam)}.docx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
