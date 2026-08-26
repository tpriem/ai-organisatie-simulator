// Trainbaarheid per competentie — puur een lookup op ESCO-metadata, geen Claude-call.
//
// De indeling volgt ESCO's eigen structuur (skillType + reuseLevel + de transversale
// pijler), die samenvalt met het ijsbergmodel van Spencer & Spencer (1993): kennis en
// beroepsspecifieke vaardigheden zitten boven de waterlijn en zijn met opleiding te
// ontwikkelen; transversale "attitudes & waarden" zitten eronder en laten zich niet
// zomaar aanleren. Zo hoeven we geen eigen classificatie te verzinnen.

export const TRAINABILITY_TIERS = [
  {
    id: "hoog",
    label: "Hoog trainbaar",
    toelichting: "Kennis of beroepsspecifieke vaardigheid — met opleiding te ontwikkelen.",
    actie: "ontwikkelen",
  },
  {
    id: "midden",
    label: "Midden trainbaar",
    toelichting: "Transversale vaardigheid — te ontwikkelen via coaching en ervaring, niet via een cursus alleen.",
    actie: "ontwikkelen",
  },
  {
    id: "laag",
    label: "Laag trainbaar",
    toelichting: "Attitude of drijfveer — laat zich moeilijk aanleren; toets hierop bij de huidige bezetting.",
    actie: "toetsen",
  },
];

export const TRAINABILITY_IDS = TRAINABILITY_TIERS.map((t) => t.id);

export function getTrainabilityTier(id) {
  return TRAINABILITY_TIERS.find((t) => t.id === id) ?? null;
}

/** Trainbaar = met ontwikkeling te overbruggen. Alleen "laag" valt hierbuiten. */
export function isTrainbaar(tierId) {
  return tierId === "hoog" || tierId === "midden";
}

/**
 * Bepaalt de trainbaarheidstier van één ESCO-skill.
 *
 * Verwacht de genormaliseerde metadata die scripts/buildEscoDataset.mjs wegschrijft:
 *   { type: "knowledge" | "skill", reuse: "transversal" | "cross-sector" |
 *     "sector-specific" | "occupation-specific", cat: "attitudes" | ... | null }
 *
 * Geeft null terug als de metadata ontbreekt (bijv. bij analyses van vóór de
 * ESCO-koppeling) — de aanroeper hoort dat als "onbekend" te behandelen en er geen
 * conclusies aan te verbinden.
 */
export function getTrainability(skillMeta) {
  if (!skillMeta) return null;

  // Kennis is per definitie overdraagbaar via opleiding.
  if (skillMeta.type === "knowledge") return "hoog";

  // Hoe smaller toepasbaar, hoe concreter en dus beter aanleerbaar.
  if (skillMeta.reuse === "occupation-specific" || skillMeta.reuse === "sector-specific") {
    return "hoog";
  }

  // Onder in de ijsberg: attitudes en waarden.
  if (skillMeta.cat === "attitudes") return "laag";

  // Transversaal/sectoroverschrijdend, maar wél een vaardigheid: denken, taal,
  // kennistoepassing, sociale interactie.
  if (skillMeta.reuse === "transversal" || skillMeta.reuse === "cross-sector") {
    return "midden";
  }

  return null;
}
