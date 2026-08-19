import { NextResponse } from "next/server";
import { deleteUser } from "@/lib/userStore";

export async function DELETE(request, { params }) {
  const { id } = await params;
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
