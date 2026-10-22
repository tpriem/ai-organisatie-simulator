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
  const { data, error } = await getSupabase().storage.from(FILES_BUCKET).download(pad(id));
  // Nog geen bestand is de gewone beginsituatie, geen fout.
  if (error) return leeg();
  try {
    const gelezen = JSON.parse(await data.text());
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
    .upload(pad(id), Buffer.from(JSON.stringify(inhoud)), { contentType: "application/json", upsert: true });
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
