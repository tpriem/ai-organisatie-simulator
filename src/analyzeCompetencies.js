import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./config.js";
import { matchOccupations, buildCandidateSkills, skillIdByLabel, getSkill } from "./esco.js";

const TOOL_NAME = "report_taak_competenties";

// Sentinel in de enum: liever expliciet "geen passende match" dan dat Claude een taak
// forceert op een competentie die er net naast zit. Komt dit vaak voor bij één rol, dan
// zit de beroepsmatch ernaast en is dat zichtbaar in plaats van stil verborgen.
export const GEEN_MATCH = "(geen passende ESCO-competentie)";

export function bouwSchema(kandidaatLabels) {
  const enumWaarden = [...kandidaatLabels, GEEN_MATCH];
  return {
    name: TOOL_NAME,
    description:
      "Koppel de taken van een rol aan competenties uit de meegeleverde ESCO-lijst, en benoem welke competenties de rol ná automatisering nieuw nodig heeft.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        taakCompetenties: {
          type: "array",
          description:
            "Eén item per taak uit de taaklijst — élke taak moet voorkomen, met taakIndex 0-based — met de 1-2 meest bepalende competenties.",
          items: {
            type: "object",
            properties: {
              taakIndex: { type: "integer" },
              competenties: {
                type: "array",
                description: "1 tot 2 competenties, letterlijk overgenomen uit de meegeleverde lijst.",
                items: { type: "string", enum: enumWaarden },
              },
            },
            required: ["taakIndex", "competenties"],
            additionalProperties: false,
          },
        },
        nieuweCompetenties: {
          type: "array",
          description:
            "Precies 3 tot 6 competenties die deze rol ná de transformatie nieuw nodig heeft en nu nog geen rol spelen — bijvoorbeeld het beoordelen van AI-output of het afhandelen van uitzonderingen. Dit veld mag nooit leeg blijven.",
          items: {
            type: "object",
            properties: {
              naam: { type: "string", enum: enumWaarden },
              belang: { type: "integer", description: "Relatief belang, 1 (nuttig) tot 5 (onmisbaar)." },
              toelichting: { type: "string", description: "Eén zin: waarom deze competentie nieuw nodig wordt." },
            },
            required: ["naam", "belang", "toelichting"],
            additionalProperties: false,
          },
        },
      },
      required: ["taakCompetenties", "nieuweCompetenties"],
      additionalProperties: false,
    },
  };
}

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
 * Koppelt de taken van een rol aan ESCO-competenties en bepaalt wat de rol ná de
 * transformatie nieuw nodig heeft.
 *
 * De competenties komen uit een gecontroleerd vocabulaire (ESCO, de EU-classificatie)
 * in plaats van dat Claude ze vrij formuleert. Dat is afgedwongen via een enum in het
 * tool-schema, niet via een instructie in de prompt — Claude kán er dus niet buiten
 * kiezen. Zo zijn competenties vergelijkbaar tussen rollen en klanten, en is per
 * competentie de trainbaarheid af te leiden uit ESCO's eigen metadata.
 *
 * @returns {{ taakCompetenties, nieuweCompetenties, competentieLijst, competentieMeta, beroepsmatch, ongematchteTaken }}
 */
