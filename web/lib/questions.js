// Positioneringsvragen — bron: briefing hoofdstuk 4.3 / 4.4
export const IMPACT_QUESTIONS = [
  { id: "omzet_automatisering", text: "Welk percentage van jullie omzet komt uit activiteiten die de komende 3 jaar sterk geautomatiseerd kunnen worden?" },
  { id: "data_afhankelijkheid", text: "Hoe afhankelijk ben je van data of inhoud die AI makkelijk kan genereren?" },
  { id: "menselijk_contact", text: "Hoe belangrijk is persoonlijk menselijk contact voor jullie klanten? (omgekeerd gescoord)" },
  { id: "overstapdrempel", text: "Hoe makkelijk kunnen klanten overstappen naar een andere leverancier?" },
  { id: "ai_native_concurrentie", text: "Hoe groot is het concurrentierisico door nieuwe AI-native spelers in jullie markt?" },
];

export const READINESS_QUESTIONS = [
  { id: "regelgeving", text: "Hoe zwaar weegt wet- en regelgeving in jullie dagelijkse werk?" },
  { id: "veranderingsvermogen_org", text: "Hoe snel en makkelijk kan jullie organisatie zelf veranderen?" },
  { id: "veranderingsvermogen_mensen", text: "Hoe groot is de bereidheid en het veranderingsvermogen van je medewerkers?" },
  { id: "budget", text: "Is er al budget gereserveerd voor digitale transformatie en AI?" },
  { id: "menselijke_beslissingen", text: "Hoe groot is het deel van de beslissingen dat per se door mensen genomen moet worden?" },
];

export const ALL_QUESTIONS = [
  ...IMPACT_QUESTIONS.map((q) => ({ ...q, groep: "impact" })),
  ...READINESS_QUESTIONS.map((q) => ({ ...q, groep: "readiness" })),
];
