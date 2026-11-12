/**
 * Bereidt de data voor het organogram voor: organisatie → afdelingen → rollen, of de echte
 * rapportagestructuur als het roster een kolom "rapporteert aan" heeft.
 *
 * Alles draait om de capaciteit die vrijkomt (en waar die naartoe kan), niet om hoeveel FTE
 * overblijft: per knoop de huidige FTE, de vrijkomende FTE en die per bestemming.
 *
 * Zonder rapportagelijnen valt het terug op de afdelingen; zonder afdelingen op één groep met alle
 * rollen.
 */
import { nl } from "../../src/formatNl.js";

/**
 * Volgorde waarin de bestemmingen in een balk staan. Dezelfde volgorde als de drie opties in de
 * app, met "onbepaald" (analyse zonder waardetype) als laatste.
 */
export const BESTEMMING_VOLGORDE = ["kostenreductie", "capaciteitsgroei", "kwaliteitsverbetering", "onbepaald"];

/** De sleutel van een rol, ook voor analyses zonder roleId. */
const idVan = (r) => r.roleId ?? `${r.afdeling ?? ""}::${r.rolnaam}`;

/**
 * Wat een rol aan capaciteit vrijmaakt (realistisch), met de bestemming erbij. Dezelfde bron als de
 * kaarten en de rolkoppen (fteWeg); fte − fteOver alleen voor resultaten die dat veld niet hebben.
 */
function vrijVan(r) {
  const s = r.scenarios.realistisch;
  const vrij = Math.max(s.fteWeg ?? r.fte - s.fteOver, 0);
  return { vrij, type: r.waardetype || "onbepaald" };
}

function telOp(deelnemers) {
  const perType = {};
  let vrij = 0;
  for (const d of deelnemers) {
    perType[d.type] = (perType[d.type] ?? 0) + d.vrij;
    vrij += d.vrij;
  }
  return { vrij, perType };
}

/**
 * De segmenten van een balk: hoeveel van de huidige FTE komt vrij, per bestemming. Wat niet vrijkomt
 * blijft; dat is de rest van de balk en krijgt dus geen eigen segment. Aandelen zijn t.o.v. fteHuidig.
 */
export function balkSegmenten(fteHuidig, vrijPerType) {
  if (!(fteHuidig > 0)) return [];
  return BESTEMMING_VOLGORDE.filter((t) => (vrijPerType?.[t] ?? 0) > 0).map((t) => ({
    soort: t,
    fte: vrijPerType[t],
    aandeel: Math.min(vrijPerType[t] / fteHuidig, 1),
  }));
}

