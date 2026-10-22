import raamwerk from "./data/volwassenheidsraamwerk.json" with { type: "json" };
import { calculateCompetentieAgenda } from "./competencyAgenda.js";

/**
 * Berekening voor het AI-volwassenheidsraamwerk van House of Digital.
 *
 * De inhoud (assen, thema's, stellingen, afhankelijkheden, regels) staat in
 * src/data/volwassenheidsraamwerk.json; het ontwerp en de redenering staan in
 * docs/volwassenheidsraamwerk-ontwerp.md. Dit bestand rekent alleen. De letters A tot en met I
 * in de commentaren verwijzen naar de analyses in dat ontwerp.
 *
 * Kernregels:
 *  - Voldaan = "ja" of "n.v.t.". "Deels" en "nee" zijn niet voldaan; onbeantwoord ook niet.
 *  - Thema-niveau = hoogste n waarvoor alle stellingen met niveau <= n voldaan zijn.
 *  - As-niveau = laagste thema-niveau van die as. Geen gemiddelden en geen totaalscore.
 *  - Een niveau zonder bewijs dat de adviseur heeft gezien heet "indicatief".
 */

export const RAAMWERK = raamwerk;
export const RAAMWERK_VERSIE = raamwerk.versie;
export const NIVEAUS = raamwerk.niveaus;
export const ROLLEN = raamwerk.rollen;
export const ASSEN = raamwerk.assen;
export const THEMAS = raamwerk.assen.flatMap((a) => a.themas.map((t) => ({ ...t, asId: a.id })));
export const STELLINGEN = raamwerk.assen.flatMap((a) =>
  a.themas.flatMap((t) => t.stellingen.map((s) => ({ ...s, themaId: t.id, asId: a.id })))
);

export const ANTWOORDEN = [
  { waarde: "nee", label: "Nee" },
  { waarde: "deels", label: "Deels" },
  { waarde: "ja", label: "Ja" },
  { waarde: "nvt", label: "N.v.t." },
];
const RANG = { nee: 0, deels: 1, ja: 2, nvt: 2 };
const GELDIG = new Set(Object.keys(RANG));
const voldaan = (a) => a === "ja" || a === "nvt";

export const STANDAARD_DOEL = 3;
export const MAX_INVULLERS = 12;

export const niveauNaam = (n) => (n === 0 ? "Nog niet begonnen" : NIVEAUS.find((x) => x.niveau === n)?.naam ?? null);
export const getAs = (id) => ASSEN.find((a) => a.id === id) ?? null;
export const getThema = (id) => THEMAS.find((t) => t.id === id) ?? null;
const STELLING_IDS = new Set(STELLINGEN.map((s) => s.id));
const ROL_IDS = new Set(ROLLEN.map((r) => r.id));

// ---- Invoer ------------------------------------------------------------------------------------
//
// invoer = {
//   scope, doelen: { asId: 1-5 },
//   invullers: [{ id, rol, label, antwoorden: { stellingId: "nee|deels|ja|nvt" }, bewijs: { stellingId: tekst },
//                 bron?: "adviseur" | "link", status?: "nieuw" | "bezig" | "ingediend", bijgewerktOp?, ingediendOp? }],
//     Een invuller met bron "link" vult zelf in via een persoonlijke link; zijn antwoorden tellen pas
//     mee zodra hij ze heeft verstuurd (status "ingediend").
//   geldend: { antwoorden, bewijs, bewijsGezien: { stellingId: true } }   // het oordeel van de adviseur
// }

export const leegeInvoer = () => ({
  scope: "",
  doelen: {},
  invullers: [],
  geldend: { antwoorden: {}, bewijs: {}, bewijsGezien: {} },
});

function schoneAntwoorden(ruw) {
  const uit = {};
  if (ruw && typeof ruw === "object") {
    for (const [id, w] of Object.entries(ruw)) if (STELLING_IDS.has(id) && GELDIG.has(w)) uit[id] = w;
  }
  return uit;
}
function schoneTeksten(ruw, max) {
  const uit = {};
  if (ruw && typeof ruw === "object") {
    for (const [id, t] of Object.entries(ruw)) {
      if (STELLING_IDS.has(id) && typeof t === "string" && t.trim()) uit[id] = t.trim().slice(0, max);
    }
  }
  return uit;
}

