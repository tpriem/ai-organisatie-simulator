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
        description:
          "Functies waar naar verhouding de meeste tijd vrijkomt. Beschrijf in de toelichting welk werk AI overneemt en waar de vrijgekomen tijd naartoe kan (ander werk, meer huurders of woningen bedienen, hogere kwaliteit). Schrijf niet over krimp, ontslag of het schrappen van functies.",
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
        description:
          "Combinaties van functies waarvan het werk dat overblijft sterk overlapt, zodat het zinvol is ze samen te bekijken of anders in te delen. Alleen als het echt past.",
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
        `- ${r.roleLabel ?? r.rolnaam}: ${r.fte} FTE; van de tijd komt realistisch ${(r.scenarios.realistisch.reductiePercentage * 100).toFixed(
          0
        )}% vrij (${r.scenarios.realistisch.fteWeg.toFixed(1)} FTE), ambitieus ${(
          r.scenarios.agressief.reductiePercentage * 100
        ).toFixed(0)}%. Bestemming van die tijd: ${r.waardetype ?? "nog niet bepaald"}. Belangrijkste taakcategorieën: ${topCategorieen}.`
      );
    })
    .join("\n");
}

/**
 * Genereert organisatiebrede bevindingen en aanbevelingen op basis van alle rol-analyses.
 */
export async function generateAanbevelingen(bedrijfsnaam, roleResults) {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Je bent een organisatieadviseur die voor woningcorporatie "${bedrijfsnaam ?? "deze organisatie"}" bevindingen en aanbevelingen opstelt, op basis van een analyse van wat AI in het werk kan overnemen.

Uitgangspunt: de analyse laat zien hoeveel tijd er per functie vrijkomt. Dat is capaciteit, geen bezuiniging. De vraag voor de organisatie is waar die tijd het meeste oplevert: meer aandacht voor huurders en wijken, achterstanden wegwerken, hogere kwaliteit, of groei opvangen zonder extra mensen. Schrijf daarom over tijd die vrijkomt en hoe die in te zetten, over ander werk, omscholing en herplaatsing. Schrijf niet over krimp, reductie van functies, ontslag of mensen die "weg kunnen". Het gaat om technisch potentieel, niet om een voorspelling.

Analyse per functie (realistisch scenario, tenzij anders vermeld):
${summarizeRoles(roleResults)}

Instructies:
1. Schrijf een korte samenvatting van de belangrijkste bevindingen, in gewone taal voor een directie.
2. Noem de functies waar naar verhouding de meeste tijd vrijkomt (meer dan de helft is een sterk signaal, maar gebruik je eigen oordeel), met wat AI daar overneemt en waar de tijd naartoe kan.
3. Noem functies die in waarde kunnen groeien, of nieuw werk dat nodig wordt (bijvoorbeeld toezicht op de kwaliteit van AI, begeleiding van de verandering).
4. Noem functies waarvan het werk dat overblijft sterk overlapt en die daarom samen bekeken kunnen worden. Alleen als dat er echt uitziet; verzin het niet.
5. Geef 4 tot 6 concrete, uitvoerbare aanbevelingen voor het anders inrichten van werk en processen, geen algemeenheden. Houd rekening met de sector: betrek de ondernemingsraad en de huurdersorganisatie waar dat past, en begin waar huurders er het meeste van merken.`,
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
