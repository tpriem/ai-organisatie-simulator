// Sectortabel — bron: briefing hoofdstuk 4.1
export const SECTORS = [
  { id: "afvalverwerking", niveau: 1, sector: "Afvalverwerking", risico: 1, kans: 5 },
  { id: "zorg", niveau: 2, sector: "Zorg", risico: 2, kans: 3 },
  { id: "bouw", niveau: 2, sector: "Bouw", risico: 2, kans: 2.5 },
  { id: "horeca", niveau: 2, sector: "Horeca", risico: 2, kans: 2.5 },
  { id: "agrarisch", niveau: 2, sector: "Agrarisch", risico: 2, kans: 2.5 },
  { id: "manufacturing", niveau: 2, sector: "Manufacturing", risico: 2, kans: 2.5 },
  { id: "energie", niveau: 2, sector: "Energie", risico: 2, kans: 2.5 },
  { id: "onderwijs", niveau: 2, sector: "Onderwijs", risico: 2, kans: 2.5 },
  { id: "overheid", niveau: 2, sector: "Overheid", risico: 2, kans: 2.5 },
  { id: "banken", niveau: 3, sector: "Banken", risico: 3, kans: 2.5 },
  { id: "transport", niveau: 2, sector: "Transport", risico: 2, kans: 2.5 },
  { id: "retail", niveau: 4, sector: "Retail", risico: 4, kans: 1.5 },
  { id: "professional_services", niveau: 4, sector: "Professional services", risico: 4, kans: 1.5 },
  { id: "ict", niveau: 4, sector: "ICT", risico: 4, kans: 1.5 },
  { id: "media_entertainment", niveau: 5, sector: "Media & Entertainment", risico: 5, kans: 2.5 },
  { id: "callcenters", niveau: 5, sector: "Callcenters", risico: 5, kans: 2.5 },
];

export function getSector(id) {
  return SECTORS.find((s) => s.id === id) ?? null;
}
