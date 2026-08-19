import { NextResponse } from "next/server";
import path from "node:path";
import { getClientMeta, uploadProfiles, deleteProfileFile } from "@/lib/clientStore";

const ALLOWED_EXT = [".docx", ".pdf", ".txt", ".md"];

function safeBaseName(name) {
  return path.basename(name).replace(/[/\\]/g, "_");
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!(await getClientMeta(id))) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files");
  if (files.length === 0) return NextResponse.json({ error: "Geen bestanden ontvangen" }, { status: 400 });

  const toUpload = [];
  const skipped = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      skipped.push(file.name);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    toUpload.push({ fileName: safeBaseName(file.name), buffer });
  }

  const saved = toUpload.length > 0 ? await uploadProfiles(id, toUpload) : [];

  return NextResponse.json({ ok: true, saved, skipped });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { fileName } = await request.json();
  await deleteProfileFile(id, safeBaseName(fileName));
  return NextResponse.json({ ok: true });
}
