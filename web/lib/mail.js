import { Resend } from "resend";

let resend;
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("E-mailverzending is nog niet geconfigureerd.");
  }
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendSetPasswordEmail({ origin, to, name, token, isInvite }) {
  const resend = getResend();
  const link = `${origin}/reset-password?token=${token}`;

  const subject = isInvite
    ? "Je bent uitgenodigd voor de AI Organisatie Transformatie Simulator"
    : "Wachtwoord opnieuw instellen";

  const intro = isInvite
    ? `Je hebt toegang gekregen tot de AI Organisatie Transformatie Simulator. Klik op de link hieronder om een wachtwoord in te stellen.`
    : `Er is een verzoek gedaan om je wachtwoord opnieuw in te stellen. Klik op de link hieronder om een nieuw wachtwoord te kiezen.`;

  const { error } = await resend.emails.send({
    from: "AI Organisatie Transformatie Simulator <noreply@transformation-simulation.ai>",
    to,
    subject,
    html: `
      <p>Hoi${name ? ` ${name}` : ""},</p>
      <p>${intro}</p>
      <p><a href="${link}">${link}</a></p>
      <p>Deze link is een uur geldig.</p>
    `,
  });

  if (error) throw new Error(error.message ?? "Versturen mislukt.");
}

/**
 * Een mail van een adviseur aan een klant met een invul- of aanleverlink. De inhoud wordt in
 * src/mailLink.js opgebouwd; hier gaat het alleen om het versturen. Antwoorden van de klant gaan
 * naar de adviseur (replyTo), niet naar het noreply-adres.
 */
export async function sendLinkEmail({ to, replyTo, bcc, subject, text, html }) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: "House of Digital <noreply@transformation-simulation.ai>",
    to,
    ...(replyTo ? { replyTo } : {}),
    ...(bcc ? { bcc } : {}),
    subject,
    text,
    html,
  });
  if (error) throw new Error(error.message ?? "Versturen mislukt.");
}
