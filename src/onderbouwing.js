import { TASK_CATEGORIES, getCategory } from "./config.js";
import raamwerk from "./data/volwassenheidsraamwerk.json" with { type: "json" };

/**
 * Het document "Werking en onderbouwing" voor directies en bestuurders.
 *
 * De tekst staat hier als gegevens, zodat de webpagina en de pdf dezelfde inhoud tonen. Alles wat uit
 * de tool zelf volgt (de percentages per soort werk, het aantal thema's en stellingen) wordt hier uitgerekend en niet overgetikt: verandert de tool, dan
 * verandert het document mee.
 *
 * Opmaak in de tekst: **vet** en [tekst](https://adres). Meer is er niet.
 */

export const ONDERBOUWING_TITEL = "Werking en onderbouwing";
export const ONDERBOUWING_ONDERTITEL = "AI Organisatie Transformatie Simulator";
export const ONDERBOUWING_VERSIE = "november 2026";
export const ONDERBOUWING_BESTANDSNAAM = "werking-en-onderbouwing-ai-transformatie-simulator.pdf";

const TELWOORDEN = ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien", "twintig"];
/** Een getal tot en met twintig als woord, daarboven als cijfer. */
export const telwoord = (n) => TELWOORDEN[n] ?? String(n);

const pct = (x) => `${Math.round(x * 100)}%`;

// De korte naam en de voorbeelden per soort werk, zoals een directie ze herkent. De percentages komen
// uit config.js. Een categorie zonder regel hier valt terug op haar naam uit de tool (de test bewaakt
// dat dat niet ongemerkt gebeurt).
const SOORT_WERK = {
  klantcontact: ["Eenvoudig klantcontact en eerstelijns support", "Vragen beantwoorden, meldingen aannemen, doorverwijzen"],
  accountmanagement: ["Accountmanagement en relatiebeheer", "Klanten bezoeken, relaties onderhouden, onderhandelen"],
  data_entry: ["Administratie en gegevensverwerking", "Gegevens invoeren, facturen boeken, dossiers bijhouden"],
  research: ["Informatie zoeken en onderzoek", "Markt, regelgeving, concurrenten"],
  schrijven: ["Schrijven en documentatie", "Brieven, offertes, verslagen"],
  analyseren: ["Analyseren en rapporteren", "Begroting, managementinformatie"],
  sourcing: ["Sourcing en leadgeneratie", "Kandidaten of klanten vinden en benaderen"],
  plannen: ["Plannen en coördineren", "Roosters, projecten, afstemming"],
  compliance: ["Compliance en juridisch werk", "Contracten, privacy, toezicht"],
  creatief: ["Creatief denkwerk", "Concepten, campagnes, ontwerp"],
  strategisch: ["Strategisch denkwerk", "Koers, beleid, besluiten"],
  technisch: ["Technisch werk en coderen", "Systemen beheren, software bouwen"],
};

/** De soorten werk met hun bandbreedte, van hoog naar laag, rechtstreeks uit de tool. */
export function soortenWerk() {
  return [...TASK_CATEGORIES]
    .sort((a, b) => b.realistisch - a.realistisch || b.agressief - a.agressief)
    .map((c) => ({
      id: c.id,
      naam: SOORT_WERK[c.id]?.[0] ?? c.label,
      voorbeelden: SOORT_WERK[c.id]?.[1] ?? "",
      beschreven: Boolean(SOORT_WERK[c.id]),
      percentage: `${pct(c.realistisch)} tot ${pct(c.agressief)}`,
    }));
}

/** De omvang van het volwassenheidsraamwerk: onderdelen, thema's en stellingen. */
export function raamwerkOmvang() {
  const themas = raamwerk.assen.flatMap((a) => a.themas ?? []);
  return {
    onderdelen: raamwerk.assen.length,
    themas: themas.length,
    stellingen: themas.reduce((n, t) => n + (t.stellingen?.length ?? 0), 0),
    niveaus: raamwerk.niveaus.length,
  };
}

