import { createHash } from "node:crypto";
import { TASK_CATEGORIES } from "./config.js";
import { calculateRole } from "./calculate.js";
import { calculateCompetentieTop5 } from "./competencyTop5.js";
import { calculateCompetentieProfiel } from "./competencyProfile.js";
import { isHandmatig } from "./waardetype.js";

// Dezelfde invoer hoort dezelfde uitkomst te geven. De taakverdeling komt van een taalmodel, en dat
// antwoordt niet elke keer precies gelijk: een tweede analyse van dezelfde bestanden gaf andere
// totalen. Daarom bewaart elke rol een sleutel van de invoer waarop de inschatting is gemaakt. Is die
// bij een volgende analyse gelijk, dan wordt de eerdere inschatting hergebruikt en alleen opnieuw
// doorgerekend (FTE, uren en kosten uit het functieoverzicht mogen wel veranderd zijn).

/** Verhoog dit als de AI-instructie zo verandert dat oude inschattingen niet meer vergelijkbaar zijn. */
export const ANALYSE_VERSIE = "2";

const witruimte = (t) => String(t ?? "").replace(/\s+/g, " ").trim();

/** De sleutel van alles wat de inschatting van het model bepaalt: instructie, categorieën, rol en profiel. */
export function invoerSleutel({ rolLabel, profielTekst }) {
  const categorieen = TASK_CATEGORIES.map((c) => `${c.id}:${c.label}`).join("|");
  return createHash("sha256")
    .update(JSON.stringify([ANALYSE_VERSIE, categorieen, witruimte(rolLabel), witruimte(profielTekst)]))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Bouwt het resultaat van een rol op uit een eerdere inschatting, of geeft null als die er niet is of
 * op andere invoer was gebaseerd. De handmatige keuzes van de adviseur (taakverdeling, waardetype)
 * worden hier niet toegepast: dat doen neemAangepasteTakenOver en neemHandmatigeWaardetypesOver daarna,
 * net als bij een verse inschatting.
 */
export function hergebruikRol(vorigeRol, row, sleutel) {
  if (!vorigeRol || !sleutel || vorigeRol.invoerSleutel !== sleutel) return null;
  if (!Array.isArray(vorigeRol.taken) || vorigeRol.taken.length === 0) return null;

  const taken = vorigeRol.taken.map((t) => ({ omschrijving: t.omschrijving, categorie: t.categorie, aandeel: t.aandeel }));
  let rol;
  try {
    rol = calculateRole({ ...row, taken });
  } catch {
    // Bijvoorbeeld een categorie die niet meer bestaat: dan is opnieuw inschatten de enige weg.
    return null;
  }

  const handmatig = isHandmatig(vorigeRol);
  rol.waardetype = (handmatig ? vorigeRol.waardetypeAI : vorigeRol.waardetype) ?? null;
  rol.waardetypeToelichting = (handmatig ? vorigeRol.waardetypeToelichtingAI : vorigeRol.waardetypeToelichting) ?? "";

  for (const veld of ["competentieLijst", "taakCompetenties", "nieuweCompetenties", "competentieMeta", "beroepsmatch", "ongematchteTaken"]) {
    if (vorigeRol[veld] !== undefined) rol[veld] = vorigeRol[veld];
  }
  rol.competentieTop5 = calculateCompetentieTop5(rol.scenarios.realistisch.taken, rol.taakCompetenties);
  rol.competentieProfiel = calculateCompetentieProfiel(
    rol.scenarios.realistisch.taken,
    rol.taakCompetenties,
    rol.nieuweCompetenties,
    rol.competentieMeta
  );

  rol.invoerSleutel = sleutel;
  rol.ingeschatOp = vorigeRol.ingeschatOp ?? null;
  return rol;
}

/**
 * Is de nieuwe analyse dezelfde als de vorige? Dan hoeven de aanbevelingen niet opnieuw geschreven te
 * worden, en blijft een goedgekeurde tekst staan.
 */
export function analyseOngewijzigd(vorige, nieuw) {
  if (!vorige?.rollen?.length || !nieuw?.rollen?.length) return false;
  if (vorige.rollen.length !== nieuw.rollen.length) return false;
  if ((vorige.missingProfiles?.length ?? 0) !== (nieuw.missingProfiles?.length ?? 0)) return false;
  if ((nieuw.mislukteRollen?.length ?? 0) > 0) return false;
  const oud = new Map(vorige.rollen.map((r) => [r.roleId, r]));
  const dichtbij = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 1e-6;
  return nieuw.rollen.every((r) => {
    const o = oud.get(r.roleId);
    return (
      o &&
      o.invoerSleutel &&
      o.invoerSleutel === r.invoerSleutel &&
      dichtbij(o.fte, r.fte) &&
      dichtbij(o.scenarios?.realistisch?.fteWeg, r.scenarios?.realistisch?.fteWeg) &&
      dichtbij(o.scenarios?.agressief?.fteWeg, r.scenarios?.agressief?.fteWeg) &&
      o.waardetype === r.waardetype
    );
  });
}
