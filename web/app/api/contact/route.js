import { NextResponse } from "next/server";
import { Resend } from "resend";

const CONTACT_EMAIL = "ralf@houseofdigital.nl";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request) {
  const { naam, email, organisatie, bericht } = await request.json();

  if (!naam?.trim() || !email?.trim() || !bericht?.trim()) {
    return NextResponse.json({ error: "Naam, e-mail en bericht zijn verplicht." }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "E-mailverzending is nog niet geconfigureerd." }, { status: 500 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { error } = await resend.emails.send({
      from: "AI Organisatie Transformatie Simulator <noreply@transformation-simulation.ai>",
      to: CONTACT_EMAIL,
      replyTo: email.trim(),
      subject: `Nieuw contactverzoek: ${naam.trim()}${organisatie?.trim() ? ` (${organisatie.trim()})` : ""}`,
      html: `
        <p><strong>Naam:</strong> ${esc(naam)}</p>
        <p><strong>E-mail:</strong> ${esc(email)}</p>
        ${organisatie?.trim() ? `<p><strong>Organisatie:</strong> ${esc(organisatie)}</p>` : ""}
        <p><strong>Bericht:</strong></p>
        <p>${esc(bericht).replace(/\n/g, "<br/>")}</p>
      `,
    });

    if (error) {
      return NextResponse.json({ error: "Versturen mislukt, probeer het later opnieuw." }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Versturen mislukt, probeer het later opnieuw." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
