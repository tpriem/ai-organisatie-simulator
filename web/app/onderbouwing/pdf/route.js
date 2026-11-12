import { renderHtmlToPdf } from "@/lib/generateReportPdf";
import { meldStoring } from "@/lib/alert";
import { onderbouwingHtml, ONDERBOUWING_TITEL, ONDERBOUWING_ONDERTITEL, ONDERBOUWING_BESTANDSNAAM } from "../../../../src/onderbouwing.js";
import { maakBegrenzer } from "../../../../src/begrenzer.js";

// Het document "Werking en onderbouwing" als pdf, in de kleuren van de rapporten. Openbaar, net als de
// pagina zelf.
//
// Een pdf maken start een browser en dat is duur. Daarom drie remmen: het resultaat blijft in het
// geheugen van de serverinstantie, het netwerk ervoor mag het een dag bewaren (een nieuwe uitrol
// ververst het vanzelf), en één afzender kan het niet eindeloos opnieuw laten maken.
export const maxDuration = 60;

// Dezelfde kleuren als de rapporten: donkerblauw voor koppen, violet als accent, op wit papier.
const KLEUR = {
  navy: "#241b4b",
  paars: "#7b4feb",
  limoen: "#d5c9fb",
  mist: "#f1f0f9",
  tekst: "#4d4a70",
  grijs: "#6b6a8f",
  lijn: "#d2d0e6",
};
const COCREATIE = "AI Organisatie Transformatie Simulator · House of Digital";

const voet = () =>
  `<div style="width:100%;padding:0 16mm;font-family:Arial,Helvetica,sans-serif;font-size:7.5px;color:#9d9bbd;display:flex;justify-content:space-between;">` +
  `<span>${ONDERBOUWING_TITEL} · ${ONDERBOUWING_ONDERTITEL}</span>` +
  `<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;

let bewaard = null;
function maakPdf() {
  if (!bewaard) {
    bewaard = renderHtmlToPdf(onderbouwingHtml({ kleur: KLEUR, cocreatie: COCREATIE }), { voet: voet() }).catch((err) => {
      // Een mislukte poging niet bewaren, anders blijft de download kapot tot de instantie stopt.
      bewaard = null;
      throw err;
    });
  }
  return bewaard;
}

const toegestaan = maakBegrenzer({ limiet: 20, tijdvakMs: 60 * 60 * 1000 });

export async function GET(request) {
  const afzender = (request.headers.get("x-forwarded-for") ?? "onbekend").split(",")[0].trim();
  if (!toegestaan(afzender)) {
    return new Response("Te vaak opgevraagd. Probeer het over een uur opnieuw.", { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  let buffer;
  try {
    buffer = await maakPdf();
  } catch (err) {
    meldStoring("Pdf van de onderbouwing maken mislukt", { fout: err.message });
    return new Response("De pdf kon niet gemaakt worden. De tekst staat ook op de pagina zelf.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ONDERBOUWING_BESTANDSNAAM}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
