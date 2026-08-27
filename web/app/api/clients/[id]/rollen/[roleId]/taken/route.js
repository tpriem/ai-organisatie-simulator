import { NextResponse } from "next/server";
import { readResults, writeResults } from "@/lib/clientStore";
import {
  calculateRole,
  calculateOrganisatie,
  calculateSubtotalenPerAfdeling,
} from "../../../../../../../../src/calculate.js";
import { calculateCompetentieTop5 } from "../../../../../../../../src/competencyTop5.js";
import { calculateCompetentieProfiel } from "../../../../../../../../src/competencyProfile.js";

function getOrigineelTaken(role) {
  if (role.taken) return role.taken;
  // Fallback voor resultaten van vóór dit veld bestond.
  return role.scenarios.realistisch.taken.map((t) => ({
    omschrijving: t.omschrijving,
    categorie: t.categorie,
    categorieLabel: t.categorieLabel,
    aandeel: t.aandeel,
  }));
}

export async function PATCH(request, { params }) {
  const { id, roleId } = await params;
  const { taken } = await request.json();

  if (!Array.isArray(taken) || taken.length === 0) {
    return NextResponse.json({ error: "Ongeldige taken-array" }, { status: 400 });
  }

  const results = await readResults(id);
  if (!results) {
    return NextResponse.json({ error: "Geen analyse gevonden voor deze klant" }, { status: 404 });
  }

  const idx = results.rollen.findIndex((r) => (r.roleId ?? r.rolnaam) === roleId);
  if (idx === -1) {
    return NextResponse.json({ error: "Rol niet gevonden" }, { status: 404 });
  }

  const role = results.rollen[idx];
  const origineelTaken = getOrigineelTaken(role);

  let recomputed;
  try {
    recomputed = calculateRole({
      rolnaam: role.rolnaam,
      afdeling: role.afdeling,
      fte: role.fte,
      urenPerWeek: role.urenPerWeek,
      kostenPerUur: role.kostenPerUur,
      taken,
    });
  } catch (err) {
    return NextResponse.json({ error: `Kon niet herberekenen: ${err.message}` }, { status: 400 });
  }

  results.rollen[idx] = {
    ...role,
    taken: origineelTaken,
    takenAangepast: taken,
    scenarios: recomputed.scenarios,
    competentieTop5: calculateCompetentieTop5(recomputed.scenarios.realistisch.taken, role.taakCompetenties),
    competentieProfiel: calculateCompetentieProfiel(
      recomputed.scenarios.realistisch.taken,
      role.taakCompetenties,
      role.nieuweCompetenties,
      role.competentieMeta
    ),
  };

  results.organisatieTotaal = calculateOrganisatie(results.rollen);
  results.subtotalenPerAfdeling = calculateSubtotalenPerAfdeling(results.rollen);

  await writeResults(id, results, { reden: `taakverdeling aangepast voor ${role.rolnaam}` });
  return NextResponse.json(results);
}