/** Maakt van ongecontroleerde invoer een schone meting. Onbekende velden verdwijnen. */
export function schoonInvoer(invoer) {
  const doelen = {};
  for (const a of ASSEN) {
    const d = invoer?.doelen?.[a.id];
    if (Number.isInteger(d) && d >= 1 && d <= 5) doelen[a.id] = d;
  }

  const invullers = [];
  const gezien = new Set();
  for (const i of Array.isArray(invoer?.invullers) ? invoer.invullers : []) {
    if (invullers.length >= MAX_INVULLERS) break;
    if (typeof i?.id !== "string" || !/^[a-z0-9_-]{1,40}$/.test(i.id) || gezien.has(i.id) || !ROL_IDS.has(i.rol)) continue;
    gezien.add(i.id);
    const schoon = {
      id: i.id,
      rol: i.rol,
      label: typeof i.label === "string" ? i.label.trim().slice(0, 60) : "",
      antwoorden: schoneAntwoorden(i.antwoorden),
      bewijs: schoneTeksten(i.bewijs, 500),
    };
    if (i.bron === "link") {
      schoon.bron = "link";
      schoon.status = ["nieuw", "bezig", "ingediend"].includes(i.status) ? i.status : "nieuw";
      for (const veld of ["bijgewerktOp", "ingediendOp"]) {
        if (typeof i[veld] === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(i[veld])) schoon[veld] = i[veld];
      }
    }
    invullers.push(schoon);
  }

  const g = invoer?.geldend ?? {};
  const bewijsGezien = {};
  if (g.bewijsGezien && typeof g.bewijsGezien === "object") {
    for (const [id, w] of Object.entries(g.bewijsGezien)) if (STELLING_IDS.has(id) && w === true) bewijsGezien[id] = true;
  }

  return {
    scope: typeof invoer?.scope === "string" ? invoer.scope.trim().slice(0, 200) : "",
    doelen,
    invullers,
    geldend: { antwoorden: schoneAntwoorden(g.antwoorden), bewijs: schoneTeksten(g.bewijs, 500), bewijsGezien },
  };
}

/** Een vastgelegde meting: alleen de invoer. Het profiel wordt bij het lezen opnieuw berekend. */
export function maakSnapshot(invoer, { op = new Date() } = {}) {
  return { op: op.toISOString(), raamwerkVersie: RAAMWERK_VERSIE, ...schoonInvoer(invoer) };
}

// ---- Welke antwoorden gelden -------------------------------------------------------------------

/** Telt een invuller mee? Wie via een link invult, telt pas mee nadat hij zijn antwoorden heeft verstuurd. */
export const teltMee = (invuller) => invuller?.bron !== "link" || invuller?.status === "ingediend";

/** Het strengste van meerdere antwoorden. Bij gelijk rang wint "ja" van "n.v.t.". */
function strengste(lijst) {
  const gevuld = lijst.filter((a) => GELDIG.has(a));
  if (gevuld.length === 0) return null;
  return gevuld.reduce((m, a) => (RANG[a] < RANG[m] || (RANG[a] === RANG[m] && a === "ja") ? a : m));
}

/**
 * De geldende antwoorden per stelling: het oordeel van de adviseur als dat er is, anders het
 * strengste antwoord van de invullers (F).
 */
export function effectieveAntwoorden(invoer) {
  const uit = {};
  for (const s of STELLINGEN) {
    const geldend = invoer?.geldend?.antwoorden?.[s.id];
    if (GELDIG.has(geldend)) {
      uit[s.id] = geldend;
      continue;
    }
    uit[s.id] = strengste((invoer?.invullers ?? []).filter(teltMee).map((i) => i.antwoorden?.[s.id]));
  }
  return uit;
}

/** Het strengste antwoord per rol (zonder de adviseur), voor het verschil tussen invullers. */
export function antwoordenPerRol(invoer) {
  const perRol = {};
  for (const r of ROLLEN) {
    if (r.id === "adviseur") continue;
    const van = (invoer?.invullers ?? []).filter((i) => i.rol === r.id && teltMee(i));
    if (van.length === 0) continue;
    const uit = {};
    for (const s of STELLINGEN) uit[s.id] = strengste(van.map((i) => i.antwoorden?.[s.id]));
    if (Object.values(uit).some((a) => a !== null)) perRol[r.id] = uit;
  }
  return perRol;
}

