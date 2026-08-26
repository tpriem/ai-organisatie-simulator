#!/usr/bin/env node
// Bouwt de gebundelde ESCO-dataset in src/data/ die src/esco.js inleest.
//
// Twee bronnen:
//   --from-csv <map>   De officiële ESCO-download (esco.ec.europa.eu/en/use-esco/download,
//                      CSV, Nederlands). Compleet: inclusief de transversale
//                      skills-collectie, die nodig is om attitudes te herkennen en dus
//                      om "laag trainbaar" correct te bepalen. Dit is de productiebron.
//   --from-api         Oogst via de publieke ESCO-API. Geen registratie nodig, maar de
//                      transversale collectie is er niet via te benaderen; alle skills
//                      krijgen dan cat=null en er komt geen enkele "laag trainbaar"
//                      uit. Alleen bedoeld als ontwikkelfixture.
//
// Gebruik:
//   node scripts/buildEscoDataset.mjs --from-csv ./esco-download
//   node scripts/buildEscoDataset.mjs --from-api

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const UIT_MAP = path.join(process.cwd(), "src", "data");
const API = "https://ec.europa.eu/esco/api";
const TAAL = "nl";

// Zoektermen voor de API-fixture: breed genoeg voor kantoor-, financiële en
// dienstverlenende organisaties, het werkveld van deze tool.
const API_ZOEKTERMEN = [
  "klantenservice", "accountmanager", "verkoop", "marketing", "communicatie",
  "boekhouder", "financieel analist", "controller", "bankmedewerker", "verzekering",
  "human resources", "recruiter", "opleidingscoördinator", "salarisadministrateur",
  "administratief medewerker", "secretaresse", "officemanager", "receptionist",
  "softwareontwikkelaar", "data-analist", "systeembeheerder", "ICT-consultant",
  "projectmanager", "kwaliteitsmanager", "inkoper", "logistiek medewerker",
  "juridisch adviseur", "compliance officer", "risicoanalist", "auditor",
  "manager", "teamleider", "directeur", "bedrijfsanalist", "consultant",
];

function uitBundelUri(uri) {
  return uri?.split("/").pop() ?? null;
}

