import { getSupabase, FILES_BUCKET } from "./supabase";
import { BESTAND_SOORTEN, UPLOAD_LIMIETEN, schoneBestandsnaam } from "../../src/links.js";

// Bestanden die een klant via de aanleverlink binnenbrengt, komen eerst in een inbox
// (`<klant>/inbox/<soort>/<naam>`) en worden pas door de adviseur overgenomen naar het echte
// roster of de functieprofielen. Zo kan een link nooit een bestaand roster overschrijven.

const map = (klantId, soort) => `${klantId}/inbox/${soort}`;

/** Alle bestanden in de inbox, per soort. */
export async function lijstInbox(klantId) {
  const uit = [];
  for (const soort of Object.keys(BESTAND_SOORTEN)) {
    const { data } = await getSupabase().storage.from(FILES_BUCKET).list(map(klantId, soort), { limit: 200 });
    for (const f of data ?? []) {
      if (f.id === null) continue;
      uit.push({ soort, naam: f.name, grootte: f.metadata?.size ?? 0, op: f.created_at ?? f.updated_at ?? null });
    }
  }
  return uit.sort((a, b) => String(b.op).localeCompare(String(a.op)));
}

/**
 * Zet een bestand in de inbox. Controleert de aantallen en de totale omvang. Een nieuw roster
 * vervangt een eerder roster in de inbox (er is er maar één).
 */
export async function zetInInbox(klantId, soort, naam, buffer) {
  const huidig = await lijstInbox(klantId);
  const anders = huidig.filter((f) => !(f.soort === soort && f.naam === naam));
  const maxVoorSoort = BESTAND_SOORTEN[soort].max;

  if (soort === "roster") {
    const supabase = getSupabase();
    const oud = huidig.filter((f) => f.soort === "roster" && f.naam !== naam).map((f) => `${map(klantId, "roster")}/${f.naam}`);
    if (oud.length) await supabase.storage.from(FILES_BUCKET).remove(oud);
  } else if (anders.filter((f) => f.soort === soort).length >= maxVoorSoort) {
    return { ok: false, fout: `Er zijn al ${maxVoorSoort} bestanden aangeleverd; meer is niet mogelijk.` };
  }
  if (anders.length >= UPLOAD_LIMIETEN.maxBestanden) return { ok: false, fout: "Er zijn al te veel bestanden aangeleverd." };
  if (anders.reduce((s, f) => s + (f.grootte ?? 0), 0) + buffer.length > UPLOAD_LIMIETEN.maxTotaalBytes) {
    return { ok: false, fout: "De totale omvang van de aangeleverde bestanden is te groot." };
  }

  const { error } = await getSupabase()
    .storage.from(FILES_BUCKET)
    .upload(`${map(klantId, soort)}/${naam}`, buffer, { upsert: true, contentType: "application/octet-stream" });
  if (error) throw error;
  return { ok: true };
}

export async function verwijderUitInbox(klantId, soort, naam) {
  const schoon = schoneBestandsnaam(naam);
  if (!schoon || !BESTAND_SOORTEN[soort]) return false;
  const { error } = await getSupabase().storage.from(FILES_BUCKET).remove([`${map(klantId, soort)}/${schoon}`]);
  if (error) throw error;
  return true;
}

export async function leesUitInbox(klantId, soort, naam) {
  const schoon = schoneBestandsnaam(naam);
  if (!schoon || !BESTAND_SOORTEN[soort]) return null;
  const { data, error } = await getSupabase().storage.from(FILES_BUCKET).download(`${map(klantId, soort)}/${schoon}`);
  if (error) return null;
  return { naam: schoon, buffer: Buffer.from(await data.arrayBuffer()) };
}
