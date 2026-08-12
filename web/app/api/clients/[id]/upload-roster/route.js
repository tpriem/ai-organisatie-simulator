import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { clientDir, getClientMeta } from "@/lib/clientStore";

const ALLOWED_EXT = [".csv", ".xlsx", ".xls"];

export async function POST(request, { params }) {
  const { id } = await params;
  if (!getClientMeta(id)) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file) return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `Bestandstype ${ext} niet ondersteund. Gebruik .csv of .xlsx.` }, { status: 400 });
  }

  const dir = clientDir(id);
  fs.mkdirSync(dir, { recursive: true });

  // Verwijder een eventueel eerder geüpload roster-bestand.
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith("roster.")) fs.rmSync(path.join(dir, f));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, `roster${ext}`), buffer);

  return NextResponse.json({ ok: true, fileName: `roster${ext}` });
}