// ---- Thema's en assen (A, B, D, G) -------------------------------------------------------------

/**
 * Hoogste n waarvoor alle stellingen met niveau <= n (en voldoen aan `filter`) voldaan zijn.
 * Een niveau waarop geen enkele stelling aan het filter voldoet, is nooit zelf een bereikt
 * niveau: anders zou een ladder die alleen over vaardigheden gaat over de niveaus met enkel
 * borgingsstellingen heen "klimmen" zonder dat er iets is voldaan.
 */
function ladder(stellingen, antwoorden, filter = () => true) {
  let niveau = 0;
  for (let n = 1; n <= 5; n++) {
    const opNiveau = stellingen.filter((s) => s.niveau === n && filter(s));
    if (opNiveau.length === 0) continue;
    if (!opNiveau.every((s) => voldaan(antwoorden[s.id]))) break;
    niveau = n;
  }
  return niveau;
}

export function beoordeelThema(thema, antwoorden, gezien = {}) {
  const lijst = thema.stellingen.map((s) => ({
    id: s.id,
    niveau: s.niveau,
    kant: s.kant,
    tekst: s.tekst,
    bewijsvraag: s.bewijsvraag,
    bewijsvoorbeelden: s.bewijsvoorbeelden,
    antwoord: antwoorden[s.id] ?? null,
    gezien: gezien[s.id] === true,
  }));
  const niveau = ladder(thema.stellingen, antwoorden);
  const losNiveau = ladder(thema.stellingen, antwoorden, (s) => s.kant === "vaardigheid");
  const beantwoord = lijst.filter((s) => s.antwoord !== null).length;

  // Alle voldane stellingen tot en met het bereikte niveau moeten door de adviseur zijn gezien.
  // n.v.t. hoeft niet onderbouwd. Niveau 0 claimt niets en is dus niet "indicatief".
  const onderbouwd = lijst.filter((s) => s.niveau <= niveau && s.antwoord === "ja").every((s) => s.gezien);

  const volgende = lijst.filter((s) => s.niveau <= Math.min(niveau + 1, 5)).find((s) => !voldaan(s.antwoord)) ?? null;

  const borging = lijst.filter((s) => s.kant === "borging");
  return {
    id: thema.id,
    naam: thema.naam,
    beschrijving: thema.beschrijving,
    niveau,
    losNiveau,
    // D: alleen te beoordelen als er over borging iets is beantwoord.
    borgingBeantwoord: borging.some((s) => s.antwoord !== null),
    gemeten: beantwoord > 0,
    beantwoord,
    totaal: lijst.length,
    onvolledig: beantwoord < lijst.length,
    ingevuld: beantwoord === lijst.length,
    onderbouwd,
    volgendeStap: volgende && { stellingId: volgende.id, niveau: volgende.niveau, tekst: volgende.tekst },
    stellingen: lijst,
  };
}

export function beoordeelAs(as, antwoorden, gezien = {}, doel = STANDAARD_DOEL) {
  const themas = as.themas.map((t) => beoordeelThema(t, antwoorden, gezien));
  const gemeten = themas.some((t) => t.gemeten);
  const niveau = Math.min(...themas.map((t) => t.niveau));
  const beantwoord = themas.reduce((s, t) => s + t.beantwoord, 0);
  const totaal = themas.reduce((s, t) => s + t.totaal, 0);

  const zwakste = gemeten ? themas.filter((t) => t.niveau === niveau) : [];
  const alleStellingen = themas.flatMap((t) => t.stellingen);
  const jas = alleStellingen.filter((s) => s.antwoord === "ja");

  return {
    id: as.id,
    naam: as.naam,
    kant: as.kant,
    beschrijving: as.beschrijving,
    gemeten,
    niveau: gemeten ? niveau : null,
    niveauNaam: gemeten ? niveauNaam(niveau) : null,
    doel,
    gat: gemeten ? Math.max(0, doel - niveau) : null,
    themas,
    // B: het thema dat het niveau bepaalt, met de eerstvolgende stelling die niet voldaan is.
    zwakksteThemas: zwakste.map((t) => ({ id: t.id, naam: t.naam, volgendeStap: t.volgendeStap })),
    beantwoord,
    totaal,
    onvolledig: beantwoord < totaal,
    ingevuld: beantwoord === totaal,
    onderbouwd: gemeten && themas.every((t) => t.onderbouwd),
    // G
    onderbouwing: {
      voldaan: jas.length,
      gezien: jas.filter((s) => s.gezien).length,
      aandeel: jas.length ? jas.filter((s) => s.gezien).length / jas.length : null,
    },
    aandeelNvt: totaal ? alleStellingen.filter((s) => s.antwoord === "nvt").length / totaal : 0,
  };
}

