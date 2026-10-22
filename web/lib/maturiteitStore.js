import { leesJson, schrijfJson, verwijderBestand } from "./jsonBestand";
import { leegeInvoer, schoonInvoer, schoneAntwoorden } from "../../src/volwassenheid.js";

// De AI-volwassenheidsmetingen staan als JSON-bestand in de opslag van de klant, naast
// het roster en de profielen. Zo is er geen databasemigratie nodig, en verdwijnen ze
// vanzelf mee wanneer een klant wordt verwijderd (removeAllUnderPrefix in clientStore).
//
// Structuur: { huidig: <invoer>, metingen: [snapshot, ...] }. De invoer is die van
// src/volwassenheid.js (scope, doelen, invullers, geldend). De metingen zijn vastgelegde
// momenten, nieuwste eerst; `huidig` is het werkdocument.
//
// Invullers die via een link invullen (bron "link") hebben hun antwoorden in een eigen bestand,
// `invuller-<id>.json`. Zo kunnen een invuller en de adviseur tegelijk werken zonder elkaars
// antwoorden te overschrijven. readMaturiteit voegt ze samen; opslaan bewaart ze nooit mee.

const MAX_METINGEN = 10;
const leeg = () => ({ huidig: leegeInvoer(), metingen: [] });
const pad = (id) => `${id}/maturiteit.json`;
const invullerPad = (klantId, invullerId) => `${klantId}/invuller-${invullerId}.json`;

/** De antwoorden en de status van een invuller via een link. */
export async function leesInvullerBestand(klantId, invullerId) {
  const g = await leesJson(invullerPad(klantId, invullerId));
  if (!g) return null;
  return {
    antwoorden: schoneAntwoorden(g.antwoorden),
    status: ["nieuw", "bezig", "ingediend"].includes(g.status) ? g.status : "nieuw",
    bijgewerktOp: typeof g.bijgewerktOp === "string" ? g.bijgewerktOp : null,
    ingediendOp: typeof g.ingediendOp === "string" ? g.ingediendOp : null,
  };
}

export async function schrijfInvullerBestand(klantId, invullerId, inhoud) {
  await schrijfJson(invullerPad(klantId, invullerId), inhoud);
}

export async function verwijderInvullerBestand(klantId, invullerId) {
  await verwijderBestand(invullerPad(klantId, invullerId)).catch(() => {});
}

async function leesBasis(id) {
  const gelezen = await leesJson(pad(id));
  if (!gelezen) return leeg();
  return {
    // Een bestand uit een eerdere opzet heeft andere velden; die verdwijnen bij het schonen.
    huidig: schoonInvoer(gelezen.huidig),
    // Alleen metingen van dit raamwerk (die hebben een raamwerkVersie).
    metingen: (Array.isArray(gelezen.metingen) ? gelezen.metingen : []).filter((m) => typeof m?.raamwerkVersie === "string"),
  };
}

export async function readMaturiteit(id) {
  const basis = await leesBasis(id);
  const invullers = await Promise.all(
    basis.huidig.invullers.map(async (i) => {
      if (i.bron !== "link") return i;
      const bestand = await leesInvullerBestand(id, i.id);
      if (!bestand) return { ...i, status: "nieuw" };
      return { ...i, ...bestand, bron: "link" };
    })
  );
  return { huidig: { ...basis.huidig, invullers }, metingen: basis.metingen };
}

/**
 * Slaat het werkdocument op. De antwoorden van invullers via een link worden niet meegeschreven
 * (die staan in hun eigen bestand), en een stuk dat de adviseur niet kent, zoals een invuller die
 * net is uitgenodigd, wordt niet weggegooid.
 */
export async function saveHuidigeMeting(id, huidig) {
  const bestaand = await leesBasis(id);
  const serverLinkInvullers = bestaand.huidig.invullers.filter((i) => i.bron === "link");
  const eigen = huidig.invullers.filter((i) => i.bron !== "link");
  const invullers = [...eigen, ...serverLinkInvullers.map((i) => ({ ...i, antwoorden: {}, bewijs: {} }))];
  await schrijfJson(pad(id), { ...bestaand, huidig: { ...huidig, invullers } });
}

export async function leggMetingVast(id, snapshot) {
  const bestaand = await leesBasis(id);
  const metingen = [snapshot, ...bestaand.metingen].slice(0, MAX_METINGEN);
  await schrijfJson(pad(id), { ...bestaand, metingen });
  return metingen;
}

export async function verwijderMeting(id, op) {
  const bestaand = await leesBasis(id);
  const metingen = bestaand.metingen.filter((m) => m.op !== op);
  if (metingen.length === bestaand.metingen.length) return null;
  await schrijfJson(pad(id), { ...bestaand, metingen });
  return metingen;
}

/** Voegt een invuller toe die via een link invult. Alleen de adviseur-API roept dit aan. */
export async function voegLinkInvullerToe(id, { invullerId, rol, label }) {
  const bestaand = await leesBasis(id);
  const invullers = [...bestaand.huidig.invullers, { id: invullerId, rol, label, bron: "link", status: "nieuw", antwoorden: {}, bewijs: {} }];
  await schrijfJson(pad(id), { ...bestaand, huidig: { ...bestaand.huidig, invullers } });
  await schrijfInvullerBestand(id, invullerId, { antwoorden: {}, status: "nieuw", bijgewerktOp: null, ingediendOp: null });
}

/** Haalt een invuller via een link weer weg, met zijn antwoorden. */
export async function verwijderLinkInvuller(id, invullerId) {
  const bestaand = await leesBasis(id);
  const invullers = bestaand.huidig.invullers.filter((i) => i.id !== invullerId);
  await schrijfJson(pad(id), { ...bestaand, huidig: { ...bestaand.huidig, invullers } });
  await verwijderInvullerBestand(id, invullerId);
}
