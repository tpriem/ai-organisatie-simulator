// Waar de vrijgekomen capaciteit naartoe gaat, per waardetype. Dit is de beslissing
// die de analyse blootlegt: kostenreductie levert een eenmalig voordeel dat
// wegconcurreert zodra AI gemeengoed is, capaciteit die naar kwaliteit of volume gaat
// stapelt. Zonder deze uitsplitsing leest "6,6 FTE komt vrij" automatisch als besparing.
// Eén kleurcode, gebruikt in het blok "Waar gaat die capaciteit heen?" en in het organogram.
export const BESTEMMING_STIJL = {
  kostenreductie: { balk: "bg-slate-400", tekst: "text-slate-700" },
  capaciteitsgroei: { balk: "bg-indigo-500", tekst: "text-indigo-700" },
  kwaliteitsverbetering: { balk: "bg-hod-cyan", tekst: "text-hod-cyan" },
  onbepaald: { balk: "bg-slate-200", tekst: "text-slate-400" },
};