/** Het volledige profiel. */
export function berekenProfiel(invoer) {
  const antwoorden = effectieveAntwoorden(invoer);
  const gezien = invoer?.geldend?.bewijsGezien ?? {};
  const assen = ASSEN.map((a) => {
    const d = invoer?.doelen?.[a.id];
    return beoordeelAs(a, antwoorden, gezien, Number.isInteger(d) && d >= 1 && d <= 5 ? d : STANDAARD_DOEL);
  });
  const gemeten = assen.filter((a) => a.gemeten);
  const telling = assen.reduce((t, a) => ({ totaal: t.totaal + a.totaal, beantwoord: t.beantwoord + a.beantwoord }), {
    totaal: 0,
    beantwoord: 0,
  });
  return {
    raamwerkVersie: RAAMWERK_VERSIE,
    scope: String(invoer?.scope ?? ""),
    // In de bewustwordingsfase is de scan een zelfbeoordeling zonder bewijs. Zodra de adviseur
    // bewijs gaat vastleggen (verdiepingsfase) tellen de onderbouwing en de overschattingsregel mee.
    bewijsGebruikt: Object.keys(invoer?.geldend?.bewijsGezien ?? {}).length > 0,
    assen,
    gemeten: gemeten.length,
    telling,
    ingevuld: assen.every((a) => a.ingevuld),
    laagste: gemeten.length ? gemeten.reduce((m, a) => (a.niveau < m.niveau ? a : m)) : null,
    hoogste: gemeten.length ? gemeten.reduce((m, a) => (a.niveau > m.niveau ? a : m)) : null,
  };
}

const allesThemas = (profiel) => profiel.assen.flatMap((a) => a.themas.map((t) => ({ ...t, asId: a.id, doel: a.doel })));

// ---- C. Volgorde van aanpak --------------------------------------------------------------------

/**
 * Thema's met een kloof, grootste eerst. Daarna worden de afhankelijkheden nagelopen: wil
 * thema X boven niveau n komen (doel van zijn as >= n) terwijl thema Y onder het vereiste
 * niveau zit, dan komt Y vóór X, ook als Y zelf geen kloof heeft.
 */
