# AI-volwassenheidsraamwerk House of Digital — ontwerp

Versie 1.0, 22 oktober 2026. Ontwerp van de inhoud en de analyses; de technische opzet (tabblad,
opslag, metingen in de tijd) bestaat al. Het inhoudsbestand staat in
`src/data/volwassenheidsraamwerk.json`, de volledigheidstoets in `src/volwassenheidsraamwerk.test.js`.

## 1. Waarvoor het dient

De rolanalyse van de simulator zegt hoeveel capaciteit er per functie vrijkomt en wat dat van mensen
vraagt. Dit raamwerk beantwoordt de vraag die daarna komt: **kan de organisatie dat ook realiseren,
en wat houdt haar tegen?** De uitkomst is een profiel over acht assen, met per as een niveau, een
doel, de kloof, en de concrete reden waarom het niveau niet hoger is.

De lat: een directie moet er besluiten uit kunnen halen. Daarom is het raamwerk vanuit de analyses
ontworpen (paragraaf 3) en pas daarna vanuit de vragen (paragraaf 4). Elke stelling voedt ten minste
één analyse; wat geen analyse voedt is weggelaten.

## 2. Bouwstenen

**Acht assen**, vier aan de organisatiekant en vier aan de systeemkant:

| Kant | As | Meet |
|---|---|---|
| Organisatie | Strategie en sturing | Of AI een bewuste koers is met doelen, portfolio en besluiten |
| Organisatie | Mensen en cultuur | Of mensen met AI kunnen en durven werken, en kritisch blijven |
| Organisatie | Werkprocessen | Of het werk opnieuw wordt ingericht rond AI, met de mens in de regie |
| Organisatie | Risico en governance | Wie beslist, wat mag, en wat er gebeurt als het misgaat |
| Systeem | Data | Of de data beschikbaar, bruikbaar en betrouwbaar is |
| Systeem | Bouwen en integreren | Of AI met discipline wordt gebouwd, gekoppeld en getoetst |
| Systeem | Beheer in productie | Of draaiende AI wordt bewaakt, onderhouden en beveiligd |
| Systeem | Technologie en leveranciers | Of infrastructuur en leveranciers opschalen toelaten zonder afhankelijkheid |

**Twintig thema's**, twee of drie per as. Elk thema heeft een **ladder van vijf stellingen**, één per
niveau. Per stelling: het niveau, de kant (vaardigheid of borging), een bewijsvraag met voorbeelden,
en de analyses die ze voedt.

**Vijf niveaus**, met eigen namen:

| Niveau | Naam | Betekenis |
|---|---|---|
| 1 | Verkennen | Er is bewust mee begonnen; losse initiatieven, nog niet herhaalbaar |
| 2 | Werkend | Het bestaat en wordt in ten minste één onderdeel gebruikt met zichtbaar resultaat |
| 3 | Gestuurd | Er is een eigenaar, er zijn afspraken, het wordt gemeten en bijgestuurd |
| 4 | Organisatiebreed | Overal dezelfde werkwijze, herhaalbaar en vergelijkbaar tussen onderdelen |
| 5 | Zelfvernieuwend | De organisatie kijkt vooruit en vernieuwt op eigen initiatief, voordat de druk ontstaat |

Niveau 0 betekent: de stelling van niveau 1 is nog niet voldaan.

**Twee kanten.** Een stelling van de kant *vaardigheid* zegt of de organisatie iets kán; een stelling
van de kant *borging* zegt of het geborgd is (eigenaar, afspraken, middelen, herhaalbaar). Borging zit
vooral op de niveaus 3 en 4. Het verschil tussen beide kanten is zelf een analyse (D).

