import { getSupabase, FILES_BUCKET } from "./supabase";

// JSON-bestanden in de opslag van de klant die vaak worden overschreven (metingen, links,
// antwoorden van invullers). De opslag van Supabase serveert objecten achter een CDN: direct
// teruglezen na schrijven gaf de oude inhoud (gemeten in productie). Daarom lezen via een
// kortlevende ondertekende link met een tijdstempel en zonder cache, en schrijven met
// cacheControl 0.

/** Leest een JSON-bestand. Null als het niet bestaat of niet te lezen is. */
export async function leesJson(pad) {
  const { data: link, error } = await getSupabase().storage.from(FILES_BUCKET).createSignedUrl(pad, 60);
  if (error || !link?.signedUrl) return null;
  const res = await fetch(`${link.signedUrl}&t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  try {
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
}

export async function schrijfJson(pad, inhoud) {
  const { error } = await getSupabase()
    .storage.from(FILES_BUCKET)
    .upload(pad, Buffer.from(JSON.stringify(inhoud)), { contentType: "application/json", upsert: true, cacheControl: "0" });
  if (error) throw error;
}

export async function verwijderBestand(pad) {
  const { error } = await getSupabase().storage.from(FILES_BUCKET).remove([pad]);
  if (error) throw error;
}
