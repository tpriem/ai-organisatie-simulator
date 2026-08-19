// Taakcategorieën & automatiseringspotentieel — bron: briefing hoofdstuk 3.3 / 6
export const TASK_CATEGORIES = [
  { id: "klantcontact", label: "Eenvoudig klantcontact & 1e lijns support", realistisch: 0.70, agressief: 0.85 },
  { id: "accountmanagement", label: "Accountmanagement & relatiebeheer", realistisch: 0.20, agressief: 0.35 },
  { id: "data_entry", label: "Data entry & administratie", realistisch: 0.75, agressief: 0.90 },
  { id: "research", label: "Informatie zoeken & research", realistisch: 0.70, agressief: 0.85 },
  { id: "schrijven", label: "Schrijven & documentatie", realistisch: 0.70, agressief: 0.85 },
  { id: "analyseren", label: "Analyseren & rapporteren", realistisch: 0.55, agressief: 0.75 },
  { id: "sourcing", label: "Sourcing & leadgeneratie", realistisch: 0.65, agressief: 0.85 },
  { id: "plannen", label: "Plannen & coördineren", realistisch: 0.45, agressief: 0.65 },
  { id: "compliance", label: "Compliance & juridisch werk", realistisch: 0.35, agressief: 0.60 },
  { id: "creatief", label: "Creatief denkwerk", realistisch: 0.20, agressief: 0.40 },
  { id: "strategisch", label: "Strategisch denkwerk", realistisch: 0.25, agressief: 0.45 },
  { id: "technisch", label: "Technisch werk & coderen", realistisch: 0.50, agressief: 0.75 },
];

export const TASK_CATEGORY_IDS = TASK_CATEGORIES.map((c) => c.id);

export function getCategory(id) {
  const cat = TASK_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Onbekende taakcategorie: ${id}`);
  return cat;
}

export const SCENARIOS = ["realistisch", "agressief"];

// Hoe vrijgekomen capaciteit voor deze rol het beste te lezen is — gebaseerd op hoe
// grote onderzoeken (McKinsey, BCG, WEF) automatisering framen: niet uniform als
// kostenbesparing, maar afhankelijk van of de rol waarde-creërend of ondersteunend is.
export const WAARDETYPES = [
  { id: "kostenreductie", label: "Kostenreductie", icon: "💰" },
  { id: "capaciteitsgroei", label: "Capaciteitsgroei", icon: "📈" },
  { id: "kwaliteitsverbetering", label: "Kwaliteitsverbetering", icon: "✨" },
];
export const WAARDETYPE_IDS = WAARDETYPES.map((w) => w.id);

export function getWaardetype(id) {
  return WAARDETYPES.find((w) => w.id === id) ?? null;
}

export const CLAUDE_MODEL = "claude-sonnet-5";