**Antwoordvorm per stelling**: *nee*, *deels*, *ja* of *niet van toepassing*. Daarnaast een
bewijsveld: een korte tekst (welk document, welke meting, wie gesproken) en een vinkje *bewijs gezien*
dat alleen de adviseur zet. Waarom deze vorm: een vierpuntsschaal is grof genoeg om snel in te vullen
en fijn genoeg om "we zijn ermee bezig" (deels) te onderscheiden van "het is er" (ja). "Niet van
toepassing" is nodig voor kleinere onderdelen (een unit zonder eigen leveranciers) en telt als voldaan,
maar wordt apart geteld (zie E8).

**Scope**: één meting gaat over één organisatieonderdeel. Per as een **doelniveau** (standaard 3,
Gestuurd); een lager doel is legitiem en wordt vastgelegd met reden.

## 3. De analyses

Voor elke analyse: wat de directie ziet, welke gegevens nodig zijn, hoe het wordt berekend, en wanneer
de tool het niet toont.

### A. Profiel en kloof per as

*Ziet:* acht balken met niveau 0-5, de doelstreep, en per as de kloof.
*Berekening:* thema-niveau = het hoogste niveau n waarvoor alle stellingen met niveau ≤ n voldaan zijn
(ja of n.v.t.). As-niveau = het laagste thema-niveau van die as (B). Kloof = doel − niveau, minimaal 0.
*Niet tonen:* een as waarin geen enkele stelling is beantwoord heet "niet gemeten". Een as met
onbeantwoorde stellingen krijgt het label "onvolledig": onbeantwoord telt als niet voldaan, dus het
niveau is een ondergrens.

### B. Zwakste schakel

*Ziet:* per as welk thema het niveau bepaalt, en welke stelling daar als eerste niet voldaan is ("de
volgende stap").
*Berekening:* het thema met het laagste niveau; bij gelijke niveaus alle thema's op dat niveau. De
volgende stap is de eerste niet-voldane stelling in dat thema, letterlijk uit het raamwerk.
*Waarom geen gemiddelde:* een gemiddelde verbergt precies wat een directie moet weten. Een organisatie
met sterke engineering en zwakke governance is niet "gemiddeld niveau 2,5"; ze loopt risico.
Er is geen totaalscore over de assen.

### C. Volgorde van aanpak

*Ziet:* een genummerde lijst: welke thema's eerst, met de reden.
*Gegevens:* de kloof per thema (doel van de as − thema-niveau) en de afhankelijkheden uit het raamwerk.
*Berekening:* sorteer thema's met kloof > 0 op kloof (grootste eerst), daarna op niveau (laagste
eerst). Loop daarna de afhankelijkheden na: als thema X boven niveau n wil komen maar thema Y onder
niveau m zit, schuift Y vóór X met de melding "eerst Y: [reden]". Afhankelijkheden hebben een
drempel, zodat ze niet alles blokkeren: ze gelden pas vanaf het niveau waarop de afhankelijkheid
inhoudelijk gaat tellen.
*De afhankelijkheden* (vastgelegd in het raamwerk; uitgangspunten, aan te scherpen op ervaring):

| Thema (vanaf niveau) | Vereist (minimaal) | Reden |
|---|---|---|
| Werkprocessen: herontwerp (3) | Werkprocessen: kiezen en beproeven (2) | Herontwerpen zonder beproefde toepassing is ontwerpen op papier |
| Werkprocessen: herontwerp (3) | Mensen: vaardigheden (2) | Een herontworpen proces draait niet zonder mensen die ermee kunnen werken |
| Bouwen: ontwerpen en bouwen (3) | Data: kwaliteit en herkomst (2) | Bouwen op data waarvan de kwaliteit onbekend is levert onbetrouwbare toepassingen |
| Beheer: bewaken (3) | Bouwen: toetsen (2) | Je kunt niet bewaken wat nooit tegen een norm is getoetst |
| Technologie: infrastructuur en opschalen (4) | Risico: eigenaarschap (3) | Organisatiebreed uitrollen zonder vast besluitproces vermenigvuldigt risico's |
| Technologie: infrastructuur en opschalen (4) | Beheer: bewaken (3) | Opschalen zonder gedeelde bewaking betekent opschalen van blinde vlekken |
| Strategie: portfolio en rendement (3) | Werkprocessen: effect meten (2) | Sturen op rendement vereist dat er ten minste één keer is gemeten |
| Mensen: omgang met AI (3) | Risico: beleid en naleving (2) | Kritisch gebruik vereist dat duidelijk is wat mag en wat niet |
| Risico: verantwoorde AI (3) | Risico: eigenaarschap (2) | Incidenten opvolgen vereist een aanspreekbare eigenaar per toepassing |
| Bouwen: toetsen (4) | Technologie: leveranciers (3) | Dezelfde toetsnorm voor leverancierstoepassingen vereist contractuele grip op leveranciers |

