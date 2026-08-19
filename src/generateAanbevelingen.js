import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config.js";

const TOOL_NAME = "report_aanbevelingen";

const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: "Rapporteer organisatiebrede bevindingen en aanbevelingen op basis van de rol-analyses.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      bevindingenSamenvatting: {
        type: "string",
        description: "Een samenvattende alinea (3-5 zinnen) met de belangrijkste bevindingen van de analyse.",
      },
      krimpendeRollen: {
        type: "array",
        description: "Rollen die sterk krimpen door automatisering.",
        items: {
          type: "object",
          properties: {
            rolnaam: { type: "string" },
            toelichting: { type: "string" },
          },
          required: ["rolnaam", "toelichting"],
          additionalProperties: false,
        },
      },
      groeiendeRollen: {
        type: "array",
        description: "Rollen die juist meer waarde/capaciteit kunnen leveren met dezelfde bezetting (outputgroei), of nieuwe rollen die nodig worden (bijv. AI-kwaliteitscontrole).",
        items: {
          type: "object",
          properties: {
            rolnaam: { type: "string" },
            toelichting: { type: "string" },
          },
          required: ["rolnaam", "toelichting"],
          additionalProperties: false,
        },
      },
      samenvoegKandidaten: {
        type: "array",
        description: "Combinaties van rollen die door de afname aan taken samengevoegd zouden kunnen worden.",
        items: {
          type: "object",
          properties: {
            rollen: { type: "array", items: { type: "string" } },
            toelichting: { type: "string" },
          },
          required: ["rollen", "toelichting"],
          additionalProperties: false,
        },
      },
      aanbevelingen: {
        type: "array",
        description: "4-6 concrete aanbevelingen voor het herontwerp van rollen en processen.",
        items: {
          type: "object",
          properties: {
            titel: { type: "string" },
            beschrijving: { type: "string" },
          },
          required: ["titel", "beschrijving"],
          additionalProperties: false,
        },
      },
    },
    required: ["bevindingenSamenvatting", "krimpendeRollen", "groeiendeRollen", "samenvoegKandidaten", "aanbevelingen"],
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

function summarizeRoles(roleResults) {
  return roleResults
    .map((r) => {
      const topCategorieen = [...r.scenarios.realistisch.taken]
        .sort((a, b) => b.aandeel - a.aandeel)
        .slice(0, 3)
        .map((t) => t.categorieLabel)
        .join(", ");
      return (
        `- ${r.roleLabel ?? r.rolnaam}: ${r.fte} FTE, reductie realistisch ${(r.scenarios.realistisch.reductiePercentage * 100).toFixed(
          0
        )}% (${r.fte} → ${r.scenarios.realistisch.fteOver.toFixed(2)} FTE), agressief ${(
          r.scenarios.agressief.reductiePercentage * 100
        ).toFixed(0)}%. Belangrijkste taakcategorieën: ${topCategorieen}.`
      );
    })
    .join("\n");
}

/**
 * Genereert organisatiebrede bevindingen en aanbevelingen op basis van alle rol-analyses
 * en (optioneel) de sector-positionering.
 */
export async function generateAanbevelingen(bedrijfsnaam, roleResults, sectorAnalyse) {
  const anthropic = getClient();

  const sectorContext = sectorAnalyse
    ? `\n\nSectorcontext: ${sectorAnalyse.sector.sector}, eindscore ${sectorAnalyse.eindscore.toFixed(1)}/5, urgentie: ${sectorAnalyse.urgentie}. Positionering: ${sectorAnalyse.positionering}`
    : "";

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Je bent een organisatieadviseur die op basis van een AI-transformatie-analyse van "${bedrijfsnaam ?? "deze organisatie"}" bevindingen en aanbevelingen opstelt.

Rol-analyses (realistisch scenario, tenzij anders vermeld):
${summarizeRoles(roleResults)}${sectorContext}

Instructies:
1. Schrijf een korte samenvatting van de belangrijkste bevindingen.
2. Wijs rollen aan die sterk krimpen (>50% reductie is een sterk signaal, maar gebruik je eigen oordeel).
3. Wijs rollen aan die kunnen groeien in waarde/output, of benoem nieuwe rollen/taken die nodig worden (bijv. toezicht op AI-kwaliteit, prompting-specialisten, verandermanagement).
4. Stel voor welke rollen samengevoegd zouden kunnen worden als hun overgebleven taken sterk overlappen — alleen als dat er daadwerkelijk uitziet, verzin het niet als het niet past.
5. Geef 4-6 concrete, uitvoerbare aanbevelingen voor het herontwerp van rollen en processen, geen algemeenheden.`,
      },
    ],
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Antwoord van Claude afgekapt door max_tokens-limiet bij het genereren van aanbevelingen.");
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || Object.keys(toolUse.input).length === 0) {
    throw new Error("Claude gaf geen (volledige) aanbevelingen terug.");
  }
  return toolUse.input;
}
