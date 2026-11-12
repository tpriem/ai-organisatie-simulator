import { auth } from "@/auth";
import { leesJson, schrijfJson } from "./jsonBestand";
import { voegToe, schoonLogboek } from "../../src/logboek.js";

// Het logboek staat als JSON-bestand in de opslag van de klant, net als de metingen en de links, en
// verdwijnt dus mee als de klant wordt verwijderd. Twee handelingen op precies hetzelfde moment kunnen
// elkaars regel overschrijven; voor een logboek van een handvol adviseurs is dat aanvaardbaar.

const pad = (klantId) => `${klantId}/logboek.json`;

/** Legt een handeling vast. Faalt nooit hard: een logregel mag de handeling zelf niet blokkeren. */
export async function logActie(klantId, actie, details = {}) {
  try {
    const sessie = await auth().catch(() => null);
    const huidige = (await leesJson(pad(klantId))) ?? [];
    await schrijfJson(pad(klantId), voegToe(huidige, { actie, details, door: sessie?.user?.email ?? null }));
  } catch (err) {
    console.error(`[logboek] vastleggen mislukt voor klant ${klantId}: ${err?.message}`);
  }
}

export async function leesLogboek(klantId) {
  return schoonLogboek((await leesJson(pad(klantId))) ?? []);
}
