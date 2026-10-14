import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Een ontbrekende import of een typfout in een functienaam is in JavaScript geen
  // buildfout maar een crash tijdens het draaien — in een analyseroute pas nadat het
  // Claude-werk al gedaan is. De standaardregels van Next vangen dat niet (gemeten: een
  // bestand met een niet-bestaande functieaanroep gaf exit 0). Deze regel wel, en de
  // codebase had er op het moment van aanzetten nul overtredingen van.
  {
    rules: {
      "no-undef": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
