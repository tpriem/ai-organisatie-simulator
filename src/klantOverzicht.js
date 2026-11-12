import { profielenOpNaam, matchRosterToProfiles } from "./parseProfiles.js";
import { roleId, roleLabel } from "./roleIdentity.js";

/**
 * Het controle-overzicht van een klant: de rollen uit het functieoverzicht, welke daarvan een
 * functieprofiel hebben, en de totalen. De koppeling gaat op bestandsnaam: de profielen zelf worden
 * hier niet gelezen (bij vijftig profielen scheelde dat ruim tien seconden per keer dat de pagina
 * opent). Of een profiel leesbaar is, blijkt bij de analyse.
 *
 * @param {object[]} rosterRows  uitkomst van parseRoster
 * @param {string[]} profileFiles bestandsnamen van de profielen
 */
export function bouwRosterCheck(rosterRows, profileFiles) {
  let matchedIds = new Set();
  try {
    const { matched } = matchRosterToProfiles(rosterRows, profielenOpNaam(profileFiles ?? []));
    matchedIds = new Set(matched.map((r) => roleId(r)));
  } catch {
    // rollen tonen dan als "nog niet gekoppeld"
  }

  const rollen = rosterRows.map((r) => ({
    roleId: roleId(r),
    rolnaam: r.rolnaam,
    roleLabel: roleLabel(r),
    afdeling: r.afdeling ?? "",
    fte: r.fte,
    urenPerWeek: r.urenPerWeek,
    kostenPerUur: r.kostenPerUur,
    loonkostenPerJaar: r.fte * r.urenPerWeek * r.kostenPerUur * 52,
    gekoppeld: matchedIds.has(roleId(r)),
  }));

  const som = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
  const fteVan = (rows) => som(rows, (r) => r.fte);
  const urenVan = (rows) => som(rows, (r) => r.fte * r.urenPerWeek);
  const loonVan = (rows) => som(rows, (r) => r.fte * r.urenPerWeek * r.kostenPerUur);

  const groepen = new Map();
  for (const r of rosterRows) {
    const key = r.afdeling?.trim() || "";
    if (!groepen.has(key)) groepen.set(key, []);
    groepen.get(key).push(r);
  }
  const heeftAfdelingen = [...groepen.keys()].some((k) => k !== "");
  const subtotalenPerAfdeling = heeftAfdelingen
    ? [...groepen.entries()].map(([afdeling, rows]) => {
        const fte = fteVan(rows);
        const urenWeek = urenVan(rows);
        const loonWeek = loonVan(rows);
        return {
          afdeling: afdeling || "Geen afdeling",
          aantalRollen: rows.length,
          totaalFte: fte,
          gewogenUrenPerWeek: fte > 0 ? urenWeek / fte : 0,
          gewogenKostenPerUur: urenWeek > 0 ? loonWeek / urenWeek : 0,
          totaalLoonkostenPerJaar: loonWeek * 52,
        };
      })
    : [];

  const totaalFte = fteVan(rosterRows);
  const totaalUren = urenVan(rosterRows);
  const totaalLoon = loonVan(rosterRows);

  return {
    totaalRollen: rosterRows.length,
    gekoppeld: rollen.filter((r) => r.gekoppeld).length,
    // De rollen die zonder profiel niet meetellen in een analyse: de waarschuwing vooraf leest deze lijst.
    zonderProfiel: rollen.filter((r) => !r.gekoppeld).map((r) => r.roleLabel),
    rollen,
    subtotalenPerAfdeling,
    totalen: {
      totaalFte,
      gewogenUrenPerWeek: totaalFte > 0 ? totaalUren / totaalFte : 0,
      gewogenKostenPerUur: totaalUren > 0 ? totaalLoon / totaalUren : 0,
      totaalLoonkostenPerJaar: totaalLoon * 52,
    },
  };
}