// Het rekenvoorbeeld gebruikt het percentage voor schrijfwerk uit de tool, zodat het klopt met de tabel.
function rekenvoorbeeld() {
  const uren = 12 * 36;
  const taak = uren * 0.2;
  const p = getCategory("schrijven").realistisch;
  return { uren, taak: Math.round(taak), pct: pct(p), vrij: Math.round(taak * p) };
}

const BRON = {
  eloundou: "https://arxiv.org/abs/2303.10130",
  mckinsey: "https://www.mckinsey.com/mgi/our-research/agents-robots-and-us-skill-partnerships-in-the-age-of-ai",
  ilo: "https://www.ilo.org/publications/generative-ai-and-jobs-global-analysis-potential-effects-job-quantity-and",
  brynjolfsson: "https://www.nber.org/papers/w31161",
  noy: "https://economics.mit.edu/sites/default/files/inline-files/Noy_Zhang_1_0.pdf",
  dellacqua: "https://mitsloan.mit.edu/sites/default/files/2023-10/SSRN-id4573321.pdf",
  metr: "https://arxiv.org/abs/2507.09089",
  humlum: "https://www.nber.org/papers/w33777",
  acemoglu: "https://www.nber.org/papers/w32487",
  anthropic: "https://www.anthropic.com/news/the-anthropic-economic-index",
  ser: "https://www.ser.nl/nl/adviezen/ai-en-werk",
};

/**
 * Het hele document als hoofdstukken met blokken. Soorten blokken:
 *   { soort: "p", tekst }            alinea
 *   { soort: "kop", tekst }          tussenkop
 *   { soort: "lijst", punten }       opsomming
 *   { soort: "stappen", punten }     genummerde lijst
 *   { soort: "tabel", kop, rijen, smal? }
 *   { soort: "formule", delen }      de rekensom, als losse delen met een maalteken ertussen
 *   { soort: "kader", tekst }        uitgelichte zin
 */