### D. Vaardigheid versus borging

*Ziet:* per thema twee niveaus: "kan het" en "geborgd". Waar het eerste hoger is dan het tweede staat:
"werkt, maar niet geborgd".
*Berekening:* los niveau = de ladder alleen over de vaardigheidsstellingen; strikt niveau = de ladder
over alle stellingen (dat is het niveau uit A). Verschil ≥ 1 is het signaal; verschil ≥ 2 is een
waarschuwing ("hangt aan personen of toeval").
*Niet tonen:* als de borgingsstellingen van het thema onbeantwoord zijn.

### E. Interne tegenstrijdigheden

*Ziet:* een lijst signalen met uitleg, bedoeld voor het gesprek, niet als oordeel.
*Berekening:* regels over de berekende niveaus en de antwoorden. Een signaal verschijnt alleen als
beide betrokken onderdelen gemeten zijn.

| Nr | Regel | Uitleg |
|---|---|---|
| E1 | Bouwen ≥ 3 en Data ≤ 1 | Gedisciplineerd bouwen op data die niemand kent is onwaarschijnlijk; waarschijnlijk is bouwen te positief beoordeeld |
| E2 | Technologie ≥ 3 en Risico ≤ 1 | Opschalen zonder governance: ofwel de governance is onderschat, ofwel het opschalen is risicovol |
| E3 | Werkprocessen ≥ 4 en Mensen ≤ 1 | Organisatiebreed herontworpen werk zonder opgeleide mensen kan niet draaien |
| E4 | Beheer ≥ 3 en Bouwen ≤ 1 | Beheren met afspraken van iets dat zonder discipline is gebouwd |
| E5 | Strategie: portfolio ≥ 3 en Werkprocessen: effect ≤ 1 | Sturen op rendement terwijl er niets is gemeten |
| E6 | Enige as op 5 terwijl een andere as op ≤ 1 staat | Zo'n spreiding komt in de praktijk zelden voor; controleer de hoogste as |
| E7 | In een as meer dan 70% "ja" en minder dan 20% daarvan met bewijs gezien | Patroon van zelfoverschatting; de as is indicatief |
| E8 | In een as meer dan 25% "niet van toepassing" | De scope past niet bij deze as, of n.v.t. wordt gebruikt om vragen te ontwijken |
| E9 | Niveau 1 van een thema "nee" terwijl een hoger niveau "ja" is | De invuller heeft de ladder niet als ladder gelezen; antwoorden nalopen |

### F. Verschil tussen invullers

