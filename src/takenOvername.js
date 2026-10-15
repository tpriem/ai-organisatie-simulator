import { calculateRole } from "./calculate.js";
import { calculateCompetentieTop5 } from "./competencyTop5.js";
import { calculateCompetentieProfiel } from "./competencyProfile.js";

/**
 * Handmatig aangepaste taakverdeling meenemen bij een nieuwe analyse.
 *
 * De adviseur kan het aandeel per taak bijsturen (`takenAangepast`). Een nieuwe analyse
 * laat Claude de taken opnieuw afleiden, en die lijst is niet elke keer gelijk: andere
 * formulering, soms een taak meer of minder (gemeten: bij 2 van 6 rollen wisselde de
 * verzameling categorieën tussen runs). Een aangepast aandeel kan daarom niet per
 * volgnummer worden overgenomen, want dan zou "klantcontact 40%" bij een andere taak
 * terechtkomen.
 *
 * Wat de berekening bepaalt is het aandeel per categorie (de automatiseringsgraad hangt
 * aan de categorie). Dus:
 *  1. zijn de taken inhoudelijk gelijk gebleven, dan gaat elk aandeel naar dezelfde taak;
 *  2. zijn de categorieën gelijk gebleven, dan krijgt elke categorie het aandeel dat de
 *     adviseur vastlegde, naar rato verdeeld over de nieuwe taken in die categorie;
 *  3. anders is er geen eerlijke koppeling mogelijk. Dan blijft de nieuwe analyse staan en
 *     wordt de eerdere aanpassing bewaard als `takenAangepastVervallen`, zodat de adviseur
 *     het ziet in plaats van dat het stil verdwijnt.
 */

const SOM_MARGE = 0.01;

const normaal = (tekst) =>
  String(tekst ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const som = (taken) => taken.reduce((s, t) => s + (Number(t.aandeel) || 0), 0);
const afronden = (x) => Number(x.toFixed(6));

/**
 * Berekent een rol opnieuw met een andere taakverdeling. Zelfde stappen als het handmatig
 * aanpassen in de app, zodat beide wegen hetzelfde resultaat geven.
 */
export function herberekenRolMetTaken(rol, taken) {
  const berekend = calculateRole({
    rolnaam: rol.rolnaam,
    afdeling: rol.afdeling,
    rapporteertAan: rol.rapporteertAan,
    fte: rol.fte,
    urenPerWeek: rol.urenPerWeek,
    kostenPerUur: rol.kostenPerUur,
    taken,
  });
  return {
    ...rol,
    takenAangepast: taken,
    scenarios: berekend.scenarios,
    competentieTop5: calculateCompetentieTop5(berekend.scenarios.realistisch.taken, rol.taakCompetenties),
    competentieProfiel: calculateCompetentieProfiel(
      berekend.scenarios.realistisch.taken,
      rol.taakCompetenties,
      rol.nieuweCompetenties,
      rol.competentieMeta
    ),
  };
}

/**
 * Probeert de aangepaste taakverdeling op de nieuwe taken te leggen.
 * @returns {{ methode: "exact"|"categorie", taken: object[] } | null}
 */
export function koppelAangepasteTaken(nieuweTaken, aangepasteTaken) {
  if (!nieuweTaken?.length || !aangepasteTaken?.length) return null;
  if (Math.abs(som(aangepasteTaken) - 1) > SOM_MARGE) return null;

  // 1. Dezelfde taken: elk aandeel naar de taak met dezelfde omschrijving en categorie.
  if (nieuweTaken.length === aangepasteTaken.length) {
    const beschikbaar = aangepasteTaken.map((t) => ({ ...t, sleutel: normaal(t.omschrijving) }));
    const gekoppeld = [];
    for (const taak of nieuweTaken) {
      const i = beschikbaar.findIndex((o) => o.sleutel === normaal(taak.omschrijving) && o.categorie === taak.categorie);
      if (i === -1) break;
      gekoppeld.push({ ...taak, aandeel: beschikbaar[i].aandeel });
      beschikbaar.splice(i, 1);
    }
    if (gekoppeld.length === nieuweTaken.length) return { methode: "exact", taken: gekoppeld };
  }

  // 2. Dezelfde categorieën: het aandeel per categorie naar rato over de nieuwe taken.
  const perCategorie = (taken) =>
    taken.reduce((m, t) => m.set(t.categorie, (m.get(t.categorie) ?? 0) + (Number(t.aandeel) || 0)), new Map());
  const oud = perCategorie(aangepasteTaken);
  const nieuw = perCategorie(nieuweTaken);
  const gelijkeCategorieen = oud.size === nieuw.size && [...nieuw.keys()].every((c) => oud.has(c));
  if (!gelijkeCategorieen) return null;

  const aantalPerCategorie = nieuweTaken.reduce((m, t) => m.set(t.categorie, (m.get(t.categorie) ?? 0) + 1), new Map());
  const taken = nieuweTaken.map((taak) => {
    const totaalNieuw = nieuw.get(taak.categorie);
    const verhouding = totaalNieuw > 0 ? taak.aandeel / totaalNieuw : 1 / aantalPerCategorie.get(taak.categorie);
    return { ...taak, aandeel: afronden(oud.get(taak.categorie) * verhouding) };
  });
  return { methode: "categorie", taken };
}

/**
 * Neemt aangepaste taakverdelingen uit een eerdere analyse over in een nieuwe, gekoppeld
 * op roleId. Moet vóór de organisatietotalen worden toegepast: het verandert de capaciteit.
 */
export function neemAangepasteTakenOver(nieuweRollen, vorigeRollen) {
  const aangepast = new Map(
    (vorigeRollen ?? []).filter((r) => r.takenAangepast?.length).map((r) => [r.roleId ?? r.rolnaam, r])
  );
  if (aangepast.size === 0) return nieuweRollen;

  return nieuweRollen.map((nieuw) => {
    const vorige = aangepast.get(nieuw.roleId ?? nieuw.rolnaam);
    if (!vorige) return nieuw;

    const vervallen = (reden) => ({ ...nieuw, takenAangepastVervallen: { taken: vorige.takenAangepast, reden } });
    const koppeling = koppelAangepasteTaken(nieuw.taken, vorige.takenAangepast);
    if (!koppeling) {
      return vervallen("De taken en categorieën in de nieuwe analyse wijken af van de eerdere; de aanpassing is niet overgenomen.");
    }
    // Een fout bij het overnemen mag de hele analyse niet omgooien: dan geldt de nieuwe analyse.
    try {
      return { ...herberekenRolMetTaken(nieuw, koppeling.taken), takenAangepastOvername: koppeling.methode };
    } catch {
      return vervallen("De aanpassing kon niet worden herberekend en is niet overgenomen.");
    }
  });
}
