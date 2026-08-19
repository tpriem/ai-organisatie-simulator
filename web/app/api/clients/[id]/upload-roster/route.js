import { NextResponse } from "next/server";
import path from "node:path";
import { getClientMeta, uploadRoster } from "@/lib/clientStore";

const ALLOWED_EXT = [".csv", ".xlsx", ".xls"];

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file) return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `Bestandstype ${ext} niet ondersteund. Gebruik .csv of .xlsx.` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = await uploadRoster(id, file.name, buffer);

  return NextResponse.json({ ok: true, fileName });
}
