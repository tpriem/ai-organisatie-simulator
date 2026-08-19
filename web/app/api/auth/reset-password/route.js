import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumePasswordReset, setPassword } from "@/lib/userStore";

export async function POST(request) {
  const { token, password } = await request.json();

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: "Wachtwoord moet minimaal 8 tekens zijn." }, { status: 400 });
  }

  const userId = await consumePasswordReset(token);
  if (!userId) {
    return NextResponse.json({ error: "Deze link is ongeldig of verlopen." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  await setPassword(userId, hash);

  return NextResponse.json({ ok: true });
}