export function onderbouwing() {
  const soorten = soortenWerk();
  const omvang = raamwerkOmvang();
  const vb = rekenvoorbeeld();
  const aantalSoorten = telwoord(soorten.length);

  return [
    {
      id: "in-het-kort",
      titel: "In het kort",
      blokken: [
        {
          soort: "kader",
          tekst:
            "De simulator laat per functie zien hoeveel tijd AI kan vrijmaken in uw organisatie, en of uw organisatie klaar is om die tijd ook te benutten. Het is een onderbouwde schatting om een besluit op te baseren, geen voorspelling.",
        },
        {
          soort: "lijst",
          punten: [
            "**Wat u aanlevert:** een overzicht van uw functies met aantal FTE, uren en loonkosten, en de functieprofielen. Namen van medewerkers zijn niet nodig.",
            "**Wat u ontvangt:** twee rapporten en een gesprek. Het eerste rapport gaat over de tijd die kan vrijkomen, het tweede over hoe ver uw organisatie is met AI.",
            "**Waar het over gaat:** tijd die vrijkomt, en de keuze wat u daarmee doet. Niet over het schrappen van functies.",
            "**Wat het niet is:** een meting van wat uw medewerkers in een week doen, of een garantie dat de tijd vanzelf vrijkomt.",
          ],
        },
      ],
    },
    {
      id: "twee-onderzoeken",
      titel: "Twee onderzoeken",
      blokken: [
        { soort: "p", tekst: "De simulator bestaat uit twee onderzoeken die los van elkaar te gebruiken zijn: de capaciteitsanalyse en de AI-volwassenheidsscan." },
        {
          soort: "tabel",
          kop: ["", "Capaciteitsanalyse", "AI-volwassenheidsscan"],
          rijen: [
            ["**De vraag**", "Hoeveel tijd kan er vrijkomen als AI taken overneemt, en waar blijft die tijd?", "Hoe ver is de organisatie met AI, en wat is de volgende stap?"],
            ["**Wat er nodig is**", "Functieoverzicht en functieprofielen", `Een vragenlijst van hooguit ${omvang.stellingen} stellingen`],
            ["**Wie het invult**", "De adviseur, met uw bestanden", "Directie, management, IT, HR en werkvloer"],
            ["**De uitkomst**", "Vrijkomende tijd per functie en afdeling, de bestemming van die tijd, en de gevolgen voor competenties", "Een niveau per onderdeel, de zwakste schakel en een volgorde van aanpak"],
            ["**Het rapport**", "Capaciteitsrapport", "Volwassenheidsrapport"],
          ],
        },
        {
          soort: "p",
          tekst:
            "Samen geven ze het hele beeld. De capaciteitsanalyse zegt wat er kan vrijkomen. De scan zegt of aan de voorwaarden is voldaan om dat ook te bereiken, zoals medewerkers die ermee kunnen werken, duidelijke regels en bruikbare gegevens.",
        },
      ],
    },
    {
      id: "hoe-het-werkt",
      titel: "Hoe het werkt, stap voor stap",
      blokken: [
        { soort: "p", tekst: "Het traject heeft vijf stappen; het rekenwerk duurt minuten, de meeste tijd zit in het aanleveren en in het gesprek over de uitkomsten." },
        {
          soort: "stappen",
          punten: [
            "**Aanleveren.** U uploadt via een beveiligde link een functieoverzicht en de functieprofielen. Het overzicht bevat per functie het aantal FTE, de uren per week, de loonkosten per uur, de afdeling en de leidinggevende functie.",
            "**Vragenlijst.** Voor de scan krijgen enkele mensen uit directie, management, IT, HR en werkvloer een persoonlijke link. De lijst past zich aan de antwoorden aan en kost 20 tot 45 minuten. Antwoorden worden per rol verwerkt, nooit per persoon getoond.",
            "**Analyse.** AI leest elk functieprofiel en splitst de functie in taken, elk met een aandeel van de tijd. Elke taak wordt ingedeeld bij een soort werk. De competenties per functie worden gekoppeld aan een Europese classificatie.",
            "**Controle door de adviseur.** De adviseur loopt de uitkomsten na en stuurt bij waar de praktijk afwijkt van het profiel. De functies die samen de helft van de vrijkomende tijd bepalen, worden uitdrukkelijk bevestigd. De bevindingen en aanbevelingen worden door AI voorgesteld en komen pas in het rapport nadat de adviseur ze heeft gelezen, aangepast en goedgekeurd.",
            "**Rapport en gesprek.** U ontvangt beide rapporten en we lopen de uitkomsten met u door.",
          ],
        },
      ],
    },
    {
      id: "hoe-de-tool-rekent",
      titel: "Hoe de tool rekent",
      blokken: [
        { soort: "p", tekst: "De tool rekent per taak en niet per functie: de uren van een taak, maal het percentage dat hoort bij het soort werk." },
        { soort: "formule", uitkomst: "vrijkomende uren", delen: ["FTE", "uren per week", "aandeel van de taak", "percentage van het soort werk"] },
        {
          soort: "p",
          tekst: `Een voorbeeld. Twaalf klantadviseurs werken samen ${vb.uren} uur per week. Offertes en brieven opstellen is 20% van hun tijd, dus ${vb.taak} uur. Dat is schrijfwerk, met een percentage van ${vb.pct}. Voor die taak komt dan ${vb.vrij} uur per week vrij. De tool doet dit voor elke taak van elke functie en telt het op per functie, per afdeling en voor de hele organisatie.`,
        },
        { soort: "p", tekst: `Er zijn ${aantalSoorten} soorten werk. Elk heeft een lager en een hoger percentage; de uitkomst is daarom altijd een bandbreedte.` },
        {
          soort: "tabel",
          kop: ["Soort werk", "Voorbeelden", "Percentage"],
          rijen: soorten.map((s) => [s.naam, s.voorbeelden, s.percentage]),
          smal: [2],
        },
        {
          soort: "p",
          tekst:
            "Werk dat om afweging, creativiteit en relaties draait heeft bewust lagere percentages dan routinematig kantoorwerk. Hoe het werk in uw organisatie is verdeeld, bepaalt het totaal sterker dan elk los percentage.",
        },
        { soort: "p", tekst: "Naast de uren laat het rapport drie dingen zien:" },
        {
          soort: "lijst",
          punten: [
            "**De bestemming van de tijd.** Per functie een voorstel: kosten verlagen, meer werk aankunnen met hetzelfde team, of de kwaliteit verhogen. De keuze is aan u.",
            "**De waarde van die tijd.** De vrijkomende uren maal de loonkosten per uur. Dat is alleen een besparing als de uren ook uit de kosten verdwijnen.",
            "**De gevolgen voor uw mensen.** Welke competenties belangrijker worden en hoe goed die te ontwikkelen zijn.",
          ],
        },
      ],
    },
    {
      id: "de-uitkomst-lezen",
      titel: "Hoe u de uitkomst leest",
      blokken: [
        {
          soort: "kader",
          tekst:
            "De uitkomst is technisch potentieel: wat er kan vrijkomen als het werk rond AI opnieuw is ingericht. Een organisatie die alleen een hulpmiddel invoert en het werk laat zoals het is, haalt daar een klein deel van.",
        },
        { soort: "p", tekst: "Onderzoek meet verschillende dingen, die ver uit elkaar liggen:" },
        {
          soort: "tabel",
          kop: ["Wat is gemeten", "Uitkomst", "Bron"],
          rijen: [
            [
              "**Wat technisch kan**",
              "Bij circa 80% van de werkenden kan AI minstens 10% van de taken versnellen. De bestaande techniek kan in theorie 57% van de werkuren overnemen.",
              `[Eloundou e.a.](${BRON.eloundou}), [McKinsey](${BRON.mckinsey})`,
            ],
            [
              "**Wat experimenten meten**",
              "Klantenservice: 14% meer vragen per uur. Schrijfwerk: 37% minder tijd. Advieswerk: 25% sneller.",
              `[Brynjolfsson e.a.](${BRON.brynjolfsson}), [Noy en Zhang](${BRON.noy}), [Dell'Acqua e.a.](${BRON.dellacqua})`,
            ],
            [
              "**Waar het misgaat**",
              "Bij taken buiten het bereik van AI: 19 procentpunten meer fouten. Ervaren softwareontwikkelaars werden 19% trager.",
              `[Dell'Acqua e.a.](${BRON.dellacqua}), [METR](${BRON.metr})`,
            ],
            ["**Wat er in de praktijk gebeurt**", "In Denemarken is twee jaar na de komst van ChatGPT geen effect op gewerkte uren te meten.", `[Humlum en Vestergaard](${BRON.humlum})`],
          ],
        },
        { soort: "p", tekst: "Voor uw besluit betekent dit:" },
        {
          soort: "stappen",
          punten: [
            "**Lees de uitkomst als eindbeeld.** Het zegt hoeveel er te winnen is, niet hoe snel.",
            "**Tijd komt pas vrij als het werk anders wordt ingericht.** Een hulpmiddel erbij maakt het werk prettiger en soms beter, maar levert op zichzelf weinig uren op.",
            "**De scan laat zien of de voorwaarden er zijn.** Daarom horen de twee onderzoeken bij elkaar.",
            "**Begin waar het potentieel hoog is en het onderzoek het stevigst:** schrijfwerk, klantcontact en administratie.",
          ],
        },
        { soort: "p", tekst: "McKinsey zegt er zelf bij dat de 57% geen voorspelling is en dat invoering lang kan duren." },
      ],
    },
    {
      id: "volwassenheidsscan",
      titel: "De AI-volwassenheidsscan",
      blokken: [
        {
          soort: "p",
          tekst: `De scan meet op ${telwoord(omvang.onderdelen)} onderdelen hoe ver de organisatie is met AI, op een schaal van ${telwoord(omvang.niveaus)} niveaus. Er is bewust geen totaalcijfer: een gemiddelde verbergt precies wat een directie moet weten.`,
        },
        { soort: "p", tekst: `De ${telwoord(omvang.onderdelen)} onderdelen:` },
        {
          soort: "lijst",
          punten: [
            "**Organisatie:** strategie en sturing, mensen en cultuur, werkprocessen, risico en governance.",
            "**Systemen:** data, bouwen en integreren, beheer in productie, technologie en leveranciers.",
          ],
        },
        {
          soort: "p",
          tekst: `Samen zijn dat ${omvang.themas} thema's en ${omvang.stellingen} stellingen.`,
        },
        {
          soort: "tabel",
          kop: ["Niveau", "Naam", "Betekenis"],
          rijen: [
            ["1", "**Verkennen**", "Er is bewust mee begonnen: losse initiatieven, nog niet herhaalbaar"],
            ["2", "**Werkend**", "Het bestaat en wordt in ten minste één onderdeel gebruikt, met zichtbaar resultaat"],
            ["3", "**Gestuurd**", "Er is een eigenaar, er zijn afspraken en het effect wordt gemeten"],
            ["4", "**Organisatiebreed**", "Dezelfde werkwijze geldt in de hele organisatie"],
            ["5", "**Zelfvernieuwend**", "De organisatie kijkt vooruit en vernieuwt zelf"],
          ],
          smal: [0, 1],
        },
        { soort: "p", tekst: "Zo werkt de beoordeling:" },
        {
          soort: "lijst",
          punten: [
            "**Een ladder per thema.** Elk thema heeft één stelling per niveau. Een niveau geldt pas als die stelling en alle lagere voldaan zijn.",
            '**Antwoorden:** ja, deels, nee of niet van toepassing. "Ja" en "niet van toepassing" tellen als voldaan, "deels" niet.',
            '**Het strengste antwoord telt.** Zeggen de directie "ja" en de werkvloer "nee", dan geldt "nee". Het verschil tussen rollen is zelf een uitkomst.',
            "**De lijst past zich aan.** Is iets er nog niet, dan vervallen de verdergaande stellingen over dat onderwerp.",
            "**Het zwakste thema bepaalt het niveau van een onderdeel.**",
          ],
        },
        {
          soort: "p",
          tekst:
            "Het rapport geeft per onderdeel het niveau en het doel, de zwakste schakel met de eerstvolgende stap, een volgorde van aanpak, en de voorwaarden om de tijd uit de capaciteitsanalyse te bereiken. In een verdiepingsfase kan de adviseur per stelling het bewijs beoordelen. Een herhaalmeting laat de voortgang zien.",
        },
      ],
    },
    {
      id: "bronnen",
      titel: "Waarop het is gebaseerd",
      blokken: [
        { soort: "p", tekst: "De simulator rust op twee soorten bronnen: een Europese classificatie van competenties en beroepen, en onderzoek naar wat AI met werk doet." },
        { soort: "kop", tekst: "Classificatie van competenties" },
        {
          soort: "p",
          tekst:
            "De competenties per functie komen uit ESCO, de classificatie van beroepen en vaardigheden van de Europese Commissie (versie 1.2.1). De indeling naar hoe goed een competentie te ontwikkelen is, is een eigen afleiding op basis van ESCO en maakt geen deel uit van ESCO zelf.",
        },
        { soort: "kop", tekst: "Onderzoek" },
        {
          soort: "tabel",
          kop: ["Onderzoek", "Wat het laat zien"],
          rijen: [
            [`[Eloundou e.a. (2023), GPTs are GPTs](${BRON.eloundou})`, "Welke taken een taalmodel kan versnellen, per beroep"],
            [`[McKinsey Global Institute (2025)](${BRON.mckinsey})`, "Welk deel van de werkuren de bestaande techniek in theorie kan overnemen"],
            [`[ILO, Gmyrek e.a. (2023)](${BRON.ilo})`, "Administratief werk is het meest blootgesteld; de verwachting is vooral ondersteuning, niet vervanging"],
            [`[Brynjolfsson, Li en Raymond (2025)](${BRON.brynjolfsson})`, "Het gemeten effect bij klantenservice"],
            [`[Noy en Zhang (2023)](${BRON.noy})`, "Het gemeten effect bij schrijfwerk"],
            [`[Dell'Acqua e.a. (2023)](${BRON.dellacqua})`, "Het gemeten effect bij advieswerk, en waar AI het werk slechter maakt"],
            [`[METR (2025)](${BRON.metr})`, "Ervaren softwareontwikkelaars werden trager met AI"],
            [`[Humlum en Vestergaard (2025)](${BRON.humlum})`, "Het effect op loon en uren in de praktijk"],
            [`[Acemoglu (2025)](${BRON.acemoglu})`, "Het verwachte effect op de hele economie"],
            [`[Anthropic Economic Index (2025)](${BRON.anthropic})`, "Hoe AI in de praktijk wordt gebruikt: ondersteunen tegenover overnemen"],
            [`[SER (2025), AI en werk](${BRON.ser})`, "De Nederlandse context: zet de mens en waardig werk centraal"],
          ],
        },
        {
          soort: "p",
          tekst:
            "De percentages per soort werk zijn een samengestelde schatting op basis van onder meer Eloundou e.a. en McKinsey. Ze zijn niet één op één uit een onderzoek overgenomen.",
        },
        {
          soort: "p",
          tekst:
            "Geen van deze onderzoeken gaat over uw organisatie of uw sector in het bijzonder. Ze zijn gebruikt als vergelijking voor soorten werk. Het cijfer van McKinsey is via een zoekresultaat bekeken, niet in het rapport zelf.",
        },
      ],
    },
    {
      id: "grenzen",
      titel: "Grenzen en zorgvuldigheid",
      blokken: [
        { soort: "p", tekst: "De uitkomst is zo goed als de functieprofielen en de percentages waarop ze rust; beide hebben grenzen die u moet kennen." },
        {
          soort: "lijst",
          punten: [
            "**Het is een schatting, geen meting.** Een functieprofiel beschrijft taken, niet hoeveel tijd eraan wordt besteed. Hoe beter de profielen, hoe scherper de uitkomst.",
            "**AI doet de ontleding, een adviseur controleert.** Dezelfde bestanden geven bij een nieuwe analyse dezelfde uitkomst. Elke aanpassing van de adviseur blijft zichtbaar.",
            "**Het is potentieel, geen verwachting.** Zie het hoofdstuk over het lezen van de uitkomst.",
            "**Cultuur, leiderschap en medezeggenschap vallen buiten de cijfers.** Betrek de ondernemingsraad vroeg.",
          ],
        },
        { soort: "p", tekst: "Zo gaan we met uw gegevens om:" },
        {
          soort: "lijst",
          punten: [
            "**Geen persoonsgegevens nodig.** Functies, aantallen, uren, loonkosten en functieprofielen volstaan.",
            "**Verwerking door AI.** De functieprofielen worden ontleed met een AI-model van Anthropic (Claude).",
            "**Antwoorden per rol.** In de scan ziet niemand wat een individuele invuller heeft geantwoord.",
            "**Toegang en herleidbaarheid.** Alleen ingelogde adviseurs zien uw gegevens. Links voor aanleveren en invullen verlopen vanzelf. Een logboek legt vast wie wat deed, en de laatste tien versies van een analyse zijn terug te zetten.",
          ],
        },
      ],
    },
  ];
}

