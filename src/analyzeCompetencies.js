import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config.js";

const TOOL_NAME = "report_taak_competenties";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: "Tag elke taak van een rol met de 1-2 belangrijkste competenties uit een rolgebonden competentielijst.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      competentieLijst: {
        type: "array",
        description: "5-8 kerncompetenties die relevant zijn voor deze rol.",
        items: { type: "string" },
      },
      taakCompetenties: {
        type: "array",
        description:
          "Voor elke taak uit de taaklijst (zelfde volgorde en aantal, taakIndex 0-based), de 1-2 meest relevante competenties uit competentieLijst.",
        items: {
          type: "object",
          properties: {
            taakIndex: { type: "integer" },
            competenties: {
              type: "array",
              description: "1 tot 2 competenties uit competentieLijst.",
              items: { type: "string" },
            },
          },
          required: ["taakIndex", "competenties"],
          additionalProperties: false,
        },
      },
    },
    required: ["competentieLijst", "taakCompetenties"],
    additionalProperties: false,
  },
};

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY ontbreekt.");
    }
    client = new Anthropic();
  }
  return client;
}

function summarizeTaken(taken) {
  return taken
    .map(
      (t, i) =>
        `${i}. ${t.omschrijving} (${t.categorieLabel}, ${(t.aandeel * 100).toFixed(0)}% van de functie, ${(
          t.automatiseringspercentage * 100
        ).toFixed(0)}% automatiseerbaar)`
    )
    .join("\n");
}

/**
 * Tagt elke taak van een rol met de 1-2 belangrijkste competenties uit een rolgebonden
 * competentielijst, zodat het aandeel (tijdsbesteding) en automatiseringspercentage per
 * taak gebruikt kunnen worden om te berekenen welke competenties nu/na de transformatie
 * dominant zijn — in plaats van Claude zelf een los "belang"-cijfer te laten schatten.
 */
export async function analyzeCompetencies(rolnaam, profileText, takenRealistisch) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Je analyseert welke competenties nodig zijn voor de taken van de rol "${rolnaam}".

Functieprofiel:
"""
${profileText}
"""

Taaklijst met automatiseringspotentieel (realistisch scenario):
${summarizeTaken(takenRealistisch)}

Instructies:
1. Stel een lijst samen van 5-8 kerncompetenties die relevant zijn voor deze rol, zowel uitvoerende competenties (bijv. data-invoer, klantcontact) als competenties die belangrijker worden na automatisering (bijv. kritisch denken, kwaliteitscontrole van AI-output, verandermanagement).
2. Tag daarna élke taak uit de taaklijst (alle ${takenRealistisch.length} taken, op taakIndex) met de 1-2 competenties uit die lijst die het meest bepalend zijn om die specifieke taak uit te voeren.
3. Wees concreet en specifiek voor deze rol, geen generieke lijst.`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(`Antwoord van Claude afgekapt door max_tokens-limiet bij competentie-analyse voor "${rolnaam}".`);
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  const result = toolUse?.input;
  if (!result?.competentieLijst?.length || !result?.taakCompetenties?.length) {
    throw new Error(`Claude gaf geen (volledige) competentie-analyse terug voor rol "${rolnaam}".`);
  }
  // maxItems wordt niet ondersteund in strict tool-schema's, dus de 1-2 grens hier afdwingen.
  result.taakCompetenties = result.taakCompetenties.map((tag) => ({
    ...tag,
    competenties: tag.competenties.slice(0, 2),
  }));
  return result;
}