function normaliseerNaam(naam) {
  return String(naam ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Bouwt de rapportagestructuur uit de kolom "rapporteert aan" van het roster.
 *
 * Rostergegevens van klanten zijn zelden schoon, dus dit moet tegen rommel kunnen:
 * verwijzingen naar een rol die niet bestaat, dubbele rolnamen in verschillende
 * afdelingen, en kringverwijzingen (A rapporteert aan B, B aan A). In al die gevallen
 * komt de rol bovenaan te hangen en wordt het probleem gemeld in plaats van genegeerd —
 * stil een verkeerde boom tekenen is erger dan geen boom.
 *
 * @returns {null} als geen enkele rol een leidinggevende heeft
 */
export function buildHierarchy(rollenIn) {
  const rollen = rollenIn.map((r) => (r.roleId ? r : { ...r, roleId: idVan(r) }));
  const metVerwijzing = rollen.filter((r) => normaliseerNaam(r.rapporteertAan));
  if (metVerwijzing.length === 0) return null;

  // Rolnaam → rollen met die naam. Meerdere treffers betekent dat de naam in meerdere
  // afdelingen voorkomt; dan geeft de afdeling de doorslag.
  const opNaam = new Map();
  for (const r of rollen) {
    const key = normaliseerNaam(r.rolnaam);
    if (!opNaam.has(key)) opNaam.set(key, []);
    opNaam.get(key).push(r);
  }

  const problemen = [];
  const ouderVan = new Map();

  for (const r of rollen) {
    const gezocht = normaliseerNaam(r.rapporteertAan);
    if (!gezocht) continue;

    const kandidaten = opNaam.get(gezocht) ?? [];
    let leidinggevende = null;

    if (kandidaten.length === 1) {
      leidinggevende = kandidaten[0];
    } else if (kandidaten.length > 1) {
      leidinggevende = kandidaten.find((k) => normaliseerNaam(k.afdeling) === normaliseerNaam(r.afdeling)) ?? null;
      if (!leidinggevende) {
        problemen.push(`"${r.roleLabel ?? r.rolnaam}" verwijst naar "${r.rapporteertAan}", die in meerdere afdelingen voorkomt.`);
      }
    } else {
      problemen.push(`"${r.roleLabel ?? r.rolnaam}" rapporteert aan "${r.rapporteertAan}", die niet in het functieoverzicht staat.`);
    }

    if (leidinggevende && leidinggevende.roleId !== r.roleId) {
      ouderVan.set(r.roleId, leidinggevende.roleId);
    }
  }

  // Kringen verbreken: loop vanaf elke rol omhoog; kom je jezelf tegen, dan is de laatst
  // gelegde schakel de boosdoener en knippen we die door.
  for (const start of rollen) {
    const gezien = new Set([start.roleId]);
    let huidig = start.roleId;
    while (ouderVan.has(huidig)) {
      const ouder = ouderVan.get(huidig);
      if (gezien.has(ouder)) {
        const naam = rollen.find((r) => r.roleId === huidig)?.roleLabel ?? huidig;
        problemen.push(`Kringverwijzing in de rapportagelijnen bij "${naam}" — die lijn is losgekoppeld.`);
        ouderVan.delete(huidig);
        break;
      }
      gezien.add(ouder);
      huidig = ouder;
    }
  }

  const knoopVan = new Map(
    rollen.map((r) => [
      r.roleId,
      {
        roleId: r.roleId,
        rolnaam: r.rolnaam,
        label: r.roleLabel ?? r.rolnaam,
        afdeling: r.afdeling ?? "",
        fteHuidig: r.fte,
        waardetype: r.waardetype || null,
        fteVrij: vrijVan(r).vrij,
        vrijPerType: telOp([vrijVan(r)]).perType,
        kinderen: [],
      },
    ])
  );

  const top = [];
  for (const r of rollen) {
    const knoop = knoopVan.get(r.roleId);
    const ouderId = ouderVan.get(r.roleId);
    if (ouderId && knoopVan.has(ouderId)) knoopVan.get(ouderId).kinderen.push(knoop);
    else top.push(knoop);
  }

  // Aansturing: hoeveel FTE hangt er onder een rol? Juist het verschil tussen nu en
  // straks is interessant — een leidinggevende die van acht naar twee FTE gaat, is een
  // gesprek waard over of die laag nog nodig is.
  const berekenSpan = (knoop, diepte = 0) => {
    knoop.diepte = diepte;
    let onderHuidig = 0;
    let onderVrij = 0;
    let onderRollen = 0;
    for (const kind of knoop.kinderen) {
      berekenSpan(kind, diepte + 1);
      onderHuidig += kind.fteHuidig + kind.spanTotaalHuidig;
      onderVrij += kind.fteVrij + kind.spanTotaalVrij;
      onderRollen += 1 + kind.spanAantalRollen;
    }
    knoop.spanDirect = knoop.kinderen.length;
    knoop.spanTotaalHuidig = onderHuidig;
    knoop.spanTotaalVrij = onderVrij;
    knoop.spanAantalRollen = onderRollen;
    return knoop;
  };
  top.forEach((k) => berekenSpan(k));

  const maxDiepte = (knopen) =>
    knopen.reduce((m, k) => Math.max(m, k.kinderen.length ? 1 + maxDiepte(k.kinderen) : 1), 0);

  return {
    top,
    lagen: maxDiepte(top),
    problemen: [...new Set(problemen)],
    aantalMetLeidinggevende: ouderVan.size,
  };
}

export function buildOrgChartData(rollenIn) {
  // Elke rol een sleutel geven, ook als de analyse die niet heeft: zonder sleutel vallen rollen samen.
  const rollen = rollenIn.map((r) => (r.roleId ? r : { ...r, roleId: idVan(r) }));

  const naarRol = (r) => ({
    roleId: r.roleId,
    rolnaam: r.rolnaam,
    label: r.roleLabel ?? r.rolnaam,
    fteHuidig: r.fte,
    waardetype: r.waardetype || null,
    fteVrij: vrijVan(r).vrij,
    vrijPerType: telOp([vrijVan(r)]).perType,
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
    const vrij = telOp(rijen.map(vrijVan));
    return {
      afdeling: naam || "Overig",
      rollen: rolData,
      fteHuidig: som((r) => r.fteHuidig),
      fteVrij: vrij.vrij,
      vrijPerType: vrij.perType,
    };
  });

  // Grootste afdeling bovenaan: daar zit doorgaans de meeste impact.
  afdelingen.sort((a, b) => b.fteHuidig - a.fteHuidig);

  const totaal = (kies) => afdelingen.reduce((t, a) => t + kies(a), 0);
  const vrijTotaal = telOp(rollen.map(vrijVan));

  return {
    heeftAfdelingen,
    // Echte rapportagelijnen als het roster ze bevat; anders null en valt de weergave
    // terug op de groepering per afdeling.
    hierarchie: buildHierarchy(rollen),
    afdelingen,
    organisatie: {
      fteHuidig: totaal((a) => a.fteHuidig),
      fteVrij: vrijTotaal.vrij,
      vrijPerType: vrijTotaal.perType,
    },
    // Platte lijst blijft beschikbaar voor weergaven die geen groepering tonen.
    rollen: rollen.map(naarRol),
  };
}

const procent = (deel, geheel) => (geheel > 0 ? Math.round((deel / geheel) * 100) : 0);

/** "4,0 FTE · 2,4 FTE vrij (61%)", voor een rol, afdeling of de hele organisatie. */
export const onderdeelRegel = (x) => `${nl(x.fteHuidig, 1)} FTE · ${nl(x.fteVrij, 1)} FTE vrij (${procent(x.fteVrij, x.fteHuidig)}%)`;
const rollenWoord = (n) => (n === 1 ? "rol" : "rollen");

/**
 * De teksten bij het organogram, op één plek zodat scherm, PDF en Word hetzelfde zeggen.
 * Alles in capaciteit: er staat nergens hoeveel mensen "overblijven", want de tool toont wat er
 * aan tijd vrijkomt en waar die heen kan, niet wie er weg kan.
 */
export function organogramTeksten(chart) {
  const o = chart.organisatie;
  const balkUitleg =
    "Het gekleurde deel van de balk is de capaciteit die vrijkomt, het grijze deel blijft; de kleur laat zien waar die capaciteit naartoe kan.";
  const uitleg = chart.hierarchie
    ? `Opgebouwd uit de rapportagelijnen in het roster (${chart.hierarchie.lagen} ${chart.hierarchie.lagen === 1 ? "laag" : "lagen"}). ${balkUitleg}`
    : chart.heeftAfdelingen
      ? `Opgebouwd uit de afdelingen in het functieoverzicht; dat bevat geen rapportagelijnen. ${balkUitleg}`
      : `Het functieoverzicht bevat geen afdelingen of rapportagelijnen; dit toont per rol hoeveel capaciteit vrijkomt. ${balkUitleg}`;

  return {
    uitleg,
    totaal: `Hele organisatie: ${nl(o.fteHuidig, 1)} FTE, waarvan ${nl(o.fteVrij, 1)} FTE (${procent(o.fteVrij, o.fteHuidig)}%) aan capaciteit vrijkomt`,
    onderdeel: onderdeelRegel,
  };
}

/**
 * Per leidinggevende: hoeveel werk er onder hangt en hoeveel capaciteit daarvan vrijkomt. Dat is
 * de vraag achter het organogram; komt er veel vrij onder een laag, dan is het de moeite om te
 * kijken of ook de aansturing mee moet veranderen.
 */
export function aansturingRegels(hierarchie, drempel = 0.4) {
  if (!hierarchie) return [];
  const regels = [];
  const loop = (knoop) => {
    if (knoop.kinderen.length) {
      const aandeel = knoop.spanTotaalHuidig > 0 ? knoop.spanTotaalVrij / knoop.spanTotaalHuidig : 0;
      const hoog = aandeel >= drempel;
      regels.push({
        roleId: knoop.roleId,
        rolnaam: knoop.rolnaam,
        aantalDirect: knoop.spanDirect,
        aantalRollen: knoop.spanAantalRollen,
        fteOnderZich: knoop.spanTotaalHuidig,
        fteVrijOnderZich: knoop.spanTotaalVrij,
        aandeelVrij: aandeel,
        hoog,
        tekst:
          `Onder ${knoop.rolnaam} ${knoop.spanAantalRollen === 1 ? "hangt" : "hangen"} ${knoop.spanAantalRollen} ${rollenWoord(knoop.spanAantalRollen)}` +
          (knoop.spanAantalRollen !== knoop.spanDirect ? ` (waarvan ${knoop.spanDirect} direct)` : "") +
          `, samen ${nl(knoop.spanTotaalHuidig, 1)} FTE. ` +
          `Daarvan komt ${nl(knoop.spanTotaalVrij, 1)} FTE (${Math.round(aandeel * 100)}%) aan capaciteit vrij.` +
          (hoog ? " Bekijk of de manier van aansturen mee moet veranderen." : ""),
      });
    }
    knoop.kinderen.forEach(loop);
  };
  hierarchie.top.forEach(loop);
  return regels;
}
