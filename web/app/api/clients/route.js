import { NextResponse } from "next/server";
import { listClients, createClient } from "@/lib/clientStore";

export async function GET() {
  return NextResponse.json(await listClients());
}

export async function POST(request) {
  const { naam } = await request.json();
  if (!naam || !naam.trim()) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }
  const client = await createClient(naam.trim());
  return NextResponse.json(client, { status: 201 });
}