export function volgordeVanAanpak(profiel) {
  const themas = new Map(allesThemas(profiel).map((t) => [t.id, t]));
  const gemeten = (t) => t.gemeten;

  const items = [];
  for (const t of themas.values()) {
    if (!gemeten(t)) continue;
    const kloof = Math.max(0, t.doel - t.niveau);
    if (kloof > 0) items.push({ thema: t.id, naam: t.naam, asId: t.asId, niveau: t.niveau, doel: t.doel, kloof, redenen: [{ soort: "kloof" }] });
  }
  items.sort((a, b) => b.kloof - a.kloof || a.niveau - b.niveau || a.naam.localeCompare(b.naam, "nl"));

  const voorwaarden = [];
  for (const d of raamwerk.afhankelijkheden) {
    const x = themas.get(d.van);
    const y = themas.get(d.vereist);
    if (!x || !y || !gemeten(x) || !gemeten(y)) continue;
    const xWilOmhoog = x.doel >= d.vanafNiveau && x.niveau < x.doel;
    if (!xWilOmhoog || y.niveau >= d.minimaalNiveau) continue;
    voorwaarden.push({ van: d.van, vereist: d.vereist, reden: d.reden, minimaalNiveau: d.minimaalNiveau });
    let it = items.find((i) => i.thema === d.vereist);
    if (!it) {
      it = { thema: y.id, naam: y.naam, asId: y.asId, niveau: y.niveau, doel: d.minimaalNiveau, kloof: d.minimaalNiveau - y.niveau, redenen: [] };
      items.push(it);
    }
    it.redenen.push({ soort: "afhankelijkheid", voorThema: d.van, voorNaam: x.naam, reden: d.reden, minimaalNiveau: d.minimaalNiveau });
  }

  // Vereiste thema's vóór de thema's die ze nodig hebben, in een stabiele volgorde.
  const volgorde = [...items];
  for (let ronde = 0; ronde < volgorde.length + 1; ronde++) {
    let verplaatst = false;
    for (const v of voorwaarden) {
      const iy = volgorde.findIndex((i) => i.thema === v.vereist);
      const ix = volgorde.findIndex((i) => i.thema === v.van);
      if (ix === -1 || iy === -1 || iy < ix) continue;
      const [y] = volgorde.splice(iy, 1);
      volgorde.splice(ix, 0, y);
      verplaatst = true;
    }
    if (!verplaatst) break;
  }
  return volgorde.map((i, n) => ({ ...i, volgorde: n + 1 }));
}

// ---- D. Vaardigheid versus borging -------------------------------------------------------------

export function vaardigheidVersusBorging(profiel) {
  return allesThemas(profiel)
    .filter((t) => t.gemeten && t.borgingBeantwoord)
    .map((t) => {
      const verschil = t.losNiveau - t.niveau;
      return {
        thema: t.id,
        naam: t.naam,
        asId: t.asId,
        kanHet: t.losNiveau,
        geborgd: t.niveau,
        verschil,
        signaal: verschil >= 2 ? "hangt aan personen of toeval" : verschil === 1 ? "werkt, maar niet geborgd" : null,
      };
    });
}

// ---- E. Interne tegenstrijdigheden -------------------------------------------------------------

export function tegenstrijdigheden(profiel) {
  const as = new Map(profiel.assen.map((a) => [a.id, a]));
  const themas = new Map(allesThemas(profiel).map((t) => [t.id, t]));
  const signalen = [];
  const meld = (regel, plek, extra = {}) => signalen.push({ id: regel.id, uitleg: regel.uitleg, plek, ...extra });

  for (const r of raamwerk.tegenstrijdigheden) {
    if (r.soort === "assen") {
      const a = as.get(r.als.as);
      const b = as.get(r.terwijl.as);
      if (a?.gemeten && b?.gemeten && a.niveau >= r.als.minimaal && b.niveau <= r.terwijl.maximaal) {
        meld(r, `${a.naam} (niveau ${a.niveau}) en ${b.naam} (niveau ${b.niveau})`, { assen: [a.id, b.id] });
      }
    } else if (r.soort === "themas") {
      const a = themas.get(r.als.thema);
      const b = themas.get(r.terwijl.thema);
      if (a?.gemeten && b?.gemeten && a.niveau >= r.als.minimaal && b.niveau <= r.terwijl.maximaal) {
        meld(r, `${a.naam} (niveau ${a.niveau}) en ${b.naam} (niveau ${b.niveau})`, { themas: [a.id, b.id] });
      }
    } else if (r.soort === "spreiding") {
      const hoog = profiel.assen.filter((a) => a.gemeten && a.niveau >= r.als.minimaal);
      const laag = profiel.assen.filter((a) => a.gemeten && a.niveau <= r.terwijl.maximaal);
      if (hoog.length && laag.length) {
        meld(r, `${hoog.map((a) => a.naam).join(", ")} naast ${laag.map((a) => a.naam).join(", ")}`, { assen: [...hoog, ...laag].map((a) => a.id) });
      }
    } else if (r.soort === "overschatting") {
      // Zonder vastgelegd bewijs zou deze regel bij elke zelfbeoordeling afgaan.
      if (!profiel.bewijsGebruikt) continue;
      for (const a of profiel.assen.filter((x) => x.gemeten)) {
        const jaAandeel = a.totaal ? a.onderbouwing.voldaan / a.totaal : 0;
        if (jaAandeel > r.aandeelJa && (a.onderbouwing.aandeel ?? 0) < r.aandeelGezien) meld(r, a.naam, { assen: [a.id] });
      }
    } else if (r.soort === "nvt") {
      for (const a of profiel.assen.filter((x) => x.gemeten)) {
        if (a.aandeelNvt > r.aandeelNvt) meld(r, a.naam, { assen: [a.id] });
      }
    } else if (r.soort === "ladder") {
      for (const t of themas.values()) {
        const eerste = t.stellingen.find((s) => s.niveau === 1);
        if (eerste?.antwoord === "nee" && t.stellingen.some((s) => s.niveau > 1 && voldaan(s.antwoord))) meld(r, t.naam, { themas: [t.id] });
      }
    }
  }
  return signalen;
}

