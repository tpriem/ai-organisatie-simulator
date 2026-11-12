import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordReset } from "@/lib/userStore";
import { sendSetPasswordEmail } from "@/lib/mail";
import { maakBegrenzer } from "../../../../../src/begrenzer.js";

// Hooguit drie herstelmails per adres per uur, en twintig per uur in totaal per serverinstantie. Zo kan
// niemand een postvak volstorten of de mailquota opmaken. Het antwoord blijft altijd hetzelfde.
const perAdres = maakBegrenzer({ limiet: 3 });
const totaal = maakBegrenzer({ limiet: 20 });

export async function POST(request) {
  const { email } = await request.json();
  const origin = request.nextUrl.origin;

  // Altijd hetzelfde antwoord, ongeacht of het account bestaat — voorkomt dat je kunt
  // aftasten welke e-mailadressen een account hebben.
  try {
    const adres = typeof email === "string" ? email.trim().toLowerCase().slice(0, 254) : "";
    const user = adres && perAdres(adres) && totaal("alle") ? await getUserByEmail(adres) : null;
    if (user) {
      const token = await createPasswordReset(user.id);
      await sendSetPasswordEmail({ origin, to: user.email, name: user.name, token, isInvite: false });
    }
  } catch {
    // stil negeren
  }

  return NextResponse.json({ ok: true });
}
