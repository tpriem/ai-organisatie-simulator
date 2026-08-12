import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { profilesDir, getClientMeta } from "@/lib/clientStore";

const ALLOWED_EXT = [".docx", ".pdf", ".txt", ".md"];

function safeBaseName(name) {
  return path.basename(name).replace(/[/\\]/g, "_");
}

export async function POST(request, { params }) {
  const { id } = await params;
  if (!getClientMeta(id)) return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll("files");
  if (files.length === 0) return NextResponse.json({ error: "Geen bestanden ontvangen" }, { status: 400 });

  const dir = profilesDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const saved = [];
  const skipped = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      skipped.push(file.name);
      continue;
    }
    const safeName = safeBaseName(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(dir, safeName), buffer);
    saved.push(safeName);
  }

  return NextResponse.json({ ok: true, saved, skipped });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { fileName } = await request.json();
  const dir = profilesDir(id);
  const target = path.join(dir, safeBaseName(fileName));
  if (fs.existsSync(target)) fs.rmSync(target);
  return NextResponse.json({ ok: true });
}
