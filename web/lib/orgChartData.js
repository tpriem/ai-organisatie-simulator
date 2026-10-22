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
import { nl } from "../../src/formatNl.js";

/**
 * Volgorde waarin de bestemmingen in een balk staan. Dezelfde volgorde als de drie opties in de
 * app, met "onbepaald" (analyse zonder waardetype) als laatste.
 */
export const BESTEMMING_VOLGORDE = ["kostenreductie", "capaciteitsgroei", "kwaliteitsverbetering", "onbepaald"];

/** Wat een rol aan capaciteit vrijmaakt (realistisch), met de bestemming erbij. */
function vrijVan(r) {
  const vrij = Math.max(r.fte - r.scenarios.realistisch.fteOver, 0);
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
export function buildHierarchy(rollen) {
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
      problemen.push(`"${r.roleLabel ?? r.rolnaam}" rapporteert aan "${r.rapporteertAan}", die niet in het roster staat.`);
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
        fteRealistisch: r.scenarios.realistisch.fteOver,
        fteAgressief: r.scenarios.agressief.fteOver,
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
    let onderRealistisch = 0;
    let onderVrij = 0;
    let onderRollen = 0;
    for (const kind of knoop.kinderen) {
      berekenSpan(kind, diepte + 1);
      onderHuidig += kind.fteHuidig + kind.spanTotaalHuidig;
      onderRealistisch += kind.fteRealistisch + kind.spanTotaalRealistisch;
      onderVrij += kind.fteVrij + kind.spanTotaalVrij;
      onderRollen += 1 + kind.spanAantalRollen;
    }
    knoop.spanDirect = knoop.kinderen.length;
    knoop.spanTotaalHuidig = onderHuidig;
    knoop.spanTotaalRealistisch = onderRealistisch;
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

export function buildOrgChartData(rollen) {
  const maxFte = Math.max(...rollen.map((r) => r.fte), 1);

  const naarRol = (r) => ({
    roleId: r.roleId ?? r.rolnaam,
    rolnaam: r.rolnaam,
    label: r.roleLabel ?? r.rolnaam,
    fteHuidig: r.fte,
    fteRealistisch: r.scenarios.realistisch.fteOver,
    fteAgressief: r.scenarios.agressief.fteOver,
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
      fteRealistisch: som((r) => r.fteRealistisch),
      fteAgressief: som((r) => r.fteAgressief),
      fteVrij: vrij.vrij,
      vrijPerType: vrij.perType,
    };
  });

  // Grootste afdeling bovenaan: daar zit doorgaans de meeste impact.
  afdelingen.sort((a, b) => b.fteHuidig - a.fteHuidig);

  const totaal = (kies) => afdelingen.reduce((t, a) => t + kies(a), 0);
  const vrijTotaal = telOp(rollen.map(vrijVan));

  return {
    maxFte,
    heeftAfdelingen,
    // Echte rapportagelijnen als het roster ze bevat; anders null en valt de weergave
    // terug op de groepering per afdeling.
    hierarchie: buildHierarchy(rollen),
    // Schaal voor de afdelingsbalken; die zijn groter dan losse rollen.
    maxAfdelingFte: Math.max(...afdelingen.map((a) => a.fteHuidig), 1),
    afdelingen,
    organisatie: {
      fteHuidig: totaal((a) => a.fteHuidig),
      fteRealistisch: totaal((a) => a.fteRealistisch),
      fteAgressief: totaal((a) => a.fteAgressief),
      fteVrij: vrijTotaal.vrij,
      vrijPerType: vrijTotaal.perType,
    },
    // Platte lijst blijft beschikbaar voor weergaven die geen groepering tonen.
    rollen: rollen.map(naarRol),
  };
}

const procent = (deel, geheel) => (geheel > 0 ? Math.round((deel / geheel) * 100) : 0);
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
      ? `Opgebouwd uit de afdelingen in het roster; het roster bevat geen rapportagelijnen. ${balkUitleg}`
      : `Het roster bevat geen afdelingen of rapportagelijnen; dit toont per rol hoeveel capaciteit vrijkomt. ${balkUitleg}`;

  return {
    uitleg,
    totaal: `Hele organisatie: ${nl(o.fteHuidig, 1)} FTE, waarvan ${nl(o.fteVrij, 1)} FTE (${procent(o.fteVrij, o.fteHuidig)}%) aan capaciteit vrijkomt`,
    onderdeel: (x) => `${nl(x.fteHuidig, 1)} FTE · ${nl(x.fteVrij, 1)} FTE vrij (${procent(x.fteVrij, x.fteHuidig)}%)`,
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
          `${knoop.rolnaam} stuurt ${knoop.spanDirect} ${rollenWoord(knoop.spanDirect)} aan, samen ${nl(knoop.spanTotaalHuidig, 1)} FTE. ` +
          `Daarvan komt ${nl(knoop.spanTotaalVrij, 1)} FTE (${Math.round(aandeel * 100)}%) aan capaciteit vrij.` +
          (hoog ? " Bekijk of de manier van aansturen mee moet veranderen." : ""),
      });
    }
    knoop.kinderen.forEach(loop);
  };
  hierarchie.top.forEach(loop);
  return regels;
}
