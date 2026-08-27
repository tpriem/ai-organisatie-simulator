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
    for (const kind of knoop.kinderen) {
      berekenSpan(kind, diepte + 1);
      onderHuidig += kind.fteHuidig + kind.spanTotaalHuidig;
      onderRealistisch += kind.fteRealistisch + kind.spanTotaalRealistisch;
    }
    knoop.spanDirect = knoop.kinderen.length;
    knoop.spanTotaalHuidig = onderHuidig;
    knoop.spanTotaalRealistisch = onderRealistisch;
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
    },
    // Platte lijst blijft beschikbaar voor weergaven die geen groepering tonen.
    rollen: rollen.map(naarRol),
  };
}
