import { getClientMeta, readResults } from "./clientStore";
import { readMaturiteit } from "./maturiteitStore";
import { bouwVolwassenheidsRapport } from "../../src/rapportVolwassenheid.js";

/**
 * Het gegevensmodel van het volwassenheidsrapport voor één klant, of null als de klant niet
 * bestaat. De rolanalyse is optioneel: zonder die analyse ontbreekt alleen de koppeling.
 */
export async function laadVolwassenheidsRapport(id) {
  const meta = await getClientMeta(id);
  if (!meta) return null;

  const [{ huidig, metingen }, results] = await Promise.all([readMaturiteit(id), readResults(id).catch(() => null)]);
  const datum = new Date().toLocaleDateString("nl-NL", { year: "numeric", month: "long", day: "numeric" });

  const model = bouwVolwassenheidsRapport({
    invoer: huidig,
    metingen,
    results,
    klantNaam: meta.naam,
    scope: meta.scope,
    scopeLabel: meta.scopeLabel,
    datum,
  });
  return { meta, model };
}

export const bestandsnaam = (naam, extensie) => `volwassenheid_${naam.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}.${extensie}`;
