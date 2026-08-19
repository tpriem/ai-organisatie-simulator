import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordReset } from "@/lib/userStore";
import { sendSetPasswordEmail } from "@/lib/mail";

export async function POST(request) {
  const { email } = await request.json();
  const origin = request.nextUrl.origin;

  // Altijd hetzelfde antwoord, ongeacht of het account bestaat — voorkomt dat je kunt
  // aftasten welke e-mailadressen een account hebben.
  try {
    const user = email?.trim() ? await getUserByEmail(email.trim()) : null;
    if (user) {
      const token = await createPasswordReset(user.id);
      await sendSetPasswordEmail({ origin, to: user.email, name: user.name, token, isInvite: false });
    }
  } catch {
    // stil negeren
  }

  return NextResponse.json({ ok: true });
}
