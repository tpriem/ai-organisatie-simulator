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
  // Beveiligingsheaders voor elke pagina en elke API-aanroep. Geen volledige Content-Security-Policy:
  // die vraagt per script een uitzondering en breekt snel iets; wel het verbod om de site in een frame
  // te laden (clickjacking), geen gokken naar bestandstypes, en altijd https.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/clients/*/report-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
