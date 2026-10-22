import { NIVEAUS, RAAMWERK, ROLLEN, analyseer, berekenProfiel, vergelijkMetingen } from "./volwassenheid.js";
import { nl } from "./formatNl.js";

/**
 * Het volwassenheidsrapport als gegevensmodel: een lijst blokken (koppen, alinea's, lijsten,
 * tabellen). De Word- en de PDF-weergave lezen dit ene model, zodat ze niet uiteenlopen.
 *
 * Dit rapport gaat naar de klant: gewone uitleg, geen aansporingen aan de adviseur. Het is een
 * zelfbeoordeling en zegt dat ook; een niveau zonder bewijs heet indicatief. Secties zonder
 * inhoud (geen signalen, geen eerdere meting, geen rolanalyse) komen er niet in.
 *
 * Blokken:
 *   { soort: "kop", niveau: 1|2, tekst }
 *   { soort: "alinea", tekst, stijl?: "normaal" | "noot" | "waarschuwing" }
 *   { soort: "lijst", items: [tekst] }
 *   { soort: "genummerd", items: [tekst] }
 *   { soort: "tabel", kolommen: [tekst], rijen: [[tekst]] }
 */

const rolNaam = (id) => ROLLEN.find((r) => r.id === id)?.naam ?? id;
const kop = (tekst, niveau = 1) => ({ soort: "kop", niveau, tekst });
const alinea = (tekst, stijl = "normaal") => ({ soort: "alinea", tekst, stijl });
const lijst = (items) => ({ soort: "lijst", items });
const genummerd = (items) => ({ soort: "genummerd", items });
const tabel = (kolommen, rijen) => ({ soort: "tabel", kolommen, rijen });

const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;

function niveauTekst(a) {
  if (!a.gemeten) return "niet gemeten";
  return `${a.niveau} · ${a.niveauNaam}`;
}

function onderbouwingTekst(a) {
  if (!a.gemeten) return "—";
  if (a.niveau === 0) return "—";
  return a.onderbouwd ? "onderbouwd" : "indicatief";
}