// ---- F. Verschil tussen invullers --------------------------------------------------------------

const MIN_ANTWOORDEN_PER_THEMA = 3;

/**
 * Per thema het niveau per rol en de stellingen waarover rollen elkaar tegenspreken. Alleen per
 * rol, nooit per persoon, en alleen als minstens twee rollen genoeg hebben ingevuld.
 */
export function verschilTussenInvullers(invoer) {
  const perRol = antwoordenPerRol(invoer);
  if (Object.keys(perRol).length < 2) return null;

  const themas = [];
  for (const t of THEMAS) {
    const stellingen = t.stellingen;
    const niveaus = {};
    for (const [rol, antw] of Object.entries(perRol)) {
      const beantwoord = stellingen.filter((s) => antw[s.id] !== null && antw[s.id] !== undefined).length;
      if (beantwoord >= MIN_ANTWOORDEN_PER_THEMA) niveaus[rol] = ladder(stellingen, antw);
    }
    if (Object.keys(niveaus).length < 2) continue;

    const waarden = Object.values(niveaus);
    const spreiding = Math.max(...waarden) - Math.min(...waarden);
    const tegenspraken = stellingen
      .map((s) => ({
        stellingId: s.id,
        niveau: s.niveau,
        tekst: s.tekst,
        rollenJa: Object.keys(perRol).filter((r) => perRol[r][s.id] === "ja"),
        rollenNee: Object.keys(perRol).filter((r) => perRol[r][s.id] === "nee"),
      }))
      .filter((x) => x.rollenJa.length > 0 && x.rollenNee.length > 0);

    themas.push({ thema: t.id, naam: t.naam, asId: t.asId, niveausPerRol: niveaus, spreiding, signaal: spreiding >= 2, tegenspraken });
  }
  return { rollen: Object.keys(perRol), themas, signalen: themas.filter((t) => t.signaal) };
}

// ---- H. Voortgang in de tijd -------------------------------------------------------------------

const normaal = (s) => String(s ?? "").trim().toLowerCase();

/** Verschil tussen twee profielen. Null met reden als ze niet vergelijkbaar zijn. */
export function vergelijkMetingen(eerder, nu) {
  if (!eerder || !nu) return null;
  if (eerder.raamwerkVersie !== nu.raamwerkVersie) return { onvergelijkbaar: "andere versie van het raamwerk" };
  if (normaal(eerder.scope) !== normaal(nu.scope)) return { onvergelijkbaar: "andere scope" };

  const verschil = (voor, na) => ({ voor, nu: na, verschil: na - voor });
  const perAs = [];
  const perThema = [];
  for (const a of nu.assen) {
    const v = eerder.assen.find((x) => x.id === a.id);
    if (!v || !v.gemeten || !a.gemeten) continue;
    perAs.push({ id: a.id, naam: a.naam, ...verschil(v.niveau, a.niveau) });
    for (const t of a.themas) {
      const vt = v.themas.find((x) => x.id === t.id);
      if (vt && vt.gemeten && t.gemeten) perThema.push({ id: t.id, naam: t.naam, asId: a.id, ...verschil(vt.niveau, t.niveau) });
    }
  }
  return {
    perAs,
    perThema,
    gestegen: perAs.filter((x) => x.verschil > 0).length,
    gedaald: perAs.filter((x) => x.verschil < 0).length,
    gelijk: perAs.filter((x) => x.verschil === 0).length,
  };
}

