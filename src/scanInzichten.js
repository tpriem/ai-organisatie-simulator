import { NIVEAUS } from "./volwassenheid.js";

/**
 * Inzichten uit de volwassenheidsscan, voor het rapport.
 *
 * De analyses in volwassenheid.js rekenen uit waar een organisatie staat. Dit bestand haalt daar de
 * dingen uit die een lezer wil weten en die niet in één getal zitten: wat er al is, waar de
 * organisatie bijna is, waar rollen het anders zien, en in welke volgorde de aanpak het meest
 * oplevert. Alles volgt uit de antwoorden; er wordt niets bij verzonnen. Dezelfde antwoorden geven
 * altijd dezelfde inzichten.
 *
 * Elke functie krijgt het profiel of de analyse uit volwassenheid.js en geeft gegevens terug, geen
 * zinnen. De zinnen maakt rapportVolwassenheid.js.
 */

/**
 * Thema's die voor één sector aan het raamwerk zijn toegevoegd. Deze tool is voor alle sectoren en
 * heeft er geen; een variant voor één sector vult ze hier in en krijgt er in het rapport een eigen
 * blok voor.
 */
export const SECTORTHEMAS = [];

const alleThemas = (profiel) => profiel.assen.flatMap((a) => a.themas.map((t) => ({ ...t, asId: a.id, asNaam: a.naam, doel: a.doel })));

/**
 * De eerstvolgende stap van een thema, met wat erbij hoort: is er al een begin mee gemaakt ("deels"),
 * en welke tastbare dingen laten zien dat het er is (de bewijsvoorbeelden uit het raamwerk).
 */
export function themaStap(thema) {
  if (!thema?.volgendeStap) return null;
  const s = thema.stellingen.find((x) => x.id === thema.volgendeStap.stellingId);
  return {
    niveau: thema.volgendeStap.niveau,
    tekst: thema.volgendeStap.tekst,
    deels: s?.antwoord === "deels",
    voorbeelden: s?.bewijsvoorbeelden ?? [],
  };
}

/**
 * Waar de organisatie staat ten opzichte van haar doelen: hoeveel onderdelen op elk niveau, hoeveel
 * het doel halen en waar de afstand het grootst is.
 */
export function totaalbeeld(profiel) {
  const gemeten = profiel.assen.filter((a) => a.gemeten);
  const perNiveau = [0, 1, 2, 3, 4, 5]
    .map((n) => ({ niveau: n, naam: n === 0 ? "Nog niet begonnen" : NIVEAUS.find((x) => x.niveau === n)?.naam, assen: gemeten.filter((a) => a.niveau === n).map((a) => a.naam) }))
    .filter((x) => x.assen.length > 0);
  const onderDoel = gemeten.filter((a) => a.gat > 0);
  const grootsteGat = Math.max(0, ...gemeten.map((a) => a.gat));
  const doelen = [...new Set(profiel.assen.map((a) => a.doel))];
  return {
    gemeten: gemeten.length,
    totaal: profiel.assen.length,
    perNiveau,
    // Het niveau waarop de meeste onderdelen staan; bij gelijke aantallen het laagste.
    meest: perNiveau.reduce((m, x) => (!m || x.assen.length > m.assen.length ? x : m), null),
    opDoel: gemeten.length - onderDoel.length,
    onderDoel: onderDoel.length,
    grootsteGat,
    verst: grootsteGat > 0 ? gemeten.filter((a) => a.gat === grootsteGat).map((a) => a.naam) : [],
    // Eén doel voor alle onderdelen (meestal de standaard), of null als de doelen verschillen.
    doel: doelen.length === 1 ? doelen[0] : null,
  };
}

/**
 * Lopen de systemen voor op de organisatie, of andersom? Een bekend patroon: de techniek is er
 * eerder dan de afspraken en de vaardigheden, of er is beleid zonder dat er iets draait.
 * Er wordt geen gemiddelde getoond; het verschil wordt alleen benoemd als het duidelijk is.
 */
export function organisatieEnSystemen(profiel) {
  const kant = (k) => profiel.assen.filter((a) => a.gemeten && a.kant === k);
  const org = kant("organisatie");
  const sys = kant("systeem");
  if (org.length === 0 || sys.length === 0) return null;
  const gem = (l) => l.reduce((s, a) => s + a.niveau, 0) / l.length;
  const verschil = gem(sys) - gem(org);
  const beschrijf = (l) => ({
    assen: l.map((a) => ({ naam: a.naam, niveau: a.niveau })),
    laagste: Math.min(...l.map((a) => a.niveau)),
    hoogste: Math.max(...l.map((a) => a.niveau)),
  });
  return {
    organisatie: beschrijf(org),
    systemen: beschrijf(sys),
    // Pas vanaf een half niveau verschil is het een patroon en geen toeval.
    voorop: verschil >= 0.5 ? "systemen" : verschil <= -0.5 ? "organisatie" : "gelijk",
  };
}

