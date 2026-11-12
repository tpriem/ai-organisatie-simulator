import { NIVEAUS, RAAMWERK, analyseer, berekenProfiel, vergelijkMetingen } from "./volwassenheid.js";
import { totaalbeeld, organisatieEnSystemen, sterkePunten, bijnaZover, rolBeeld, sectorBeeld, stappenplan, onderdeelBeeld } from "./scanInzichten.js";
import { rolNaam, meervoud, zijn, klein, eindpunt, opsomming, standZin, waaromZin, waaromKort, organisatieSystemenZin, conclusies as trekConclusies } from "./scanTeksten.js";
import { nl } from "./formatNl.js";

/**
 * Het volwassenheidsrapport als gegevensmodel: een lijst blokken (koppen, alinea's, lijsten,
 * tabellen). De Word- en de PDF-weergave lezen dit ene model, zodat ze niet uiteenlopen.
 *
 * Dit rapport gaat naar de klant: gewone uitleg, geen aansporingen aan de adviseur. Het is een
 * zelfbeoordeling en zegt dat ook; een niveau zonder bewijs heet indicatief. Secties zonder
 * inhoud (geen signalen, geen eerdere meting, geen rolanalyse) komen er niet in.
 *
 * De opbouw volgt de vragen van de lezer, in deze volgorde:
 *   1. In het kort           de conclusie, het profiel en waar te beginnen, op één pagina
 *   2. Wat het beeld laat zien   patronen: wat er al staat, wat bijna af is, waar het kwetsbaar is
 *   3. Wat dit betekent          de voorwaarden om de vrijkomende tijd te benutten
 *   4. Wat nu                    de aanpak in drie stappen
 *   5. Per onderdeel             de verdieping, met een vaste opbouw per onderdeel
 *   6. Bijlagen                  hoe de scan werkt, de volledige volgorde, wat het rapport niet zegt
 * De inzichten zelf komen uit scanInzichten.js; hier worden het zinnen.
 *
 * In de tekst heet een as een "onderdeel": zo noemt de lezer het.
 *
 * Blokken:
 *   { soort: "kop", niveau: 1|2, tekst, nieuwePagina? }
 *   { soort: "alinea", tekst, stijl?: "normaal" | "noot" | "waarschuwing" | "lead", label? }
 *   { soort: "lijst", items: [tekst] }
 *   { soort: "genummerd", items: [tekst] }
 *   { soort: "tabel", kolommen: [tekst], rijen: [[tekst]] }
 *   { soort: "kader", titel, items: [tekst] }        uitgelichte, genummerde punten
 *   { soort: "profiel", kolommen, rijen: [{ naam, groep, niveau, doel, niveauTekst, doelTekst, gatTekst, onderbouwing? }] }
 */

// Met `nieuwePagina` begint het hoofdstuk bovenaan een pagina.
const kop = (tekst, niveau = 1, nieuwePagina = false) => ({ soort: "kop", niveau, tekst, ...(nieuwePagina ? { nieuwePagina: true } : {}) });
const alinea = (tekst, stijl = "normaal") => ({ soort: "alinea", tekst, stijl });
const metLabel = (label, tekst) => ({ soort: "alinea", tekst, stijl: "normaal", label });
const lijst = (items) => ({ soort: "lijst", items });
const genummerd = (items) => ({ soort: "genummerd", items });
const tabel = (kolommen, rijen) => ({ soort: "tabel", kolommen, rijen });
const kader = (titel, items) => ({ soort: "kader", titel, items });

function niveauTekst(a) {
  if (!a.gemeten) return "niet gemeten";
  return `${a.niveau} · ${a.niveauNaam}`;
}

function onderbouwingTekst(a) {
  if (!a.gemeten) return "geen";
  if (a.niveau === 0) return "geen";
  return a.onderbouwd ? "onderbouwd" : "indicatief";
}

