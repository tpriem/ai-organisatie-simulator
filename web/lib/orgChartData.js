/**
 * Bereidt de data voor de organogram-visualisatie (voor/na per rol) voor.
 * Geen hiërarchie beschikbaar (roster bevat geen "rapporteert aan"), dus dit is
 * een FTE-vergelijking huidig vs. realistisch vs. agressief per rol, geschaald
 * t.o.v. de rol met de meeste FTE.
 */
export function buildOrgChartData(rollen) {
  const maxFte = Math.max(...rollen.map((r) => r.fte), 1);
  return {
    maxFte,
    rollen: rollen.map((r) => ({
      rolnaam: r.rolnaam,
      fteHuidig: r.fte,
      fteRealistisch: r.scenarios.realistisch.fteOver,
      fteAgressief: r.scenarios.agressief.fteOver,
    })),
  };
}
