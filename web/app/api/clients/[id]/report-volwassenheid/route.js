import { laadVolwassenheidsRapport, bestandsnaam } from "@/lib/volwassenheidRapport";
import { generateVolwassenheidDocx } from "@/lib/generateVolwassenheidReport";
import { meldStoring } from "@/lib/alert";

// Word-versie van het volwassenheidsrapport. Los van het impactrapport: het zijn twee
// onderzoeken met elk een eigen rapport.
export const maxDuration = 60;

export async function GET(request, { params }) {
  const { id } = await params;

  let geladen;
  try {
    geladen = await laadVolwassenheidsRapport(id);
  } catch (err) {
    meldStoring("Volwassenheidsrapport laden mislukt", { klantId: id, fout: err.message });
    return new Response(JSON.stringify({ error: "De gegevens voor het rapport konden niet worden geladen." }), { status: 502 });
  }
  if (!geladen) return new Response(JSON.stringify({ error: "Klant niet gevonden" }), { status: 404 });

  let buffer;
  try {
    buffer = await generateVolwassenheidDocx(geladen.model);
  } catch (err) {
    meldStoring("Word-volwassenheidsrapport genereren mislukt", { klant: geladen.meta.naam, klantId: id, fout: err.message });
    return new Response(JSON.stringify({ error: "Het Word-rapport kon niet gegenereerd worden." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${bestandsnaam(geladen.meta.naam, "docx")}"`,
    },
  });
}