export function bouwVolwassenheidsRapport({ invoer, metingen = [], results = null, klantNaam, scope = "bedrijf", scopeLabel = "", datum }) {
  const analyse = analyseer(invoer, { results });
  const { profiel } = analyse;
  const gemeten = profiel.assen.filter((a) => a.gemeten);
  const blokken = [];

  // ---- Samenvatting -------------------------------------------------------------------------
  blokken.push(kop("Managementsamenvatting"));
  if (gemeten.length === 0) {
    blokken.push(alinea("Er zijn nog geen antwoorden vastgelegd; dit rapport bevat daarom nog geen uitkomsten.", "waarschuwing"));
  } else {
    const spreiding =
      profiel.laagste.niveau === profiel.hoogste.niveau
        ? `Op alle gemeten assen is het niveau ${profiel.laagste.niveau} (${profiel.laagste.niveauNaam.toLowerCase()}).`
        : `Het hoogst scoort ${profiel.hoogste.naam} (niveau ${profiel.hoogste.niveau}, ${profiel.hoogste.niveauNaam.toLowerCase()}), het laagst ${profiel.laagste.naam} (niveau ${profiel.laagste.niveau}, ${profiel.laagste.niveauNaam.toLowerCase()}).`;
    blokken.push(
      alinea(
        `Voor ${gemeten.length} van de ${profiel.assen.length} assen is vastgesteld hoe ver de organisatie is met het inzetten van AI, op een schaal van 0 (nog niet begonnen) tot 5 (zelfvernieuwend). ${spreiding} Er is geen totaalscore: een gemiddelde zou verbergen wat een directie moet weten.`
      )
    );
    // De kolom met onderbouwing hoort bij de verdiepingsfase: alleen als er bewijs is vastgelegd.
    const metBewijs = profiel.bewijsGebruikt;
    blokken.push(
      tabel(
        ["As", "Niveau", "Doel", "Nog te gaan", ...(metBewijs ? ["Onderbouwing"] : [])],
        profiel.assen.map((a) => [
          a.naam,
          niveauTekst(a) + (a.gemeten && a.onvolledig ? " (onvolledig)" : ""),
          String(a.doel),
          a.gat === null ? "—" : a.gat === 0 ? "doel gehaald" : String(a.gat),
          ...(metBewijs ? [onderbouwingTekst(a)] : []),
        ])
      )
    );
    if (analyse.volgorde.length > 0) {
      const eerste = analyse.volgorde[0];
      const asNaam = profiel.assen.find((a) => a.id === eerste.asId)?.naam;
      blokken.push(alinea(`Het eerste aandachtspunt is ${eerste.naam} (${asNaam}): niveau ${eerste.niveau}, doel ${eerste.doel}.`));
    }
    if (profiel.telling.beantwoord < profiel.telling.totaal) {
      blokken.push(
        alinea(
          `Van de ${profiel.telling.totaal} stellingen zijn er ${profiel.telling.beantwoord} beantwoord. Wat niet is beantwoord telt als niet voldaan, dus de niveaus zijn een ondergrens.`,
          "waarschuwing"
        )
      );
    }
    if (!profiel.bewijsGebruikt) {
      blokken.push(
        alinea(
          "Dit rapport geeft een eerste beeld op basis van zelfbeoordeling. Een verdiepend onderzoek, met gesprekken en bewijs, volgt in het vervolgtraject.",
          "noot"
        )
      );
    } else if (gemeten.some((a) => a.niveau > 0 && !a.onderbouwd)) {
      blokken.push(
        alinea(
          "Dit is een zelfbeoordeling. Een as is pas onderbouwd als bij elke voldane stelling het bewijs is gezien; de overige assen zijn indicatief.",
          "noot"
        )
      );
    }
  }

  if (gemeten.length === 0) return maakModel();

  // ---- Hoe te lezen -------------------------------------------------------------------------
  blokken.push(kop("Hoe dit te lezen"));
  blokken.push(tabel(["Niveau", "Naam", "Betekenis"], [["0", "Nog niet begonnen", "De stelling van het eerste niveau is nog niet voldaan."], ...NIVEAUS.map((n) => [String(n.niveau), n.naam, n.beschrijving])]));
  blokken.push(
    lijst([
      "Elke as bestaat uit thema's, en elk thema heeft een ladder van vijf stellingen. Een niveau geldt pas als de stelling van dat niveau én van alle lagere niveaus voldaan is.",
      "Het niveau van een as is het niveau van het zwakste thema. Een sterk thema compenseert een zwak thema niet.",
      "Het doelniveau per as is de ambitie van deze organisatie of dit onderdeel; een lager doel dan het hoogste niveau is een legitieme keuze.",
    ])
  );

  // ---- Per as -------------------------------------------------------------------------------
  blokken.push(kop("Per as: waar staat de organisatie en wat is de volgende stap"));
  for (const a of gemeten) {
    blokken.push(kop(`${a.naam} — niveau ${a.niveau} (${a.niveauNaam.toLowerCase()})`, 2));
    const regels = a.zwakksteThemas.map((t) =>
      t.volgendeStap
        ? `${t.naam}: volgende stap (niveau ${t.volgendeStap.niveau}): ${t.volgendeStap.tekst}`
        : `${t.naam}: alle niveaus zijn voldaan.`
    );
    blokken.push(alinea(`Het niveau wordt bepaald door ${a.zwakksteThemas.map((t) => t.naam).join(", ")}.`));
    blokken.push(lijst(regels));
  }
  const ongemeten = profiel.assen.filter((a) => !a.gemeten);
  if (ongemeten.length > 0) {
    blokken.push(alinea(`Niet gemeten: ${ongemeten.map((a) => a.naam).join(", ")}.`, "noot"));
  }

  // ---- Volgorde van aanpak ------------------------------------------------------------------
  if (analyse.volgorde.length > 0) {
    blokken.push(kop("Volgorde van aanpak"));
    blokken.push(alinea("Grootste kloof eerst. Waar een thema eerst op orde moet zijn voordat een ander thema zin heeft, staat het vooraan en is de reden vermeld."));
    blokken.push(
      genummerd(
        analyse.volgorde.map((i) => {
          const as = profiel.assen.find((a) => a.id === i.asId)?.naam;
          const afh = i.redenen.filter((r) => r.soort === "afhankelijkheid").map((r) => ` Eerst nodig voor ${r.voorNaam}: ${r.reden}`);
          return `${i.naam} (${as}): niveau ${i.niveau}, doel ${i.doel}.${afh.join("")}`;
        })
      )
    );
  }

  // ---- Vaardigheid versus borging -----------------------------------------------------------
  const borging = analyse.vaardigheidVersusBorging.filter((r) => r.signaal);
  if (borging.length > 0) {
    blokken.push(kop("Vaardigheid versus borging"));
    blokken.push(alinea("Bij deze thema's kan de organisatie meer dan zij heeft geborgd (eigenaar, afspraken, middelen, herhaalbaar). Dat werkt, maar is kwetsbaar."));
    blokken.push(lijst(borging.map((r) => `${r.naam}: kan het op niveau ${r.kanHet}, geborgd op niveau ${r.geborgd} — ${r.signaal}.`)));
  }

  // ---- Signalen -----------------------------------------------------------------------------
  if (analyse.tegenstrijdigheden.length > 0) {
    blokken.push(kop("Signalen om te bespreken"));
    blokken.push(alinea("Combinaties die in de praktijk zelden kloppen. Ze zijn bedoeld voor het gesprek, niet als oordeel."));
    blokken.push(lijst(analyse.tegenstrijdigheden.map((s) => `${s.plek}. ${s.uitleg}`)));
  }

  // ---- Verschil tussen invullers ------------------------------------------------------------
  if (analyse.verschillen) {
    blokken.push(kop("Verschil tussen invullers"));
    blokken.push(
      alinea(
        `De vragenlijst is ingevuld door ${analyse.verschillen.rollen.map(rolNaam).join(", ")}. Hieronder staat per rol, nooit per persoon, waar het beeld uiteenloopt.`
      )
    );
    if (analyse.verschillen.signalen.length === 0) {
      blokken.push(alinea("De rollen zijn het in alle thema's ongeveer eens: het verschil is nergens twee niveaus of meer."));
    } else {
      blokken.push(
        lijst(
          analyse.verschillen.signalen.map(
            (t) => `${t.naam}: ${Object.entries(t.niveausPerRol).map(([r, n]) => `${rolNaam(r)} niveau ${n}`).join(", ")}.`
          )
        )
      );
    }
  }

  // ---- Onderbouwing -------------------------------------------------------------------------
  const voldaan = profiel.assen.reduce((s, a) => s + a.onderbouwing.voldaan, 0);
  const gezien = profiel.assen.reduce((s, a) => s + a.onderbouwing.gezien, 0);
  if (voldaan > 0 && profiel.bewijsGebruikt) {
    blokken.push(kop("Onderbouwing"));
    blokken.push(
      alinea(
        `Van de ${meervoud(voldaan, "voldane stelling", "voldane stellingen")} is bij ${gezien} het bewijs gezien (documenten, cijfers of gesprekken). De overige antwoorden rusten op een verklaring.`
      )
    );
  }

  // ---- Voortgang ----------------------------------------------------------------------------
  const vergelijking = metingen.length > 0 ? vergelijkMetingen(berekenProfiel(metingen[0]), profiel) : null;
  if (vergelijking) {
    blokken.push(kop("Voortgang sinds de vorige meting"));
    if (vergelijking.onvergelijkbaar) {
      blokken.push(alinea(`De vorige meting is niet te vergelijken met deze: ${vergelijking.onvergelijkbaar}.`, "noot"));
    } else {
      const veranderd = vergelijking.perAs.filter((v) => v.verschil !== 0);
      blokken.push(
        alinea(`Sinds de vorige meting: ${vergelijking.gestegen} gestegen, ${vergelijking.gelijk} gelijk, ${vergelijking.gedaald} gedaald.`)
      );
      if (veranderd.length > 0) blokken.push(lijst(veranderd.map((v) => `${v.naam}: niveau ${v.voor} → ${v.nu}.`)));
    }
  }

  // ---- Koppeling met de rolanalyse ----------------------------------------------------------
  const r = analyse.realisatie;
  if (r) {
    blokken.push(kop("Koppeling met de analyse van functies"));
    blokken.push(
      alinea(
        `De analyse van functies laat zien dat ${nl(r.fteRealistisch, 1)} FTE aan capaciteit kan vrijkomen in het realistische scenario${
          r.fteAgressief != null ? ` en ${nl(r.fteAgressief, 1)} FTE in het ambitieuze scenario` : ""
        }. Of de organisatie die capaciteit ook kan realiseren, hangt af van onderstaande voorwaarden. Het zijn voorwaarden en geen gecorrigeerd getal: de uitgangspunten komen uit adviespraktijk en worden met ervaring bijgesteld.`
      )
    );
    const groep = (sleutel, titel, telling) => {
      const l = r.voorwaarden.filter((v) => v.scenario === sleutel);
      if (l.length === 0) return;
      blokken.push(kop(telling ? `${titel}: ${telling.voldaan} van ${telling.totaal} voorwaarden voldaan` : titel, 2));
      blokken.push(
        tabel(
          ["Thema", "Nodig", "Nu", "Status", "Waarom"],
          l.map((v) => [v.naam, `niveau ${v.vereist}`, v.huidig === null ? "—" : `niveau ${v.huidig}`, v.status, v.reden])
        )
      );
    };
    groep("realistisch", "Realistisch scenario", r.realistisch);
    groep("agressief", "Ambitieus scenario", r.agressief);
    groep("kwaliteitsverbetering", "Rollen met bestemming kwaliteitsverbetering", null);
    if (r.knelpuntVaardigheden) {
      blokken.push(
        alinea(
          `De ontwikkelagenda uit de analyse van functies telt ${r.agendaLengte} competenties, terwijl het niveau van vaardigheden laag is. Dat is een concreet knelpunt voor de realisatie.`,
          "waarschuwing"
        )
      );
    }
  }

  // ---- Waar verdieping het meest oplevert ---------------------------------------------------
  // Dit rapport is een kwantitatief eerste beeld. De scan wijst zelf aan waar gesprekken en bewijs
  // in een vervolgtraject de meeste toegevoegde waarde hebben.
  const verdieping = [];
  const genoemd = new Set();
  const voeg = (sleutel, tekst) => {
    if (genoemd.has(sleutel) || verdieping.length >= 8) return;
    genoemd.add(sleutel);
    verdieping.push(tekst);
  };
  for (const i of analyse.volgorde.slice(0, 3)) {
    const asNaam = profiel.assen.find((a) => a.id === i.asId)?.naam;
    voeg(`thema:${i.thema}`, `${i.naam} (${asNaam}): groot verschil tussen niveau ${i.niveau} en doel ${i.doel}. Gesprekken maken duidelijk wat er concreet ontbreekt.`);
  }
  for (const r of borging) {
    voeg(`thema:${r.thema}`, `${r.naam}: de organisatie kan het, maar heeft het niet geborgd. Verdieping toetst hoe kwetsbaar dat is.`);
  }
  for (const s of analyse.tegenstrijdigheden) {
    voeg(`signaal:${s.id}:${s.plek}`, `${s.plek}: een combinatie die zelden klopt. Controleer in een gesprek wat erachter zit.`);
  }
  for (const t of analyse.verschillen?.signalen ?? []) {
    voeg(`thema:${t.thema}`, `${t.naam}: rollen zien het verschillend. Gesprekken met beide kanten leggen het verschil bloot.`);
  }
  if (verdieping.length > 0) {
    blokken.push(kop("Waar verdieping het meest oplevert"));
    blokken.push(
      alinea(
        "Op basis van deze scan zijn dit de plekken waar een verdiepend onderzoek, met gesprekken en bewijs, de meeste toegevoegde waarde heeft."
      )
    );
    blokken.push(lijst(verdieping));
  }

  // ---- Beperkingen --------------------------------------------------------------------------
  blokken.push(kop("Wat dit rapport wel en niet zegt"));
  blokken.push(
    lijst([
      "Het is een zelfbeoordeling. Ook met bewijsvragen is de score een oordeel van mensen over hun eigen organisatie, en mensen overschatten zichzelf het meest op gebieden waar ze het minst van weten. Daarom kent de scan meerdere invullers en signalen, en voegt een verdiepend onderzoek gesprekken en bewijs toe.",
      "Er is geen vergelijking met andere organisaties. Dat kan pas met eigen metingen van veel organisaties, en dan alleen per sector en omvang.",
      "De afhankelijkheden, signalen en realisatievoorwaarden zijn uitgangspunten uit adviespraktijk, geen meetresultaten. Ze worden met ervaring bijgesteld.",
      "De koppeling met de analyse van functies is een eerste uitwerking en geeft voorwaarden, geen exacte voorspelling.",
    ])
  );

  return maakModel();

  function maakModel() {
    const scopeSuffix = scope === "afdeling" && scopeLabel ? ` — ${scopeLabel}` : "";
    return {
      titel: "AI-volwassenheid",
      ondertitel: `${klantNaam}${scopeSuffix}`,
      meta: [
        `Gegenereerd op ${datum}`,
        invoer?.scope ? `Scope van de beoordeling: ${invoer.scope}` : null,
        `${RAAMWERK.naam}, versie ${RAAMWERK.versie}`,
      ].filter(Boolean),
      disclaimer:
        "Dit rapport is een strategisch gespreksondersteunend instrument en een eerste beeld op basis van zelfbeoordeling. Het is geen audit of certificering en vervangt geen diepgaand onderzoek.",
      blokken,
    };
  }
}

/** Alle tekst van het model, plat, om te controleren dat een weergave niets weglaat. */
export function modelTeksten(model) {
  const t = [model.titel, model.ondertitel, ...model.meta, model.disclaimer];
  for (const b of model.blokken) {
    if (b.soort === "kop" || b.soort === "alinea") t.push(b.tekst);
    else if (b.soort === "lijst" || b.soort === "genummerd") t.push(...b.items);
    else if (b.soort === "tabel") t.push(...b.kolommen, ...b.rijen.flat());
  }
  return t;
}
