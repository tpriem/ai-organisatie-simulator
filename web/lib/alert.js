import { Resend } from "resend";

// Storingsmeldingen. Twee kanalen: altijd naar de serverlog (zichtbaar in Vercel), en
// optioneel per e-mail zodat je het weet vóór de klant belt.
//
// Belangrijkste eigenschap: dit mag nóóit de aanvraag laten mislukken. Een tool die
// omvalt omdat het versturen van een foutmelding faalt, is erger af dan een tool zonder
// meldingen. Alles hieronder is daarom afgeschermd.

const ONTVANGER = process.env.ALERT_EMAIL;
const AFZENDER = "AI Organisatie Transformatie Simulator <noreply@transformation-simulation.ai>";

let resend;
function getResend() {
  if (!process.env.RESEND_API_KEY || !ONTVANGER) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function omgeving() {
  return process.env.VERCEL_ENV ?? (process.env.VERCEL ? "vercel" : "lokaal");
}

/**
 * Meldt een storing. Wacht niet op verzending en gooit nooit.
 *
 * @param {string} onderwerp korte omschrijving, bijv. "Analyse deels mislukt"
 * @param {object} context vrije gegevens die helpen bij het uitzoeken
 */
export function meldStoring(onderwerp, context = {}) {
  const beschrijving = veiligJson(context);

  try {
    console.error(`[storing] ${onderwerp} — ${beschrijving}`);
  } catch {
    // logging zelf mag niets breken
  }

  let client;
  try {
    client = getResend();
  } catch {
    return;
  }
  if (!client) return;

  // Bewust niet awaiten: de klant hoeft niet te wachten op een interne melding.
  Promise.resolve()
    .then(() =>
      client.emails.send({
        from: AFZENDER,
        to: ONTVANGER,
        subject: `Storing (${omgeving()}): ${onderwerp}`,
        html: `
          <p><strong>${escapeHtml(onderwerp)}</strong></p>
          <p>Omgeving: ${escapeHtml(omgeving())}<br>Tijdstip: ${new Date().toISOString()}</p>
          <pre style="background:#f1f5f9;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px;">${escapeHtml(
            veiligJson(context, 2)
          )}</pre>
        `,
      })
    )
    .catch((err) => {
      try {
        console.error(`[storing] melding versturen mislukt: ${err?.message}`);
      } catch {
        // opgegeven
      }
    });
}

// JSON.stringify gooit op circulaire structuren. Een storingsmelding die zélf een
// storing veroorzaakt is het slechtste van twee werelden, dus vangen we dat hier af.
function veiligJson(waarde, inspringen) {
  try {
    return JSON.stringify(waarde, null, inspringen);
  } catch {
    try {
      return String(waarde);
    } catch {
      return "(context niet weer te geven)";
    }
  }
}

function escapeHtml(tekst) {
  return String(tekst).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