/**
 * Splitst een stuk tekst in gewone tekst, vet en links.
 * Geeft een lijst van { soort: "tekst" | "vet" | "link", tekst, href? }.
 */
export function opmaak(tekst) {
  const uit = [];
  const patroon = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let vanaf = 0;
  for (const m of String(tekst).matchAll(patroon)) {
    if (m.index > vanaf) uit.push({ soort: "tekst", tekst: tekst.slice(vanaf, m.index) });
    if (m[1] !== undefined) uit.push({ soort: "vet", tekst: m[1] });
    else uit.push({ soort: "link", tekst: m[2], href: m[3] });
    vanaf = m.index + m[0].length;
  }
  if (vanaf < tekst.length) uit.push({ soort: "tekst", tekst: tekst.slice(vanaf) });
  return uit;
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Dezelfde opmaak als html, voor de pdf. */
export function opmaakHtml(tekst) {
  return opmaak(tekst)
    .map((d) => (d.soort === "vet" ? `<strong>${esc(d.tekst)}</strong>` : d.soort === "link" ? `<a href="${esc(d.href)}">${esc(d.tekst)}</a>` : esc(d.tekst)))
    .join("");
}

function blokHtml(b) {
  switch (b.soort) {
    case "p":
      return `<p>${opmaakHtml(b.tekst)}</p>`;
    case "kop":
      return `<h3>${esc(b.tekst)}</h3>`;
    case "kader":
      return `<p class="kader">${opmaakHtml(b.tekst)}</p>`;
    case "lijst":
      return `<ul>${b.punten.map((p) => `<li>${opmaakHtml(p)}</li>`).join("")}</ul>`;
    case "stappen":
      return `<ol>${b.punten.map((p) => `<li>${opmaakHtml(p)}</li>`).join("")}</ol>`;
    case "formule":
      return `<p class="formule"><span class="uitkomst">${esc(b.uitkomst)}</span> = ${b.delen.map((d) => `<span>${esc(d)}</span>`).join(" × ")}</p>`;
    case "tabel": {
      const smal = new Set(b.smal ?? []);
      const kop = b.kop.map((k, i) => `<th${smal.has(i) ? ' class="smal"' : ""}>${esc(k)}</th>`).join("");
      const rijen = b.rijen.map((r) => `<tr>${r.map((c, i) => `<td${smal.has(i) ? ' class="smal"' : ""}>${opmaakHtml(c)}</td>`).join("")}</tr>`).join("");
      return `<table><thead><tr>${kop}</tr></thead><tbody>${rijen}</tbody></table>`;
    }
    default:
      throw new Error(`Onbekend soort blok: ${b.soort}`);
  }
}

/**
 * Het hele document als één html-pagina voor de pdf, in de huisstijl. `kleur` zijn de kleuren van de
 * huisstijl (zie web/lib/merk.js), `cocreatie` de vermelding van de partner onderaan, `kop` extra
 * regels voor de head (het lettertype), `logo` het adres van het logo voor op het voorblad.
 */
export function onderbouwingHtml({ kleur, cocreatie, kop = "", logo = null }) {
  const hoofdstukken = onderbouwing();
  const inhoud = hoofdstukken.map((h, i) => `<li><span class="nr">${i + 1}</span>${esc(h.titel)}</li>`).join("");
  const body = hoofdstukken
    .map((h, i) => `<section><h2><span class="nr">${i + 1}</span>${esc(h.titel)}</h2>${h.blokken.map(blokHtml).join("")}</section>`)
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<title>${esc(ONDERBOUWING_TITEL)}</title>
${kop}
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: ${kleur.tekst}; font-size: 10.5px; line-height: 1.6; margin: 0; }
  .voorblad { background: ${kleur.mist}; border-radius: 24px; padding: 34px 34px 26px; margin-bottom: 22px; }
  .logo { display: block; height: 30px; width: auto; margin-bottom: 22px; }
  .label { display: inline-block; background: ${kleur.limoen}; color: ${kleur.navy}; border-radius: 30px; padding: 4px 14px; font-size: 9.5px; font-weight: 600; margin-bottom: 16px; }
  h1 { font-size: 34px; line-height: 1.1; color: ${kleur.navy}; margin: 0 0 8px; }
  .ondertitel { font-size: 14px; color: ${kleur.paars}; font-weight: 500; margin: 0 0 4px; }
  .versie { font-size: 9.5px; color: ${kleur.grijs}; margin: 0 0 22px; }
  .inhoud { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 28px; font-size: 10.5px; color: ${kleur.navy}; font-weight: 500; }
  .inhoud li { padding: 3px 0; break-inside: avoid; }
  .nr { display: inline-block; min-width: 20px; height: 20px; line-height: 20px; text-align: center; border-radius: 10px; background: ${kleur.paars}; color: #fff; font-size: 9.5px; font-weight: 600; margin-right: 8px; }
  main { padding: 0 2px; }
  section { margin-bottom: 20px; }
  h2 { font-size: 18px; color: ${kleur.navy}; margin: 22px 0 8px; break-after: avoid; }
  h2 .nr { vertical-align: 2px; }
  h3 { font-size: 12.5px; color: ${kleur.paars}; margin: 16px 0 6px; break-after: avoid; }
  p { margin: 0 0 9px; }
  a { color: ${kleur.paars}; text-decoration: underline; }
  strong { color: ${kleur.navy}; }
  ul, ol { margin: 0 0 10px; padding-left: 18px; }
  li { margin-bottom: 4px; }
  .kader { background: ${kleur.mist}; border-left: 4px solid ${kleur.limoen}; border-radius: 0 12px 12px 0; padding: 12px 16px; font-size: 11.5px; color: ${kleur.navy}; font-weight: 500; break-inside: avoid; }
  .formule { background: ${kleur.navy}; color: #fff; border-radius: 14px; padding: 12px 16px; font-weight: 500; break-inside: avoid; }
  .formule span { display: inline-block; background: rgba(255,255,255,0.14); border-radius: 20px; padding: 2px 10px; margin: 2px 0; }
  .formule .uitkomst { background: ${kleur.limoen}; color: ${kleur.navy}; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 4px 0 12px; font-size: 9.5px; line-height: 1.45; }
  th { background: ${kleur.navy}; color: #fff; text-align: left; padding: 7px 9px; font-weight: 600; }
  th:first-child { border-radius: 8px 0 0 0; } th:last-child { border-radius: 0 8px 0 0; }
  td { padding: 6px 9px; border-bottom: 1px solid ${kleur.lijn}; vertical-align: top; }
  tbody tr:nth-child(even) td { background: ${kleur.mist}; }
  tr { break-inside: avoid; }
  .smal { white-space: nowrap; }
  .slot { margin: 26px 0 0; padding: 14px 18px; background: ${kleur.navy}; color: #fff; border-radius: 14px; font-size: 10px; break-inside: avoid; }
</style>
</head>
<body>
  <div class="voorblad">
    ${logo ? `<img class="logo" src="${esc(logo)}" alt="" />` : ""}
    <span class="label">Voor directies en bestuurders</span>
    <h1>${esc(ONDERBOUWING_TITEL)}</h1>
    <p class="ondertitel">${esc(ONDERBOUWING_ONDERTITEL)}</p>
    <p class="versie">Versie ${esc(ONDERBOUWING_VERSIE)}</p>
    <ol class="inhoud">${inhoud}</ol>
  </div>
  <main>${body}</main>
  <p class="slot">${esc(cocreatie)}</p>
</body>
</html>`;
}
