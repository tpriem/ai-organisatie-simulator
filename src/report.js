import { SCENARIOS } from "./config.js";

function pct(n) {
  return `${(n * 100).toFixed(0)}%`;
}

function eur(n) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function scenarioRange(getValue, roleResults) {
  const values = SCENARIOS.map((s) => getValue(s));
  return `${values[0]} – ${values[1]}`;
}

export function buildTextReport({ bedrijfsnaam, roleResults, orgTotals, missingProfiles }) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`AI ORGANISATIE TRANSFORMATIE SIMULATOR — Nulmeting & scenario's`);
  push(`Bedrijf: ${bedrijfsnaam ?? "(niet opgegeven)"}`);
  push(`Gegenereerd: ${new Date().toISOString().slice(0, 10)}`);
  push("=".repeat(70));
  push();

  if (missingProfiles?.length) {
    push(`⚠ Rollen zonder functieprofiel (overgeslagen in analyse): ${missingProfiles.join(", ")}`);
    push();
  }

  push("--- ORGANISATIE-TOTAAL ---");
  push(
    `Huidig: ${orgTotals.realistisch.totaalFteHuidig.toFixed(1)} FTE, ${roleResults.length} rollen geanalyseerd`
  );
  push(
    `Automatiseerbare capaciteit (range Realistisch–Agressief): ${pct(
      orgTotals.realistisch.reductiePercentageOrganisatie
    )} – ${pct(orgTotals.agressief.reductiePercentageOrganisatie)}`
  );
  push(
    `FTE die potentieel vrijkomt: ${orgTotals.realistisch.totaalFteWeg.toFixed(
      1
    )} – ${orgTotals.agressief.totaalFteWeg.toFixed(1)} FTE`
  );
  push(
    `Geschatte kostenbesparing per jaar: ${eur(orgTotals.realistisch.totaalKostenBesparingPerJaar)} – ${eur(
      orgTotals.agressief.totaalKostenBesparingPerJaar
    )}`
  );
  push();
  push("Let op: dit zijn scenario-ranges op basis van gepubliceerd onderzoek, geen exacte voorspelling.");
  push();

  push("--- PER ROL ---");
  for (const role of roleResults) {
    push();
    push(`${role.rolnaam}  (${role.fte} FTE, ${role.urenPerWeek} u/week, ${eur(role.kostenPerUur)}/uur)`);
    for (const scenario of SCENARIOS) {
      const s = role.scenarios[scenario];
      push(
        `  ${scenario.padEnd(12)} reductie ${pct(s.reductiePercentage)} | FTE weg ${s.fteWeg.toFixed(
          2
        )} | FTE over ${s.fteOver.toFixed(2)} | besparing/jaar ${eur(s.kostenBesparingPerJaar)}`
      );
    }
    push("  Taakverdeling (aandeel functie → categorie, realistisch automatiseringspercentage):");
    for (const taak of role.scenarios.realistisch.taken) {
      push(`    - ${pct(taak.aandeel)} ${taak.categorieLabel}: "${taak.omschrijving}"`);
    }
  }

  push();
  push("--- NIEUW ORGANOGRAM (indicatief, per scenario) ---");
  for (const scenario of SCENARIOS) {
    push(`  [${scenario}]`);
    for (const role of roleResults) {
      const s = role.scenarios[scenario];
      push(`    ${role.rolnaam}: ${role.fte} FTE → ${s.fteOver.toFixed(2)} FTE`);
    }
  }

  return lines.join("\n");
}

export function buildJsonReport({ bedrijfsnaam, roleResults, orgTotals, missingProfiles }) {
  return {
    bedrijfsnaam: bedrijfsnaam ?? null,
    gegenereerdOp: new Date().toISOString(),
    missingProfiles: missingProfiles ?? [],
    organisatieTotaal: orgTotals,
    rollen: roleResults,
  };
}
