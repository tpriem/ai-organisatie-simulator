import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config.js";

const TOOL_NAME = "report_competenties";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: "Rapporteer de competentieverschuiving voor een rol als gevolg van AI-transformatie.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      competenties: {
        type: "array",
        description: "5-8 kerncompetenties voor deze rol, met een inschatting van hun belang nu en na de transformatie.",
        items: {
          type: "object",
          properties: {
            naam: { type: "string", description: "Naam van de competentie, bijv. 'Empathie', 'Data-invoer', 'AI-prompting'." },
            belangNu: { type: "integer", enum: [1, 2, 3, 4, 5], description: "Belang van deze competentie in de huidige functie (1=laag, 5=zeer hoog)." },
            belangNa: { type: "integer", enum: [1, 2, 3, 4, 5], description: "Verwacht belang van deze competentie na de AI-transformatie (realistisch scenario)." },
            toelichting: { type: "string", description: "Eén korte zin die de verschuiving verklaart." },
          },
          required: ["naam", "belangNu", "belangNa", "toelichting"],
          additionalProperties: false,
        },
      },
    },
    required: ["competenties"],
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
      (t) =>
        `- ${t.omschrijving} (${t.categorieLabel}, ${(t.aandeel * 100).toFixed(0)}% van de functie, ${(
          t.automatiseringspercentage * 100
        ).toFixed(0)}% automatiseerbaar)`
    )
    .join("\n");
}

/**
 * Analyseert welke competenties voor een rol in belang toe- of afnemen door de
 * AI-transformatie, op basis van het functieprofiel en de al berekende taakverdeling.
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
        content: `Je analyseert hoe de competenties van de rol "${rolnaam}" verschuiven door AI-transformatie.

Functieprofiel:
"""
${profileText}
"""

Taakverdeling met automatiseringspotentieel (realistisch scenario):
${summarizeTaken(takenRealistisch)}

Instructies:
1. Noem 5-8 kerncompetenties die relevant zijn voor deze rol, zowel competenties die nu belangrijk zijn als competenties die na de transformatie belangrijker worden (bijv. empathie, kritisch denken, AI-prompting, verandermanagement, kwaliteitscontrole van AI-output) en competenties die minder belangrijk worden (bijv. handmatige data-invoer, routinematige administratie).
2. Baseer "belangNa" expliciet op welk deel van de taken automatiseerbaar is: als een taak grotendeels wegvalt, neemt de bijbehorende uitvoerende competentie af, maar competenties nodig om AI-output te controleren of complexere/overgebleven taken op te pakken nemen toe.
3. Wees concreet en specifiek voor deze rol, geen generieke lijst.`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(`Antwoord van Claude afgekapt door max_tokens-limiet bij competentie-analyse voor "${rolnaam}".`);
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || !toolUse.input.competenties?.length) {
    throw new Error(`Claude gaf geen (volledige) competentie-analyse terug voor rol "${rolnaam}".`);
  }
  return toolUse.input.competenties;
}