export async function analyzeCompetencies(
  rolnaam,
  profileText,
  takenRealistisch,
  matchNaam = rolnaam,
  { deadline = null } = {}
) {
  // Matchen op de kale functietitel, niet op het label met afdeling erbij: "Financieel
  // administratief medewerker (Finance)" kwam door dat ene extra woord uit op
  // "financieel directeur" in plaats van "administratief medewerker". De afdeling zegt
  // iets over waar de rol hangt, niet over wat het werk is.
  const beroepen = matchOccupations(matchNaam, 3);
  const kandidaten = buildCandidateSkills(beroepen.map((b) => b.id));

  if (kandidaten.length === 0) {
    throw new Error(
      `Geen ESCO-competenties beschikbaar voor "${rolnaam}". Is de ESCO-dataset gebouwd? (node scripts/buildEscoDataset.mjs)`
    );
  }

  const kandidaatLabels = kandidaten.map((k) => k.label);
  const beroepsregel = beroepen.length
    ? `Deze rol lijkt in de ESCO-classificatie het meest op: ${beroepen.map((b) => b.label).join(", ")}.`
    : "Er is geen duidelijk passend ESCO-beroep gevonden voor deze rol.";

  const prompt = `Je analyseert welke competenties nodig zijn voor de rol "${rolnaam}".

${beroepsregel}

Functieprofiel:
"""
${profileText}
"""

Taaklijst met automatiseringspotentieel (realistisch scenario):
${summarizeTaken(takenRealistisch)}

Beschikbare competenties (ESCO — kies uitsluitend hieruit, letterlijk overgenomen):
${kandidaatLabels.map((l) => `- ${l}`).join("\n")}

Instructies:
1. Tag élke taak (alle ${takenRealistisch.length}, op taakIndex) met de 1-2 competenties die het meest bepalend zijn om die taak uit te voeren. Past er echt niets uit de lijst, kies dan "${GEEN_MATCH}" — forceer geen competentie die er net naast zit.
2. Benoem daarna 3-6 competenties die deze rol ná de transformatie níeuw nodig heeft en die nu nog geen rol spelen. Denk aan wat er ontstaat wanneer routinewerk wegvalt: het beoordelen van AI-output, het afhandelen van uitzonderingen, of het opvangen van de complexere gevallen die overblijven. Kies ook hier uitsluitend uit de lijst.
3. Wees specifiek voor deze rol, niet generiek.

Lever taakCompetenties voor alle ${takenRealistisch.length} taken en minstens 3 nieuwe competenties; een gedeeltelijk antwoord is onbruikbaar.`;

  // Het antwoord komt er soms onvolledig uit — één getagde taak in plaats van alle, en
  // een lege lijst nieuwe competenties. Dat is niet aan een foutmelding te merken, dus
  // controleren we hier expliciet op volledigheid en proberen we het opnieuw. Zonder
  // deze controle zou een half antwoord stilzwijgend een onzinnig profiel opleveren.
  const anthropic = getClient();
  let result = null;
  let laatsteTekort = "";

  for (let poging = 1; poging <= 3; poging++) {
    // Een herkansing kost al gauw tien seconden. Zit de serverless-limiet dichtbij, dan
    // is het beter om te stoppen met wat we hebben dan halverwege afgekapt te worden:
    // in dat laatste geval verliest de klant de analyse van álle rollen.
    if (poging > 1 && deadline && Date.now() > deadline) {
      break;
    }

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      tools: [bouwSchema(kandidaatLabels)],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content:
            poging === 1
              ? prompt
              : `${prompt}\n\nLet op: een eerdere poging leverde een onvolledig antwoord (${laatsteTekort}). Geef nu het volledige antwoord.`,
        },
      ],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error(`Antwoord van Claude afgekapt door max_tokens-limiet bij competentie-analyse voor "${rolnaam}".`);
    }

    const kandidaatResultaat = message.content.find((block) => block.type === "tool_use")?.input;
    const getagd = new Set(
      (kandidaatResultaat?.taakCompetenties ?? [])
        .map((t) => t.taakIndex)
        .filter((i) => Number.isInteger(i) && i >= 0 && i < takenRealistisch.length)
    );
    const aantalNieuw = (kandidaatResultaat?.nieuweCompetenties ?? []).length;

    if (getagd.size === takenRealistisch.length && aantalNieuw >= 3) {
      result = kandidaatResultaat;
      break;
    }
    laatsteTekort = `${getagd.size} van ${takenRealistisch.length} taken getagd, ${aantalNieuw} nieuwe competenties`;
  }

  if (!result) {
    const reden =
      deadline && Date.now() > deadline
        ? "tijdslimiet bereikt voordat een volledig antwoord binnen was"
        : "na 3 pogingen geen volledig antwoord";
    throw new Error(`Competentie-analyse onvolledig voor rol "${rolnaam}" — ${reden} (laatste: ${laatsteTekort}).`);
  }

  // maxItems wordt niet ondersteund in strict tool-schema's, dus de 1-2 grens hier
  // afdwingen. Meteen de sentinel eruit filteren: die telt niet mee als competentie.
  let ongematchteTaken = 0;
  const taakCompetenties = result.taakCompetenties.map((tag) => {
    const schoon = (tag.competenties ?? []).filter((c) => c !== GEEN_MATCH).slice(0, 2);
    if (schoon.length === 0) ongematchteTaken++;
    return { taakIndex: tag.taakIndex, competenties: schoon };
  });

  const nieuweCompetenties = (result.nieuweCompetenties ?? [])
    .filter((n) => n?.naam && n.naam !== GEEN_MATCH)
    .map((n) => ({
      naam: n.naam,
      belang: Math.min(5, Math.max(1, n.belang ?? 3)),
      toelichting: n.toelichting ?? "",
    }));

  // Metadata meegeven voor alles wat daadwerkelijk gebruikt is, zodat de
  // trainbaarheidsberekening geen toegang tot de volledige dataset nodig heeft.
  const gebruikt = new Set([
    ...taakCompetenties.flatMap((t) => t.competenties),
    ...nieuweCompetenties.map((n) => n.naam),
  ]);
  const competentieMeta = {};
  for (const label of gebruikt) {
    const id = skillIdByLabel(label, kandidaten);
    const skill = id ? getSkill(id) : null;
    if (skill) {
      competentieMeta[label] = { escoId: id, type: skill.type, reuse: skill.reuse, cat: skill.cat };
    }
  }

  return {
    taakCompetenties,
    nieuweCompetenties,
    competentieLijst: [...gebruikt],
    competentieMeta,
    beroepsmatch: beroepen[0] ? { id: beroepen[0].id, label: beroepen[0].label, score: beroepen[0].score } : null,
    ongematchteTaken,
  };
}
