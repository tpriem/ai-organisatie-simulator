/**
 * Bereidt de data voor het organogram voor: organisatie → afdelingen → rollen.
 *
 * Het roster kent geen rapportagelijnen ("rapporteert aan"), dus dit is geen echte
 * hiërarchie. De afdeling is wél beschikbaar en geeft een herkenbaar organisatiebeeld
 * in plaats van een platte lijst rollen. Per afdeling tonen we het FTE-totaal nu versus
 * na de transformatie, met de rollen eronder.
 *
 * Zonder afdelingen in het roster valt het terug op één naamloze groep met alle rollen —
 * dan is het beeld gelijk aan de oude platte weergave.
 */
export function buildOrgChartData(rollen) {
  const maxFte = Math.max(...rollen.map((r) => r.fte), 1);

  const naarRol = (r) => ({
    roleId: r.roleId ?? r.rolnaam,
    rolnaam: r.rolnaam,
    label: r.roleLabel ?? r.rolnaam,
    fteHuidig: r.fte,
    fteRealistisch: r.scenarios.realistisch.fteOver,
    fteAgressief: r.scenarios.agressief.fteOver,
  });

  const groepen = new Map();
  for (const r of rollen) {
    const key = r.afdeling?.trim() || "";
    if (!groepen.has(key)) groepen.set(key, []);
    groepen.get(key).push(r);
  }

  const heeftAfdelingen = [...groepen.keys()].some((k) => k !== "");

  const afdelingen = [...groepen.entries()].map(([naam, rijen]) => {
    const rolData = rijen.map(naarRol);
    const som = (kies) => rolData.reduce((t, r) => t + kies(r), 0);
    return {
      afdeling: naam || "Overig",
      rollen: rolData,
      fteHuidig: som((r) => r.fteHuidig),
      fteRealistisch: som((r) => r.fteRealistisch),
      fteAgressief: som((r) => r.fteAgressief),
    };
  });

  // Grootste afdeling bovenaan: daar zit doorgaans de meeste impact.
  afdelingen.sort((a, b) => b.fteHuidig - a.fteHuidig);

  const totaal = (kies) => afdelingen.reduce((t, a) => t + kies(a), 0);

  return {
    maxFte,
    heeftAfdelingen,
    // Schaal voor de afdelingsbalken; die zijn groter dan losse rollen.
    maxAfdelingFte: Math.max(...afdelingen.map((a) => a.fteHuidig), 1),
    afdelingen,
    organisatie: {
      fteHuidig: totaal((a) => a.fteHuidig),
      fteRealistisch: totaal((a) => a.fteRealistisch),
      fteAgressief: totaal((a) => a.fteAgressief),
    },
    // Platte lijst blijft beschikbaar voor weergaven die geen groepering tonen.
    rollen: rollen.map(naarRol),
  };
}
