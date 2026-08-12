import Anthropic from "@anthropic-ai/sdk";
import { TASK_CATEGORY_IDS, TASK_CATEGORIES, CLAUDE_MODEL } from "./config.js";

const CATEGORY_LIST = TASK_CATEGORIES.map((c) => `- ${c.id}: ${c.label}`).join("\n");

const TOOL_NAME = "report_taakverdeling";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: "Rapporteer de taakverdeling van een functieprofiel, opgesplitst in taken per taakcategorie.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      taken: {
        type: "array",
        description:
          "Lijst van taken uit het functieprofiel, elk toegewezen aan precies één taakcategorie. Het aandeel van alle taken samen moet ~1.0 (100%) van de functie zijn.",
        items: {
          type: "object",
          properties: {
            omschrijving: { type: "string", description: "Korte omschrijving van de taak of taakgroep." },
            categorie: { type: "string", enum: TASK_CATEGORY_IDS },
            aandeel: {
              type: "number",
              description: "Geschat aandeel van de totale functie dat deze taak beslaat, als fractie (0-1).",
            },
          },
          required: ["omschrijving", "categorie", "aandeel"],
          additionalProperties: false,
        },
      },
    },
    required: ["taken"],
    additionalProperties: false,
  },
};

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY ontbreekt. Zet 'm in een .env-bestand of als environment variable voordat je het script draait."
      );
    }
    client = new Anthropic();
  }
  return client;
}

/**
 * Analyseert een functieprofiel-tekst met Claude en geeft een taakverdeling terug
 * over de vaste taakcategorieën. Normaliseert de aandelen zodat ze optellen tot 1.0.
 */
export async function analyzeProfile(rolnaam, profileText) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3000,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Je analyseert het functieprofiel van de rol "${rolnaam}" voor een AI-transformatiescenario.

Taakcategorieën (gebruik uitsluitend deze id's):
${CATEGORY_LIST}

Instructies:
1. Splits het functieprofiel op in concrete taken of taakgroepen.
2. Wijs elke taak toe aan precies één van bovenstaande categorieën (kies de best passende, ook als het niet perfect past).
3. Schat per taak welk aandeel (fractie 0-1) van de totale functie die taak beslaat. Alle aandelen samen moeten ongeveer optellen tot 1.0.
4. Wees specifiek: gebruik meerdere taken per categorie als het profiel dat rechtvaardigt, in plaats van alles in één categorie te proppen.

Functieprofiel:
"""
${profileText}
"""`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error(`Antwoord van Claude afgekapt door max_tokens-limiet bij taakanalyse voor "${rolnaam}".`);
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new Error(`Claude gaf geen taakverdeling terug voor rol "${rolnaam}".`);
  }

  const taken = toolUse.input.taken ?? [];
  if (taken.length === 0) {
    throw new Error(`Lege taakverdeling voor rol "${rolnaam}".`);
  }

  const totaalAandeel = taken.reduce((sum, t) => sum + t.aandeel, 0);
  const genormaliseerd = taken.map((t) => ({
    ...t,
    aandeel: totaalAandeel > 0 ? t.aandeel / totaalAandeel : 0,
  }));

  return genormaliseerd;
}
