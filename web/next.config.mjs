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
  // Puppeteer spawnt een Chrome-subproces en leest diens stdout voor het
  // WS-endpoint — als Turbopack het bundelt, breekt die stdio-detectie.
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
