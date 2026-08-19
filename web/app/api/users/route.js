import { NextResponse } from "next/server";
import { listUsers, createUser, createPasswordReset } from "@/lib/userStore";
import { sendSetPasswordEmail } from "@/lib/mail";

export async function GET() {
  return NextResponse.json(await listUsers());
}

export async function POST(request) {
  const { email, name } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "E-mailadres is verplicht" }, { status: 400 });
  }

  let user;
  try {
    user = await createUser({ email, name });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  const token = await createPasswordReset(user.id);
  const origin = request.nextUrl.origin;
  const setupLink = `${origin}/reset-password?token=${token}`;

  let emailSent = true;
  try {
    await sendSetPasswordEmail({ origin, to: user.email, name: user.name, token, isInvite: true });
  } catch {
    emailSent = false;
  }

  return NextResponse.json({ user, setupLink, emailSent }, { status: 201 });
}
