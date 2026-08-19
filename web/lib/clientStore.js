import { getSupabase, FILES_BUCKET } from "./supabase";

function rowToClient(row) {
  return {
    id: row.id,
    naam: row.naam,
    sector: row.sector,
    scope: row.scope,
    scopeLabel: row.scope_label,
    createdAt: row.created_at,
  };
}

export async function listClients() {
  const { data, error } = await getSupabase()
    .from("clients")
    .select("id, naam, sector, scope, scope_label, created_at")
    .order("naam");
  if (error) throw error;
  return data.map(rowToClient);
}

export async function createClient(naam) {
  const { data, error } = await getSupabase()
    .from("clients")
    .insert({ naam })
    .select("id, naam, sector, scope, scope_label, created_at")
    .single();
  if (error) throw error;
  return rowToClient(data);
}

export async function getClientMeta(id) {
  const { data, error } = await getSupabase()
    .from("clients")
    .select("id, naam, sector, scope, scope_label, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data) : null;
}

export async function updateClientMeta(id, patch) {
  const dbPatch = {};
  if ("naam" in patch) dbPatch.naam = patch.naam;
  if ("sector" in patch) dbPatch.sector = patch.sector;
  if ("impact" in patch) dbPatch.impact = patch.impact;
  if ("readiness" in patch) dbPatch.readiness = patch.readiness;
  if ("scope" in patch) dbPatch.scope = patch.scope;
  if ("scopeLabel" in patch) dbPatch.scope_label = patch.scopeLabel;

  const { data, error } = await getSupabase()
    .from("clients")
    .update(dbPatch)
    .eq("id", id)
    .select("id, naam, sector, scope, scope_label, created_at")
    .maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data) : null;
}

async function removeAllUnderPrefix(supabase, prefix) {
  const { data: rootFiles } = await supabase.storage.from(FILES_BUCKET).list(prefix, { limit: 1000 });
  const paths = [];
  for (const entry of rootFiles ?? []) {
    if (entry.id === null) continue; // subfolder placeholder, handled below
    paths.push(`${prefix}/${entry.name}`);
  }
  const { data: profileFiles } = await supabase.storage.from(FILES_BUCKET).list(`${prefix}/profiles`, { limit: 1000 });
  for (const entry of profileFiles ?? []) {
    paths.push(`${prefix}/profiles/${entry.name}`);
  }
  if (paths.length > 0) {
    await supabase.storage.from(FILES_BUCKET).remove(paths);
  }
}

export async function deleteClient(id) {
  const supabase = getSupabase();
  await removeAllUnderPrefix(supabase, id);
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export async function readAnswers(id) {
  const { data, error } = await getSupabase()
    .from("clients")
    .select("sector, impact, readiness, scope, scope_label")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { sector: null, impact: {}, readiness: {}, scope: "bedrijf", scopeLabel: "" };
  return {
    sector: data.sector,
    impact: data.impact ?? {},
    readiness: data.readiness ?? {},
    scope: data.scope ?? "bedrijf",
    scopeLabel: data.scope_label ?? "",
  };
}

export async function readResults(id) {
  const { data, error } = await getSupabase().from("clients").select("results").eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.results ?? null;
}

export async function writeResults(id, results) {
  const { error } = await getSupabase().from("clients").update({ results }).eq("id", id);
  if (error) throw error;
}

const CONTENT_TYPES = {
  ".csv": "text/csv",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

function contentTypeFor(fileName) {
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function uploadRoster(id, fileName, buffer) {
  const supabase = getSupabase();
  const { data: existing } = await supabase.storage.from(FILES_BUCKET).list(id, { limit: 1000 });
  const oldRosterFiles = (existing ?? []).filter((f) => f.id !== null && f.name.startsWith("roster.")).map((f) => `${id}/${f.name}`);
  if (oldRosterFiles.length > 0) {
    await supabase.storage.from(FILES_BUCKET).remove(oldRosterFiles);
  }

  const storedName = `roster${fileName.slice(fileName.lastIndexOf("."))}`;
  const { error } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(`${id}/${storedName}`, buffer, { contentType: contentTypeFor(storedName), upsert: true });
  if (error) throw error;
  return storedName;
}

export async function getRosterInfo(id) {
  const supabase = getSupabase();
  const { data } = await supabase.storage.from(FILES_BUCKET).list(id, { limit: 1000 });
  const rosterFile = (data ?? []).find((f) => f.id !== null && f.name.startsWith("roster."));
  return rosterFile ? { fileName: rosterFile.name } : null;
}

export async function getRosterBuffer(id) {
  const info = await getRosterInfo(id);
  if (!info) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(FILES_BUCKET).download(`${id}/${info.fileName}`);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  return { fileName: info.fileName, buffer };
}

export async function uploadProfiles(id, files) {
  const supabase = getSupabase();
  const saved = [];
  for (const { fileName, buffer } of files) {
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(`${id}/profiles/${fileName}`, buffer, { contentType: contentTypeFor(fileName), upsert: true });
    if (error) throw error;
    saved.push(fileName);
  }
  return saved;
}

export async function listProfileFiles(id) {
  const supabase = getSupabase();
  const { data } = await supabase.storage.from(FILES_BUCKET).list(`${id}/profiles`, { limit: 1000 });
  return (data ?? []).filter((f) => f.id !== null).map((f) => f.name);
}

export async function deleteProfileFile(id, fileName) {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(FILES_BUCKET).remove([`${id}/profiles/${fileName}`]);
  if (error) throw error;
}

export async function getProfileBuffers(id) {
  const fileNames = await listProfileFiles(id);
  const supabase = getSupabase();
  const files = [];
  for (const fileName of fileNames) {
    const { data, error } = await supabase.storage.from(FILES_BUCKET).download(`${id}/profiles/${fileName}`);
    if (error) throw error;
    files.push({ fileName, buffer: Buffer.from(await data.arrayBuffer()) });
  }
  return files;
}