async function haal(url, pogingen = 3) {
  for (let i = 0; i < pogingen; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {
      // netwerkfout — opnieuw proberen
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return null;
}

/** Draait `taak` over alle items, met maximaal `gelijktijdig` tegelijk. */
async function inBatches(items, gelijktijdig, taak, label) {
  const uit = [];
  let klaar = 0;
  for (let i = 0; i < items.length; i += gelijktijdig) {
    const groep = items.slice(i, i + gelijktijdig);
    uit.push(...(await Promise.all(groep.map(taak))));
    klaar += groep.length;
    process.stdout.write(`\r  ${label}: ${klaar}/${items.length}`);
  }
  process.stdout.write("\n");
  return uit;
}

// ---------------------------------------------------------------- API-oogst

async function oogstViaApi() {
  console.log("Bron: publieke ESCO-API (ontwikkelfixture — zonder transversale collectie)\n");

  console.log("1. Beroepen zoeken");
  const beroepen = new Map();
  for (const term of API_ZOEKTERMEN) {
    const url = `${API}/search?text=${encodeURIComponent(term)}&language=${TAAL}&type=occupation&limit=12`;
    const data = await haal(url);
    for (const r of data?._embedded?.results ?? []) {
      const id = uitBundelUri(r.uri);
      if (id && !beroepen.has(id)) beroepen.set(id, { id, uri: r.uri, label: r.title, altLabels: [] });
    }
    process.stdout.write(`\r  gevonden: ${beroepen.size}`);
  }
  process.stdout.write("\n");

  console.log("2. Skills per beroep ophalen");
  const relaties = {};
  const skillUris = new Map();
  await inBatches([...beroepen.values()], 6, async (occ) => {
    const data = await haal(`${API}/resource/occupation?uri=${encodeURIComponent(occ.uri)}&language=${TAAL}`);
    if (!data) return;
    const verzamel = (lijst) =>
      (lijst ?? []).map((s) => {
        const id = uitBundelUri(s.uri);
        if (id && !skillUris.has(id)) {
          skillUris.set(id, { id, uri: s.uri, label: s.title, type: uitBundelUri(s.skillType) });
        }
        return id;
      }).filter(Boolean);
    relaties[occ.id] = {
      essential: verzamel(data._links?.hasEssentialSkill),
      optional: verzamel(data._links?.hasOptionalSkill),
    };
  }, "beroepen");

  console.log("3. Metadata per skill ophalen (reuseLevel)");
  await inBatches([...skillUris.values()], 6, async (s) => {
    const data = await haal(`${API}/resource/skill?uri=${encodeURIComponent(s.uri)}&language=${TAAL}`);
    if (!data) return;
    s.reuse = uitBundelUri(data._links?.hasReuseLevel?.[0]?.uri) ?? null;
    s.cat = null; // alleen uit de transversale collectie te halen — zie CSV-modus
  }, "skills");

  return {
    bron: "api",
    heeftTransversaleCollectie: false,
    beroepen: [...beroepen.values()],
    relaties,
    skills: [...skillUris.values()],
    transversaal: [],
  };
}

// ------------------------------------------------------------------ CSV-bron

async function leesCsv(map, patroon) {
  const bestanden = await readdir(map);
  const naam = bestanden.find((b) => patroon.test(b));
  if (!naam) return null;
  const inhoud = await readFile(path.join(map, naam), "utf8");
  // relax_column_count: skillsHierarchy laat lege staartkolommen weg, waardoor rijen
  // korter zijn dan de header.
  return {
    naam,
    rijen: parse(inhoud, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true }),
  };
}

// De transversale pijler van ESCO kent zes hoofdgroepen (T1-T6). Alleen T3, zelfbeheer,
// bestaat uit disposities: een positieve houding bewaren, een proactieve aanpak
// hanteren, de bereidheid tonen om te leren. Dat is de onderkant van de ijsberg
// (Spencer & Spencer) — te toetsen, niet in een cursus aan te leren. De overige
// transversale groepen zijn vaardigheden en dus wél te ontwikkelen, zij het via
// coaching en ervaring in plaats van een opleiding.
const TRANSVERSALE_CATEGORIEEN = {
  T1: "kern",
  T2: "denken",
  T3: "attitudes",
  T4: "sociaal",
  T5: "fysiek",
  T6: "levensvaardigheden",
};

async function leesUitCsv(map) {
  console.log(`Bron: officiële ESCO CSV-download (${map})\n`);
  if (!existsSync(map)) throw new Error(`Map bestaat niet: ${map}`);

  const occBestand = await leesCsv(map, /^occupations?_.*\.csv$/i);
  const skillBestand = await leesCsv(map, /^skills_.*\.csv$/i);
  const relBestand = await leesCsv(map, /^occupationSkillRelations.*\.csv$/i);
  const transBestand = await leesCsv(map, /transversal.*\.csv$/i);
  const hierBestand = await leesCsv(map, /^skillsHierarchy.*\.csv$/i);

  for (const [naam, b] of [["occupations", occBestand], ["skills", skillBestand], ["relations", relBestand]]) {
    if (!b) throw new Error(`Verwacht bestand niet gevonden in ${map}: ${naam}`);
    console.log(`  ${b.naam}: ${b.rijen.length} rijen`);
  }
  if (transBestand) console.log(`  ${transBestand.naam}: ${transBestand.rijen.length} rijen`);
  else console.warn("  LET OP: geen transversale collectie gevonden — attitudes worden niet herkend.");

  const kolom = (rij, ...namen) => {
    for (const n of namen) if (rij[n] !== undefined) return rij[n];
    return undefined;
  };

  const beroepen = occBestand.rijen.map((r) => ({
    id: uitBundelUri(kolom(r, "conceptUri", "uri")),
    label: kolom(r, "preferredLabel", "label"),
    altLabels: (kolom(r, "altLabels") ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6),
  })).filter((o) => o.id && o.label);

  // De transversale collectie verwijst naar een groep op niveau 2; via de hiërarchie
  // leiden we daaruit de hoofdcategorie (T1-T6) af.
  const groepNaarCategorie = new Map();
  for (const r of hierBestand?.rijen ?? []) {
    const niveau1 = r["Level 1 code"];
    const cat = TRANSVERSALE_CATEGORIEEN[niveau1];
    if (!cat) continue;
    for (const kol of ["Level 1 URI", "Level 2 URI", "Level 3 URI"]) {
      if (r[kol]) groepNaarCategorie.set(r[kol], cat);
    }
  }

  const transversaalIds = new Set();
  const transversaalCat = new Map();
  let zonderCategorie = 0;
  for (const r of transBestand?.rijen ?? []) {
    const id = uitBundelUri(kolom(r, "conceptUri", "uri", "skillUri"));
    if (!id) continue;
    transversaalIds.add(id);
    const cat = groepNaarCategorie.get(kolom(r, "broaderConceptUri"));
    if (cat) transversaalCat.set(id, cat);
    else zonderCategorie++;
  }
  if (zonderCategorie > 0) {
    console.warn(`  LET OP: ${zonderCategorie} transversale competenties zonder hoofdcategorie.`);
  }

  const skills = skillBestand.rijen.map((r) => {
    const id = uitBundelUri(kolom(r, "conceptUri", "uri"));
    return {
      id,
      label: kolom(r, "preferredLabel", "label"),
      type: (kolom(r, "skillType") ?? "").split("/").pop() || null,
      reuse: (kolom(r, "reuseLevel") ?? "").split("/").pop() || null,
      cat: transversaalCat.get(id) ?? null,
    };
  }).filter((s) => s.id && s.label);

  const relaties = {};
  for (const r of relBestand.rijen) {
    const occId = uitBundelUri(kolom(r, "occupationUri"));
    const skillId = uitBundelUri(kolom(r, "skillUri"));
    if (!occId || !skillId) continue;
    relaties[occId] ??= { essential: [], optional: [] };
    const soort = (kolom(r, "relationType") ?? "").toLowerCase();
    (soort.includes("optional") ? relaties[occId].optional : relaties[occId].essential).push(skillId);
  }

  return {
    bron: "csv",
    heeftTransversaleCollectie: Boolean(transBestand),
    beroepen,
    relaties,
    skills,
    transversaal: [...transversaalIds],
  };
}

// -------------------------------------------------------------------- schrijf

async function schrijf(data) {
  await mkdir(UIT_MAP, { recursive: true });

  const skillsItems = {};
  for (const s of data.skills) {
    if (!s.label) continue;
    skillsItems[s.id] = { label: s.label, type: s.type ?? null, reuse: s.reuse ?? null, cat: s.cat ?? null };
  }

  const meta = { bron: data.bron, heeftTransversaleCollectie: data.heeftTransversaleCollectie };

  const bestanden = [
    ["esco-occupations.json", { ...meta, items: data.beroepen }],
    ["esco-skills.json", { ...meta, transversaal: data.transversaal, items: skillsItems }],
    ["esco-occupation-skills.json", { ...meta, items: data.relaties }],
  ];

  console.log("\nWegschrijven:");
  for (const [naam, inhoud] of bestanden) {
    const pad = path.join(UIT_MAP, naam);
    const json = JSON.stringify(inhoud);
    await writeFile(pad, json, "utf8");
    console.log(`  ${naam.padEnd(30)} ${(json.length / 1024 / 1024).toFixed(2)} MB`);
  }

  const laagTrainbaar = Object.values(skillsItems).filter((s) => s.cat === "attitudes").length;
  console.log(`\nBeroepen: ${data.beroepen.length}`);
  console.log(`Skills: ${Object.keys(skillsItems).length}`);
  console.log(`Beroepen met skill-relaties: ${Object.keys(data.relaties).length}`);
  console.log(`Transversaal gemarkeerd: ${data.transversaal.length}`);
  console.log(`Waarvan attitudes (laag trainbaar): ${laagTrainbaar}`);
  if (laagTrainbaar === 0) {
    console.warn("\nWAARSCHUWING: geen enkele attitude-competentie herkend. De tier");
    console.warn("'laag trainbaar' komt dan nooit voor. Draai met --from-csv voor volledige data.");
  }
}

const arg = process.argv[2];
const bron =
  arg === "--from-csv" ? await leesUitCsv(process.argv[3] ?? "./esco-download")
  : arg === "--from-api" ? await oogstViaApi()
  : null;

if (!bron) {
  console.error("Gebruik: node scripts/buildEscoDataset.mjs --from-csv <map> | --from-api");
  process.exit(1);
}

await schrijf(bron);
