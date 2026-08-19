import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // De web-app deelt src/*.js met de CLI in de bovenliggende map — laat
  // Turbopack ook buiten web/ resolven in plaats van de losse .git-map hier
  // als projectgrens te gebruiken.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Puppeteer/chromium spawnen een Chrome-subproces en lezen diens stdout voor het
  // WS-endpoint — als Turbopack/webpack het bundelt, breekt die stdio-detectie.
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  // serverExternalPackages voorkomt bundelen, maar Vercel's file tracing pikt het
  // binaire chromium-bestand van @sparticuz/chromium daardoor niet altijd vanzelf op
  // in de output van de serverless functie — expliciet meenemen. Let op: "*" i.p.v.
  // het letterlijke "[id]" — vierkante haken worden door de glob-matcher gezien als
  // een bracket-expressie, niet als route-segment, dus "[id]" matcht nooit.
  outputFileTracingIncludes: {
    "/api/clients/*/report-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