/**
 * Wat er al staat: per thema de verst gevorderde stelling die voldaan is. De thema's met het hoogste
 * niveau eerst. Thema's op niveau 0 hebben nog niets en staan er niet in.
 */
export function watErAlIs(themas, max = 5) {
  return themas
    .filter((t) => t.gemeten && t.niveau >= 1)
    .map((t) => {
      const bereikt = t.stellingen.filter((s) => s.niveau <= t.niveau && s.antwoord === "ja").sort((a, b) => b.niveau - a.niveau)[0];
      return bereikt ? { thema: t.id, naam: t.naam, asNaam: t.asNaam, niveau: t.niveau, tekst: bereikt.tekst } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.niveau - a.niveau || a.naam.localeCompare(b.naam, "nl"))
    .slice(0, max);
}

/** De sterkste thema's van de hele organisatie. */
export const sterkePunten = (profiel, max = 5) => watErAlIs(alleThemas(profiel), max);

/**
 * Bijna zover: thema's waarvan de eerstvolgende stap al deels is gezet. Afmaken brengt het thema een
 * niveau hoger, dus dit zijn de stappen met de minste inspanning.
 */
export function bijnaZover(profiel) {
  return alleThemas(profiel)
    .filter((t) => t.gemeten)
    .map((t) => ({ t, stap: themaStap(t) }))
    .filter(({ stap }) => stap?.deels)
    .map(({ t, stap }) => ({ thema: t.id, naam: t.naam, asId: t.asId, asNaam: t.asNaam, niveau: t.niveau, naarNiveau: stap.niveau, tekst: stap.tekst, onderDoel: t.niveau < t.doel }))
    .sort((a, b) => Number(b.onderDoel) - Number(a.onderDoel) || a.niveau - b.niveau || a.naam.localeCompare(b.naam, "nl"));
}

/**
 * Hoe de rollen tegen de organisatie aankijken. Per rol in hoeveel thema's die rol het hoogst of het
 * laagst inschat (alleen als het verschil met een andere rol er is). Een rol die steeds hoger zit dan
 * de rest ziet de organisatie rooskleuriger; dat verschil is zelf een uitkomst.
 */
export function rolBeeld(verschillen) {
  if (!verschillen || verschillen.themas.length === 0) return null;
  const tel = Object.fromEntries(verschillen.rollen.map((r) => [r, { rol: r, hoogst: 0, laagst: 0 }]));
  let metVerschil = 0;
  for (const t of verschillen.themas) {
    const waarden = Object.values(t.niveausPerRol);
    const max = Math.max(...waarden);
    const min = Math.min(...waarden);
    if (max === min) continue;
    metVerschil += 1;
    for (const [rol, n] of Object.entries(t.niveausPerRol)) {
      if (n === max) tel[rol].hoogst += 1;
      if (n === min) tel[rol].laagst += 1;
    }
  }
  const rollen = Object.values(tel);
  const top = (veld) => {
    const gesorteerd = [...rollen].sort((a, b) => b[veld] - a[veld]);
    // Alleen noemen als één rol er duidelijk uitspringt: minstens twee thema's, en meer dan de volgende.
    return gesorteerd[0][veld] >= 2 && gesorteerd[0][veld] > (gesorteerd[1]?.[veld] ?? 0) ? gesorteerd[0].rol : null;
  };
  return {
    themasVergeleken: verschillen.themas.length,
    themasMetVerschil: metVerschil,
    tegenspraken: verschillen.themas.reduce((s, t) => s + t.tegenspraken.length, 0),
    rollen,
    meestPositief: top("hoogst"),
    meestKritisch: top("laagst"),
  };
}

/** De drie sectorthema's met hun stand en eerstvolgende stap. */
export function sectorBeeld(profiel) {
  const themas = alleThemas(profiel);
  return SECTORTHEMAS.map((id) => themas.find((t) => t.id === id))
    .filter((t) => t?.gemeten)
    .map((t) => ({ thema: t.id, naam: t.naam, beschrijving: t.beschrijving, asNaam: t.asNaam, niveau: t.niveau, doel: t.doel, stap: themaStap(t) }));
}

const MAX_NU = 4;
const MIN_NU = 3;
const MAX_DAARNA = 5;

/**
 * De aanpak in drie stappen: nu, daarna, later.
 *
 * "Nu" zijn de thema's die iets anders blokkeren: een voorwaarde om de vrijkomende tijd uit de
 * capaciteitsanalyse te benutten (realistisch scenario), of een thema dat eerst op orde moet zijn
 * voordat een ander thema zin heeft. Zijn dat er minder dan drie, dan wordt aangevuld met de grootste
 * kloven. "Daarna" zijn de overige grote kloven (twee niveaus of meer), "later" de rest.
 *
 * De volgorde binnen elke stap is die van volgordeVanAanpak, zodat rapport en scherm niet verschillen.
 */
export function stappenplan(analyse) {
  const { profiel, volgorde, realisatie } = analyse;
  const themas = new Map(alleThemas(profiel).map((t) => [t.id, t]));
  const nietVoldaan = new Map((realisatie?.voorwaarden ?? []).filter((v) => v.scenario === "realistisch" && v.status === "niet voldaan").map((v) => [v.thema, v]));

  // Een voorwaarde voor de vrijkomende tijd kan een thema zijn dat zijn eigen doel al haalt; dan staat
  // het niet in de volgorde en komt het er hier bij.
  const items = volgorde.map((i) => ({ ...i }));
  for (const v of nietVoldaan.values()) {
    if (items.some((i) => i.thema === v.thema)) continue;
    const t = themas.get(v.thema);
    if (t) items.unshift({ thema: t.id, naam: t.naam, asId: t.asId, niveau: t.niveau, doel: v.vereist, kloof: v.vereist - t.niveau, redenen: [] });
  }

  const verrijk = (i) => {
    const t = themas.get(i.thema);
    const voorwaarde = nietVoldaan.get(i.thema);
    const nodigVoor = i.redenen.filter((r) => r.soort === "afhankelijkheid");
    return {
      thema: i.thema,
      naam: i.naam,
      asNaam: t?.asNaam ?? "",
      niveau: i.niveau,
      doel: i.doel,
      kloof: i.kloof,
      stap: themaStap(t),
      // Waarom dit thema op deze plek staat, in volgorde van gewicht.
      waarom: voorwaarde
        ? { soort: "voorwaarde", vereist: voorwaarde.vereist, reden: voorwaarde.reden }
        : nodigVoor.length > 0
          ? { soort: "afhankelijkheid", voorNaam: nodigVoor.map((r) => r.voorNaam), reden: nodigVoor[0].reden }
          : { soort: "kloof" },
    };
  };

  const blokkeert = (i) => nietVoldaan.has(i.thema) || i.redenen.some((r) => r.soort === "afhankelijkheid");
  const nu = items.filter(blokkeert).slice(0, MAX_NU);
  for (const i of items) {
    if (nu.length >= MIN_NU) break;
    if (!nu.includes(i)) nu.push(i);
  }
  const rest = items.filter((i) => !nu.includes(i));
  const daarna = rest.filter((i) => i.kloof >= 2).slice(0, MAX_DAARNA);
  const later = rest.filter((i) => !daarna.includes(i));

  return { nu: nu.map(verrijk), daarna: daarna.map(verrijk), later: later.map(verrijk), totaal: items.length };
}

/**
 * Alles wat het rapport over één onderdeel wil zeggen: wat er al is, wat het niveau bepaalt, de stand
 * per thema, waar rollen elkaar tegenspreken en waarom het onderdeel telt.
 */
export function onderdeelBeeld(as, analyse) {
  const themas = as.themas.map((t) => ({ ...t, asId: as.id, asNaam: as.naam, doel: as.doel }));
  const bepalend = new Set(as.zwakksteThemas.map((t) => t.id));

  const tegenspraken = (analyse.verschillen?.themas ?? [])
    .filter((t) => t.asId === as.id && t.tegenspraken.length > 0)
    .flatMap((t) => t.tegenspraken.map((x) => ({ thema: t.naam, tekst: x.tekst, rollenJa: x.rollenJa, rollenNee: x.rollenNee })));

  const voorwaarden = (analyse.realisatie?.voorwaarden ?? []).filter((v) => v.asId === as.id);
  const nodigVoor = analyse.volgorde
    .filter((i) => i.asId === as.id)
    .flatMap((i) => i.redenen.filter((r) => r.soort === "afhankelijkheid").map((r) => ({ naam: i.naam, voorNaam: r.voorNaam, reden: r.reden })));

  return {
    watErAlIs: watErAlIs(themas, 3),
    bepalend: themas.filter((t) => bepalend.has(t.id)).map((t) => t.naam),
    themas: themas.map((t) => {
      const stap = themaStap(t);
      return {
        naam: t.naam,
        gemeten: t.gemeten,
        niveau: t.niveau,
        bepaaltNiveau: bepalend.has(t.id),
        stap,
        stand: !t.gemeten ? "niet gemeten" : !stap ? "alle niveaus gehaald" : stap.deels ? "deels gedaan" : "nog niet",
      };
    }),
    tegenspraken,
    voorwaarden,
    nodigVoor,
  };
}
