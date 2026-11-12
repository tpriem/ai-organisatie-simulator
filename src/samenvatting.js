import { nl } from "./formatNl.js";

/**
 * De kern van de capaciteitsanalyse voor wie maar één scherm leest: waar komt de meeste tijd vrij, per
 * afdeling en per functie. Alleen wat uit de berekening volgt; geen oordeel.
 * @returns {{ afdelingen: object[], functies: object[] }}
 */
export function kernpunten(results, { aantal = 3, scenario = "realistisch" } = {}) {
  const rollen = results?.rollen ?? [];
  const totaalVrij = rollen.reduce((s, r) => s + (r.scenarios?.[scenario]?.fteWeg ?? 0), 0);
  const aandeel = (fte) => (totaalVrij > 0 ? fte / totaalVrij : 0);

  const afdelingen = (results?.subtotalenPerAfdeling ?? [])
    .map((s) => ({
      naam: s.afdeling,
      fteVrij: s.scenarios?.[scenario]?.totaalFteWeg ?? 0,
      fteHuidig: s.scenarios?.[scenario]?.totaalFteHuidig ?? 0,
    }))
    .filter((a) => a.fteVrij > 0)
    .sort((a, b) => b.fteVrij - a.fteVrij)
    .slice(0, aantal)
    .map((a) => ({ ...a, aandeel: aandeel(a.fteVrij), deelVanEigenTijd: a.fteHuidig > 0 ? a.fteVrij / a.fteHuidig : 0 }));

  const functies = rollen
    .map((r) => ({
      naam: r.roleLabel ?? r.rolnaam,
      fteVrij: r.scenarios?.[scenario]?.fteWeg ?? 0,
      fteHuidig: r.fte ?? 0,
    }))
    .filter((f) => f.fteVrij > 0)
    .sort((a, b) => b.fteVrij - a.fteVrij)
    .slice(0, aantal)
    .map((f) => ({ ...f, aandeel: aandeel(f.fteVrij), deelVanEigenTijd: f.fteHuidig > 0 ? f.fteVrij / f.fteHuidig : 0 }));

  return { afdelingen, functies };
}

/** "Wonen (16 FTE, 41% van de eigen tijd)" */
export function kernpuntTekst(p) {
  return `${p.naam} (${nl(p.fteVrij, p.fteVrij >= 10 ? 0 : 1)} FTE, ${nl(p.deelVanEigenTijd * 100, 0)}% van de eigen tijd)`;
}