*Ziet:* per thema de spreiding tussen invullers (laagste en hoogste niveau, en welke rollen), en de
stellingen waarover ze het oneens zijn. Nooit per persoon, altijd per rol.
*Ontwerp:* een meting kent **invullers**, elk met een rol uit een vaste lijst (directie, management,
IT/data, HR, werkvloer, adviseur) en eigen antwoorden. De adviseur legt daarnaast de **geldende
antwoorden** vast: zijn oordeel na het zien van de verschillen en het bewijs. Alle andere analyses
rekenen met de geldende antwoorden. Zolang de adviseur niets heeft vastgelegd, geldt per stelling het
strengste antwoord van de invullers.
*Berekening:* per stelling is er tegenspraak als één rol "ja" zegt en een andere "nee". Per thema:
het aantal tegenspraken en het verschil tussen het hoogste en laagste thema-niveau over de rollen.
Verschil ≥ 2 niveaus is een signaal; de directie die zichzelf hoger scoort dan de werkvloer is het
klassieke patroon.
*Privacy:* antwoorden zijn gekoppeld aan een rol en een vrijwillig label (bijvoorbeeld "teamleider
klantenservice"), niet aan een naam. Bij één invuller per rol is de rol herleidbaar; dat wordt bij het
uitnodigen gemeld.

### G. Onderbouwing

*Ziet:* per as het aandeel voldane stellingen waarvan het bewijs is gezien, en het label "indicatief"
als het niveau op niet-geziene antwoorden rust.
*Berekening:* een stelling is onderbouwd als de adviseur *bewijs gezien* heeft gezet. Een thema-niveau
is onderbouwd als alle voldane stellingen tot en met dat niveau onderbouwd zijn; een as is onderbouwd
als al haar thema's dat zijn. Het rapport noemt een niet onderbouwd niveau "indicatief" en zegt hoeveel
stellingen op een verklaring rusten.
*Regel:* alleen de adviseur zet *bewijs gezien*; een invuller kan wel bewijs noemen.

### H. Voortgang in de tijd

*Ziet:* sinds de vorige vastgelegde meting: per as gestegen, gelijk, gedaald; per thema de verschuiving.
*Berekening:* zoals nu: vergelijk per as en thema; alleen tussen metingen van dezelfde raamwerkversie.
*Niet tonen:* als de scope van beide metingen verschilt.

### I. Koppeling met de rolanalyse

Dit is nieuw terrein. De koppeling wordt daarom als **voorwaarden** geformuleerd, niet als
berekening van een getal, en elke voorwaarde is een uitgangspunt dat in de praktijk moet worden
getoetst.

*Ziet:* "Van de X FTE die in het realistische scenario vrijkomt, berust de realisatie op de volgende
voorwaarden; daarvan zijn er N voldaan." Per onvoldane voorwaarde de as en het thema.
*Voorwaarden* (vastgelegd in het raamwerk):

| Scenario | Voorwaarde | Waarom |
|---|---|---|
| Realistisch | Werkprocessen: herontwerp ≥ 2 | Vrijgekomen tijd ontstaat pas als het werk anders wordt ingericht; een tool erbij levert geen capaciteit op |
| Realistisch | Mensen: vaardigheden ≥ 2 | Mensen moeten met de nieuwe werkwijze kunnen werken |
| Realistisch | Risico: beleid ≥ 2 | Zonder duidelijke regels blijft gebruik onzeker en wordt het teruggedraaid bij het eerste incident |
| Realistisch | Data: beschikbaar ≥ 2 (alleen bij taken met veel gegevensverwerking) | Die taken zijn alleen te automatiseren als de data er is en gebruikt mag worden |
| Ambitieus | Alles van realistisch, plus Werkprocessen: effect meten ≥ 3 | Het ambitieuze scenario veronderstelt sturing op gemeten effect |
| Ambitieus | Bouwen: bouwen ≥ 3 en Beheer: bewaken ≥ 3 | Hogere automatiseringsgraden vereisen eigen toepassingen die betrouwbaar draaien |
| Ambitieus | Strategie: veranderaanpak ≥ 3 | De bestemming van vrijgekomen capaciteit moet geregeld zijn, anders verdampt ze |

*Verder:* de ontwikkelagenda uit de rolanalyse (welke competenties ontwikkeld moeten worden) wordt
naast Mensen: vaardigheden gezet: een lange ontwikkelagenda bij een laag niveau op vaardigheden is
een concreet, benoembaar knelpunt. En waar het waardetype van grote rollen "kwaliteitsverbetering"
is, geldt een extra voorwaarde: Werkprocessen: effect meten ≥ 2, want kwaliteit die niet wordt
gemeten is niet aantoonbaar.
*Niet tonen:* zolang er geen rolanalyse is, of de betrokken thema's niet gemeten zijn.

## 4. De stellingen

Twintig thema's, honderd stellingen; zie het inhoudsbestand. Principes bij het schrijven:

- Elke stelling is toetsbaar: er is iets aan te wijzen (document, meting, register, gesprek) dat
  haar bevestigt of ontkracht. De bewijsvraag zegt wat.
- Niveau 1 vraagt naar bewustzijn en een begin; 2 naar iets dat werkt; 3 naar eigenaar, afspraken en
  meten; 4 naar dezelfde werkwijze in de hele organisatie; 5 naar vooruitkijken en zelf vernieuwen.
- Geen jargon dat uitleg nodig heeft. Waar een vakterm onvermijdelijk is (agents, AI-verordening)
  staat erbij wat bedoeld wordt.
- De stellingen zijn geschreven vanuit onze eigen praktijk en de rolanalyse van de simulator. Waar
  ze aansluiten op wat de tool al meet (impact per functie, bestemming van vrijgekomen capaciteit,
  ontwikkelagenda) is dat benoemd in de bewijsvoorbeelden.

## 5. Scoreregels samengevat

1. Voldaan = *ja* of *niet van toepassing*. *Deels* en *nee* zijn niet voldaan. Onbeantwoord is niet
   voldaan en maakt het thema "onvolledig".
2. Thema-niveau = hoogste n waarvoor alle stellingen ≤ n voldaan zijn.
3. As-niveau = laagste thema-niveau. Geen gemiddelden, geen totaalscore.
4. Los niveau (vaardigheid) zoals D; verschil met het strikte niveau is het borgingssignaal.
5. Onderbouwd zoals G; anders "indicatief".
6. Doel per as, standaard 3; kloof = doel − niveau.
7. Volgorde van aanpak zoals C, met afhankelijkheden.
8. Signalen zoals E; alleen bij gemeten onderdelen.
9. Meerdere invullers zoals F; de geldende antwoorden van de adviseur tellen.

## 6. Beperkingen, eerlijk

- **Het blijft een beoordeling.** Ook met bewijsvragen is de score een oordeel van mensen over hun
  eigen organisatie. Mensen overschatten zichzelf het meest op gebieden waar ze het minst van weten
  (bijvoorbeeld een directie over datakwaliteit). Daarom: meerdere invullers, bewijs gezien door de
  adviseur, en de signalen uit E.
- **Geen benchmark.** De tool zegt niet hoe de organisatie zich verhoudt tot anderen. Dat kan pas
  als er eigen metingen van tientallen organisaties zijn, en dan nog alleen per sector en omvang.
- **De afhankelijkheden, tegenstrijdigheidsregels en realisatievoorwaarden zijn uitgangspunten.**
  Ze komen uit adviespraktijk en redenering, niet uit meting. Ze horen na de eerste tien metingen
  tegen de werkelijkheid te worden gehouden en bijgesteld.
- **De koppeling met de rolanalyse (I) is een hypothese.** Hij is bewust als voorwaarden geformuleerd
  en niet als getal, zodat niemand een "gecorrigeerde FTE" gaat uitrekenen op aannames.
- **Honderd stellingen is veel.** Een volledige meting kost een invuller ruim een uur; met interviews
  en bewijs een dagdeel voor de adviseur. Dat is bewust: een kwartierscan geeft geen besluiten. De
  ladder helpt: wie niveau 1 met "nee" beantwoordt, hoeft de hogere niveaus van dat thema niet in te
  vullen.
- **Onafhankelijke toets aanbevolen.** Het raamwerk is ontworpen vanuit de acht algemeen gebruikte
  assen en onze eigen praktijk. Laat iemand die bestaande volwassenheidsmodellen niet kent de
  stellingen lezen op begrijpelijkheid, en laat iemand met kennis van auteursrecht bevestigen dat het
  eigen werk is voordat het in klantrapporten verschijnt.
