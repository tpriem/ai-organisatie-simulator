import { getSupabase, FILES_BUCKET } from "./supabase";

// De AI-volwassenheidsmetingen staan als JSON-bestand in de opslag van de klant, naast
// het roster en de profielen. Zo is er geen databasemigratie nodig, en verdwijnen ze
// vanzelf mee wanneer een klant wordt verwijderd (removeAllUnderPrefix in clientStore).
//
// Structuur: { huidig: { scope, practices, indicatoren, notities }, metingen: [snapshot, ...] }
// De metingen zijn vastgelegde momenten, nieuwste eerst; `huidig` is het werkdocument.

const MAX_METINGEN = 10;
const leeg = () => ({ huidig: { scope: "", practices: {}, indicatoren: {}, notities: {} }, metingen: [] });
const pad = (id) => `${id}/maturiteit.json`;

export async function readMaturiteit(id) {
  // Een bestand dat vaak wordt overschreven mag niet uit de cache komen: de opslag van
  // Supabase serveert objecten achter een CDN, en teruglezen direct na schrijven gaf dan
  // de oude inhoud (gemeten in productie). Daarom een kortlevende ondertekende link met
  // een tijdstempel in de URL en zonder cache.
  const { data: link, error: linkFout } = await getSupabase().storage.from(FILES_BUCKET).createSignedUrl(pad(id), 60);
  // Nog geen bestand is de gewone beginsituatie, geen fout.
  if (linkFout || !link?.signedUrl) return leeg();
  const res = await fetch(`${link.signedUrl}&t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return leeg();
  try {
    const gelezen = JSON.parse(await res.text());
    return {
      huidig: gelezen.huidig ?? leeg().huidig,
      metingen: Array.isArray(gelezen.metingen) ? gelezen.metingen : [],
    };
  } catch {
    return leeg();
  }
}

async function schrijf(id, inhoud) {
  const { error } = await getSupabase()
    .storage.from(FILES_BUCKET)
    .upload(pad(id), Buffer.from(JSON.stringify(inhoud)), {
      contentType: "application/json",
      upsert: true,
      cacheControl: "0",
    });
  if (error) throw error;
}

export async function saveHuidigeMeting(id, huidig) {
  const bestaand = await readMaturiteit(id);
  await schrijf(id, { ...bestaand, huidig });
}

export async function leggMetingVast(id, snapshot) {
  const bestaand = await readMaturiteit(id);
  const metingen = [snapshot, ...bestaand.metingen].slice(0, MAX_METINGEN);
  await schrijf(id, { ...bestaand, metingen });
  return metingen;
}

export async function verwijderMeting(id, op) {
  const bestaand = await readMaturiteit(id);
  const metingen = bestaand.metingen.filter((m) => m.op !== op);
  if (metingen.length === bestaand.metingen.length) return null;
  await schrijf(id, { ...bestaand, metingen });
  return metingen;
}
