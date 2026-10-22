import { leesJson, schrijfJson } from "./jsonBestand";
import { maakToken, splitsToken, geheimKlopt, nieuweLink, linkActief } from "../../src/links.js";

// De links van een klant staan in `<klant>/links.json`. Het geheim zelf wordt nooit bewaard,
// alleen de hash ervan. Zie src/links.js voor de opzet.

const pad = (klantId) => `${klantId}/links.json`;

export async function readLinks(klantId) {
  const g = await leesJson(pad(klantId));
  return Array.isArray(g?.links) ? g.links : [];
}

const schrijf = (klantId, links) => schrijfJson(pad(klantId), { links });

/**
 * Maakt een link en geeft het token terug. Dit is het enige moment waarop het geheim bekend is.
 * @returns {{ link: object, token: string }}
 */
export async function maakLink(klantId, { type, rol = null, label = "", invullerId = null }) {
  const { token, hash } = maakToken(klantId);
  const link = nieuweLink({ type, hash, rol, label, invullerId });
  const bestaand = await readLinks(klantId);
  // Er is hooguit één actieve aanleverlink tegelijk: een nieuwe vervangt de vorige.
  const behouden =
    type === "aanlever" ? bestaand.map((l) => (l.type === "aanlever" && !l.ingetrokken ? { ...l, ingetrokken: true } : l)) : bestaand;
  await schrijf(klantId, [...behouden, link]);
  return { link, token };
}

/**
 * Zoekt de link bij een token uit een URL en controleert type, geheim en geldigheid.
 * Geeft null bij alles wat niet klopt, zonder te vertellen waarom: een bezoeker mag niet kunnen
 * raden of een klant-id bestaat.
 */
export async function zoekLink(token, type) {
  const delen = splitsToken(token);
  if (!delen) return null;
  const links = await readLinks(delen.klantId);
  const link = links.find((l) => l.type === type && geheimKlopt(delen.geheim, l.hash));
  if (!link || !linkActief(link)) return null;
  return { klantId: delen.klantId, link };
}

export async function trekLinkIn(klantId, linkId) {
  const links = await readLinks(klantId);
  const gevonden = links.find((l) => l.id === linkId);
  if (!gevonden) return null;
  await schrijf(klantId, links.map((l) => (l.id === linkId ? { ...l, ingetrokken: true } : l)));
  return gevonden;
}

export async function markeerGebruikt(klantId, linkId) {
  const links = await readLinks(klantId);
  if (!links.some((l) => l.id === linkId)) return;
  await schrijf(klantId, links.map((l) => (l.id === linkId ? { ...l, laatsteGebruik: new Date().toISOString() } : l)));
}
