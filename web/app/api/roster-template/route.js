import { generateRosterTemplate } from "@/lib/rosterTemplate";
import { meldStoring } from "@/lib/alert";

// Downloadbaar rostersjabloon. Niet klantgebonden, dus geen id in het pad.
export async function GET() {
  try {
    const buffer = generateRosterTemplate();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="roster-sjabloon.xlsx"',
      },
    });
  } catch (err) {
    meldStoring("Rostersjabloon genereren mislukt", { fout: err.message });
    return new Response(JSON.stringify({ error: "Het sjabloon kon niet gegenereerd worden." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
