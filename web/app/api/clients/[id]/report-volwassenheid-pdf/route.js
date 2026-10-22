import { laadVolwassenheidsRapport, bestandsnaam } from "@/lib/volwassenheidRapport";
import { generateVolwassenheidPdf } from "@/lib/generateVolwassenheidReport";
import { meldStoring } from "@/lib/alert";

// PDF-versie van het volwassenheidsrapport. De PDF leunt op dezelfde Chromium-opzet als het
// impactrapport; faalt die, dan wijzen we op het Word-rapport.
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
    buffer = await generateVolwassenheidPdf(geladen.model);
  } catch (err) {
    meldStoring("PDF-volwassenheidsrapport genereren mislukt", { klant: geladen.meta.naam, klantId: id, fout: err.message });
    return new Response(JSON.stringify({ error: "Het PDF-rapport kon niet gegenereerd worden. Probeer het Word-rapport." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${bestandsnaam(geladen.meta.naam, "pdf")}"`,
    },
  });
}
