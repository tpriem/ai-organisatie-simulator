import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { parseRoster } from "./parseRoster.js";
import { parseProfilesDir, matchRosterToProfiles } from "./parseProfiles.js";
import { analyzeProfile } from "./analyzeTasks.js";
import { calculateRole, calculateOrganisatie } from "./calculate.js";
import { buildTextReport, buildJsonReport } from "./report.js";

function parseArgs(argv) {
  const args = { roster: null, profiles: null, bedrijfsnaam: null, out: "output" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--roster") args.roster = argv[++i];
    else if (a === "--profiles") args.profiles = argv[++i];
    else if (a === "--bedrijfsnaam") args.bedrijfsnaam = argv[++i];
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.roster || !args.profiles) {
    console.error(
      "Gebruik: node src/index.js --roster <pad naar .csv/.xlsx> --profiles <map met functieprofielen> [--bedrijfsnaam \"Naam\"] [--out output]"
    );
    process.exit(1);
  }

  console.log("1. Roster inlezen...");
  const rosterRows = parseRoster(args.roster);
  console.log(`   ${rosterRows.length} rollen gevonden.`);

  console.log("2. Functieprofielen inlezen...");
  const profiles = await parseProfilesDir(args.profiles);
  console.log(`   ${Object.keys(profiles).length} profielen gevonden.`);

  const { matched, missing } = matchRosterToProfiles(rosterRows, profiles);
  if (missing.length > 0) {
    console.warn(`   ⚠ Geen profiel gevonden voor: ${missing.join(", ")} (worden overgeslagen)`);
  }
  if (matched.length === 0) {
    console.error("Geen enkele rol kon aan een profiel gekoppeld worden. Stoppen.");
    process.exit(1);
  }

  console.log("3. Taken analyseren via Claude...");
  const roleResults = [];
  for (const row of matched) {
    process.stdout.write(`   - ${row.rolnaam}... `);
    const taken = await analyzeProfile(row.rolnaam, row.profile.text);
    const result = calculateRole({ ...row, taken });
    roleResults.push(result);
    console.log(`${taken.length} taken`);
  }

  console.log("4. Organisatie-totalen berekenen...");
  const orgTotals = calculateOrganisatie(roleResults);

  console.log("5. Rapport schrijven...");
  fs.mkdirSync(args.out, { recursive: true });
  const textReport = buildTextReport({
    bedrijfsnaam: args.bedrijfsnaam,
    roleResults,
    orgTotals,
    missingProfiles: missing,
  });
  const jsonReport = buildJsonReport({
    bedrijfsnaam: args.bedrijfsnaam,
    roleResults,
    orgTotals,
    missingProfiles: missing,
  });

  fs.writeFileSync(path.join(args.out, "rapport.txt"), textReport, "utf-8");
  fs.writeFileSync(path.join(args.out, "rapport.json"), JSON.stringify(jsonReport, null, 2), "utf-8");

  console.log(`\nKlaar. Rapport geschreven naar ${args.out}/rapport.txt en ${args.out}/rapport.json`);
  console.log("\n" + textReport.split("\n").slice(0, 20).join("\n") + "\n...(zie rapport.txt voor volledige output)");
}

main().catch((err) => {
  console.error("Fout:", err.message);
  process.exit(1);
});