// ---- I. Koppeling met de rolanalyse ------------------------------------------------------------

const GEGEVENSVERWERKING_DREMPEL = 0.1;

function aandeelGegevensverwerking(rollen) {
  let totaal = 0;
  let data = 0;
  for (const r of rollen) {
    for (const t of r.scenarios?.realistisch?.taken ?? []) {
      totaal += t.urenPerWeek ?? 0;
      if (t.categorie === "data_entry") data += t.urenPerWeek ?? 0;
    }
  }
  return totaal > 0 ? data / totaal : 0;
}

/**
 * Welke voorwaarden moeten voldaan zijn om de vrijgekomen capaciteit uit de rolanalyse te
 * realiseren, en hoeveel daarvan zijn voldaan. Bewust voorwaarden en geen gecorrigeerd FTE-getal:
 * zie het ontwerp, paragraaf 3I.
 */
export function realisatieVoorwaarden(profiel, results) {
  const rollen = results?.rollen ?? [];
  const metCapaciteit = rollen.filter((r) => (r.scenarios?.realistisch?.fteWeg ?? 0) > 0);
  if (metCapaciteit.length === 0) return null;

  const themas = new Map(allesThemas(profiel).map((t) => [t.id, t]));
  const heeftKwaliteit = metCapaciteit.some((r) => r.waardetype === "kwaliteitsverbetering");
  const dataAandeel = aandeelGegevensverwerking(rollen);

  const geldt = (v) => {
    if (v.scenario === "kwaliteitsverbetering") return heeftKwaliteit;
    if (v.alleenBij === "gegevensverwerkende taken") return dataAandeel >= GEGEVENSVERWERKING_DREMPEL;
    return true;
  };

  const lijst = raamwerk.realisatievoorwaarden.filter(geldt).map((v) => {
    const t = themas.get(v.thema);
    const gemeten = Boolean(t?.gemeten);
    return {
      scenario: v.scenario,
      thema: v.thema,
      naam: t?.naam ?? v.thema,
      asId: t?.asId,
      vereist: v.minimaalNiveau,
      huidig: gemeten ? t.niveau : null,
      status: !gemeten ? "niet gemeten" : t.niveau >= v.minimaalNiveau ? "voldaan" : "niet voldaan",
      reden: v.reden,
    };
  });

  const telling = (scenario) => {
    const l = lijst.filter((v) => v.scenario === scenario);
    return { totaal: l.length, voldaan: l.filter((v) => v.status === "voldaan").length };
  };

  // De ontwikkelagenda uit de rolanalyse naast het niveau van vaardigheden.
  const vaardigheden = themas.get("mensen_vaardigheden");
  const agenda = calculateCompetentieAgenda(rollen, "realistisch");
  const agendaLengte = agenda?.competenties?.length ?? 0;
  const knelpuntVaardigheden = Boolean(vaardigheden?.gemeten && agendaLengte >= 5 && vaardigheden.niveau <= 1);

  return {
    fteRealistisch: results?.organisatieTotaal?.realistisch?.totaalFteWeg ?? null,
    fteAgressief: results?.organisatieTotaal?.agressief?.totaalFteWeg ?? null,
    voorwaarden: lijst,
    realistisch: telling("realistisch"),
    agressief: telling("agressief"),
    kwaliteitGeldt: heeftKwaliteit,
    gegevensverwerkingGeldt: dataAandeel >= GEGEVENSVERWERKING_DREMPEL,
    agendaLengte,
    knelpuntVaardigheden,
  };
}

// ---- Voortgang voor de rest van de pagina ------------------------------------------------------

export const isIngevuld = (profiel) => Boolean(profiel?.ingevuld);

/** Alle analyses in één keer, voor het resultatenscherm. */
export function analyseer(invoer, { results = null } = {}) {
  const profiel = berekenProfiel(invoer);
  return {
    profiel,
    volgorde: volgordeVanAanpak(profiel),
    vaardigheidVersusBorging: vaardigheidVersusBorging(profiel),
    tegenstrijdigheden: tegenstrijdigheden(profiel),
    verschillen: verschilTussenInvullers(invoer),
    realisatie: realisatieVoorwaarden(profiel, results),
  };
}