export function bouwVolwassenheidsRapport({ invoer, metingen = [], results = null, klantNaam, scope = "bedrijf", scopeLabel = "", datum }) {
  const analyse = analyseer(invoer, { results });
  const { profiel } = analyse;
  const gemeten = profiel.assen.filter((a) => a.gemeten);
  const blokken = [];

  // ---- 1. In het kort -----------------------------------------------------------------------
  blokken.push(kop("In het kort"));
  if (gemeten.length === 0) {
    blokken.push(alinea("Er zijn nog geen antwoorden vastgelegd; dit rapport bevat daarom nog geen uitkomsten.", "waarschuwing"));
    return maakModel();
  }

  const beeld = totaalbeeld(profiel);
  const os = organisatieEnSystemen(profiel);
  const sterk = sterkePunten(profiel);
  const bijna = bijnaZover(profiel);
  const borging = analyse.vaardigheidVersusBorging.filter((r) => r.signaal);
  const rollen = rolBeeld(analyse.verschillen);
  const sector = sectorBeeld(profiel);
  const plan = stappenplan(analyse);
  const r = analyse.realisatie;
  const nietVoldaan = r ? r.voorwaarden.filter((v) => v.scenario === "realistisch" && v.status === "niet voldaan") : [];

  blokken.push(alinea(standZin(beeld, klantNaam), "lead"));

  // De conclusies: eerst de afstand tot het doel, dan wat de lezer er het meest aan heeft.
  const conclusies = trekConclusies(analyse);
  blokken.push(kader("De belangrijkste conclusies", conclusies));

  // Het profiel. De kolom met onderbouwing hoort bij de verdiepingsfase: alleen als er bewijs is vastgelegd.
  const metBewijs = profiel.bewijsGebruikt;
  blokken.push({
    soort: "profiel",
    kolommen: ["Onderdeel", "Niveau", "Doel", "Nog te gaan", ...(metBewijs ? ["Onderbouwing"] : [])],
    rijen: profiel.assen.map((a) => ({
      naam: a.naam,
      groep: a.kant === "systeem" ? "Systemen" : "Organisatie",
      niveau: a.gemeten ? a.niveau : null,
      doel: a.doel,
      niveauTekst: niveauTekst(a) + (a.gemeten && a.onvolledig ? " (onvolledig)" : ""),
      doelTekst: String(a.doel),
      gatTekst: a.gat === null ? "niet gemeten" : a.gat === 0 ? "doel gehaald" : String(a.gat),
      ...(metBewijs ? { onderbouwing: onderbouwingTekst(a) } : {}),
    })),
  });
  blokken.push(
    alinea(
      `Het profiel laat per onderdeel het niveau en het doel zien, op een schaal van 0 (nog niet begonnen) tot 5 (zelfvernieuwend). Er is geen totaalscore: een gemiddelde zou verbergen wat een directie moet weten.${
        profiel.bewijsGebruikt ? "" : " Dit rapport geeft een eerste beeld op basis van zelfbeoordeling; een verdiepend onderzoek, met gesprekken en bewijs, volgt in het vervolgtraject."
      }`,
      "noot"
    )
  );

  if (plan.nu.length > 0) {
    blokken.push(metLabel("Waar te beginnen", "De uitwerking staat in het hoofdstuk Wat nu."));
    blokken.push(genummerd(plan.nu.map((i) => `${i.naam} (${i.asNaam}): ${waaromKort(i.waarom)}.`)));
  }

  if (profiel.telling.beantwoord < profiel.telling.totaal) {
    blokken.push(
      alinea(
        `Van de ${profiel.telling.totaal} stellingen zijn er ${profiel.telling.beantwoord} beantwoord. Wat niet is beantwoord telt als niet voldaan, dus de niveaus zijn een ondergrens.`,
        "waarschuwing"
      )
    );
  }
  if (profiel.bewijsGebruikt && gemeten.some((a) => a.niveau > 0 && !a.onderbouwd)) {
    blokken.push(
      alinea(
        "Dit is een zelfbeoordeling. Een onderdeel is pas onderbouwd als bij elke voldane stelling het bewijs is gezien; de overige onderdelen zijn indicatief.",
        "noot"
      )
    );
  }

  // "In het kort" staat op zichzelf: het eerste hoofdstuk erna begint op een nieuwe pagina.
  let eersteHoofdstuk = true;
  const hoofdstuk = (tekst) => {
    const blok = kop(tekst, 1, eersteHoofdstuk);
    eersteHoofdstuk = false;
    return blok;
  };

  // ---- 2. Wat het beeld laat zien -----------------------------------------------------------
  const patronen = [];

  if (os) {
    patronen.push(kop("Organisatie en systemen", 2));
    patronen.push(alinea(organisatieSystemenZin(os)));
  }

  if (sterk.length > 0) {
    patronen.push(kop("Wat er al staat", 2));
    patronen.push(alinea("De thema's waar de organisatie het verst is, met wat daar is bereikt. Hier kan op worden voortgebouwd."));
    patronen.push(lijst(sterk.map((s) => `${s.naam} (${s.asNaam}, niveau ${s.niveau}): ${s.tekst}`)));
  }

  if (bijna.length > 0) {
    const MAX = 8;
    patronen.push(kop("Bijna zover", 2));
    patronen.push(
      alinea(
        `Bij ${bijna.length === 1 ? "dit thema" : `deze ${bijna.length} thema's`} is de eerstvolgende stap al deels gezet. Afmaken brengt het thema een niveau hoger en kost de minste inspanning.`
      )
    );
    patronen.push(lijst(bijna.slice(0, MAX).map((b) => `${b.naam} (${b.asNaam}), naar niveau ${b.naarNiveau}: ${b.tekst}`)));
    if (bijna.length > MAX) patronen.push(alinea(`En nog ${bijna.length - MAX}: ${opsomming(bijna.slice(MAX).map((b) => b.naam))}.`, "noot"));
  }

  if (borging.length > 0) {
    patronen.push(kop("Kunnen en borgen", 2));
    patronen.push(
      alinea(
        "Bij deze thema's kan de organisatie meer dan zij heeft geborgd (een eigenaar, afspraken, middelen, herhaalbaar). Dat werkt, maar is kwetsbaar: het hangt aan de mensen die het nu doen."
      )
    );
    patronen.push(lijst(borging.map((b) => `${b.naam}: kan het op niveau ${b.kanHet}, geborgd op niveau ${b.geborgd}; ${b.signaal}.`)));
  }

  if (analyse.verschillen) {
    patronen.push(kop("Verschil tussen rollen", 2));
    patronen.push(
      alinea(
        `De vragenlijst is ingevuld door ${opsomming(analyse.verschillen.rollen.map(rolNaam))}. Hieronder staat per rol, nooit per persoon, waar het beeld uiteenloopt. Voor het niveau telt het strengste antwoord; het verschil zelf is een onderwerp voor het gesprek.`
      )
    );
    if (rollen && rollen.themasMetVerschil > 0) {
      const delen = [`In ${rollen.themasMetVerschil} van de ${meervoud(rollen.themasVergeleken, "vergeleken thema", "vergeleken thema's")} schatten de rollen het niveau verschillend in.`];
      if (rollen.meestPositief) delen.push(`${rolNaam(rollen.meestPositief)} schat het vaakst het hoogst in.`);
      if (rollen.meestKritisch) delen.push(`${rolNaam(rollen.meestKritisch)} schat het vaakst het laagst in.`);
      patronen.push(alinea(delen.join(" ")));
    }
    if (analyse.verschillen.signalen.length === 0) {
      patronen.push(alinea("De rollen zijn het in alle thema's ongeveer eens: het verschil is nergens twee niveaus of meer."));
    } else {
      patronen.push(
        lijst(
          analyse.verschillen.signalen.map(
            (t) => `${t.naam}: ${Object.entries(t.niveausPerRol).map(([rol, n]) => `${rolNaam(rol)} niveau ${n}`).join(", ")}.`
          )
        )
      );
    }
  }

  if (sector.length > 0) {
    patronen.push(kop("Specifiek voor corporaties", 2));
    patronen.push(
      alinea(
        "Drie thema's gaan over wat een corporatie anders maakt dan een willekeurig bedrijf: de gegevens van huurders, het toezicht en de maatschappelijke opdracht."
      )
    );
    patronen.push(
      tabel(
        ["Thema", "Niveau", "Doel", "Eerstvolgende stap"],
        sector.map((s) => [s.naam, String(s.niveau), String(s.doel), s.stap ? `${s.stap.tekst}${s.stap.deels ? " (deels gedaan)" : ""}` : "Alle niveaus zijn gehaald."])
      )
    );
  }

  if (analyse.tegenstrijdigheden.length > 0) {
    patronen.push(kop("Signalen om te bespreken", 2));
    patronen.push(alinea("Combinaties die in de praktijk zelden kloppen. Ze zijn bedoeld voor het gesprek, niet als oordeel."));
    patronen.push(lijst(analyse.tegenstrijdigheden.map((s) => `${s.plek}. ${s.uitleg}`)));
  }

  if (patronen.length > 0) blokken.push(hoofdstuk("Wat het beeld laat zien"), ...patronen);

  // ---- 3. Wat dit betekent voor de vrijkomende tijd -----------------------------------------
  if (r) {
    blokken.push(hoofdstuk("Wat dit betekent voor de vrijkomende tijd"));
    blokken.push(
      alinea(
        `De capaciteitsanalyse laat zien dat ${nl(r.fteRealistisch, 1)} FTE aan capaciteit kan vrijkomen in het realistische scenario${
          r.fteAgressief != null ? ` en ${nl(r.fteAgressief, 1)} FTE in het ambitieuze scenario` : ""
        }. Of de organisatie die capaciteit ook kan benutten, hangt af van onderstaande voorwaarden. Het zijn voorwaarden en geen gecorrigeerd getal: de uitgangspunten komen uit adviespraktijk en worden met ervaring bijgesteld.`
      )
    );
    if (r.realistisch.totaal > 0) {
      blokken.push(
        alinea(
          nietVoldaan.length === 0
            ? "Aan alle voorwaarden voor het realistische scenario is voldaan. De organisatie kan beginnen met het benutten van de vrijkomende tijd."
            : `Voor het realistische scenario ${zijn(r.realistisch.voldaan)} ${r.realistisch.voldaan} van de ${r.realistisch.totaal} voorwaarden voldaan. Zolang ${opsomming(nietVoldaan.map((v) => v.naam))} niet op orde ${zijn(nietVoldaan.length)}, komt de tijd uit de capaciteitsanalyse niet vanzelf vrij.`,
          "lead"
        )
      );
    }
    const groep = (sleutel, titel, telling) => {
      const l = r.voorwaarden.filter((v) => v.scenario === sleutel);
      if (l.length === 0) return;
      blokken.push(kop(telling ? `${titel}: ${telling.voldaan} van ${telling.totaal} voorwaarden voldaan` : titel, 2));
      blokken.push(
        tabel(
          ["Thema", "Nodig", "Nu", "Status", "Waarom"],
          l.map((v) => [v.naam, `niveau ${v.vereist}`, v.huidig === null ? "niet gemeten" : `niveau ${v.huidig}`, v.status, v.reden])
        )
      );
    };
    groep("realistisch", "Realistisch scenario", r.realistisch);
    groep("agressief", "Ambitieus scenario", r.agressief);
    groep("kwaliteitsverbetering", "Rollen met bestemming kwaliteitsverbetering", null);
    if (r.knelpuntVaardigheden) {
      blokken.push(
        alinea(
          `De capaciteitsanalyse noemt ${r.agendaLengte} competenties die straks extra nodig zijn, terwijl het niveau van vaardigheden laag is. Dat is een concreet knelpunt voor de realisatie.`,
          "waarschuwing"
        )
      );
    }
  }

  // ---- 4. Wat nu: de aanpak in drie stappen -------------------------------------------------
  if (plan.totaal > 0) {
    blokken.push(hoofdstuk("Wat nu: de aanpak in drie stappen"));
    blokken.push(
      alinea(
        "De aanpak begint bij wat iets anders tegenhoudt: een voorwaarde om de vrijkomende tijd te benutten, of een thema dat eerst op orde moet zijn voordat een ander thema zin heeft. Daarna volgen de grootste afstanden tot het doel."
      )
    );

    blokken.push(kop("Stap 1: nu beginnen", 2));
    plan.nu.forEach((i, n) => {
      blokken.push(metLabel(`${n + 1}. ${i.naam} (${i.asNaam})`, `Van niveau ${i.niveau} naar niveau ${i.doel}. ${eindpunt(waaromZin(i.waarom))}`));
      if (i.stap) {
        blokken.push(
          lijst([
            `De eerste stap is gezet als geldt: ${i.stap.tekst}`,
            ...(i.stap.voorbeelden.length > 0 ? [`Dat is te zien aan: ${opsomming(i.stap.voorbeelden)}.`] : []),
            ...(i.stap.deels ? ["Hier is al een begin mee gemaakt."] : []),
          ])
        );
      }
    });

    if (plan.daarna.length > 0) {
      blokken.push(kop("Stap 2: daarna", 2));
      blokken.push(alinea("De overige thema's met een afstand van twee niveaus of meer tot het doel."));
      blokken.push(
        lijst(plan.daarna.map((i) => `${i.naam} (${i.asNaam}): van niveau ${i.niveau} naar niveau ${i.doel}.${i.stap ? ` Eerst te bereiken: ${i.stap.tekst}` : ""}`))
      );
    }

    if (plan.later.length > 0) {
      blokken.push(kop("Stap 3: later", 2));
      blokken.push(
        alinea(`${meervoud(plan.later.length, "thema", "thema's")} met een kleinere afstand tot het doel of een latere plek in de volgorde: ${opsomming(plan.later.map((i) => i.naam))}.`)
      );
    }
  }

  // ---- 5. Per onderdeel ---------------------------------------------------------------------
  blokken.push(kop("Per onderdeel", 1, true));
  blokken.push(alinea("Per onderdeel: waar het over gaat, wat er al is, wat het niveau bepaalt en wat de eerstvolgende stap per thema is."));
  for (const a of gemeten) {
    const o = onderdeelBeeld(a, analyse);
    blokken.push(kop(`${a.naam}: niveau ${a.niveau} (${klein(a.niveauNaam)}), doel ${a.doel}`, 2));
    blokken.push(metLabel("Waar het over gaat", a.beschrijving));

    if (o.watErAlIs.length > 0) {
      blokken.push(metLabel("Wat er al is", "De verst gevorderde stap per thema."));
      blokken.push(lijst(o.watErAlIs.map((w) => `${w.naam} (niveau ${w.niveau}): ${w.tekst}`)));
    } else {
      blokken.push(metLabel("Wat er al is", "Op dit onderdeel is nog geen thema voorbij de start."));
    }

    blokken.push(
      metLabel(
        "Wat het niveau bepaalt",
        a.gat === 0
          ? `Het doel is gehaald. Het niveau van een onderdeel is dat van het zwakste thema; hier ${zijn(o.bepalend.length)} dat ${opsomming(o.bepalend)}.`
          : `Het niveau van een onderdeel is dat van het zwakste thema. Hier ${zijn(o.bepalend.length)} dat ${opsomming(o.bepalend)}. Een sterk thema maakt een zwak thema niet goed.`
      )
    );
    blokken.push(
      tabel(
        ["Thema", "Niveau", "Eerstvolgende stap", "Stand"],
        o.themas.map((t) => [t.naam, t.gemeten ? String(t.niveau) : "niet gemeten", t.stap ? `Niveau ${t.stap.niveau}: ${t.stap.tekst}` : "Geen: alle niveaus zijn gehaald.", t.stand])
      )
    );

    if (o.tegenspraken.length > 0) {
      const vb = o.tegenspraken[0];
      blokken.push(
        metLabel(
          "Waar rollen het anders zien",
          `Over ${meervoud(o.tegenspraken.length, "stelling", "stellingen")} zegt de ene rol ja en de andere nee. Bijvoorbeeld bij ${vb.thema}: "${vb.tekst}" ${opsomming(vb.rollenJa.map(rolNaam))} zegt ja, ${opsomming(vb.rollenNee.map(rolNaam))} zegt nee.`
        )
      );
    }

    const redenen = [];
    for (const v of o.voorwaarden.filter((x) => x.scenario === "realistisch")) {
      redenen.push(`${v.naam} is een voorwaarde om de vrijkomende tijd te benutten (nodig: niveau ${v.vereist}, nu: ${v.huidig === null ? "niet gemeten" : `niveau ${v.huidig}`}).`);
    }
    for (const n of o.nodigVoor) redenen.push(`${n.naam} moet eerst op orde zijn voor ${n.voorNaam}: ${klein(n.reden.charAt(0))}${n.reden.slice(1)}`);
    if (redenen.length > 0) blokken.push(metLabel("Waarom dit telt", [...new Set(redenen)].slice(0, 3).join(" ")));
  }
  const ongemeten = profiel.assen.filter((a) => !a.gemeten);
  if (ongemeten.length > 0) {
    blokken.push(alinea(`Niet gemeten: ${ongemeten.map((a) => a.naam).join(", ")}.`, "noot"));
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
  for (const b of borging) {
    voeg(`thema:${b.thema}`, `${b.naam}: de organisatie kan het, maar heeft het niet geborgd. Verdieping toetst hoe kwetsbaar dat is.`);
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

  // ---- 6. Bijlagen --------------------------------------------------------------------------
  if (analyse.volgorde.length > 0) {
    blokken.push(kop("Bijlage: alle thema's in volgorde van aanpak", 1, true));
    blokken.push(alinea("Grootste afstand tot het doel eerst. Waar een thema eerst op orde moet zijn voordat een ander thema zin heeft, staat het vooraan en is de reden vermeld."));
    blokken.push(
      genummerd(
        analyse.volgorde.map((i) => {
          const as = profiel.assen.find((a) => a.id === i.asId)?.naam;
          const afh = i.redenen.filter((x) => x.soort === "afhankelijkheid").map((x) => ` Eerst nodig voor ${x.voorNaam}: ${x.reden}`);
          return `${i.naam} (${as}): niveau ${i.niveau}, doel ${i.doel}.${afh.join("")}`;
        })
      )
    );
  }

  blokken.push(kop("Bijlage: hoe de scan werkt", 1, analyse.volgorde.length === 0));
  blokken.push(tabel(["Niveau", "Naam", "Betekenis"], [["0", "Nog niet begonnen", "De stelling van het eerste niveau is nog niet voldaan."], ...NIVEAUS.map((n) => [String(n.niveau), n.naam, n.beschrijving])]));
  blokken.push(
    lijst([
      "De scan kent acht onderdelen: vier over de organisatie en vier over de systemen. Elk onderdeel bestaat uit thema's, en elk thema heeft een ladder van vijf stellingen.",
      "Een niveau geldt pas als de stelling van dat niveau én van alle lagere niveaus voldaan is. \"Ja\" en \"niet van toepassing\" tellen als voldaan, \"deels\" niet.",
      "Het niveau van een onderdeel is het niveau van het zwakste thema. Een sterk thema compenseert een zwak thema niet.",
      "Vullen meerdere mensen de lijst in, dan telt per stelling het strengste antwoord.",
      "Het doelniveau per onderdeel is de ambitie van deze organisatie of dit onderdeel; een lager doel dan het hoogste niveau is een legitieme keuze.",
    ])
  );

  // ---- Beperkingen --------------------------------------------------------------------------
  blokken.push(kop("Wat dit rapport wel en niet zegt"));
  blokken.push(
    lijst([
      "Het is een zelfbeoordeling. Ook met bewijsvragen is de score een oordeel van mensen over hun eigen organisatie, en mensen overschatten zichzelf het meest op gebieden waar ze het minst van weten. Daarom kent de scan meerdere invullers en signalen, en voegt een verdiepend onderzoek gesprekken en bewijs toe.",
      "Er is geen vergelijking met andere organisaties. Dat kan pas met eigen metingen van veel organisaties, en dan alleen per sector en omvang.",
      "De afhankelijkheden, signalen, de indeling in stappen en de voorwaarden voor de vrijkomende tijd zijn uitgangspunten uit adviespraktijk, geen meetresultaten. Ze worden met ervaring bijgesteld.",
      "De koppeling met de capaciteitsanalyse is een eerste uitwerking en geeft voorwaarden, geen exacte voorspelling.",
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
    if (b.soort === "kop") t.push(b.tekst);
    else if (b.soort === "alinea") t.push(...(b.label ? [b.label] : []), b.tekst);
    else if (b.soort === "lijst" || b.soort === "genummerd") t.push(...b.items);
    else if (b.soort === "tabel") t.push(...b.kolommen, ...b.rijen.flat());
    else if (b.soort === "kader") t.push(b.titel, ...b.items);
    else if (b.soort === "profiel") {
      t.push(...b.kolommen);
      for (const r of b.rijen) t.push(r.groep, r.naam, r.niveauTekst, r.doelTekst, r.gatTekst, ...(r.onderbouwing ? [r.onderbouwing] : []));
    }
  }
  return t;
}
